/**
 * Site metadata: the title and description the owner can set in the admin panel. Pure functions, shared by the Worker (which validates
 * what it stores) and the browser (which applies it). See docs/decisions/0062-site-metadata-settings.md.
 */

import { studioOfPath } from '../tracking/trackingConfig';

/** The studios that can have a title of their own. Every other page uses the site title. */
export const TITLED_STUDIOS = ['rhinestone', 'htv', 'papercraft'] as const;
export type TitledStudio = (typeof TITLED_STUDIOS)[number];

export interface SiteMeta {
  /** The browser tab title of every page that has no studio title. Never empty. */
  title: string;
  /** The meta description. Empty removes the tag. */
  description: string;
  /** A title for the pages of one studio. Empty means: use the site title. */
  studioTitles: Record<TitledStudio, string>;
}

/** What the app has always shown; `app/layout.tsx` uses the same values for the HTML that is built. */
export const DEFAULT_SITE_META: SiteMeta = {
  title: 'Rhinestone Template Tool',
  description: 'Precision SVG templates for Cricut Maker 3 + Magic Flock',
  studioTitles: { rhinestone: '', htv: '', papercraft: '' },
};

export const META_LIMITS = { title: 70, description: 200 } as const;

export type MetaResult = { ok: true; meta: SiteMeta } | { ok: false; error: string };

/** Line breaks and runs of spaces become one space; nothing a tag could break on. */
const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Checks the settings the admin panel sends. A missing field falls back to the default; a wrong type or a too long text is refused. */
export function parseSiteMeta(raw: unknown): MetaResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Settings must be an object.' };
  const o = raw as Record<string, unknown>;

  const text = (value: unknown, fallback: string): string | null => (value === undefined || value === null ? fallback : typeof value === 'string' ? tidy(value) : null);

  const title = text(o.title, DEFAULT_SITE_META.title);
  const description = text(o.description, DEFAULT_SITE_META.description);
  if (title === null || description === null) return { ok: false, error: 'The title and the description must be text.' };
  if (title === '') return { ok: false, error: 'The site title cannot be empty.' };
  if (title.length > META_LIMITS.title) return { ok: false, error: `The title is at most ${META_LIMITS.title} characters.` };
  if (description.length > META_LIMITS.description) return { ok: false, error: `The description is at most ${META_LIMITS.description} characters.` };

  const given = typeof o.studioTitles === 'object' && o.studioTitles !== null && !Array.isArray(o.studioTitles) ? (o.studioTitles as Record<string, unknown>) : {};
  const studioTitles = { ...DEFAULT_SITE_META.studioTitles };
  for (const studio of TITLED_STUDIOS) {
    const value = text(given[studio], '');
    if (value === null) return { ok: false, error: 'A studio title must be text.' };
    if (value.length > META_LIMITS.title) return { ok: false, error: `A studio title is at most ${META_LIMITS.title} characters.` };
    studioTitles[studio] = value;
  }
  return { ok: true, meta: { title, description, studioTitles } };
}

/** A settings text read back from the database: anything that does not pass falls back to the defaults. */
export function metaFromStored(text: string | null | undefined): SiteMeta {
  if (!text) return cloneDefault();
  try {
    const parsed = parseSiteMeta(JSON.parse(text));
    return parsed.ok ? parsed.meta : cloneDefault();
  } catch {
    return cloneDefault();
  }
}

function cloneDefault(): SiteMeta {
  return { ...DEFAULT_SITE_META, studioTitles: { ...DEFAULT_SITE_META.studioTitles } };
}

/** The tab title for a page: the studio's own title when it has one, otherwise the site title. */
export function titleForPath(meta: SiteMeta, path: string): string {
  const studio = studioOfPath(path);
  if ((TITLED_STUDIOS as readonly string[]).includes(studio)) {
    const own = meta.studioTitles[studio as TitledStudio];
    if (own) return own;
  }
  return meta.title;
}
