import { describe, expect, it } from 'vitest';
import {
  HTV_SHORTCUT_GROUPS,
  RHINESTONE_NUDGE_SHIFT_STEP_MM,
  RHINESTONE_NUDGE_STEP_MM,
  RHINESTONE_SHORTCUT_GROUPS,
  isActivatableControl,
  isKeyHandlingWidget,
  isModalOpen,
  nudgeCenters,
  resolveStudioShortcut,
  type ShortcutOptions,
} from '../app/lib/studioShortcuts';

const RH: ShortcutOptions = { tools: true, nudgeStepMm: RHINESTONE_NUDGE_STEP_MM, nudgeShiftStepMm: RHINESTONE_NUDGE_SHIFT_STEP_MM };
const HTV: ShortcutOptions = { tools: false, nudgeStepMm: 1, nudgeShiftStepMm: 10 };
const key = (k: string, extra: object = {}) => ({ key: k, ...extra });

describe('resolveStudioShortcut', () => {
  it('opens help with ?', () => {
    expect(resolveStudioShortcut(key('?', { shiftKey: true }), RH)).toEqual({ type: 'help' });
  });

  it('maps one-key tool shortcuts in the Rhinestone studio only', () => {
    expect(resolveStudioShortcut(key('v'), RH)).toEqual({ type: 'tool', tool: 'select' });
    expect(resolveStudioShortcut(key('A'), RH)).toEqual({ type: 'tool', tool: 'manual' });
    expect(resolveStudioShortcut(key('t'), RH)).toEqual({ type: 'tool', tool: 'text' });
    expect(resolveStudioShortcut(key('g'), RH)).toEqual({ type: 'tool', tool: 'grid' });
    expect(resolveStudioShortcut(key('s'), RH)).toEqual({ type: 'tool', tool: 'svg' });
    expect(resolveStudioShortcut(key('i'), RH)).toEqual({ type: 'tool', tool: 'template-import' });
    expect(resolveStudioShortcut(key('v'), HTV)).toBeNull();
  });

  it('does not treat Ctrl/Cmd/Alt combinations as tool or view keys', () => {
    expect(resolveStudioShortcut(key('a', { ctrlKey: true }), RH)).toBeNull(); // select all is handled elsewhere
    expect(resolveStudioShortcut(key('f', { metaKey: true }), RH)).toBeNull(); // browser find
    expect(resolveStudioShortcut(key('v', { altKey: true }), RH)).toBeNull();
    expect(resolveStudioShortcut(key('0', { ctrlKey: true }), RH)).toBeNull(); // browser zoom reset
  });

  it('save and export need Ctrl or Cmd', () => {
    expect(resolveStudioShortcut(key('s', { ctrlKey: true }), RH)).toEqual({ type: 'save' });
    expect(resolveStudioShortcut(key('e', { metaKey: true }), RH)).toEqual({ type: 'export' });
    expect(resolveStudioShortcut(key('e'), RH)).toBeNull();
    expect(resolveStudioShortcut(key('s', { ctrlKey: true, shiftKey: true }), RH)).toBeNull();
  });

  it('maps view keys', () => {
    expect(resolveStudioShortcut(key('f'), RH)).toEqual({ type: 'fit' });
    expect(resolveStudioShortcut(key('+', { shiftKey: true }), RH)).toEqual({ type: 'zoom-in' });
    expect(resolveStudioShortcut(key('='), RH)).toEqual({ type: 'zoom-in' });
    expect(resolveStudioShortcut(key('-'), RH)).toEqual({ type: 'zoom-out' });
    expect(resolveStudioShortcut(key('0'), RH)).toEqual({ type: 'zoom-reset' });
    expect(resolveStudioShortcut(key('f'), HTV)).toEqual({ type: 'fit' });
  });

  it('nudges with arrows, further with Shift', () => {
    expect(resolveStudioShortcut(key('ArrowLeft'), RH)).toEqual({ type: 'nudge', dx: -1, dy: 0 });
    expect(resolveStudioShortcut(key('ArrowDown', { shiftKey: true }), RH)).toEqual({ type: 'nudge', dx: 0, dy: 5 });
    expect(resolveStudioShortcut(key('ArrowUp', { shiftKey: true }), HTV)).toEqual({ type: 'nudge', dx: 0, dy: -10 });
    expect(resolveStudioShortcut(key('ArrowRight', { ctrlKey: true }), RH)).toBeNull();
  });

  it('ignores unrelated keys', () => {
    expect(resolveStudioShortcut(key('Enter'), RH)).toBeNull();
    expect(resolveStudioShortcut(key('x'), RH)).toBeNull();
    expect(resolveStudioShortcut(key('V', { shiftKey: true }), RH)).toBeNull();
  });
});

