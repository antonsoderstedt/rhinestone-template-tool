import { describe, expect, it } from 'vitest';
import { catalogModelFile, catalogModels, searchCatalogModels } from '../app/papercraft/papercraftCatalog';
import type { CatalogTemplate } from '../app/lib/catalog/catalogClient';

const make = (over: Partial<CatalogTemplate> & { id: string }): CatalogTemplate => ({
  studio: 'papercraft', format: 'obj', name: over.id, description: '', category: '', tags: [], licence: '', fields: {}, published: true, createdAt: '', updatedAt: '',
  file: { name: `${over.id}.obj`, type: 'model/obj', chars: 10 }, preview: null, ...over,
});

describe('Papercraft catalog models', () => {
  it('keeps the published Papercraft templates that have a model file', () => {
    const all = [
      make({ id: 'ok' }),
      make({ id: 'glb', file: { name: 'a.GLB', type: '', chars: 1 } }),
      make({ id: 'draft', published: false }),
      make({ id: 'nofile', file: null }),
      make({ id: 'pdf', file: { name: 'a.pdf', type: '', chars: 1 } }),
      make({ id: 'htv', studio: 'htv' }),
    ];
    expect(catalogModels(all).map((t) => t.id)).toEqual(['ok', 'glb']);
  });

  it('searches name, category, tags and description, ignoring case', () => {
    const models = [make({ id: 'a', name: 'Bear', category: 'Animals' }), make({ id: 'b', name: 'Box', tags: ['gift'] }), make({ id: 'c', name: 'Cat', description: 'sleeping' })];
    expect(searchCatalogModels(models, ' BEAR ').map((t) => t.id)).toEqual(['a']);
    expect(searchCatalogModels(models, 'gift').map((t) => t.id)).toEqual(['b']);
    expect(searchCatalogModels(models, 'sleep').map((t) => t.id)).toEqual(['c']);
    expect(searchCatalogModels(models, '')).toHaveLength(3);
  });

  it('turns the stored file into a File with its name, and returns null when it cannot be fetched', async () => {
    const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
    const file = await catalogModelFile(make({ id: 'ok', file: { name: 'ok.obj', type: 'model/obj', chars: obj.length } }), (async () => new Response(obj)) as unknown as typeof fetch);
    expect(file?.name).toBe('ok.obj');
    expect(await file!.text()).toBe(obj);
    expect(await catalogModelFile(make({ id: 'ok' }), (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).toBeNull();
  });

  it('decodes a binary model (GLB) from base64', async () => {
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
    const file = await catalogModelFile(make({ id: 'g', format: 'glb', file: { name: 'g.glb', type: '', chars: 12 } }), (async () => new Response(btoa(String.fromCharCode(...bytes)))) as unknown as typeof fetch);
    expect(Array.from(new Uint8Array(await file!.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});
