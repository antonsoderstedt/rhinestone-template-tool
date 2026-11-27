import type { TabOptions } from '@/src/lib/papercraft-engine';

export type DrawTool = 'select' | 'polygon' | 'rect' | 'ngon' | 'fold' | 'tab' | 'number';

export interface ToolOptions {
  /** The sides of the regular polygon (many sides make a circle). */
  sides: number;
  foldKind: 'mountain' | 'valley';
  /** The outline tool: what it draws (a cut, or a mountain or valley fold line), whether the line is a smooth curve through the points, and whether a cut is left open. */
  outlineKind: 'cut' | 'mountain' | 'valley';
  smooth: boolean;
  leaveOpen: boolean;
  tab: TabOptions;
  /** The number the number tool puts down, and how tall it is. It counts up by one after each. */
  numberText: string;
  numberHeightMm: number;
  /** Corners snap to this grid in millimetres (0 is off); they always snap to the corners of other shapes. */
  gridMm: number;
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  sides: 6,
  foldKind: 'valley',
  outlineKind: 'cut',
  smooth: false,
  leaveOpen: false,
  tab: { widthMm: 8, angleDeg: 45 },
  numberText: '1',
  numberHeightMm: 5,
  gridMm: 5,
};

/** The text that follows a number: `7` is `8`; a text that is not a plain whole number stays. */
export function nextNumberText(text: string): string {
  return /^\d{1,9}$/.test(text) ? String(Number(text) + 1) : text;
}
