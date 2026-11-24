/**
 * Keyboard shortcuts shared by the Rhinestone and HTV studios.
 *
 * `resolveStudioShortcut` maps a key press to an action and is pure, so it can be
 * tested without a DOM. The shells decide what each action does. Shortcuts that
 * already existed (undo/redo, copy/paste, delete, select all, duplicate, Esc) are
 * handled where they always were; they are listed here so the shortcuts sheet is
 * the one complete reference.
 */

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export type StudioToolShortcut = 'select' | 'manual' | 'text' | 'grid' | 'svg' | 'template-import';

export type StudioShortcut =
  | { type: 'help' }
  | { type: 'tool'; tool: StudioToolShortcut }
  | { type: 'fit' }
  | { type: 'zoom-in' }
  | { type: 'zoom-out' }
  | { type: 'zoom-reset' }
  | { type: 'export' }
  | { type: 'save' }
  | { type: 'nudge'; dx: number; dy: number };

export interface ShortcutOptions {
  /** The Rhinestone studio has source tools with one-key shortcuts; HTV does not. */
  tools: boolean;
  /** Arrow-key nudge distance in mm, and with Shift held. */
  nudgeStepMm: number;
  nudgeShiftStepMm: number;
}

export const RHINESTONE_NUDGE_STEP_MM = 1;
export const RHINESTONE_NUDGE_SHIFT_STEP_MM = 5;

const TOOL_KEYS: Record<string, StudioToolShortcut> = {
  v: 'select',
  a: 'manual',
  t: 'text',
  g: 'grid',
  s: 'svg',
  i: 'template-import',
};

export function resolveStudioShortcut(event: KeyLike, options: ShortcutOptions): StudioShortcut | null {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  const key = event.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod) {
    if (event.altKey || event.shiftKey) return null;
    if (lower === 'e') return { type: 'export' };
    if (lower === 's') return { type: 'save' };
    return null;
  }
  if (event.altKey) return null;

  if (key === '?') return { type: 'help' };

  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
    const step = event.shiftKey ? options.nudgeShiftStepMm : options.nudgeStepMm;
    return {
      type: 'nudge',
      dx: key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0,
      dy: key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0,
    };
  }

  if (key === '+' || key === '=') return { type: 'zoom-in' };
  if (key === '-' || key === '_') return { type: 'zoom-out' };
  if (key === '0') return { type: 'zoom-reset' };

  if (event.shiftKey) return null;
  if (lower === 'f') return { type: 'fit' };
  if (options.tools && lower in TOOL_KEYS) return { type: 'tool', tool: TOOL_KEYS[lower]! };
  return null;
}

/** New centres for items moved by (dx, dy) mm. Pure; the caller dispatches the result. */
export function nudgeCenters(
  items: ReadonlyArray<{ id: string; x: number; y: number }>,
  dx: number,
  dy: number,
): Array<{ id: string; toX: number; toY: number }> {
  return items.map((item) => ({ id: item.id, toX: item.x + dx, toY: item.y + dy }));
}

// ─── Where shortcuts must not fire ────────────────────────────────────────────

const WIDGET_ROLES = new Set(['slider', 'tab', 'radio', 'listbox', 'option', 'menu', 'menuitem', 'combobox', 'spinbutton', 'tree', 'treeitem', 'grid', 'gridcell']);

interface ElementLike {
  tagName?: unknown;
  isContentEditable?: unknown;
  getAttribute?: (name: string) => string | null;
}

/**
 * True for controls that use the same keys themselves (text fields, sliders, tabs, menus,
 * radio groups…), so a shortcut must leave them alone.
 */
export function isKeyHandlingWidget(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const element = target as ElementLike;
  const tag = typeof element.tagName === 'string' ? element.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true) return true;
  const role = element.getAttribute?.('role');
  return Boolean(role && WIDGET_ROLES.has(role));
}

/** Buttons, links and summaries are activated with Space/Enter; those keys must reach them. */
export function isActivatableControl(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const element = target as ElementLike;
  const tag = typeof element.tagName === 'string' ? element.tagName : '';
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  return element.getAttribute?.('role') === 'button';
}

/** Shortcuts stay quiet while a dialog is open. */
export function isModalOpen(doc: { querySelector(selector: string): unknown } = document): boolean {
  return doc.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

// ─── The shortcuts sheet ──────────────────────────────────────────────────────

export interface ShortcutItem {
  /** Alternative key combinations; each combination is a list of keys pressed together. */
  keys: string[][];
  description: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

const MOD = 'Ctrl/⌘';

const EDIT_GROUP_COMMON: ShortcutItem[] = [
  { keys: [[MOD, 'Z']], description: 'Undo' },
  { keys: [[MOD, 'Shift', 'Z'], [MOD, 'Y']], description: 'Redo' },
  { keys: [[MOD, 'A']], description: 'Select all' },
  { keys: [[MOD, 'D']], description: 'Duplicate selection' },
  { keys: [['Delete'], ['Backspace']], description: 'Delete selection' },
  { keys: [['Esc']], description: 'Clear selection' },
];

const VIEW_GROUP: ShortcutItem[] = [
  { keys: [['F']], description: 'Fit the design to the view' },
  { keys: [['+'], ['-']], description: 'Zoom in / out' },
  { keys: [['0']], description: 'Reset zoom to 100%' },
  { keys: [[MOD, 'Scroll']], description: 'Zoom with the mouse wheel' },
];

const FILE_GROUP: ShortcutItem[] = [
  { keys: [[MOD, 'S']], description: 'Save to My Designs' },
  { keys: [[MOD, 'E']], description: 'Export' },
  { keys: [['?']], description: 'Show this list' },
];

export const RHINESTONE_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    items: [
      { keys: [['V']], description: 'Select' },
      { keys: [['A']], description: 'Add stones' },
      { keys: [['T']], description: 'Text' },
      { keys: [['G']], description: 'Grid' },
      { keys: [['S']], description: 'SVG artwork' },
      { keys: [['I']], description: 'Import a template' },
    ],
  },
  {
    title: 'Edit',
    items: [
      ...EDIT_GROUP_COMMON,
      { keys: [[MOD, 'C'], [MOD, 'V']], description: 'Copy / paste stones' },
      { keys: [['Arrow keys']], description: `Nudge selected stones ${RHINESTONE_NUDGE_STEP_MM} mm` },
      { keys: [['Shift', 'Arrow keys']], description: `Nudge ${RHINESTONE_NUDGE_SHIFT_STEP_MM} mm` },
    ],
  },
  {
    title: 'View',
    items: [...VIEW_GROUP, { keys: [['Space', 'Drag']], description: 'Pan the canvas (hold Space)' }],
  },
  { title: 'File', items: FILE_GROUP },
];

export const HTV_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Edit',
    items: [
      ...EDIT_GROUP_COMMON,
      { keys: [['Arrow keys']], description: 'Nudge selected layers 1 mm' },
      { keys: [['Shift', 'Arrow keys']], description: 'Nudge 10 mm' },
    ],
  },
  { title: 'View', items: VIEW_GROUP },
  { title: 'File', items: FILE_GROUP },
];
