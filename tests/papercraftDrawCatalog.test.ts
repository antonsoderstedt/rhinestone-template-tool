import { describe, expect, it } from 'vitest';
import { addItem, newDoc, parseDoc, rectanglePoints } from '../src/lib/papercraft-engine';
import type { CatalogTemplate } from '../app/lib/catalog/catalogClient';
import { catalogDrawingDoc, drawingEntries, saveDrawingAsTemplate } from '../app/papercraft/draw/drawCatalog';
import { catalogModels, entryKindOf } from '../app/papercraft/papercraftCatalog';

const make = (over: Partial<CatalogTemplate> & { id: string }): CatalogTemplate => ({
  studio: 'papercraft', format: 'json', name: over.id, description: '', category: '', tags: [], licence: '', fields: {}, published: true, createdAt: '', updatedAt: '',
  file: { name: `${over.id}.json`, type: 'application/json', chars: 10 }, preview: null, ...over,
});
const drawing = (id: string, over: Partial<CatalogTemplate> = {}) => make({ id, fields: { Kind: 'drawing' }, ...over });
const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
const drawn = addItem(newDoc(150, 200, 'Old'), { kind: 'cut', points: rectanglePoints(10, 10, 60, 60), closed: true }).doc;

describe('drawings in the catalog', () => {
  it('the drawing tool lists published drawings only, and the studio does not offer them as designs', () => {
    const all = [drawing('a'), drawing('draft', { published: false }), make({ id: 'design' }), drawing('nofile', { file: null }), drawing('htv', { studio: 'htv' }), drawing('model', { file: { name: 'a.obj', type: '', chars: 1 } })];
    expect(drawingEntries(all).map((t) => t.id)).toEqual(['a']);
    // The Kind field only matters for JSON: an OBJ file is still a model.
    expect(catalogModels(all).map((t) => t.id)).toEqual(['design', 'model']);
    expect(entryKindOf(drawing('a'))).toBeNull();
    expect(entryKindOf(make({ id: 'x' }))).toBe('design');
  });

  it('saves details marked as a drawing, the drawing as JSON, and an SVG picture; the file opens again as the same drawing', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher = (async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); return ok(); }) as unknown as typeof fetch;
    const result = await saveDrawingAsTemplate(drawn, { name: ' My box ', category: ' Boxes ', published: true }, ['my-box'], fetcher);
    expect(result).toEqual({ ok: true, value: { id: 'my-box-2', previewSaved: true } });
    expect(calls).toHaveLength(3);
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ id: 'my-box-2', studio: 'papercraft', format: 'json', name: 'My box', category: 'Boxes', published: true, fields: { Kind: 'drawing' } });
    const restored = parseDoc(JSON.parse(calls[1]!.body));
    expect(restored?.name).toBe('My box');
    expect(restored?.items).toEqual(drawn.items);
    expect(calls[2]!.url).toContain('part=preview&name=my-box-2.svg');
    expect(calls[2]!.body).toMatch(/^<svg/);
    expect(calls[2]!.body).not.toMatch(/<use|<image|<canvas/);
  });

  it('still saves when only the picture fails, and says so', async () => {
    const fetcher = (async (url: string) => (String(url).includes('part=preview') ? new Response(JSON.stringify({ error: 'Too large.' }), { status: 413, headers: { 'content-type': 'application/json' } }) : ok())) as unknown as typeof fetch;
    expect(await saveDrawingAsTemplate(drawn, { name: 'X', category: '', published: false }, [], fetcher)).toEqual({ ok: true, value: { id: 'x', previewSaved: false } });
  });

  it('refuses an empty name or an empty drawing without calling the server, and reports a refusal', async () => {
    let called = 0;
    const counting = (async () => { called++; return ok(); }) as unknown as typeof fetch;
    expect(await saveDrawingAsTemplate(drawn, { name: ' ', category: '', published: true }, [], counting)).toEqual({ ok: false, reason: 'no-name' });
    expect(await saveDrawingAsTemplate(newDoc(), { name: 'X', category: '', published: true }, [], counting)).toEqual({ ok: false, reason: 'nothing-drawn' });
    expect(called).toBe(0);
    const refusing = (async () => new Response(JSON.stringify({ error: 'Bad id.' }), { status: 400, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    expect(await saveDrawingAsTemplate(drawn, { name: 'X', category: '', published: true }, [], refusing)).toEqual({ ok: false, reason: 'error', message: 'Bad id.' });
  });

  it('opens a drawing from its file and says no to a file that is not one', async () => {
    const text = JSON.stringify({ version: 1, kind: 'papercraft-drawing', doc: drawn });
    const tpl = drawing('d', { file: { name: 'd.json', type: '', chars: text.length } });
    expect((await catalogDrawingDoc(tpl, (async () => new Response(text)) as unknown as typeof fetch))?.items).toHaveLength(1);
    for (const body of ['{"hello":1}', 'not json', '']) expect(await catalogDrawingDoc(tpl, (async () => new Response(body)) as unknown as typeof fetch)).toBeNull();
    expect(await catalogDrawingDoc(tpl, (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).toBeNull();
  });
});
