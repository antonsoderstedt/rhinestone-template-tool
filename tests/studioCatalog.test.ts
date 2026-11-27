import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CatalogTemplates from '../app/components/CatalogTemplates';
import type { CatalogTemplate } from '../app/lib/catalog/catalogClient';
import { STUDIO_FORMATS } from '../app/lib/catalog/catalogFormat';
import { OPEN_FORMATS, catalogTemplateFile, isOpenableFileName, openableTemplates, saveHtvTemplate, saveRhinestoneTemplate, searchTemplates } from '../app/lib/catalog/studioCatalog';

const make = (over: Partial<CatalogTemplate> & { id: string }): CatalogTemplate => ({
  studio: 'rhinestone', format: 'svg', name: over.id, description: '', category: '', tags: [], licence: '', fields: {}, published: true,
  createdAt: '', updatedAt: '', file: { name: `${over.id}.svg`, type: 'image/svg+xml', chars: 10 }, preview: null, ...over,
});

describe('openableTemplates', () => {
  const all = [
    make({ id: 'star' }),
    make({ id: 'project', format: 'json', file: { name: 'p.rhinestone.json', type: 'application/json', chars: 5 } }),
    make({ id: 'plain-json', format: 'json', file: { name: 'other.json', type: 'application/json', chars: 5 } }),
    make({ id: 'draft', published: false }),
    make({ id: 'nofile', file: null }),
    make({ id: 'model', file: { name: 'm.obj', type: 'model/obj', chars: 5 } }),
    make({ id: 'htv-shirt', studio: 'htv' }),
    make({ id: 'htv-json', studio: 'htv', file: { name: 'x.json', type: 'application/json', chars: 5 } }),
    make({ id: 'htv-design', studio: 'htv', file: { name: 'team.htv.json', type: 'application/json', chars: 5 } }),
    make({ id: 'paper', studio: 'papercraft' }),
  ];

  it('takes the published templates of the studio that have a file it can open', () => {
    expect(openableTemplates('rhinestone', all).map((t) => t.id)).toEqual(['star', 'project']);
    expect(openableTemplates('htv', all).map((t) => t.id)).toEqual(['htv-shirt', 'htv-design']);
  });

  it('opens a JSON template in Rhinestone only when it is named like a project file', () => {
    expect(isOpenableFileName('rhinestone', 'star.rhinestone.json')).toBe(true);
    expect(isOpenableFileName('rhinestone', 'STAR.RHINESTONE.JSON')).toBe(true);
    expect(isOpenableFileName('rhinestone', 'star.json')).toBe(false);
    expect(isOpenableFileName('rhinestone', 'star.svg')).toBe(true);
    expect(isOpenableFileName('htv', 'star.rhinestone.json')).toBe(false);
    expect(isOpenableFileName('htv', 'heart.svg')).toBe(true);
  });

  it('opens a JSON template in HTV only when it is named like a design file, and not in Rhinestone', () => {
    expect(isOpenableFileName('htv', 'team.htv.json')).toBe(true);
    expect(isOpenableFileName('htv', 'TEAM.HTV.JSON')).toBe(true);
    expect(isOpenableFileName('htv', 'team.json')).toBe(false);
    expect(isOpenableFileName('rhinestone', 'team.htv.json')).toBe(false);
  });

  it('agrees with what the admin panel lets the owner upload for each studio', () => {
    for (const studio of ['rhinestone', 'htv'] as const) {
      for (const format of OPEN_FORMATS[studio]) expect(STUDIO_FORMATS[studio]).toContain(format);
      for (const format of STUDIO_FORMATS[studio]) expect(OPEN_FORMATS[studio]).toContain(format);
    }
  });

  it('searches name, category, tags and description', () => {
    const list = [make({ id: 'a', name: 'Angel wings', tags: ['cheer'] }), make({ id: 'b', name: 'Fish', category: 'Fishing' }), make({ id: 'c', name: 'Bow', description: 'for the team' })];
    expect(searchTemplates(list, '')).toHaveLength(3);
    expect(searchTemplates(list, 'WINGS').map((t) => t.id)).toEqual(['a']);
    expect(searchTemplates(list, 'cheer').map((t) => t.id)).toEqual(['a']);
    expect(searchTemplates(list, 'fishing').map((t) => t.id)).toEqual(['b']);
    expect(searchTemplates(list, 'team').map((t) => t.id)).toEqual(['c']);
    expect(searchTemplates(list, 'zzz')).toEqual([]);
  });
});

describe('catalogTemplateFile', () => {
  it('fetches the file and gives it its name and type', async () => {
    const fetcher = vi.fn(async () => new Response('<svg/>', { headers: { 'content-type': 'text/plain' } }));
    const file = await catalogTemplateFile(make({ id: 'star' }), fetcher as unknown as typeof fetch);
    expect(file?.name).toBe('star.svg');
    expect(file?.type).toBe('image/svg+xml');
    expect(await file?.text()).toBe('<svg/>');
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toBe('/api/catalog/file?id=star&part=file');
  });

  it('gives null when it cannot be fetched', async () => {
    expect(await catalogTemplateFile(make({ id: 'x' }), (async () => new Response('', { status: 500 })) as unknown as typeof fetch)).toBeNull();
    expect(await catalogTemplateFile(make({ id: 'x', file: null }))).toBeNull();
  });
});