describe('nudgeCenters', () => {
  it('moves every item by the same offset without mutating the input', () => {
    const items = [{ id: 'a', x: 1, y: 2 }, { id: 'b', x: 10, y: 20 }];
    expect(nudgeCenters(items, 5, -1)).toEqual([{ id: 'a', toX: 6, toY: 1 }, { id: 'b', toX: 15, toY: 19 }]);
    expect(items[0]).toEqual({ id: 'a', x: 1, y: 2 });
  });
});

describe('target guards', () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, extra: object = {}) =>
    ({ tagName, getAttribute: (name: string) => attrs[name] ?? null, ...extra }) as unknown as EventTarget;

  it('leaves text fields, selects, sliders and tabs alone', () => {
    expect(isKeyHandlingWidget(el('INPUT'))).toBe(true);
    expect(isKeyHandlingWidget(el('TEXTAREA'))).toBe(true);
    expect(isKeyHandlingWidget(el('SELECT'))).toBe(true);
    expect(isKeyHandlingWidget(el('DIV', {}, { isContentEditable: true }))).toBe(true);
    expect(isKeyHandlingWidget(el('BUTTON', { role: 'tab' }))).toBe(true);
    expect(isKeyHandlingWidget(el('DIV', { role: 'slider' }))).toBe(true);
    expect(isKeyHandlingWidget(el('BUTTON'))).toBe(false);
    expect(isKeyHandlingWidget(null)).toBe(false);
  });

  it('recognises controls activated with Space', () => {
    expect(isActivatableControl(el('BUTTON'))).toBe(true);
    expect(isActivatableControl(el('A'))).toBe(true);
    expect(isActivatableControl(el('SUMMARY'))).toBe(true);
    expect(isActivatableControl(el('DIV', { role: 'button' }))).toBe(true);
    expect(isActivatableControl(el('svg'))).toBe(false);
  });

  it('detects an open modal dialog', () => {
    expect(isModalOpen({ querySelector: () => ({}) })).toBe(true);
    expect(isModalOpen({ querySelector: () => null })).toBe(false);
  });
});

describe('shortcut sheet', () => {
  it('has no empty groups and no duplicate descriptions in a studio', () => {
    for (const groups of [RHINESTONE_SHORTCUT_GROUPS, HTV_SHORTCUT_GROUPS]) {
      const descriptions = groups.flatMap((group) => group.items.map((item) => item.description));
      expect(groups.every((group) => group.items.length > 0)).toBe(true);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    }
  });

  it('lists every key the resolver handles', () => {
    const listed = (groups: typeof RHINESTONE_SHORTCUT_GROUPS) =>
      new Set(groups.flatMap((group) => group.items.flatMap((item) => item.keys.flat())));
    const rh = listed(RHINESTONE_SHORTCUT_GROUPS);
    for (const k of ['V', 'A', 'T', 'G', 'S', 'I', 'F', '+', '-', '0', '?', 'Z', 'Y', 'D', 'E']) expect(rh.has(k)).toBe(true);
    const htv = listed(HTV_SHORTCUT_GROUPS);
    for (const k of ['F', '+', '-', '0', '?', 'S', 'E']) expect(htv.has(k)).toBe(true);
    expect(htv.has('V')).toBe(false); // HTV has no tool keys
  });
});
