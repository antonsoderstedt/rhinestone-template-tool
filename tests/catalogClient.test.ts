import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, decodeFromCatalog, encodeForCatalog, formatOfFileName, idFromName, isTextFormat, STUDIO_FORMATS } from '../app/lib/catalog/catalogFormat';
import { deleteCatalogTemplate, fetchCatalogFile, listCatalog, saveCatalogDetails, uploadCatalogFile, type CatalogDetails } from '../app/lib/catalog/catalogClient';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('catalog file format', () => {
  it('sends text formats as text and binary ones as base64, and gets the same bytes back', () => {
    const obj = new TextEncoder().encode('v 0 0 0\nf 1 2 3\nÅ');
    expect(encodeForCatalog('obj', obj)).toBe('v 0 0 0\nf 1 2 3\nÅ');
    expect(Array.from(decodeFromCatalog('obj', encodeForCatalog('obj', obj)))).toEqual(Array.from(obj));
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 255, 128, 13, 10]);
    expect(encodeForCatalog('pdf', pdf)).toBe(bytesToBase64(pdf));
    expect(Array.from(decodeFromCatalog('pdf', encodeForCatalog('pdf', pdf)))).toEqual(Array.from(pdf));
  });

  it('turns a big binary file into base64 and back without a stack overflow', () => {
    const bytes = new Uint8Array(500_000).map((_, i) => i % 251);
    const back = base64ToBytes(bytesToBase64(bytes));
    expect(back.length).toBe(bytes.length);
    expect(back[499_999]).toBe(bytes[499_999]);
  });

  it('knows the format of a file name, and which formats are text', () => {
    expect(formatOfFileName('Bear Head.OBJ')).toBe('obj');
    expect(formatOfFileName('noextension')).toBe('');
    expect(isTextFormat('SVG')).toBe(true);
    expect(isTextFormat('pdf')).toBe(false);
    expect(STUDIO_FORMATS.papercraft).toContain('obj');
  });

  it('makes a plain id from a name', () => {
    expect(idFromName('Björn på äng!')).toBe('bjorn-pa-ang');
    expect(idFromName('  --  ')).toBe('template');
    expect(idFromName('Cube 40 mm')).toBe('cube-40-mm');
  });
});

describe('catalog client', () => {
  const details: CatalogDetails = { id: 'box', studio: 'papercraft', format: 'obj', name: 'Box', description: '', category: '', tags: [], licence: '', fields: {}, published: false };

  it('lists the templates, asking for the studio and for unpublished ones when told to', async () => {
    let asked = '';
    const result = await listCatalog({ studio: 'papercraft', all: true }, (async (url: string) => { asked = url; return json({ templates: [{ id: 'box' }] }); }) as unknown as typeof fetch);
    expect(asked).toContain('/api/catalog/templates?studio=papercraft&all=1');
    expect(result.ok && result.value).toHaveLength(1);
  });

  it('says there is no catalog on a site that answers with a web page or 404, and asks for sign-in on 403', async () => {
    const html = (async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    expect(await listCatalog({}, html)).toEqual({ ok: false, reason: 'unavailable' });
    const notFound = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await listCatalog({}, notFound)).toEqual({ ok: false, reason: 'unavailable' });
    const denied = (async () => json({ error: 'no' }, 403)) as unknown as typeof fetch;
    expect(await listCatalog({}, denied)).toEqual({ ok: false, reason: 'signin' });
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await listCatalog({}, down)).toEqual({ ok: false, reason: 'error' });
  });

  it('saves details as JSON and passes on the server\'s reason when it refuses', async () => {
    let sent: { method?: string; body?: string } = {};
    const ok = await saveCatalogDetails(details, (async (_u: string, init: RequestInit) => { sent = { method: init.method, body: String(init.body) }; return json({ ok: true }); }) as unknown as typeof fetch);
    expect(ok.ok).toBe(true);
    expect(sent.method).toBe('PUT');
    expect(JSON.parse(sent.body!)).toMatchObject({ id: 'box', studio: 'papercraft' });
    const refused = await saveCatalogDetails(details, (async () => json({ error: 'Bad id.' }, 400)) as unknown as typeof fetch);
    expect(refused).toEqual({ ok: false, reason: 'error', message: 'Bad id.' });
  });

  it('uploads a binary file as base64 with its name and type in the address, and a text file as text', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher = (async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); return json({ ok: true }); }) as unknown as typeof fetch;
    await uploadCatalogFile('box', 'file', { name: 'my box.pdf', bytes: new Uint8Array([1, 2, 3]) }, fetcher);
    await uploadCatalogFile('box', 'preview', { name: 'p.svg', bytes: new TextEncoder().encode('<svg/>') }, fetcher);
    expect(calls[0]!.url).toContain('id=box&part=file&name=my%20box.pdf&type=application%2Fpdf');
    expect(calls[0]!.body).toBe(bytesToBase64(new Uint8Array([1, 2, 3])));
    expect(calls[1]!.url).toContain('part=preview');
    expect(calls[1]!.body).toBe('<svg/>');
  });

  it('fetches a file back as bytes, decoding what was base64, and says so when there is no file', async () => {
    const pdf = new Uint8Array([9, 8, 7, 0, 255]);
    const fetcher = (async () => new Response(bytesToBase64(pdf), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchCatalogFile({ id: 'box', format: 'pdf', file: { name: 'box.pdf', type: 'application/pdf', chars: 8 }, preview: null }, 'file', fetcher);
    expect(result.ok && Array.from(result.value.bytes)).toEqual(Array.from(pdf));
    expect((await fetchCatalogFile({ id: 'box', format: 'pdf', file: null, preview: null }, 'file', fetcher)).ok).toBe(false);
  });

  it('deletes by id', async () => {
    let asked = '';
    const result = await deleteCatalogTemplate('box', (async (url: string, init: RequestInit) => { asked = `${init.method} ${url}`; return json({ ok: true }); }) as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(asked).toBe('DELETE /api/admin/template?id=box');
  });
});
