/** Talks to the catalog API of the private site (`worker/catalog.ts`). Everything takes the fetch function, so it can be tested. */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { decodeFromCatalog, encodeForCatalog, formatOfFileName, mimeOfFormat, type CatalogStudio } from './catalogFormat';

export interface CatalogFileInfo { name: string; type: string; chars: number }

export interface CatalogTemplate {
  id: string;
  studio: CatalogStudio;
  format: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  licence: string;
  fields: Record<string, string>;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  file: CatalogFileInfo | null;
  preview: CatalogFileInfo | null;
}

export type CatalogDetails = Pick<CatalogTemplate, 'id' | 'studio' | 'format' | 'name' | 'description' | 'category' | 'tags' | 'licence' | 'fields' | 'published'>;

/** `unavailable`: this site has no catalog (GitHub Pages, local development without the Worker). `signin`: Access refused. */
export type CatalogFailure = 'unavailable' | 'signin' | 'error';
export type CatalogResult<T> = { ok: true; value: T } | { ok: false; reason: CatalogFailure; message?: string };

type Failed = { ok: false; reason: CatalogFailure; message?: string };

const failure = (response: Response): Failed => ({
  ok: false,
  reason: response.status === 401 || response.status === 403 ? 'signin' : response.status === 404 ? 'unavailable' : 'error',
});

async function errorOf(response: Response): Promise<Failed> {
  const base = failure(response);
  try {
    const body = (await response.json()) as { error?: string };
    return { ...base, message: body.error };
  } catch {
    return base;
  }
}

const isJson = (response: Response) => (response.headers.get('content-type') ?? '').includes('application/json');

export async function listCatalog(options: { studio?: CatalogStudio; all?: boolean } = {}, fetcher: typeof fetch = fetch): Promise<CatalogResult<CatalogTemplate[]>> {
  const query = [options.studio ? `studio=${options.studio}` : '', options.all ? 'all=1' : ''].filter(Boolean).join('&');
  try {
    const response = await fetcher(withBasePath(`/api/catalog/templates${query ? `?${query}` : ''}`), { cache: 'no-store', credentials: 'same-origin' });
    // A static host answers an unknown path with its 404 page (HTML): there is no catalog here.
    if (response.ok && !isJson(response)) return { ok: false, reason: 'unavailable' };
    if (!response.ok) return failure(response);
    const body = (await response.json()) as { templates?: CatalogTemplate[] };
    return Array.isArray(body.templates) ? { ok: true, value: body.templates } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function saveCatalogDetails(details: CatalogDetails, fetcher: typeof fetch = fetch): Promise<CatalogResult<null>> {
  try {
    const response = await fetcher(withBasePath('/api/admin/template'), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(details) });
    return response.ok ? { ok: true, value: null } : await errorOf(response);
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function uploadCatalogFile(id: string, part: 'file' | 'preview', file: { name: string; bytes: Uint8Array }, fetcher: typeof fetch = fetch): Promise<CatalogResult<null>> {
  const format = formatOfFileName(file.name);
  const query = `id=${encodeURIComponent(id)}&part=${part}&name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(mimeOfFormat(format))}`;
  try {
    const response = await fetcher(withBasePath(`/api/admin/file?${query}`), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'text/plain; charset=utf-8' }, body: encodeForCatalog(format, file.bytes) });
    return response.ok ? { ok: true, value: null } : await errorOf(response);
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function deleteCatalogTemplate(id: string, fetcher: typeof fetch = fetch): Promise<CatalogResult<null>> {
  try {
    const response = await fetcher(withBasePath(`/api/admin/template?id=${encodeURIComponent(id)}`), { method: 'DELETE', credentials: 'same-origin' });
    return response.ok ? { ok: true, value: null } : await errorOf(response);
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** A template's file (or its picture) as bytes. */
export async function fetchCatalogFile(template: Pick<CatalogTemplate, 'id' | 'format' | 'file' | 'preview'>, part: 'file' | 'preview', fetcher: typeof fetch = fetch): Promise<CatalogResult<{ name: string; bytes: Uint8Array }>> {
  const info = part === 'file' ? template.file : template.preview;
  if (!info) return { ok: false, reason: 'error', message: 'No file.' };
  try {
    const response = await fetcher(withBasePath(`/api/catalog/file?id=${encodeURIComponent(template.id)}&part=${part}`), { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return failure(response);
    const format = formatOfFileName(info.name);
    return { ok: true, value: { name: info.name, bytes: decodeFromCatalog(format, await response.text()) } };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
