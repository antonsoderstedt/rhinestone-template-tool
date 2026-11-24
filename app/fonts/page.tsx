'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { useRouter } from 'next/navigation';
import { Search, Star, Upload } from 'lucide-react';
import { inspectFontBytes, listOutlineFonts, repairFontBytes, type StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import {
  type FontPreference,
  type UploadedWorkspaceFont,
  type WorkspaceVault,
  EMPTY_WORKSPACE_VAULT,
  getFontPreference,
  makeWorkspaceId,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';
import { WorkspaceEmptyState, WorkspacePage, WorkspaceSurface, workspaceInputClassName, workspaceSelectClassName } from '../components/workspace/WorkspaceChrome';
import { DEFAULT_PREVIEW_TEXT } from '../lib/fontLaunch';
import { useT } from '../lib/i18n';
import { useFontPreviewLoader, type FontPreviewSpec } from './useFontPreviewLoader';
import FontCard, { type UploadedFontPatch } from './FontCard';
import {
  DEFAULT_FONT_FILTERS,
  categoryCounts,
  filterFamilies,
  groupFamilies,
  sortFamilies,
  type FontEntry,
  type FontFilters,
  type FontFamily,
  type FontSort,
} from './fontFamilies';

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the font file.'));
    reader.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
  });
}

type UploadOutcome = { font: UploadedWorkspaceFont } | { fileName: string; reason: string };

/** Checks a font file before it is added; repairs fixable files and refuses unusable ones. */
async function fileToUploadedFont(file: File): Promise<UploadOutcome> {
  const original = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectFontBytes(original);
  if (!inspection.ok && !inspection.repairable) {
    return { fileName: file.name, reason: inspection.issues.map((issue) => issue.message).join(' ') };
  }
  const bytes = repairFontBytes(original);

  const now = new Date().toISOString();
  const fontId = makeWorkspaceId('upload-font');
  const displayName = file.name.replace(/\.[^.]+$/, '');
  const mimeType = file.type || 'font/woff';
  return {
    font: {
      fontId,
      name: displayName,
      fileName: file.name,
      mimeType,
      sizeBytes: bytes.byteLength,
      sourceKind: 'browser-uploaded',
      category: 'Display',
      styleLabel: 'Uploaded',
      tags: ['upload'],
      favorite: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      previewFamily: `WorkspaceUploadedFont_${fontId.replace(/[^a-z0-9]/gi, '_')}`,
      previewText: DEFAULT_PREVIEW_TEXT,
      licenseSource: 'User uploaded local workspace asset',
      note: 'Review the generated outlines before production cutting.',
      preferredTextCoverageMode: 'outline',
      supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
      sourceDataUrl: await bytesToDataUrl(bytes, mimeType),
    },
  };
}

/** Cards drawn at once. Fonts for cards that are not on screen are never loaded. */
const PAGE_SIZE = 24;

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'];

/** One entry of the font library's catalog (scripts/build-font-library.ts). */
interface LibraryCatalogFont {
  id: string;
  name: string;
  family: string;
  variant: string;
  category: string;
  bytes: number;
}