describe('CatalogTemplates', () => {
  it('shows nothing until (and unless) the catalog has templates, so a site without one looks as before', () => {
    expect(renderToStaticMarkup(createElement(CatalogTemplates, { studio: 'rhinestone', onOpen: vi.fn() }))).toBe('');
    expect(renderToStaticMarkup(createElement(CatalogTemplates, { studio: 'htv', onOpen: vi.fn(), wrap: (c) => createElement('div', null, 'heading', c) }))).toBe('');
  });
});

describe('saveRhinestoneTemplate', () => {
  const calls: { url: string; method: string; body: string }[] = [];
  const recorder = (failPreview = false, failFile = false): typeof fetch =>
    (async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method ?? 'GET', body: String(init?.body ?? '') });
      if (failFile && u.includes('part=file')) return new Response(JSON.stringify({ error: 'no' }), { status: 500, headers: { 'content-type': 'application/json' } });
      if (failPreview && u.includes('part=preview')) return new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

  it('saves the details, a .rhinestone.json project file and a picture, with a new id', async () => {
    calls.length = 0;
    const result = await saveRhinestoneTemplate('{"projectName":"Star"}', '<svg/>', { name: ' Cheer star ', category: ' Cheer ', published: true }, ['cheer-star'], recorder());
    expect(result).toEqual({ ok: true, value: { id: 'cheer-star-2', previewSaved: true } });
    const details = JSON.parse(calls[0]!.body);
    expect(details).toMatchObject({ id: 'cheer-star-2', studio: 'rhinestone', format: 'json', name: 'Cheer star', category: 'Cheer', published: true, fields: { 'Made in': 'Rhinestone Studio' } });
    expect(calls[1]!.url).toContain('id=cheer-star-2&part=file&name=cheer-star-2.rhinestone.json');
    expect(calls[1]!.body).toBe('{"projectName":"Star"}');
    expect(calls[2]!.url).toContain('part=preview&name=cheer-star-2.svg');
  });

  it('is found again by the studio: the file name passes the same rule that lists templates', async () => {
    calls.length = 0;
    await saveRhinestoneTemplate('{}', null, { name: 'Ä Å Ö', category: '', published: true }, [], recorder());
    const name = decodeURIComponent(/name=([^&]+)/.exec(calls[1]!.url)![1]!);
    expect(isOpenableFileName('rhinestone', name)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('refuses no name and a project too big to open again, and sends nothing', async () => {
    calls.length = 0;
    expect(await saveRhinestoneTemplate('{}', null, { name: '  ', category: '', published: false }, [], recorder())).toEqual({ ok: false, reason: 'no-name' });
    expect(await saveRhinestoneTemplate('x'.repeat(20 * 1024 * 1024 + 1), null, { name: 'Big', category: '', published: false }, [], recorder())).toEqual({ ok: false, reason: 'too-big' });
    expect(calls).toHaveLength(0);
  });

  it('reports a failed picture without failing the save, and a failed file as a failure', async () => {
    const options = { name: 'Star', category: '', published: true };
    expect(await saveRhinestoneTemplate('{}', '<svg/>', options, [], recorder(true))).toEqual({ ok: true, value: { id: 'star', previewSaved: false } });
    expect((await saveRhinestoneTemplate('{}', '<svg/>', options, [], recorder(false, true))).ok).toBe(false);
  });
});

describe('saveHtvTemplate', () => {
  const calls: { url: string; body: string }[] = [];
  const recorder = (): typeof fetch =>
    (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') });
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

  it('saves the details, a .htv.json design file and a picture, found again by the HTV studio', async () => {
    calls.length = 0;
    const result = await saveHtvTemplate('{"format":"x"}', '<svg/>', { name: 'Team shirt', category: 'Teams', published: true }, ['team-shirt'], recorder());
    expect(result).toEqual({ ok: true, value: { id: 'team-shirt-2', previewSaved: true } });
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ id: 'team-shirt-2', studio: 'htv', format: 'json', fields: { 'Made in': 'HTV Studio' } });
    const name = decodeURIComponent(/name=([^&]+)/.exec(calls[1]!.url)![1]!);
    expect(name).toBe('team-shirt-2.htv.json');
    expect(isOpenableFileName('htv', name)).toBe(true);
    expect(calls[1]!.body).toBe('{"format":"x"}');
  });

  it('refuses no name and a design too big to open again', async () => {
    calls.length = 0;
    expect(await saveHtvTemplate('{}', null, { name: ' ', category: '', published: false }, [], recorder())).toEqual({ ok: false, reason: 'no-name' });
    expect(await saveHtvTemplate('x'.repeat(20 * 1024 * 1024 + 1), null, { name: 'Big', category: '', published: false }, [], recorder())).toEqual({ ok: false, reason: 'too-big' });
    expect(calls).toHaveLength(0);
  });
});
