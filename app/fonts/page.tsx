'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ChevronDown, ChevronUp, Gem, RefreshCcw, Search, Star, SwatchBook, Type, Upload } from 'lucide-react';
import { getOutlineFontFaceCss, listOutlineFonts } from '@/src/lib/rhinestone-engine/index';
import {
  type FontPreference,
  type UploadedWorkspaceFont,
  type WorkspaceVault,
  getFontPreference,
  makeWorkspaceId,
  mergeInstalledWorkspaceFonts,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function fileToUploadedFont(file: File): Promise<UploadedWorkspaceFont> {
  const now = new Date().toISOString();
  const fontId = makeWorkspaceId('upload-font');
  const displayName = file.name.replace(/\.[^.]+$/, '');
  return {
    fontId,
    name: displayName,
    fileName: file.name,
    mimeType: file.type || 'font/woff',
    sizeBytes: file.size,
    sourceKind: 'browser-uploaded',
    category: 'Display',
    styleLabel: 'Uploaded',
    tags: ['upload'],
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    previewFamily: `WorkspaceUploadedFont_${fontId.replace(/[^a-z0-9]/gi, '_')}`,
    previewText: 'Sulay 123',
    licenseSource: 'User uploaded local workspace asset',
    note: 'Review the generated outlines before production cutting.',
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
    sourceDataUrl: await readFileAsDataUrl(file),
  };
}

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
  canLaunch: boolean;
  note: string;
  previewText: string;
  licenseSource: string;
  preferredTextCoverageMode: UploadedWorkspaceFont['preferredTextCoverageMode'] | 'outline';
  fileName: string | null;
};

interface InstalledFontManifestMeta {
  generatedAt: string;
  importedCount: number;
  skippedCount: number;
  zipArchiveCount: number;
  sourceDirectory: string;
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
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(() => readWorkspaceVault());
  const [installedManifestMeta, setInstalledManifestMeta] = useState<InstalledFontManifestMeta | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('Sulay 123');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bundled' | 'browser-uploaded' | 'workspace-installed'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'favorites'>('name');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupInstalledFamilies, setGroupInstalledFamilies] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/fonts/workspace-installed/manifest.json', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as UploadedWorkspaceFont[] | { meta?: InstalledFontManifestMeta; fonts?: UploadedWorkspaceFont[] };
        const manifest = Array.isArray(payload) ? payload : (Array.isArray(payload.fonts) ? payload.fonts : []);
        if (cancelled) return;

        if (!Array.isArray(payload) && payload.meta) {
          setInstalledManifestMeta(payload.meta);
        }

        if (!Array.isArray(manifest)) return;

