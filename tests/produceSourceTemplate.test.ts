import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_EDITOR_STATE, type EditorState } from '../app/editor/EditorState';
import { SKIP_GENERATION, produceSourceTemplate, replaceOutlineFontStatus, type OutlineFontStatusState } from '../app/editor/generation/produceSourceTemplate';

/** The generation of stones for the active source tool, with the checks that keep an outdated request from changing anything (ADR 0070). */
function run(state: EditorState, over: { requestId?: number; latest?: number } = {}) {
  const dispatch = vi.fn();
  const setOutlineFontStatus = vi.fn();
  const setArtworkInfo = vi.fn();
  const promise = produceSourceTemplate({
    state,
    sourceTool: state.activeTool === 'select' ? 'text' : (state.activeTool as never),
    gridTool: state.gridTool,
    textTool: state.textTool,
    svgTool: state.svgTool,
    requestId: over.requestId ?? 1,
    currentRequestId: () => over.latest ?? over.requestId ?? 1,
    setOutlineFontStatus,
    setArtworkInfo,
    dispatch,
  });
  return { promise, dispatch, setOutlineFontStatus, setArtworkInfo };
}

const withTool = (tool: EditorState['activeTool'], patch: Partial<EditorState> = {}): EditorState => ({ ...DEFAULT_EDITOR_STATE, activeTool: tool, ...patch });

describe('produceSourceTemplate', () => {
  it('makes a grid of stones', async () => {
    const result = await run(withTool('grid')).promise;
    expect(result).not.toBe(SKIP_GENERATION);
    if (result !== SKIP_GENERATION) expect(result.template?.stones.length).toBeGreaterThan(0);
  });

  it('makes outline text with the built-in font, and says nothing is loading', async () => {
    const state = withTool('text', { textTool: { ...DEFAULT_EDITOR_STATE.textTool, mode: 'outline', text: 'HI', fontId: 'legacy-original' } });
    const { promise, setOutlineFontStatus } = run(state);
    const result = await promise;
    expect(result).not.toBe(SKIP_GENERATION);
    if (result !== SKIP_GENERATION) expect(result.template?.stones.length).toBeGreaterThan(0);
    // a built-in font needs no loading: the status is set to idle, never to loading
    const updates = setOutlineFontStatus.mock.calls.map(([update]) => (typeof update === 'function' ? update({ status: 'loading', message: 'x', fontId: 'a' }) : update)) as OutlineFontStatusState[];
    expect(updates.every((u) => u.status === 'idle')).toBe(true);
  });

  it('gives up when a newer request has started while this one was waiting', async () => {
    const state = withTool('text', { textTool: { ...DEFAULT_EDITOR_STATE.textTool, mode: 'outline', text: 'HI', fontId: 'legacy-original' } });
    const { promise, setOutlineFontStatus, dispatch } = run(state, { requestId: 1, latest: 2 });
    expect(await promise).toBe(SKIP_GENERATION);
    // an outdated request reports nothing: not a status, not a warning
    expect(setOutlineFontStatus).toHaveBeenCalledTimes(1); // only the "idle/loading" start, before the wait
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips a source tool with no text, and a tool that makes no stones', async () => {
    expect(await run(withTool('rhinestone-font', { rhinestoneFontTool: { ...DEFAULT_EDITOR_STATE.rhinestoneFontTool, text: '   ' } })).promise).toBe(SKIP_GENERATION);
    expect(await run(withTool('svg-alphabet', { svgAlphabetTool: { ...DEFAULT_EDITOR_STATE.svgAlphabetTool, text: '' } })).promise).toBe(SKIP_GENERATION);
    expect(await run(withTool('letter-stencil', { letterStencilTool: { ...DEFAULT_EDITOR_STATE.letterStencilTool, text: '' } })).promise).toBe(SKIP_GENERATION);
    expect(await run(withTool('manual')).promise).toBe(SKIP_GENERATION);
  });

  it('returns no template, not a skip, for text that is empty', async () => {
    const state = withTool('text', { textTool: { ...DEFAULT_EDITOR_STATE.textTool, text: '  ' } });
    expect(await run(state).promise).toEqual({ template: null });
  });

  it('keeps the same status object when nothing changed, so React skips the render', () => {
    const current: OutlineFontStatusState = { status: 'idle', message: null, fontId: 'a' };
    expect(replaceOutlineFontStatus({ ...current })(current)).toBe(current);
    expect(replaceOutlineFontStatus({ status: 'error', message: 'x', fontId: 'a' })(current).status).toBe('error');
  });
});
