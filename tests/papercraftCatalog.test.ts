import { describe, expect, it } from 'vitest';
import { catalogDesignState, catalogModelFile, catalogModels, entryKindOf, saveDesignAsTemplate, searchCatalogModels, uniqueTemplateId } from '../app/papercraft/papercraftCatalog';
import { initialPapercraftState } from '../app/papercraft/papercraftState';
import { deserializePapercraft, serializePapercraft } from '../app/papercraft/papercraftSnapshot';
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
      make({ id: 'design', format: 'json', file: { name: 'a.json', type: '', chars: 1 } }),
      make({ id: 'draft', published: false }),
      make({ id: 'nofile', file: null }),
      make({ id: 'pdf', file: { name: 'a.pdf', type: '', chars: 1 } }),
      make({ id: 'htv', studio: 'htv' }),
    ];
    expect(catalogModels(all).map((t) => t.id)).toEqual(['ok', 'glb', 'design']);
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

describe('saved templates', () => {
  it('knows a model file from a saved design', () => {
    expect(entryKindOf({ file: { name: 'a.obj', type: '', chars: 1 } })).toBe('model');
    expect(entryKindOf({ file: { name: 'a.JSON', type: '', chars: 1 } })).toBe('design');
    expect(entryKindOf({ file: { name: 'a.pdf', type: '', chars: 1 } })).toBeNull();
    expect(entryKindOf({ file: null })).toBeNull();
  });

  it('makes an id that no template has: the name, then name-2, name-3', () => {
    expect(uniqueTemplateId('My Box', [])).toBe('my-box');
    expect(uniqueTemplateId('My Box', ['my-box'])).toBe('my-box-2');
    expect(uniqueTemplateId('My Box', ['my-box', 'my-box-2'])).toBe('my-box-3');
  });

  it('saves the design as details, a JSON file and a picture, and the file opens again as the same design', async () => {
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const fetcher = (async (url: string, init: RequestInit) => { calls.push({ url, method: String(init.method), body: String(init.body) }); return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }); }) as unknown as typeof fetch;
    const state = { ...initialPapercraftState(), projectName: 'Old name', size: { by: 'largest' as const, mm: 123 } };
    const result = await saveDesignAsTemplate(state, { name: ' My box ', category: ' Boxes ', published: false }, ['my-box'], fetcher);
    expect(result).toEqual({ ok: true, value: { id: 'my-box-2', previewSaved: true } });
    expect(calls).toHaveLength(3);
    const details = JSON.parse(calls[0]!.body);
    expect(details).toMatchObject({ id: 'my-box-2', studio: 'papercraft', format: 'json', name: 'My box', category: 'Boxes', published: false });
    expect(calls[1]!.url).toContain('id=my-box-2&part=file&name=my-box-2.json');
    const restored = deserializePapercraft(JSON.parse(calls[1]!.body));
    expect(restored?.projectName).toBe('My box');
    expect(restored?.size.mm).toBe(123);
    expect(calls[2]!.url).toContain('part=preview&name=my-box-2.svg');
    expect(calls[2]!.body.startsWith('<svg')).toBe(true);
    expect(calls[2]!.body).not.toMatch(/<use|<image|opacity=/);
  });

  it('still saves the template when only the picture fails, and says the picture is missing', async () => {
    const fetcher = (async (url: string) => (String(url).includes('part=preview')
      ? new Response(JSON.stringify({ error: 'Too large.' }), { status: 413, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch;
    const result = await saveDesignAsTemplate(initialPapercraftState(), { name: 'X', category: '', published: true }, [], fetcher);
    expect(result).toEqual({ ok: true, value: { id: 'x', previewSaved: false } });
  });

  it('opens a saved design from its file, and says no to a file that is not one', async () => {
    const text = JSON.stringify(serializePapercraft({ ...initialPapercraftState(), projectName: 'Kept' }));
    const tpl = make({ id: 'd', format: 'json', file: { name: 'd.json', type: 'application/json', chars: text.length } });
    expect((await catalogDesignState(tpl, (async () => new Response(text)) as unknown as typeof fetch))?.projectName).toBe('Kept');
    expect(await catalogDesignState(tpl, (async () => new Response('{"hello":1}')) as unknown as typeof fetch)).toBeNull();
    expect(await catalogDesignState(tpl, (async () => new Response('not json')) as unknown as typeof fetch)).toBeNull();
    expect(await catalogDesignState(tpl, (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).toBeNull();
  });

  it('refuses an empty name and does not call the server', async () => {
    let called = 0;
    const fetcher = (async () => { called++; return new Response('{}'); }) as unknown as typeof fetch;
    expect(await saveDesignAsTemplate(initialPapercraftState(), { name: '  ', category: '', published: true }, [], fetcher)).toEqual({ ok: false, reason: 'no-name' });
    expect(called).toBe(0);
  });

  it('stops and says why when the server refuses the details', async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => { calls.push(url); return new Response(JSON.stringify({ error: 'Bad id.' }), { status: 400, headers: { 'content-type': 'application/json' } }); }) as unknown as typeof fetch;
    const result = await saveDesignAsTemplate(initialPapercraftState(), { name: 'X', category: '', published: true }, [], fetcher);
    expect(result).toMatchObject({ ok: false, message: 'Bad id.' });
    expect(calls).toHaveLength(1);
  });
});
