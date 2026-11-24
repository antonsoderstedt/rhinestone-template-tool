'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { useRouter } from 'next/navigation';
import { Archive, ChevronDown, ChevronUp, Gem, RefreshCcw, Search, Star, SwatchBook, Type, Upload } from 'lucide-react';
import { inspectFontBytes, listOutlineFonts, repairFontBytes } from '@/src/lib/rhinestone-engine/index';
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
import {
  WorkspaceEmptyState,
  WorkspaceHero,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspaceSurface,
  WorkspaceTag,
  workspaceInputClassName,
  workspaceSelectClassName,
  workspaceTextAreaClassName,
} from '../components/workspace/WorkspaceChrome';
import { DEFAULT_PREVIEW_TEXT, buildFontLaunchUrl, getFontLaunchAvailability } from '../lib/fontLaunch';
import { useFontPreviewLoader, type FontPreviewSpec } from './useFontPreviewLoader';

import { useT } from '../lib/i18n';
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

/** Cards rendered at once. Fonts for off-screen cards are never loaded. */
const PAGE_SIZE = 24;

const UPLOAD_FONT_CATEGORIES = ['Block', 'Condensed', 'Varsity', 'Bubble', 'Serif', 'Gothic', 'Script', 'Handwritten', 'Display'] as const;
const COVERAGE_DEFAULTS = [
  { value: 'outline', label: 'Outline default' },
  { value: 'fill', label: 'Fill default' },
  { value: 'outline-fill', label: 'Outline + fill default' },
] as const;

type FontCatalogItem = {
  key: string;
  name: string;
  familyName: string;
  variantName: string;
  importSourceLabel: string;
  category: string;
  styleLabel: string;
  previewFamily: string;
  source: 'bundled' | 'browser-uploaded' | 'workspace-installed';
  favorite: boolean;
  archived: boolean;
  tags: string[];
  isBuiltInSimple: boolean;
  fontUrl: string | null;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  note: string;
  licenseSource: string;
  preferredTextCoverageMode: UploadedWorkspaceFont['preferredTextCoverageMode'] | 'outline';
  fileName: string | null;
};

/** One entry of the font library's catalog (scripts/build-font-library.ts). */
interface LibraryCatalogFont {
  id: string;
  name: string;
  family: string;
  variant: string;
  category: string;
  bytes: number;
}

interface InstalledFontManifestMeta {
  generatedAt?: string;
  importedCount?: number;
  skippedCount?: number;
  excludedCount?: number;
  zipArchiveCount?: number;
}

type InstalledFamilyItem = {
  familyKey: string;
  familyName: string;
  category: string;
  source: 'workspace-installed';
  variantCount: number;
  representative: FontCatalogItem;
  variants: FontCatalogItem[];
  tags: string[];
  favoriteCount: number;
  importSources: string[];
};

function compareInstalledVariants(left: FontCatalogItem, right: FontCatalogItem) {
  return variantPriority(left.variantName) - variantPriority(right.variantName)
    || left.variantName.localeCompare(right.variantName)
    || left.name.localeCompare(right.name);
}

function variantPriority(variantName: string) {
  const normalized = variantName.toLowerCase();
  if (/regular|roman|normal|book/.test(normalized)) return 0;
  if (/medium/.test(normalized)) return 1;
  if (/semibold|semi bold/.test(normalized)) return 2;
  if (/bold/.test(normalized)) return 3;
  if (/black|heavy|extrabold|extra bold/.test(normalized)) return 4;
  if (/light|thin|extra light/.test(normalized)) return 5;
  if (/italic|oblique|slant/.test(normalized)) return 6;
  return 10;
}

function pickRepresentativeVariant(variants: FontCatalogItem[]) {
  return [...variants].sort(compareInstalledVariants)[0]!;
}

