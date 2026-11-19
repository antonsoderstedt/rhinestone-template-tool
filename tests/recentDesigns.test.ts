import { describe, expect, it } from 'vitest';
import { createTemplateLibraryEntry } from '../src/lib/rhinestone-engine/templateLibrary/model';
import type { TemplateLibraryEntry } from '../src/lib/rhinestone-engine/index';
import type { HtvDesignEntry } from '../app/lib/workspaceVault';
import { buildRecentDesigns } from '../app/lib/recentDesigns';
import { sanitizePreviewRef } from '../app/lib/workspaceBackup';

const SVG_REF = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E';

function rhinestone(id: string, updatedAt: string, previewRef: string | null = SVG_REF, stoneCount = 120): TemplateLibraryEntry {
  return createTemplateLibraryEntry({
    templateId: id, name: `Design ${id}`, category: 'text', tags: [], builtIn: false, readOnly: false, favorite: false,
    previewRef, widthMm: 50, heightMm: 20, stoneCount, stoneSizes: ['SS10'], colorLayerCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt,
    snapshot: { schemaVersion: 1, savedAt: updatedAt, projectName: id, generatorState: { generatorId: 'manual-editor', stones: [], includeGuideBox: true, paddingMm: 5 }, activeTool: 'manual' },
  });
}
function htv(id: string, updatedAt: string, archived = false): HtvDesignEntry {
  return {
    designId: id, name: `HTV ${id}`, tags: [], favorite: false, archived, createdAt: '2026-01-01T00:00:00.000Z', updatedAt,
    previewText: 'Team', layerCount: 2, garmentLabel: 'Tee',
    snapshot: { projectName: id, layers: [], selectedLayerIds: [], canvas: {} as HtvDesignEntry['snapshot']['canvas'], garment: {} as HtvDesignEntry['snapshot']['garment'], history: { past: [], future: [] } },
  };
}

describe('buildRecentDesigns', () => {
  it('mixes both studios, newest first, and caps the list', () => {
    const list = buildRecentDesigns({
      rhinestoneDesigns: [rhinestone('a', '2026-03-01T00:00:00.000Z'), rhinestone('b', '2026-05-01T00:00:00.000Z')],
      htvDesigns: [htv('x', '2026-04-01T00:00:00.000Z'), htv('y', '2026-06-01T00:00:00.000Z')],
    }, 3);
    expect(list.map((d) => d.key)).toEqual(['htv:y', 'rhinestone:b', 'htv:x']);
  });

  it('links each design to the studio that opens it', () => {
    const [first, second] = buildRecentDesigns({
      rhinestoneDesigns: [rhinestone('a b', '2026-03-01T00:00:00.000Z')],
      htvDesigns: [htv('x', '2026-04-01T00:00:00.000Z')],
    });
    expect(first!.href).toBe('/htv?designId=x');
    expect(second!.href).toBe('/rhinestone?designId=a%20b');
  });

  it('leaves out archived designs', () => {
    const list = buildRecentDesigns({
      rhinestoneDesigns: [rhinestone('a', '2026-03-01T00:00:00.000Z'), rhinestone('b', '2026-04-01T00:00:00.000Z')],
      htvDesigns: [htv('x', '2026-05-01T00:00:00.000Z', true)],
      archivedKeys: new Set(['rhinestone:b']),
    });
    expect(list.map((d) => d.key)).toEqual(['rhinestone:a']);
  });

  it('shows a picture for rhinestone designs and text for HTV designs, with readable details', () => {
    const list = buildRecentDesigns({
      rhinestoneDesigns: [rhinestone('a', '2026-03-01T00:00:00.000Z', SVG_REF, 1200)],
      htvDesigns: [htv('x', '2026-02-01T00:00:00.000Z')],
    });
    expect(list[0]!.thumbnail).toBe(SVG_REF);
    expect(list[0]!.details).toBe('1,200 stones · SS10');
    expect(list[1]!.thumbnail).toBeNull();
    expect(list[1]!.placeholderText).toBe('Team');
    expect(list[1]!.details).toBe('2 layers · Tee');
  });

  it('only ever uses local images as thumbnails, never a web address', () => {
    expect(sanitizePreviewRef('https://tracker.example/pixel.png')).toBeNull();
    expect(sanitizePreviewRef('javascript:alert(1)')).toBeNull();
    expect(sanitizePreviewRef(null)).toBeNull();
    expect(sanitizePreviewRef(SVG_REF)).toBe(SVG_REF);
    const [only] = buildRecentDesigns({ rhinestoneDesigns: [rhinestone('a', '2026-03-01T00:00:00.000Z', 'https://tracker.example/pixel.png')], htvDesigns: [] });
    expect(only!.thumbnail).toBeNull();
  });

  it('is deterministic and handles an empty workspace', () => {
    const input = { rhinestoneDesigns: [rhinestone('a', '2026-03-01T00:00:00.000Z'), rhinestone('b', '2026-03-01T00:00:00.000Z')], htvDesigns: [] };
    expect(buildRecentDesigns(input)).toEqual(buildRecentDesigns(input));
    expect(buildRecentDesigns({ rhinestoneDesigns: [], htvDesigns: [] })).toEqual([]);
  });
});
