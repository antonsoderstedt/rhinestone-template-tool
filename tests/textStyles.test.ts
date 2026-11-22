import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE, editorReducer, type EditorAction, type EditorState } from '../app/editor/EditorState';
import {
  actionsForTextStyle,
  currentTextStyle,
  currentWords,
  isSameTextStyle,
  listStoneFontsForUsers,
  listTextStyleGroups,
} from '../app/editor/textStyles';
import { dotMatrixThumbnail, thumbnailText } from '../app/editor/textStyleThumbnails';
import { RAIL_TOOLS, railToolFor } from '../app/editor/editorUi';

const apply = (state: EditorState, actions: EditorAction[]) => actions.reduce(editorReducer, state);
const withText = (text: string): EditorState => ({ ...DEFAULT_EDITOR_STATE, textTool: { ...DEFAULT_EDITOR_STATE.textTool, text } });

describe('text style gallery', () => {
  it('offers traced letters (with dots) and ready-made stone fonts, never the test fixture', () => {
    const groups = listTextStyleGroups();
    expect(groups.map((group) => group.id)).toEqual(['traced', 'ready-made', 'alphabets']);
    const keys = groups.flatMap((group) => group.options.map((option) => option.key));
    expect(keys).toContain('dots');
    expect(keys.some((key) => key.startsWith('outline:'))).toBe(true);
    expect(keys.some((key) => key.startsWith('stone-font:'))).toBe(true);
    expect(keys).not.toContain('stone-font:test-fixture');
    expect(new Set(keys).size).toBe(keys.length);
    expect(groups[1]!.options).toHaveLength(listStoneFontsForUsers().length);
    expect(keys.some((key) => key.startsWith('alphabet:'))).toBe(true);
  });

  it('knows which look is in use', () => {
    const state = withText('Mia');
    expect(currentTextStyle(state)).toEqual({ kind: 'outline', fontId: state.textTool.fontId });
    expect(currentTextStyle({ ...state, textTool: { ...state.textTool, mode: 'dot-matrix' } })).toEqual({ kind: 'dots' });
    expect(currentTextStyle({ ...state, activeTool: 'rhinestone-font' })).toEqual({
      kind: 'stone-font',
      fontId: state.rhinestoneFontTool.rhinestoneFontId,
    });
    expect(currentTextStyle({ ...state, activeTool: 'grid' })).toBeNull();
  });

  it('keeps the words when going from traced letters to a stone font and back', () => {
    const start = withText('Mia Rose');
    const toStone = apply(start, actionsForTextStyle(start, { kind: 'stone-font', fontId: 'blessed-stone' }));
    expect(toStone.activeTool).toBe('rhinestone-font');
    expect(toStone.rhinestoneFontTool.text).toBe('Mia Rose');
    expect(toStone.rhinestoneFontTool.rhinestoneFontId).toBe('blessed-stone');
    expect(currentWords(toStone)).toBe('Mia Rose');

    const edited = editorReducer(toStone, { type: 'UPDATE_RHINESTONE_FONT_TOOL', updates: { text: 'Mia Rose 7' } });
    const back = apply(edited, actionsForTextStyle(edited, { kind: 'outline', fontId: 'archivo-black' }));
    expect(back.activeTool).toBe('text');
    expect(back.textTool.text).toBe('Mia Rose 7');
    expect(back.textTool.mode).toBe('outline');
    expect(back.textTool.fontId).toBe('archivo-black');
  });

  it('switches to dots in the text tool and takes the font size the font was made for', () => {
    const start = withText('Go');
    const dots = apply(start, actionsForTextStyle(start, { kind: 'dots' }));
    expect(dots.activeTool).toBe('text');
    expect(dots.textTool.mode).toBe('dot-matrix');
    expect(dots.textTool.text).toBe('Go');

    const digits = apply(start, actionsForTextStyle(start, { kind: 'stone-font', fontId: 'huge-digits' }));
    expect(digits.rhinestoneFontTool.stoneSize).toBe('SS10');
  });

  it('does not reset a stone size the user chose when picking the same font again', () => {
    const state: EditorState = {
      ...withText('Mia'),
      activeTool: 'rhinestone-font',
      rhinestoneFontTool: { ...DEFAULT_EDITOR_STATE.rhinestoneFontTool, rhinestoneFontId: 'huge-digits', stoneSize: 'SS6' },
    };
    const again = apply(state, actionsForTextStyle(state, { kind: 'stone-font', fontId: 'huge-digits' }));
    expect(again.rhinestoneFontTool.stoneSize).toBe('SS6');
  });

  it('goes to an alphabet and keeps the words, then back to traced letters', () => {
    const start = withText('Mia');
    const toAlphabet = apply(start, actionsForTextStyle(start, { kind: 'alphabet', alphabetId: 'big-bold' }));
    expect(toAlphabet.activeTool).toBe('svg-alphabet');
    expect(toAlphabet.svgAlphabetTool.svgAlphabetId).toBe('big-bold');
    expect(toAlphabet.svgAlphabetTool.text).toBe('Mia');
    expect(currentTextStyle(toAlphabet)).toEqual({ kind: 'alphabet', alphabetId: 'big-bold' });
    expect(currentWords(toAlphabet)).toBe('Mia');
    const edited = editorReducer(toAlphabet, { type: 'UPDATE_SVG_ALPHABET_TOOL', updates: { text: 'Mia R' } });
    const back = apply(edited, actionsForTextStyle(edited, { kind: 'dots' }));
    expect(back.textTool.text).toBe('Mia R');
  });

  it('compares looks', () => {
    expect(isSameTextStyle({ kind: 'dots' }, { kind: 'dots' })).toBe(true);
    expect(isSameTextStyle({ kind: 'outline', fontId: 'a' }, { kind: 'outline', fontId: 'a' })).toBe(true);
    expect(isSameTextStyle({ kind: 'outline', fontId: 'a' }, { kind: 'stone-font', fontId: 'a' })).toBe(false);
    expect(isSameTextStyle(null, { kind: 'dots' })).toBe(false);
    expect(isSameTextStyle({ kind: 'alphabet', alphabetId: 'x' }, { kind: 'alphabet', alphabetId: 'x' })).toBe(true);
    expect(isSameTextStyle({ kind: 'alphabet', alphabetId: 'x' }, { kind: 'stone-font', fontId: 'x' })).toBe(false);
  });
});

describe('text style thumbnails', () => {
  it('shows one short line of the words, or the fallback', () => {
    expect(thumbnailText('  Mia Rose is my name\nsecond', 'x')).toBe('Mia Rose i');
    expect(thumbnailText('\n  \n', 'Sample')).toBe('Sample');
  });

  it('draws the dot-matrix look with real stone positions', () => {
    const thumbnail = dotMatrixThumbnail('Hi');
    expect(thumbnail).not.toBeNull();
    expect(thumbnail!.dots.length).toBeGreaterThan(10);
    expect(thumbnail!.viewBox.width).toBeGreaterThan(0);
    expect(thumbnail!.isSample).toBe(false);
  });
});

describe('tool rail', () => {
  it('has no button of its own for stone fonts, and Text stands for them', () => {
    expect(RAIL_TOOLS.some((tool) => tool.id === 'rhinestone-font' || tool.id === 'svg-alphabet')).toBe(false);
    expect(railToolFor('svg-alphabet')).toBe('text');
    expect(railToolFor('rhinestone-font')).toBe('text');
    expect(railToolFor('grid')).toBe('grid');
  });
});