function persistVault(nextVault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function FontsPage() {
  const t = useT();
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(EMPTY_WORKSPACE_VAULT);
  const [installedManifestMeta, setInstalledManifestMeta] = useState<InstalledFontManifestMeta | null>(null);
  const [libraryFonts, setLibraryFonts] = useState<LibraryCatalogFont[]>([]);
  const [syncMessage] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bundled' | 'browser-uploaded' | 'workspace-installed'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'favorites'>('name');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupInstalledFamilies, setGroupInstalledFamilies] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [uploadMessage, setUploadMessage] = useState<{ tone: 'success' | 'warning'; lines: string[] } | null>(null);
  const [pageState, setPageState] = useState({ key: '', limit: PAGE_SIZE });
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

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
        setInstalledManifestMeta({ excludedCount: catalog.excluded ?? 0 });
      } catch {
        // No font library here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const builtIns = useMemo<FontCatalogItem[]>(() => listOutlineFonts().filter((font) => font.sourceKind !== 'browser-uploaded' && font.sourceKind !== 'workspace-installed').map((font) => {
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

  const uploads = useMemo<FontCatalogItem[]>(() => {
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

  const catalog = useMemo<FontCatalogItem[]>(() => [...builtIns, ...uploads], [builtIns, uploads]);

  const installedFamilyItems = useMemo<InstalledFamilyItem[]>(() => {
    const installedFonts = uploads.filter((font) => font.source === 'workspace-installed');
    const byFamily = new Map<string, FontCatalogItem[]>();

    for (const font of installedFonts) {
      const familyKey = `${font.familyName}::${font.category}`;
      const existing = byFamily.get(familyKey);
      if (existing) existing.push(font);
      else byFamily.set(familyKey, [font]);
    }

    return Array.from(byFamily.entries()).map(([familyKey, variants]) => {
      const sortedVariants = [...variants].sort(compareInstalledVariants);
      const representative = pickRepresentativeVariant(sortedVariants);
      return {
        familyKey,
        familyName: representative.familyName,
        category: representative.category,
        source: 'workspace-installed' as const,
        variantCount: sortedVariants.length,
        representative,
        variants: sortedVariants,
        tags: Array.from(new Set(sortedVariants.flatMap((font) => font.tags))).sort((a, b) => a.localeCompare(b)),
        favoriteCount: sortedVariants.filter((font) => font.favorite).length,
        importSources: Array.from(new Set(sortedVariants.map((font) => font.importSourceLabel))).sort((a, b) => a.localeCompare(b)),
      };
    }).sort((left, right) => left.familyName.localeCompare(right.familyName));
  }, [uploads]);

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((font) => font.category))).sort((a, b) => a.localeCompare(b)),
    [catalog],
  );

  const visibleFonts = useMemo(() => {
    const loweredQuery = deferredQuery.trim().toLowerCase();
    const filtered = catalog.filter((font) => {
      if (sourceFilter !== 'all' && font.source !== sourceFilter) return false;
      if (categoryFilter !== 'all' && font.category !== categoryFilter) return false;
      if (font.archived) return false;
      if (!loweredQuery) return true;
      return `${font.name} ${font.category} ${font.tags.join(' ')}`.toLowerCase().includes(loweredQuery);
    });

    filtered.sort((left, right) => {
      if (sortBy === 'favorites' && left.favorite !== right.favorite) {
        return Number(right.favorite) - Number(left.favorite);
      }
      if (sortBy === 'category') {
        const categoryDiff = left.category.localeCompare(right.category);
        if (categoryDiff !== 0) return categoryDiff;
      }
      return left.name.localeCompare(right.name);
    });

    return filtered;
  }, [catalog, categoryFilter, deferredQuery, sortBy, sourceFilter]);

  const visibleInstalledFamilies = useMemo(() => {
    const loweredQuery = deferredQuery.trim().toLowerCase();
    return installedFamilyItems.filter((family) => {
      if (sourceFilter !== 'all' && sourceFilter !== 'workspace-installed') return false;
      if (categoryFilter !== 'all' && family.category !== categoryFilter) return false;
      if (!loweredQuery) return true;
      const haystack = [
        family.familyName,
        family.category,
        ...family.tags,
        ...family.variants.map((variant) => `${variant.name} ${variant.variantName} ${variant.fileName ?? ''}`),
        ...family.importSources,
      ].join(' ').toLowerCase();
      return haystack.includes(loweredQuery);
    });
  }, [categoryFilter, deferredQuery, installedFamilyItems, sourceFilter]);

  const standaloneFonts = useMemo(
    () => visibleFonts.filter((font) => !(groupInstalledFamilies && font.source === 'workspace-installed')),
    [groupInstalledFamilies, visibleFonts],
  );

  // ─── Windowing: only the first `limit` cards exist in the DOM ───────────────
  const filterKey = `${deferredQuery}|${sourceFilter}|${categoryFilter}|${sortBy}|${groupInstalledFamilies}`;
  const limit = pageState.key === filterKey ? pageState.limit : PAGE_SIZE;
  const totalCards = (groupInstalledFamilies ? visibleInstalledFamilies.length : 0) + standaloneFonts.length;
  const shownFamilies = useMemo(
    () => (groupInstalledFamilies ? visibleInstalledFamilies.slice(0, limit) : []),
    [groupInstalledFamilies, limit, visibleInstalledFamilies],
  );
  const shownStandalone = useMemo(
    () => standaloneFonts.slice(0, Math.max(0, limit - shownFamilies.length)),
    [limit, shownFamilies.length, standaloneFonts],
  );
  const shownCount = shownFamilies.length + shownStandalone.length;
  const hasMore = shownCount < totalCards;

  const showMore = () => setPageState({ key: filterKey, limit: limit + PAGE_SIZE });

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setPageState({ key: filterKey, limit: limit + PAGE_SIZE });
    }, { rootMargin: '600px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [filterKey, hasMore, limit]);

  // Fonts are loaded only for the cards on screen.
  const previewSpecs = useMemo<FontPreviewSpec[]>(() => {
    const specs = new Map<string, FontPreviewSpec>();
    const add = (font: FontCatalogItem) => {
      specs.set(font.previewFamily, { family: font.previewFamily, url: font.fontUrl, weight: font.fontWeight, style: font.fontStyle });
    };
    shownStandalone.forEach(add);
    shownFamilies.forEach((family) => add(family.representative));
    return Array.from(specs.values());
  }, [shownFamilies, shownStandalone]);
  const previewStatuses = useFontPreviewLoader(previewSpecs);
  const fileUnavailable = (font: FontCatalogItem) => previewStatuses[font.previewFamily] === 'failed';

  const updateFontPreference = (fontKey: string, updater: (current: FontPreference) => FontPreference) => {
    const current = getFontPreference(vault, fontKey);
    const next = updater(current);
    const nextVault = {
      ...vault,
      fontPreferences: [...vault.fontPreferences.filter((item) => item.fontKey !== fontKey), next],
    };
    persistVault(nextVault, setVault);
  };

  const updateUploadedFont = (fontId: string, updater: (font: UploadedWorkspaceFont) => UploadedWorkspaceFont) => {
    const nextVault = {
      ...vault,
      uploadedFonts: vault.uploadedFonts.map((font) => (font.fontId === fontId ? updater(font) : font)),
    };
    persistVault(nextVault, setVault);
  };

  const updateFont = (font: FontCatalogItem, bundled: (current: FontPreference) => FontPreference, uploaded: (current: UploadedWorkspaceFont) => UploadedWorkspaceFont) => {
    if (font.source === 'bundled' || font.source === 'workspace-installed') updateFontPreference(font.key, bundled);
    else updateUploadedFont(font.key, uploaded);
  };

  const toggleFamilyExpanded = (familyKey: string) => {
    setExpandedFamilies((current) => ({ ...current, [familyKey]: !current[familyKey] }));
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

  const installedCount = libraryFonts.length;
  const excludedCount = installedManifestMeta?.excludedCount ?? 0;

  return (
    <WorkspacePage tone="accent">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <WorkspaceHero
          eyebrow="Fonts"
          title={t('Fonts')}
          description={t('Type your own text to compare fonts side by side, then send one to the Rhinestone or HTV studio with your text already in place.')}
          tone="accent"
          actions={(
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-sand-900/15 transition hover:bg-sand-800">
              <Upload className="h-4 w-4" />
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
          )}
        />

        {(syncMessage || uploadMessage) && (
          <WorkspaceSurface
            className={`px-5 py-4 text-sm ${uploadMessage?.tone === 'warning' ? 'border-warning-500/30 bg-warning-50 text-warning-600' : 'border-success-500/20 bg-success-50 text-success-600'}`}
          >
            <div role="status">
              {uploadMessage ? uploadMessage.lines.map((line) => <p key={line}>{line}</p>) : syncMessage}
            </div>
          </WorkspaceSurface>
        )}

        {installedCount > 0 && (
          <WorkspaceSurface className="p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink">{t('Imported font libraries')}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-secondary">
                  {t('Large imports are grouped by family so you are not scrolling through every weight and file format.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGroupInstalledFamilies((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-secondary transition hover:text-ink"
              >
                <RefreshCcw className="h-4 w-4" />
                {groupInstalledFamilies ? 'Show every file' : 'Group by family'}
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <WorkspaceMetricCard label={t('Imported font files')} value={String(installedCount)} />
              <WorkspaceMetricCard label={t('Families')} value={String(installedFamilyItems.length)} />
              <WorkspaceMetricCard label={t('Excluded (damaged files)')} value={String(excludedCount)} />
            </div>
            {installedManifestMeta?.generatedAt && (
              <p className="mt-3 text-xs text-ink-muted">Last import: {new Date(installedManifestMeta.generatedAt).toLocaleDateString()}</p>
            )}
          </WorkspaceSurface>
        )}

        <WorkspaceSurface className="p-5">
          <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <label className="flex items-center gap-3">
              <Type className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                placeholder={t('Type your text')}
                aria-label={t('Preview text — used on every card and sent to the studio')}
                className={workspaceInputClassName}
              />
            </label>
            <label className="flex items-center gap-3">
              <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Search fonts')}
                aria-label={t('Search fonts by name, category or tag')}
                className={workspaceInputClassName}
              />
            </label>
            <select aria-label={t('Source')} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} className={workspaceSelectClassName}>
              <option value="all">{t('All sources')}</option>
              <option value="bundled">{t('Bundled')}</option>
              <option value="workspace-installed">{t('Imported libraries')}</option>
              <option value="browser-uploaded">{t('Uploaded by you')}</option>
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select aria-label={t('Category')} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={workspaceSelectClassName}>
                <option value="all">{t('All categories')}</option>
                {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
              </select>
              <select aria-label={t('Sort by')} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={workspaceSelectClassName}>
                <option value="name">{t('Name')}</option>
                <option value="category">{t('Category')}</option>
                <option value="favorites">{t('Favorites first')}</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
            Showing {shownCount} of {totalCards} {totalCards === 1 ? 'font' : 'fonts and families'}
          </p>
        </WorkspaceSurface>

        {shownFamilies.length > 0 && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-label={t('Imported font families')}>
            {shownFamilies.map((family) => {
              const expanded = expandedFamilies[family.familyKey] ?? false;
              const unavailable = fileUnavailable(family.representative);
              return (
                <article key={family.familyKey} className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.92)] p-6 shadow-sm transition hover:border-border-strong hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{categoryLabel(family.category)} · Imported</div>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">{family.familyName}</h2>
                      <p className="mt-2 text-sm text-ink-secondary">{family.variantCount} variant{family.variantCount === 1 ? '' : 's'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFamilyExpanded(family.familyKey)}
                      aria-expanded={expanded}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {expanded ? 'Hide variants' : 'Show variants'}
                    </button>
                  </div>

                  <FontSample font={family.representative} text={previewText} unavailable={unavailable} />

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-muted">
                    <span className="rounded-full border border-border px-3 py-1">Preview: {family.representative.variantName}</span>
                    {family.favoriteCount > 0 && <span className="rounded-full border border-border px-3 py-1">{family.favoriteCount} favorite{family.favoriteCount === 1 ? '' : 's'}</span>}
                  </div>

                  {family.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {family.tags.map((tag) => <WorkspaceTag key={tag}>{tag}</WorkspaceTag>)}
                    </div>
                  )}

                  <LaunchButtons
                    font={family.representative}
                    text={previewText}
                    unavailable={unavailable}
                    onLaunch={(url) => router.push(url)}
                    suffix=" (main style)"
                  />

                  {expanded && (
                    <div className="mt-5 space-y-3 border-t border-border pt-5">
                      {family.variants.map((font) => (
                        <div key={font.key} className="rounded-2xl border border-border/80 bg-surface px-4 py-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-ink">{font.variantName}</div>
                              <div className="mt-1 text-xs text-ink-muted">{font.fileName ?? font.name}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateUploadedFont(font.key, (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }))}
                                aria-pressed={font.favorite}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${font.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface-raised text-ink-secondary hover:text-ink'}`}
                              >
                                <Star className="h-4 w-4" />
                                {font.favorite ? 'Favorited' : 'Favorite'}
                              </button>
                              <button
                                onClick={() => updateUploadedFont(font.key, (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }))}
                                className="inline-flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
                              >
                                <Archive className="h-4 w-4" />
                                {font.archived ? 'Restore' : 'Archive'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-label={t('Fonts')}>
          {shownStandalone.map((font) => {
            const unavailable = fileUnavailable(font);
            const editable = font.source !== 'bundled';
            return (
              <article key={font.key} className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.92)] p-6 shadow-sm transition hover:border-border-strong hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{categoryLabel(font.category)} · {sourceLabel(font.source)}</div>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">{font.name}</h2>
                  </div>
                  <button
                    onClick={() => updateFont(
                      font,
                      (current) => ({ ...current, favorite: !current.favorite }),
                      (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }),
                    )}
                    aria-pressed={font.favorite}
                    aria-label={font.favorite ? `Remove ${font.name} from favorites` : `Add ${font.name} to favorites`}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${font.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-muted hover:text-ink'}`}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                </div>

                <FontSample font={font} text={previewText} unavailable={unavailable} />

                <p className="mt-4 text-sm leading-7 text-ink-secondary">{font.note}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
                  <span className="rounded-full border border-border px-3 py-1">{font.styleLabel}</span>
                  <span className="rounded-full border border-border px-3 py-1">{coverageLabel(font.preferredTextCoverageMode)}</span>
                  {font.fileName ? <span className="rounded-full border border-border px-3 py-1">{font.fileName}</span> : null}
                </div>

                <TagsField
                  key={`${font.key}:${font.tags.join('|')}`}
                  fontName={font.name}
                  tags={font.tags}
                  onCommit={(tags) => updateFont(font, (current) => ({ ...current, tags }), (current) => ({ ...current, tags, updatedAt: new Date().toISOString() }))}
                />

                {editable ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-ink-secondary">
                      <span className="font-medium text-ink">{t('Category')}</span>
                      <select
                        value={font.category}
                        onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, category: event.target.value, updatedAt: new Date().toISOString() }))}
                        className={workspaceSelectClassName}
                      >
                        {UPLOAD_FONT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-ink-secondary">
                      <span className="font-medium text-ink">{t('Style label')}</span>
                      <input
                        value={font.styleLabel}
                        onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, styleLabel: event.target.value, updatedAt: new Date().toISOString() }))}
                        className={workspaceInputClassName}
                      />
                    </label>
                    <label className="space-y-2 text-sm text-ink-secondary md:col-span-2">
                      <span className="font-medium text-ink">{t('Default text style')}</span>
                      <select
                        value={font.preferredTextCoverageMode}
                        onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, preferredTextCoverageMode: event.target.value as UploadedWorkspaceFont['preferredTextCoverageMode'], updatedAt: new Date().toISOString() }))}
                        className={workspaceSelectClassName}
                      >
                        {COVERAGE_DEFAULTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-ink-secondary md:col-span-2">
                      <span className="font-medium text-ink">{t('License / source')}</span>
                      <input
                        value={font.licenseSource}
                        onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, licenseSource: event.target.value, updatedAt: new Date().toISOString() }))}
                        className={workspaceInputClassName}
                      />
                    </label>
                    <label className="space-y-2 text-sm text-ink-secondary md:col-span-2">
                      <span className="font-medium text-ink">{t('Production note')}</span>
                      <textarea
                        value={font.note}
                        onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, note: event.target.value, updatedAt: new Date().toISOString() }))}
                        rows={3}
                        className={workspaceTextAreaClassName}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-border/80 bg-surface px-4 py-3 text-sm text-ink-secondary">
                    {font.licenseSource}
                  </div>
                )}

                <LaunchButtons font={font} text={previewText} unavailable={unavailable} onLaunch={(url) => router.push(url)} />

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    onClick={() => updateFont(
                      font,
                      (current) => ({ ...current, archived: !current.archived }),
                      (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }),
                    )}
                    className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
                  >
                    <Archive className="h-4 w-4" />
                    {t('Archive')}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center pb-4">
            <button
              type="button"
              onClick={showMore}
              className="rounded-2xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-border-strong"
            >
              Show {Math.min(PAGE_SIZE, totalCards - shownCount)} more
            </button>
          </div>
        )}

        {totalCards === 0 && (
          <WorkspaceEmptyState
            title={t('No fonts match the current filters')}
            description={t('Clear the search, change the source or category, or upload a font file to add to the list.')}
          />
        )}
      </div>
    </WorkspacePage>
  );
}

