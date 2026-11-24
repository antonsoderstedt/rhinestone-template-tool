import { describe, expect, it } from 'vitest';
import { MAX_PREVIOUS_SESSIONS, isPreviousSessionCopy, planPreviousSessionKeep } from '../app/editor/previousSession';
import type { TemplateLibraryEntry } from '../src/lib/rhinestone-engine/index';

const entry = (over: Partial<TemplateLibraryEntry> & { design?: string; projectName?: string }): TemplateLibraryEntry =>
  ({
    templateId: over.templateId ?? 'x',
    name: over.name ?? 'Design',
    category: 'text',
    tags: [],
    builtIn: false,
    readOnly: false,
    favorite: false,
    previewRef: null,
    widthMm: 100,
    heightMm: 50,
    stoneCount: over.stoneCount ?? 120,
    stoneSizes: ['SS10'],
    colorLayerCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: over.updatedAt ?? '2026-01-01T00:00:00Z',
    snapshot: { version: 1, project: { projectName: over.projectName ?? 'n', design: over.design ?? 'A' } as never },
  }) as TemplateLibraryEntry;

describe('keeping the previous session', () => {
  it('does not keep an empty session', () => {
    expect(planPreviousSessionKeep(entry({ stoneCount: 0 }), [])).toEqual({ keep: false, reason: 'empty', prune: [] });
  });

  it('does not make a second copy of a design that is already saved, whatever it is called', () => {
    const saved = entry({ templateId: 'a', name: 'Mia design', design: 'MIA', projectName: 'Mia design' });
    const previous = entry({ templateId: 'autosave', name: 'Untitled (Autosave)', design: 'MIA', projectName: 'Untitled' });
    expect(planPreviousSessionKeep(previous, [saved]).reason).toBe('already-saved');
    expect(planPreviousSessionKeep(entry({ design: 'OTHER' }), [saved]).keep).toBe(true);
  });

  it('keeps at most a few copies and prunes the oldest', () => {
    const copies = Array.from({ length: 5 }, (_, i) =>
      entry({ templateId: `previous-session-2026-01-0${i + 1}`, name: `Old ${i} (previous session)`, updatedAt: `2026-01-0${i + 1}T00:00:00Z`, design: `D${i}` }),
    );
    const plan = planPreviousSessionKeep(entry({ design: 'NEW' }), copies);
    expect(plan.keep).toBe(true);
    // The three newest of five would leave four with the new one, so only the two newest stay.
    expect(plan.prune.sort()).toEqual(['previous-session-2026-01-01', 'previous-session-2026-01-02', 'previous-session-2026-01-03']);
    expect(copies.length - plan.prune.length + 1).toBe(MAX_PREVIOUS_SESSIONS);
  });

  it('recognises its own copies and nothing else', () => {
    expect(isPreviousSessionCopy({ templateId: 'previous-session-1', name: 'A (previous session)' })).toBe(true);
    expect(isPreviousSessionCopy({ templateId: 'library-1', name: 'A (previous session)' })).toBe(false);
  });
});
