'use client';

/**
 * The length unit the app shows: millimetres or inches. Everything inside is always millimetres (AGENTS.md); this only changes
 * what a person reads and types. The choice is kept in this browser, like the language and theme.
 */

import { useEffect, useState } from 'react';

export type LengthUnit = 'mm' | 'in';
export const MM_PER_INCH = 25.4;

const STORAGE_KEY = 'rt-unit';
const DEFAULT_UNIT: LengthUnit = 'mm';

export function isLengthUnit(value: unknown): value is LengthUnit {
  return value === 'mm' || value === 'in';
}

/** A length in millimetres as text in the unit: `197.3 mm` or `7.77 in`. */
export function formatLength(mm: number, unit: LengthUnit): string {
  return unit === 'in' ? `${(mm / MM_PER_INCH).toFixed(2)} in` : `${mm.toFixed(1)} mm`;
}

/** `197.3×110.0 mm` or `7.77×4.33 in`. */
export function formatSize(widthMm: number, heightMm: number, unit: LengthUnit): string {
  return unit === 'in'
    ? `${(widthMm / MM_PER_INCH).toFixed(2)}×${(heightMm / MM_PER_INCH).toFixed(2)} in`
    : `${widthMm.toFixed(1)}×${heightMm.toFixed(1)} mm`;
}

const listeners = new Set<() => void>();

function readStoredUnit(): LengthUnit {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLengthUnit(stored) ? stored : DEFAULT_UNIT;
  } catch {
    return DEFAULT_UNIT;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function setUnit(next: LengthUnit): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage disabled: lasts until the page is closed
  }
  listeners.forEach((notify) => notify());
}

/** The first render is the default (as on the server); the saved choice is read right after, so hydration always matches. */
export function useUnit(): LengthUnit {
  const [unit, setUnitState] = useState<LengthUnit>(DEFAULT_UNIT);
  useEffect(() => {
    const sync = () => setUnitState(readStoredUnit());
    queueMicrotask(sync);
    return subscribe(sync);
  }, []);
  return unit;
}
