import { useState } from 'react';

/**
 * Deep equality for the plain data (primitives, arrays, plain objects) the editor keeps in state.
 * Not a general-purpose `isEqual`: Dates, Maps, Sets and class instances compare by identity.
 */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const left = a as unknown[];
    const right = b as unknown[];
    return left.length === right.length && left.every((item, index) => structurallyEqual(item, right[index]));
  }

  const leftProto = Object.getPrototypeOf(a);
  if (leftProto !== Object.prototype && leftProto !== null) return false;
  if (Object.getPrototypeOf(b) !== leftProto) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && structurallyEqual(left[key], right[key]));
}

/**
 * Returns the previous reference while `value` is structurally unchanged.
 *
 * Use it for effect dependencies that are state slices. React rebuilds a reducer's state from its
 * base state on every render while an earlier update is still waiting for its lane (for example an
 * update dispatched while the tree was hidden under Suspense). A reducer that spreads a slice then
 * hands out a new object for the same content on every render, and an effect keyed on that object
 * re-runs, sets state and renders again — forever. Keying the effect on content instead of
 * identity makes it run once per real change.
 */
export function useStableValue<T>(value: T): T {
  const [stable, setStable] = useState(value);
  if (stable === value || structurallyEqual(stable, value)) return stable;
  // Storing a derived value during render is the documented way to react to a prop/state change;
  // React re-renders straight away with the new reference.
  setStable(value);
  return value;
}