function persistVault(nextVault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function FontsPage() {
  const t = useT();
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(EMPTY_WORKSPACE_VAULT);
  const [libraryFonts, setLibraryFonts] = useState<LibraryCatalogFont[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [filters, setFilters] = useState<FontFilters>(DEFAULT_FONT_FILTERS);
  const [sortBy, setSortBy] = useState<FontSort>('name');
  const [stones, setStones] = useState<{ on: boolean; size: StoneSizeId }>({ on: true, size: 'SS10' });
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const [uploadMessage, setUploadMessage] = useState<{ tone: 'success' | 'warning'; lines: string[] } | null>(null);
  const [pageState, setPageState] = useState({ key: '', limit: PAGE_SIZE });
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(filters.query);
  const deferredText = useDeferredValue(previewText);

  useEffect(() => {
    queueMicrotask(() => setVault(readWorkspaceVault()));
  }, []);

  // The imported fonts come from the font library's catalog (a small file; each font is fetched when its card is shown). They are
  // not copied into the browser's storage, only the user's own choices about them (favourites, tags) are.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(withBasePath('/font-library/catalog.json'));
        if (!response.ok) return;
        const catalog = (await response.json()) as { fonts?: LibraryCatalogFont[]; excluded?: number };
        if (cancelled || !Array.isArray(catalog.fonts)) return;
        setLibraryFonts(catalog.fonts);
        setExcludedCount(catalog.excluded ?? 0);
      } catch {
        // No font library here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const builtIns = useMemo<FontEntry[]>(() => listOutlineFonts().filter((font) => font.sourceKind !== 'browser-uploaded' && font.sourceKind !== 'workspace-installed').map((font) => {
    const preference = getFontPreference(vault, font.fontId);
    return {
      key: font.fontId,
      name: font.displayName,
      familyName: font.displayName,
      variantName: font.category,
      importSourceLabel: font.licenseSource,
      category: font.category,
      styleLabel: font.category,
      previewFamily: font.previewFontFamily,
      source: 'bundled' as const,
      favorite: preference.favorite,
      archived: preference.archived,
      tags: preference.tags,
      isBuiltInSimple: font.isLegacy,
      fontUrl: font.assetUrl,
      fontWeight: font.fontWeight,
      fontStyle: font.fontStyle,
      note: font.limitations?.join(' • ') ?? font.licenseSource,
      licenseSource: font.licenseSource,
      preferredTextCoverageMode: font.preferredTextCoverageMode,
      fileName: null,
    };
  }), [vault]);

  const uploads = useMemo<FontEntry[]>(() => {
    const own = vault.uploadedFonts.map((font) => ({
      key: font.fontId,
      name: font.name,
      familyName: font.familyName ?? font.name,
      variantName: font.variantName ?? font.styleLabel,
      importSourceLabel: font.importSourceLabel ?? font.licenseSource,
      category: font.category,
      styleLabel: font.styleLabel,
      previewFamily: font.previewFamily,
      source: font.sourceKind ?? 'browser-uploaded',
      favorite: font.favorite,
      archived: font.archived,
      tags: font.tags,
      isBuiltInSimple: false,
      fontUrl: font.assetUrl ?? font.sourceDataUrl ?? null,
      fontWeight: 400,
      fontStyle: 'normal' as const,
      note: font.note,
      licenseSource: font.licenseSource,
      preferredTextCoverageMode: font.preferredTextCoverageMode,
      fileName: font.fileName,
    }));
    const library = libraryFonts.map((font) => {
      const preference = getFontPreference(vault, font.id);
      return {
        key: font.id,
        name: font.name,
        familyName: font.family,
        variantName: font.variant || 'Regular',
        importSourceLabel: 'Font library',
        category: font.category,
        styleLabel: 'Imported',
        previewFamily: `FontLibrary_${font.id}`,
        source: 'workspace-installed' as const,
        favorite: preference.favorite,
        archived: preference.archived,
        tags: preference.tags,
        isBuiltInSimple: false,
        fontUrl: withBasePath(`/font-library/f/${font.id}.woff`),
        fontWeight: 400,
        fontStyle: 'normal' as const,
        note: 'From your font library. Review outline quality before production cutting.',
        licenseSource: 'Your font library',
        preferredTextCoverageMode: 'outline' as const,
        fileName: `${font.id}.woff`,
      };
    });
    return [...own, ...library];
  }, [libraryFonts, vault]);

  const families = useMemo<FontFamily[]>(() => groupFamilies([...builtIns, ...uploads]), [builtIns, uploads]);
  const activeFilters = useMemo<FontFilters>(() => ({ ...filters, query: deferredQuery }), [filters, deferredQuery]);
  const shown = useMemo(() => sortFamilies(filterFamilies(families, activeFilters), sortBy), [families, activeFilters, sortBy]);
  const chips = useMemo(() => categoryCounts(families, activeFilters), [families, activeFilters]);
  const sourceCounts = useMemo(() => {
    const counts = { bundled: 0, 'workspace-installed': 0, 'browser-uploaded': 0 };
    for (const family of families) counts[family.source] += 1;
    return counts;
  }, [families]);

  // ─── Windowing: only the first `limit` cards exist in the page ───────────────
  const filterKey = `${deferredQuery}|${filters.category}|${filters.source}|${filters.favoritesOnly}|${filters.showArchived}|${sortBy}`;
  const limit = pageState.key === filterKey ? pageState.limit : PAGE_SIZE;
  const visible = useMemo(() => shown.slice(0, limit), [shown, limit]);
  const hasMore = visible.length < shown.length;
  const showMore = useCallback(() => setPageState({ key: filterKey, limit: limit + PAGE_SIZE }), [filterKey, limit]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) showMore();
    }, { rootMargin: '600px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, showMore]);

  const selectedOf = useCallback((family: FontFamily): FontEntry => family.variants.find((v) => v.key === variantChoice[family.key]) ?? family.variants[0]!, [variantChoice]);

  const previewSpecs = useMemo<FontPreviewSpec[]>(() => {
    if (stones.on) return [];
    const specs = new Map<string, FontPreviewSpec>();
    for (const family of visible) {
      const font = selectedOf(family);
      specs.set(font.previewFamily, { family: font.previewFamily, url: font.fontUrl, weight: font.fontWeight, style: font.fontStyle });
    }
    return Array.from(specs.values());
  }, [visible, selectedOf, stones.on]);
  const previewStatuses = useFontPreviewLoader(previewSpecs);
  const fileUnavailable = (font: FontEntry) => !stones.on && previewStatuses[font.previewFamily] === 'failed';

  // ─── Changes (favourites, tags, archive, edits of the user's own fonts) ──────
  const updatePreference = (fontKey: string, updater: (current: FontPreference) => FontPreference) => {
    const next = updater(getFontPreference(vault, fontKey));
    persistVault({ ...vault, fontPreferences: [...vault.fontPreferences.filter((item) => item.fontKey !== fontKey), next] }, setVault);
  };
  const updateUploaded = (fontId: string, updater: (font: UploadedWorkspaceFont) => UploadedWorkspaceFont) => {
    persistVault({ ...vault, uploadedFonts: vault.uploadedFonts.map((font) => (font.fontId === fontId ? updater(font) : font)) }, setVault);
  };
  const stamp = () => new Date().toISOString();

  const onFavorite = (font: FontEntry) => {
    if (font.source === 'browser-uploaded') updateUploaded(font.key, (current) => ({ ...current, favorite: !current.favorite, updatedAt: stamp() }));
    else updatePreference(font.key, (current) => ({ ...current, favorite: !current.favorite }));
  };
  const onTags = (font: FontEntry, tags: string[]) => {
    if (font.source === 'browser-uploaded') updateUploaded(font.key, (current) => ({ ...current, tags, updatedAt: stamp() }));
    else updatePreference(font.key, (current) => ({ ...current, tags }));
  };
  const onArchive = (family: FontFamily) => {
    const archived = !family.archived;
    const keys = new Set(family.variants.map((variant) => variant.key));
    const own = family.variants.filter((variant) => variant.source === 'browser-uploaded');
    const others = family.variants.filter((variant) => variant.source !== 'browser-uploaded');
    persistVault({
      ...vault,
      uploadedFonts: vault.uploadedFonts.map((font) => (keys.has(font.fontId) && own.some((variant) => variant.key === font.fontId) ? { ...font, archived, updatedAt: stamp() } : font)),
      fontPreferences: [
        ...vault.fontPreferences.filter((item) => !others.some((variant) => variant.key === item.fontKey)),
        ...others.map((variant) => ({ ...getFontPreference(vault, variant.key), archived })),
      ],
    }, setVault);
  };
  const onEditUploaded = (font: FontEntry, patch: UploadedFontPatch) => {
    updateUploaded(font.key, (current) => ({ ...current, ...patch, updatedAt: stamp() }));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const outcomes = await Promise.all(Array.from(files).map(fileToUploadedFont));
    const added = outcomes.flatMap((outcome) => ('font' in outcome ? [outcome.font] : []));
    const refused = outcomes.flatMap((outcome) => ('font' in outcome ? [] : [outcome]));
    if (added.length > 0) persistVault({ ...vault, uploadedFonts: [...added, ...vault.uploadedFonts] }, setVault);
    setUploadMessage({
      tone: refused.length > 0 ? 'warning' : 'success',
      lines: [
        ...(added.length > 0 ? [`Added ${added.length} font${added.length === 1 ? '' : 's'}.`] : []),
        ...refused.map((item) => `${item.fileName} was not added: ${item.reason}`),
      ],
    });
  };

  const setFilter = <K extends keyof FontFilters>(key: K, value: FontFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const chip = (active: boolean) => `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-border bg-surface text-ink-secondary hover:text-ink'}`;
  const fontCount = families.reduce((sum, family) => sum + family.variants.length, 0);

  return (
    <WorkspacePage tone="accent">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-ink">{t('Fonts')}</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {t('{fonts} fonts in {families} families', { fonts: fontCount, families: families.length })}
              {excludedCount > 0 ? ` · ${t('{n} could not be used', { n: excludedCount })}` : ''}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-md transition hover:bg-sand-800">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('Upload fonts')}
            <input
              type="file"
              accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
              multiple
              className="sr-only"
              onChange={async (event) => {
                const input = event.target;
                await handleUpload(input.files);
                input.value = '';
              }}
            />
          </label>
        </header>

        {uploadMessage && (
          <WorkspaceSurface className={`px-5 py-3 text-sm ${uploadMessage.tone === 'warning' ? 'border-warning-500/30 bg-warning-50 text-warning-600' : 'border-success-500/20 bg-success-50 text-success-600'}`}>
            <div role="status">{uploadMessage.lines.map((line) => <p key={line}>{line}</p>)}</div>
          </WorkspaceSurface>
        )}

        <WorkspaceSurface className="space-y-3 p-3 backdrop-blur lg:sticky lg:top-2 lg:z-20 lg:p-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1.2fr_1fr_auto_auto] lg:gap-3">
            <input
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder={t('Type your text')}
              aria-label={t('Preview text — used on every card and sent to the studio')}
              className={`${workspaceInputClassName} col-span-2 lg:col-span-1`}
            />
            <div className="relative col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                value={filters.query}
                onChange={(event) => setFilter('query', event.target.value)}
                placeholder={t('Search fonts')}
                aria-label={t('Search fonts by name, category or tag')}
                className={`${workspaceInputClassName} pl-9`}
              />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
              <button type="button" aria-pressed={stones.on} onClick={() => setStones((s) => ({ ...s, on: !s.on }))} className={chip(stones.on)}>
                {t('Show as stones')}
              </button>
              {stones.on && (
                <select aria-label={t('Stone size')} value={stones.size} onChange={(event) => setStones((s) => ({ ...s, size: event.target.value as StoneSizeId }))} className={`${workspaceSelectClassName} !w-auto`}>
                  {STONE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              )}
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
              <button type="button" aria-pressed={filters.favoritesOnly} onClick={() => setFilter('favoritesOnly', !filters.favoritesOnly)} className={chip(filters.favoritesOnly)}>
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Favorites')}
              </button>
              <select aria-label={t('Sort by')} value={sortBy} onChange={(event) => setSortBy(event.target.value as FontSort)} className={`${workspaceSelectClassName} !w-auto`}>
                <option value="name">{t('Name')}</option>
                <option value="category">{t('Category')}</option>
                <option value="favorites">{t('Favorites first')}</option>
              </select>
            </div>
          </div>

          <div className="-mx-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0" role="group" aria-label={t('Category')}>
            <button type="button" aria-pressed={filters.category === 'all'} onClick={() => setFilter('category', 'all')} className={chip(filters.category === 'all')}>
              {t('All')} <span className="text-ink-muted">{chips.reduce((sum, c) => sum + c.count, 0)}</span>
            </button>
            {chips.map(({ category, count }) => (
              <button key={category} type="button" aria-pressed={filters.category === category} onClick={() => setFilter('category', filters.category === category ? 'all' : category)} className={chip(filters.category === category)}>
                {category === 'Legacy' ? t('Built-in') : category} <span className="text-ink-muted">{count}</span>
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <select aria-label={t('Source')} value={filters.source} onChange={(event) => setFilter('source', event.target.value as FontFilters['source'])} className={`${workspaceSelectClassName} !w-auto`}>
              <option value="all">{t('All sources')}</option>
              <option value="workspace-installed">{t('Library')} ({sourceCounts['workspace-installed']})</option>
              <option value="browser-uploaded">{t('Uploaded by you')} ({sourceCounts['browser-uploaded']})</option>
              <option value="bundled">{t('Bundled')} ({sourceCounts.bundled})</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
              <input type="checkbox" checked={filters.showArchived} onChange={(event) => setFilter('showArchived', event.target.checked)} />
              {t('Show archived')}
            </label>
          </div>
        </WorkspaceSurface>

        <p className="text-xs text-ink-muted" aria-live="polite">{t('{n} families', { n: shown.length })}</p>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label={t('Fonts')}>
          {visible.map((family) => (
            <FontCard
              key={family.key}
              family={family}
              selectedKey={selectedOf(family).key}
              onSelectVariant={(fontKey) => setVariantChoice((current) => ({ ...current, [family.key]: fontKey }))}
              previewText={deferredText}
              stones={stones}
              unavailable={fileUnavailable}
              onFavorite={onFavorite}
              onArchive={onArchive}
              onTags={onTags}
              onEditUploaded={onEditUploaded}
              onLaunch={(url) => router.push(url)}
            />
          ))}
        </section>

        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center pb-4">
            <button type="button" onClick={showMore} className="rounded-2xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-border-strong">
              {t('Show {n} more', { n: Math.min(PAGE_SIZE, shown.length - visible.length) })}
            </button>
          </div>
        )}

        {shown.length === 0 && (
          <WorkspaceEmptyState
            title={t('No fonts match the current filters')}
            description={t('Clear the search, change the source or category, or upload a font file to add to the list.')}
          />
        )}
      </div>
    </WorkspacePage>
  );
}
