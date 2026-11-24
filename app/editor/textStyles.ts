/**
 * The Text tool's style gallery: which looks the user can pick for their words, and what picking one does.
 *
 * "Text" used to be two tools (Text and Stone Font) that made text in different ways without saying how they differed.
 * Now there is one place to go, and the choice is a look: letters traced with stones, dots, or a font that already has
 * its stones placed. Picking a look carries the words over, so nothing has to be typed twice.
 *
 * Pure: no React, no DOM.
 */

import { getPreferredRhinestoneFontStoneSize, listOutlineFonts, listRhinestoneFonts, listSvgAlphabets, getSvgAlphabetDefinition } from '@/src/lib/rhinestone-engine/index';
import type { EditorAction, EditorState } from './EditorState';

export type TextStyleChoice =
  | { kind: 'outline'; fontId: string }
  | { kind: 'dots' }
  | { kind: 'stone-font'; fontId: string }
  | { kind: 'alphabet'; alphabetId: string };

export interface TextStyleOption {
  choice: TextStyleChoice;
  /** A stable key for lists and tests. */
  key: string;
  label: string;
  /** One short line saying what the look is. */
  note: string;
}

export interface TextStyleGroup {
  id: 'traced' | 'ready-made' | 'alphabets';
  title: string;
  description: string;
  options: TextStyleOption[];
}

/** The fonts that are offered. The test fixture is for the test suite and has no font file in the browser. */
export function listStoneFontsForUsers() {
  return listRhinestoneFonts().filter((font) => font.fontId !== 'test-fixture');
}

export function listTextStyleGroups(): TextStyleGroup[] {
  const traced: TextStyleOption[] = listOutlineFonts().map((font) => ({
    choice: { kind: 'outline', fontId: font.fontId },
    key: `outline:${font.fontId}`,
    label: font.displayName,
    note: font.category,
  }));
  traced.push({
    choice: { kind: 'dots' },
    key: 'dots',
    label: 'Dot matrix',
    note: 'Dots on a grid',
  });
  const readyMade: TextStyleOption[] = listStoneFontsForUsers().map((font) => ({
    choice: { kind: 'stone-font', fontId: font.fontId },
    key: `stone-font:${font.fontId}`,
    label: font.displayName,
    note: font.style,
  }));
  const alphabets: TextStyleOption[] = listSvgAlphabets().map((alphabet) => ({
    choice: { kind: 'alphabet', alphabetId: alphabet.alphabetId },
    key: `alphabet:${alphabet.alphabetId}`,
    label: alphabet.displayName,
    note: alphabet.style,
  }));
  return [
    {
      id: 'traced',
      title: 'Letters traced with stones',
      description: 'The stones follow the shape of the letters. Any size.',
      options: traced,
    },
    {
      id: 'ready-made',
      title: 'Fonts with stones already placed',
      description: 'Each letter comes with its stones. The size is fixed by the font.',
      options: readyMade,
    },
    {
      id: 'alphabets',
      title: 'Letters drawn one by one',
      description: 'Every letter is a separate drawing of stones, joined to spell your words.',
      options: alphabets,
    },
  ];
}

/** The look the editor is using right now, or null when the active tool does not make text. */
export function currentTextStyle(state: TextStyleState): TextStyleChoice | null {
  if (state.activeTool === 'svg-alphabet') return { kind: 'alphabet', alphabetId: state.svgAlphabetTool.svgAlphabetId };
  if (state.activeTool === 'rhinestone-font') return { kind: 'stone-font', fontId: state.rhinestoneFontTool.rhinestoneFontId };
  if (state.activeTool === 'text') {
    return state.textTool.mode === 'dot-matrix' ? { kind: 'dots' } : { kind: 'outline', fontId: state.textTool.fontId };
  }
  return null;
}

export type TextStyleState = Pick<EditorState, 'activeTool' | 'textTool' | 'rhinestoneFontTool' | 'svgAlphabetTool'>;

export const isSameTextStyle = (a: TextStyleChoice | null, b: TextStyleChoice): boolean => {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'dots') return true;
  if (a.kind === 'alphabet') return b.kind === 'alphabet' && a.alphabetId === b.alphabetId;
  return b.kind !== 'dots' && b.kind !== 'alphabet' && a.fontId === b.fontId;
};

/** The words in whichever text tool is in use, so a change of look keeps them. */
export function currentWords(state: TextStyleState): string {
  if (state.activeTool === 'svg-alphabet') return state.svgAlphabetTool.text;
  return state.activeTool === 'rhinestone-font' ? state.rhinestoneFontTool.text : state.textTool.text;
}

/** What to dispatch to switch to a look, carrying the words over. */
export function actionsForTextStyle(
  state: TextStyleState,
  choice: TextStyleChoice,
): EditorAction[] {
  const text = currentWords(state);
  if (choice.kind === 'stone-font') {
    const sameFont = state.rhinestoneFontTool.rhinestoneFontId === choice.fontId;
    return [
      { type: 'SET_ACTIVE_TOOL', tool: 'rhinestone-font' },
      {
        type: 'UPDATE_RHINESTONE_FONT_TOOL',
        updates: {
          text,
          rhinestoneFontId: choice.fontId,
          ...(sameFont ? {} : { stoneSize: getPreferredRhinestoneFontStoneSize(choice.fontId) }),
        },
      },
    ];
  }
  if (choice.kind === 'alphabet') {
    const sameAlphabet = state.svgAlphabetTool.svgAlphabetId === choice.alphabetId;
    const definition = getSvgAlphabetDefinition(choice.alphabetId as never);
    return [
      { type: 'SET_ACTIVE_TOOL', tool: 'svg-alphabet' },
      {
        type: 'UPDATE_SVG_ALPHABET_TOOL',
        updates: {
          text,
          svgAlphabetId: choice.alphabetId,
          ...(sameAlphabet ? {} : { stoneSize: definition.supportedTargetStoneSizeIds[0] ?? 'SS10' }),
        },
      },
    ];
  }
  if (choice.kind === 'dots') {
    return [
      { type: 'SET_ACTIVE_TOOL', tool: 'text' },
      { type: 'UPDATE_TEXT_TOOL', updates: { text, mode: 'dot-matrix' } },
    ];
  }
  return [
    { type: 'SET_ACTIVE_TOOL', tool: 'text' },
    { type: 'UPDATE_TEXT_TOOL', updates: { text, mode: 'outline', fontId: choice.fontId } },
  ];
}