        const currentVault = readWorkspaceVault();
        const nextVault = mergeInstalledWorkspaceFonts(currentVault, manifest);
        const same = JSON.stringify(nextVault.uploadedFonts) === JSON.stringify(currentVault.uploadedFonts);
        if (!same) {
          persistVault(nextVault, setVault);
          setSyncMessage(`Synced ${manifest.length} installed fonts from the local zip import library.`);
        }
      } catch {
        // No local import manifest yet.
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
      canLaunch: !font.isLegacy,
      note: font.limitations?.join(' • ') ?? font.licenseSource,
      previewText: font.displayName,
      licenseSource: font.licenseSource,
      preferredTextCoverageMode: font.preferredTextCoverageMode,
      fileName: null,
    };
  }), [vault]);

  const uploads = useMemo<FontCatalogItem[]>(() => vault.uploadedFonts.map((font) => ({
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
    canLaunch: true,
    note: font.note,
    previewText: font.previewText,
    licenseSource: font.licenseSource,
    preferredTextCoverageMode: font.preferredTextCoverageMode,
    fileName: font.fileName,
  })), [vault.uploadedFonts]);

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
    const loweredQuery = query.trim().toLowerCase();
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
  }, [catalog, categoryFilter, query, sortBy, sourceFilter]);

  const visibleInstalledFamilies = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
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
  }, [categoryFilter, installedFamilyItems, query, sourceFilter]);

  const standaloneFonts = useMemo(
    () => visibleFonts.filter((font) => !(groupInstalledFamilies && font.source === 'workspace-installed')),
    [groupInstalledFamilies, visibleFonts],
  );

  const uploadedFontFaceCss = useMemo(
    () => vault.uploadedFonts.map((font) => `
@font-face {
  font-family: '${font.previewFamily}';
  src: url('${font.sourceDataUrl}');
  font-display: swap;
}
`).join('\n'),
    [vault.uploadedFonts],
  );

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

  const toggleFamilyExpanded = (familyKey: string) => {
    setExpandedFamilies((current) => ({ ...current, [familyKey]: !current[familyKey] }));
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(124,77,255,0.16),transparent_24%),linear-gradient(180deg,#faf8f5_0%,#f7f1ea_100%)] px-4 py-8 md:px-6">
      <style>{`${getOutlineFontFaceCss()}\n${uploadedFontFaceCss}`}</style>

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[2.5rem] border border-border bg-surface-raised/90 p-8 shadow-xl shadow-sand-900/5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/15 bg-accent-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
                Fonts
              </div>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Preview fonts the way customers actually buy</h1>
              <p className="mt-4 text-base leading-8 text-ink-secondary md:text-lg">
                Compare every font on the exact same phrase, search fast, upload custom families in bulk, and jump straight into a studio with the right built-in or installed font selected.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--color-accent-500),var(--color-brand-500))] px-5 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-accent-500/20 transition hover:brightness-105">
              <Upload className="h-4 w-4" />
              Bulk upload fonts
              <input
                type="file"
                accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
                multiple
                className="hidden"
                onChange={async (event) => {
                  const files = event.target.files;
                  if (!files || files.length === 0) return;
                  const uploaded = await Promise.all(Array.from(files).map(fileToUploadedFont));
                  persistVault({ ...vault, uploadedFonts: [...uploaded, ...vault.uploadedFonts] }, setVault);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </section>

        {syncMessage && (
          <section className="rounded-[1.5rem] border border-success-500/20 bg-success-50 px-5 py-4 text-sm text-success-600 shadow-sm">
            {syncMessage}
            <div className="mt-2 text-xs text-success-600/90">
              For large zip libraries, run `npm run import:font-zips -- /Users/sulaysoderstedt/Desktop/FONTS` and then open this page once to sync them into the tool.
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-border bg-surface-raised/90 p-5 shadow-lg shadow-sand-900/5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Imported Zip Library</div>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Installed font families from your zip packs</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">
                This view is optimized for large imported font libraries. Group by family to avoid scrolling through thousands of weight and format variants one by one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGroupInstalledFamilies((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-secondary transition hover:text-ink"
            >
              <RefreshCcw className="h-4 w-4" />
              {groupInstalledFamilies ? 'Show every variant' : 'Group installed families'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <MetricCard label="Installed files" value={String(vault.uploadedFonts.filter((font) => font.sourceKind === 'workspace-installed').length)} />
            <MetricCard label="Installed families" value={String(installedFamilyItems.length)} />
            <MetricCard label="Zip archives" value={String(installedManifestMeta?.zipArchiveCount ?? '—')} />
            <MetricCard label="Skipped by parser" value={String(installedManifestMeta?.skippedCount ?? '—')} />
          </div>

          <div className="mt-4 text-xs text-ink-muted">
            {installedManifestMeta
              ? `Last import: ${new Date(installedManifestMeta.generatedAt).toLocaleString()} · Source: ${installedManifestMeta.sourceDirectory}`
              : 'No manifest metadata loaded yet.'}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-surface-raised/90 p-5 shadow-lg shadow-sand-900/5">
          <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <Type className="h-4 w-4 text-ink-muted" />
              <input
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                placeholder="Type your preview text"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search fonts"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </label>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="all">All sources</option>
              <option value="bundled">Bundled</option>
              <option value="workspace-installed">Installed zip imports</option>
              <option value="browser-uploaded">Browser uploads</option>
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="favorites">Favorites first</option>
              </select>
            </div>
          </div>
        </section>

        {groupInstalledFamilies && visibleInstalledFamilies.length > 0 && (
          <section className="grid gap-5 xl:grid-cols-2">
            {visibleInstalledFamilies.map((family) => {
              const expanded = expandedFamilies[family.familyKey] ?? false;
              return (
                <article key={family.familyKey} className="rounded-[2rem] border border-border bg-surface-raised p-6 shadow-lg shadow-sand-900/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{family.category} · installed zip imports</div>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">{family.familyName}</h2>
                      <p className="mt-2 text-sm text-ink-secondary">{family.variantCount} variants · {family.importSources[0] ?? 'local import'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFamilyExpanded(family.familyKey)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {expanded ? 'Hide variants' : 'Show variants'}
                    </button>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-border bg-surface px-5 py-6">
                    <p style={{ fontFamily: family.representative.previewFamily }} className="break-words text-[44px] leading-none text-ink md:text-[56px]">
                      {previewText || family.representative.previewText || family.familyName}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-muted">
                    <span className="rounded-full border border-border px-3 py-1">Representative: {family.representative.variantName}</span>
                    <span className="rounded-full border border-border px-3 py-1">{family.favoriteCount} favorites</span>
                    <span className="rounded-full border border-border px-3 py-1">{family.variantCount} variants</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {family.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">{tag}</span>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-2 md:grid-cols-2">
                    <button
                      onClick={() => router.push(`/rhinestone?font=${family.representative.key}&text=${encodeURIComponent(previewText || 'Sulay 123')}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent-300 hover:text-accent-600"
                    >
                      <Gem className="h-4 w-4" />
                      Use representative in Rhinestone
                    </button>
                    <button
                      onClick={() => router.push(`/htv?font=${family.representative.key}&text=${encodeURIComponent(previewText || 'Sulay 123')}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-600"
                    >
                      <SwatchBook className="h-4 w-4" />
                      Use representative in HTV
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-5 space-y-3 border-t border-border pt-5">
                      {family.variants.map((font) => (
                        <div key={font.key} className="rounded-2xl border border-border bg-surface px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-ink">{font.variantName}</div>
                              <div className="mt-1 text-xs text-ink-muted">{font.fileName ?? font.name}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateUploadedFont(font.key, (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }))}
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

        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {standaloneFonts.map((font) => (
            <article key={font.key} className="rounded-[2rem] border border-border bg-surface-raised p-6 shadow-lg shadow-sand-900/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{font.category} · {font.source}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{font.name}</h2>
                </div>
                <button
                  onClick={() => {
                    if (font.source !== 'bundled') {
                      updateUploadedFont(font.key, (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }));
                    } else {
                      updateFontPreference(font.key, (current) => ({ ...current, favorite: !current.favorite }));
                    }
                  }}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${font.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-muted hover:text-ink'}`}
                  title="Favorite"
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-border bg-surface px-5 py-6">
                <p style={{ fontFamily: font.previewFamily }} className="break-words text-[44px] leading-none text-ink md:text-[56px]">
                  {previewText || font.previewText || 'Sulay 123'}
                </p>
              </div>

              <p className="mt-4 text-sm leading-7 text-ink-secondary">{font.note}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
                <span className="rounded-full border border-border px-3 py-1">{font.styleLabel}</span>
                <span className="rounded-full border border-border px-3 py-1">{coverageLabel(font.preferredTextCoverageMode)}</span>
                {font.fileName ? <span className="rounded-full border border-border px-3 py-1">{font.fileName}</span> : null}
              </div>

              <label className="mt-4 block space-y-2 text-sm text-ink-secondary">
                <span className="font-medium text-ink">Tags</span>
                <input
                  value={font.tags.join(', ')}
                  onChange={(event) => {
                    const tags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean);
                    if (font.source !== 'bundled') {
                      updateUploadedFont(font.key, (current) => ({ ...current, tags, updatedAt: new Date().toISOString() }));
                    } else {
                      updateFontPreference(font.key, (current) => ({ ...current, tags }));
                    }
                  }}
                  placeholder="wedding, chrome, mascot"
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                {font.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">{tag}</span>
                ))}
              </div>

              {font.source !== 'bundled' ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-ink-secondary">
                    <span className="font-medium text-ink">Category</span>
                    <select
                      value={font.category}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, category: event.target.value, updatedAt: new Date().toISOString() }))}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink"
                    >
                      {UPLOAD_FONT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-ink-secondary">
                    <span className="font-medium text-ink">Style label</span>
                    <input
                      value={font.styleLabel}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, styleLabel: event.target.value, updatedAt: new Date().toISOString() }))}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-ink-secondary">
                    <span className="font-medium text-ink">Coverage default</span>
                    <select
                      value={font.preferredTextCoverageMode}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, preferredTextCoverageMode: event.target.value as UploadedWorkspaceFont['preferredTextCoverageMode'], updatedAt: new Date().toISOString() }))}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink"
                    >
                      {COVERAGE_DEFAULTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-ink-secondary">
                    <span className="font-medium text-ink">Fallback sample</span>
                    <input
                      value={font.previewText}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, previewText: event.target.value, updatedAt: new Date().toISOString() }))}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-ink-secondary md:col-span-2">
                    <span className="font-medium text-ink">License / source</span>
                    <input
                      value={font.licenseSource}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, licenseSource: event.target.value, updatedAt: new Date().toISOString() }))}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-ink-secondary md:col-span-2">
                    <span className="font-medium text-ink">Production note</span>
                    <textarea
                      value={font.note}
                      onChange={(event) => updateUploadedFont(font.key, (current) => ({ ...current, note: event.target.value, updatedAt: new Date().toISOString() }))}
                      rows={3}
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-secondary">
                  {font.licenseSource}
                </div>
              )}

              <div className="mt-5 grid gap-2 md:grid-cols-2">
                <button
                  onClick={() => router.push(`/rhinestone?font=${font.key}&text=${encodeURIComponent(previewText || 'Sulay 123')}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent-300 hover:text-accent-600"
                >
                  <Gem className="h-4 w-4" />
                  Use in Rhinestone
                </button>
                <button
                  onClick={() => router.push(`/htv?font=${font.key}&text=${encodeURIComponent(previewText || 'Sulay 123')}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-600"
                >
                  <SwatchBook className="h-4 w-4" />
                  Use in HTV
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <button
                  onClick={() => {
                    if (font.source !== 'bundled') {
                      updateUploadedFont(font.key, (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }));
                    } else {
                      updateFontPreference(font.key, (current) => ({ ...current, archived: !current.archived }));
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-surface px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}