/** Preview text in the font, or a clear message when the font file could not be loaded. */
function FontSample({ font, text, unavailable }: { font: FontCatalogItem; text: string; unavailable: boolean }) {
  const t = useT();
  return (
    <div className="mt-5 rounded-[1.5rem] border border-border bg-surface px-5 py-6">
      <p
        style={{ fontFamily: unavailable ? undefined : `'${font.previewFamily}', system-ui, sans-serif` }}
        className={`break-words text-[44px] leading-none md:text-[56px] ${unavailable ? 'text-ink-muted' : 'text-ink'}`}
      >
        {text || DEFAULT_PREVIEW_TEXT}
      </p>
      {unavailable && (
        <p role="alert" className="mt-3 text-sm text-warning-600">
          {t('This font file could not be loaded, so it cannot be previewed or used. Re-download the font and upload it again.')}
        </p>
      )}
    </div>
  );
}

function LaunchButtons({
  font,
  text,
  unavailable,
  onLaunch,
  suffix = '',
}: {
  font: FontCatalogItem;
  text: string;
  unavailable: boolean;
  onLaunch: (url: string) => void;
  suffix?: string;
}) {
  const availability = getFontLaunchAvailability({ isBuiltInSimple: font.isBuiltInSimple, fileUnavailable: unavailable });
  const base = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className="mt-5 grid gap-2 md:grid-cols-2">
      <button
        type="button"
        disabled={!availability.rhinestone.enabled}
        title={availability.rhinestone.reason}
        onClick={() => onLaunch(buildFontLaunchUrl('rhinestone', font.key, text))}
        className={`${base} enabled:hover:border-accent-300 enabled:hover:text-accent-600`}
      >
        <Gem className="h-4 w-4" />
        Use in Rhinestone{suffix}
      </button>
      <button
        type="button"
        disabled={!availability.htv.enabled}
        title={availability.htv.reason}
        onClick={() => onLaunch(buildFontLaunchUrl('htv', font.key, text))}
        className={`${base} enabled:hover:border-brand-300 enabled:hover:text-brand-600`}
      >
        <SwatchBook className="h-4 w-4" />
        Use in HTV{suffix}
      </button>
      {!availability.htv.enabled && availability.htv.reason && !unavailable && (
        <p className="text-xs text-ink-muted md:col-span-2">{availability.htv.reason}</p>
      )}
    </div>
  );
}

