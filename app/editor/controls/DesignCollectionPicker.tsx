'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { compactToDots, compactToSvg, type CompactDesign } from '@/src/lib/rhinestone-engine/index';
import { designsWithUploads } from '@/src/lib/library/libraryItems';
import { useT } from '../../lib/i18n';
import { loadLibrary } from '../../lib/library/libraryClient';
import { editorFieldLabelClassName, editorSelectClassName } from './controlStyles';

/** One design in the collection built by `npm run import:designs` (see scripts/import-design-bundle.ts). */
export interface DesignCollectionEntry {
  id: string;
  title: string;
  category: string;
  stones: number;
  widthMm: number;
  heightMm: number;
  stoneMm: number;
  file: string;
}

const BASE = withBasePath('/design-library');

/** A design of the built library is a file in the library folder; an uploaded one is an address on the site. */
const designUrl = (file: string): string => (file.startsWith('/api/') ? withBasePath(file) : `${BASE}/${file}`);
const PAGE_SIZE = 24;
let cachedIndex: Promise<DesignCollectionEntry[] | null> | null = null;

function loadIndex(): Promise<DesignCollectionEntry[] | null> {
  // The owner's changes from the admin panel (hidden designs, titles, categories) are put on top of the library's own list, and the
  // designs uploaded there are added to it. With no built library the uploaded designs are still listed.
  cachedIndex ??= Promise.all([
    fetch(`${BASE}/index.json`).then((response) => (response.ok ? (response.json() as Promise<{ designs?: DesignCollectionEntry[] }>) : null)).catch(() => null),
    loadLibrary(),
  ])
    .then(([payload, library]) => {
      const built = payload && Array.isArray(payload.designs) ? payload.designs : [];
      const list = designsWithUploads<DesignCollectionEntry>(built, library.items, library.overlay, (item, file) => ({
        id: item.id,
        title: item.name,
        category: item.category || 'Uploaded',
        source: 'Uploaded in the admin panel',
        stones: item.design?.stones ?? 0,
        widthMm: item.design?.widthMm ?? 0,
        heightMm: item.design?.heightMm ?? 0,
        stoneMm: item.design?.stoneMm ?? 0,
        file,
      }));
      return payload || list.length > 0 ? list : null;
    })
    .catch(() => null);
  return cachedIndex;
}

const designCache = new Map<string, Promise<CompactDesign | null>>();

function loadDesign(file: string): Promise<CompactDesign | null> {
  let pending = designCache.get(file);
  if (!pending) {
    pending = fetch(designUrl(file))
      .then((response) => (response.ok ? (response.json() as Promise<CompactDesign>) : null))
      .then((design) => (design && design.v === 1 && Array.isArray(design.s) && Array.isArray(design.c) ? design : null))
      .catch(() => null);
    designCache.set(file, pending);
  }
  return pending;
}

/** A small picture of a design, drawn from its stones. The data is fetched only when the card is scrolled into view. */
function DesignThumb({ file }: { file: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [design, setDesign] = useState<CompactDesign | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let cancelled = false;
    const start = () => void loadDesign(file).then((loaded) => { if (!cancelled) setDesign(loaded); });
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => { cancelled = true; observer.disconnect(); };
  }, [file]);
  const dots = useMemo(() => (design ? compactToDots(design) : null), [design]);
  return (
    <div ref={ref} className="flex h-16 w-full items-center justify-center rounded bg-white">
      {dots && (
        <svg viewBox={dots.viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {dots.paths.map((path, index) => (
            <path key={index} d={path.d} fill="none" stroke={path.colour ?? '#7c5ce0'} strokeWidth={path.diameter} strokeLinecap="round" />
          ))}
        </svg>
      )}
    </div>
  );
}

