import type { PapercraftDraft } from './papercraftDraft';
import { deserializePapercraft } from './papercraftSnapshot';
import { initialPapercraftState, type PapercraftState } from './papercraftState';
import type { WorkspaceVault } from '../lib/workspaceVault';

export interface PapercraftBoot {
  state: PapercraftState;
  /** The saved design the studio opened with (it is that design, or a draft of it), if any. */
  activeId: string | null;
  /** Why the studio opened as it did, for a message. */
  from: 'design' | 'draft' | 'new' | 'missing-design';
}

/**
 * What the studio opens with: the saved design named in the address (`?designId=`), else the work in progress from the last visit,
 * else the test cube. A draft that was a saved design is still that design only while the design exists.
 */
export function bootPapercraft(search: string, vault: Pick<WorkspaceVault, 'papercraftDesigns'>, draft: PapercraftDraft | null): PapercraftBoot {
  const wanted = new URLSearchParams(search).get('designId');
  if (wanted) {
    const entry = vault.papercraftDesigns.find((d) => d.designId === wanted);
    const state = entry ? deserializePapercraft(entry.snapshot) : null;
    if (entry && state) return { state, activeId: entry.designId, from: 'design' };
    return { state: initialPapercraftState(), activeId: null, from: 'missing-design' };
  }
  if (draft) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(draft.snapshotText);
    } catch {
      parsed = null;
    }
    const state = deserializePapercraft(parsed);
    if (state) {
      const stillSaved = draft.activeId !== null && vault.papercraftDesigns.some((d) => d.designId === draft.activeId);
      return { state, activeId: stillSaved ? draft.activeId : null, from: 'draft' };
    }
  }
  return { state: initialPapercraftState(), activeId: null, from: 'new' };
}