/**
 * Comma-separated tags. Keeps what is being typed (including trailing commas and
 * spaces) and saves on blur or Enter, so typing "a, b" is possible.
 */
function TagsField({ fontName, tags, onCommit }: { fontName: string; tags: string[]; onCommit: (tags: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(tags.join(', '));
  const commit = () => {
    const next = draft.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (next.join('\u0000') !== tags.join('\u0000')) onCommit(next);
  };
  return (
    <div className="mt-4 space-y-2 text-sm text-ink-secondary">
      <label className="block space-y-2">
        <span className="font-medium text-ink">{t('Tags')}</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          aria-label={`Tags for ${fontName}, separated by commas`}
          placeholder="e.g. wedding, chrome, mascot"
          className={workspaceInputClassName}
        />
      </label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => <WorkspaceTag key={tag}>{tag}</WorkspaceTag>)}
        </div>
      )}
    </div>
  );
}

function categoryLabel(category: string): string {
  return category === 'Legacy' ? 'Built-in' : category;
}

function sourceLabel(source: FontCatalogItem['source']): string {
  switch (source) {
    case 'bundled':
      return 'Bundled';
    case 'workspace-installed':
      return 'Imported';
    default:
      return 'Uploaded';
  }
}

function coverageLabel(mode: UploadedWorkspaceFont['preferredTextCoverageMode'] | 'outline') {
  switch (mode) {
    case 'fill':
      return 'Fill default';
    case 'outline-fill':
      return 'Outline + fill default';
    default:
      return 'Outline default';
  }
}