/** Filters by words in the title or category, and by category. Pure, so it can be tested. */
export function filterDesigns(designs: readonly DesignCollectionEntry[], query: string, category: string): DesignCollectionEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return designs.filter((design) => {
    if (category !== 'all' && design.category !== category) return false;
    if (words.length === 0) return true;
    const haystack = `${design.title} ${design.category}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Browse the design collection (thousands of ready-made templates from the user's own folder) and pick one. The picked
 * design is made into SVG text (circles) and handed to `onPick`, which loads it the same way a file from the computer is loaded.
 */
export default function DesignCollectionPicker({ onPick }: { onPick: (svgText: string, fileName: string, design: DesignCollectionEntry) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<DesignCollectionEntry[] | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const design of designs ?? []) counts.set(design.category, (counts.get(design.category) ?? 0) + 1);
    return [...counts].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [designs]);
  const matching = useMemo(() => filterDesigns(designs ?? [], query, category), [designs, query, category]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && designs === undefined) void loadIndex().then(setDesigns);
  };

  const pick = async (design: DesignCollectionEntry) => {
    setLoading(design.id);
    setError(null);
    try {
      const compact = await loadDesign(design.file);
      if (!compact) throw new Error('missing');
      onPick(compactToSvg(compact), `${design.title}.svg`, design);
    } catch {
      setError(t('Could not open {name}.', { name: design.title }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--studio-border)] px-3 py-2 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-accent-400"
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        {t('Browse the design collection')}
        {designs ? ` (${designs.length})` : ''}
      </button>

      {open && designs === undefined && <p className="text-xs text-[var(--studio-ink-muted)]">{t('Loading…')}</p>}
      {open && designs === null && (
        <p className="text-xs text-[var(--studio-ink-muted)]">
          {t('No collection has been imported yet. Run this once in the project folder, then reload:')}
          <code className="mt-1 block break-all rounded bg-[var(--studio-well)] px-2 py-1">npm run import:designs -- &quot;/path/to/your/folder&quot;</code>
        </p>
      )}

      {open && designs && (
        <div className="space-y-2" role="group" aria-label={t('Design collection')}>
          <span className={editorFieldLabelClassName}>{t('Design collection')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }}
            placeholder={t('Search {n} designs', { n: designs.length })}
            aria-label={t('Search designs')}
            className="w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5 text-xs text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <select
            value={category}
            onChange={(event) => { setCategory(event.target.value); setLimit(PAGE_SIZE); }}
            aria-label={t('Category')}
            className={editorSelectClassName}
          >
            <option value="all">{t('All categories')} ({designs.length})</option>
            {categories.map(([name, count]) => (
              <option key={name} value={name}>{name} ({count})</option>
            ))}
          </select>
          <p className="text-xs text-[var(--studio-ink-muted)]">{t('{n} designs', { n: matching.length })}</p>
          {matching.length === 0 && <p className="text-xs text-[var(--studio-ink-muted)]">{t('No designs match.')}</p>}
          <ul className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {matching.slice(0, limit).map((design) => (
              <li key={design.id}>
                <button
                  type="button"
                  disabled={loading !== null}
                  aria-label={`${design.title}, ${design.stones} stones, ${design.widthMm} × ${design.heightMm} mm`}
                  onClick={() => void pick(design)}
                  className="flex h-full w-full flex-col gap-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] p-1.5 text-left transition hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:opacity-60"
                >
                  <DesignThumb file={design.file} />
                  <span className="line-clamp-2 text-xs font-medium leading-tight text-[var(--studio-ink)]">{design.title}</span>
                  <span className="text-xs text-[var(--studio-ink-muted)]">
                    {loading === design.id ? t('Opening…') : `${design.stones} · ${Math.round(design.widthMm)}×${Math.round(design.heightMm)} mm`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {matching.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
              className="w-full rounded-lg border border-[var(--studio-border)] px-3 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              {t('Show {n} more', { n: Math.min(PAGE_SIZE, matching.length - limit) })}
            </button>
          )}
          {error && <p role="alert" className="text-xs text-danger-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
