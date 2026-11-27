import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CatalogTemplates from '../app/components/CatalogTemplates';
import type { CatalogTemplate } from '../app/lib/catalog/catalogClient';
import { STUDIO_FORMATS } from '../app/lib/catalog/catalogFormat';
import { OPEN_FORMATS, catalogTemplateFile, isOpenableFileName, openableTemplates, searchTemplates } from '../app/lib/catalog/studioCatalog';

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
    make({ id: 'paper', studio: 'papercraft' }),
  ];

  it('takes the published templates of the studio that have a file it can open', () => {
    expect(openableTemplates('rhinestone', all).map((t) => t.id)).toEqual(['star', 'project']);
    expect(openableTemplates('htv', all).map((t) => t.id)).toEqual(['htv-shirt']);
  });

  it('opens a JSON template in Rhinestone only when it is named like a project file', () => {
    expect(isOpenableFileName('rhinestone', 'star.rhinestone.json')).toBe(true);
    expect(isOpenableFileName('rhinestone', 'STAR.RHINESTONE.JSON')).toBe(true);
    expect(isOpenableFileName('rhinestone', 'star.json')).toBe(false);
    expect(isOpenableFileName('rhinestone', 'star.svg')).toBe(true);
    expect(isOpenableFileName('htv', 'star.rhinestone.json')).toBe(false);
    expect(isOpenableFileName('htv', 'heart.svg')).toBe(true);
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
