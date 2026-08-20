'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Gem, Image as ImageIcon, LibraryBig, Search, Star, SwatchBook, Trash2, Upload } from 'lucide-react';
import {
  type WorkspaceAsset,
  type WorkspaceVault,
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
} from '../components/workspace/WorkspaceChrome';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function fileToAsset(file: File): Promise<WorkspaceAsset> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const svgText = isSvg ? await file.text() : null;
  const sourceDataUrl = isSvg
    ? `data:image/svg+xml;utf8,${encodeURIComponent(svgText ?? '')}`
    : await readFileAsDataUrl(file);
  const now = new Date().toISOString();

  return {
    assetId: makeWorkspaceId('asset'),
    name: file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    kind: isSvg ? 'svg' : 'image',
    mimeType: file.type || (isSvg ? 'image/svg+xml' : 'application/octet-stream'),
    sizeBytes: file.size,
    tags: [isSvg ? 'vector' : 'raster'],
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    previewDataUrl: sourceDataUrl,
    sourceDataUrl,
    svgText,
  };
}

function persistVault(nextVault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function LibraryPage() {
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(() => readWorkspaceVault());
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'svg' | 'image'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'favorites'>('recent');
  const [tagFilter, setTagFilter] = useState('all');

  const allTags = useMemo(
    () => Array.from(new Set(vault.assets.flatMap((asset) => asset.tags))).sort((a, b) => a.localeCompare(b)),
    [vault.assets],
  );

  const visibleAssets = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    const filtered = vault.assets.filter((asset) => {
      if (kindFilter !== 'all' && asset.kind !== kindFilter) return false;
      if (statusFilter === 'active' && asset.archived) return false;
      if (statusFilter === 'archived' && !asset.archived) return false;
      if (tagFilter !== 'all' && !asset.tags.includes(tagFilter)) return false;
      if (!loweredQuery) return true;
      return `${asset.name} ${asset.fileName} ${asset.tags.join(' ')}`.toLowerCase().includes(loweredQuery);
    });

    filtered.sort((left, right) => {
      if (sortBy === 'name') return left.name.localeCompare(right.name);
      if (sortBy === 'favorites') {
        if (left.favorite !== right.favorite) return Number(right.favorite) - Number(left.favorite);
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    return filtered;
  }, [kindFilter, query, sortBy, statusFilter, tagFilter, vault.assets]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded = await Promise.all(Array.from(files).map(fileToAsset));
    const nextVault = {
      ...vault,
      assets: [...uploaded, ...vault.assets],
    };
    persistVault(nextVault, setVault);
  };

  const updateAsset = (assetId: string, updater: (asset: WorkspaceAsset) => WorkspaceAsset) => {
    const nextVault = {
      ...vault,
      assets: vault.assets.map((asset) => (asset.assetId === assetId ? updater(asset) : asset)),
    };
    persistVault(nextVault, setVault);
  };

  return (
    <WorkspacePage tone="brand">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <WorkspaceHero
          eyebrow="Library"
          title="Asset command center"
          description="Upload artwork in bulk, keep naming and tags clean, and launch the right vector or raster source into the right studio without hunting through folders."
          tone="brand"
          actions={(
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-sand-900/15 transition hover:bg-sand-800">
              <Upload className="h-4 w-4" />
              Bulk upload assets
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                multiple
                className="hidden"
                onChange={(event) => {
                  void handleUpload(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          )}
          aside={(
            <WorkspaceSurface className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Workspace behavior</div>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                Vector files stay easy to route into Rhinestone. Raster files stay visible for HTV tracing and silhouette cleanup.
              </p>
            </WorkspaceSurface>
          )}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetricCard label="Assets" value={vault.assets.length} />
          <WorkspaceMetricCard label="Vectors" value={vault.assets.filter((asset) => asset.kind === 'svg').length} />
          <WorkspaceMetricCard label="Favorited" value={vault.assets.filter((asset) => asset.favorite).length} />
        </section>

        <WorkspaceSurface className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1.8fr_repeat(4,minmax(0,1fr))]">
            <label className="flex items-center gap-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, filename, or tag"
                className={workspaceInputClassName}
              />
            </label>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)} className={workspaceSelectClassName}>
              <option value="all">All kinds</option>
              <option value="svg">SVG only</option>
              <option value="image">Image only</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className={workspaceSelectClassName}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className={workspaceSelectClassName}>
              <option value="all">All tags</option>
              {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={workspaceSelectClassName}>
              <option value="recent">Recently updated</option>
              <option value="name">Name</option>
              <option value="favorites">Favorites first</option>
            </select>
          </div>
        </WorkspaceSurface>

        <section className="grid gap-5 xl:grid-cols-2">
          {visibleAssets.map((asset) => (
            <article key={asset.assetId} className="group overflow-hidden rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.92)] shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
              <div className="flex min-h-[280px] items-center justify-center bg-[linear-gradient(180deg,#ffffff,#f7f2ea)] p-5">
                {asset.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- asset previews are client-side data URLs, not remote media
                  <img src={asset.previewDataUrl} alt={asset.name} className="max-h-64 rounded-2xl object-contain shadow-md shadow-sand-900/10" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- asset previews are client-side SVG data URLs
                  <img src={asset.previewDataUrl} alt={asset.name} className="max-h-64 rounded-2xl object-contain" />
                )}
              </div>

              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">
                    {asset.kind === 'svg' ? <LibraryBig className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {asset.kind}
                  </div>
                  <div className="text-xs text-ink-muted">Updated {new Date(asset.updatedAt).toLocaleDateString()}</div>
                </div>

                <input
                  value={asset.name}
                  onChange={(event) => updateAsset(asset.assetId, (current) => ({ ...current, name: event.target.value, updatedAt: new Date().toISOString() }))}
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-lg font-semibold text-ink outline-none focus:border-accent-300"
                />

                <label className="block space-y-2 text-sm text-ink-secondary">
                  <span className="font-medium text-ink">Tags</span>
                  <input
                    value={asset.tags.join(', ')}
                    onChange={(event) => updateAsset(asset.assetId, (current) => ({
                      ...current,
                      tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                      updatedAt: new Date().toISOString(),
                    }))}
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
                    placeholder="competition, bride, mascot, chrome"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <WorkspaceTag key={tag}>{tag}</WorkspaceTag>
                  ))}
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    onClick={() => router.push(`/rhinestone?asset=${asset.assetId}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent-300 hover:text-accent-600"
                  >
                    <Gem className="h-4 w-4" />
                    Open in Rhinestone
                  </button>
                  <button
                    onClick={() => router.push(`/htv?asset=${asset.assetId}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-600"
                  >
                    <SwatchBook className="h-4 w-4" />
                    Open in HTV
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    onClick={() => updateAsset(asset.assetId, (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }))}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${asset.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-secondary hover:bg-surface-raised hover:text-ink'}`}
                  >
                    <Star className="h-4 w-4" />
                    {asset.favorite ? 'Favorited' : 'Favorite'}
                  </button>
                  <button
                    onClick={() => updateAsset(asset.assetId, (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }))}
                    className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
                  >
                    <Archive className="h-4 w-4" />
                    {asset.archived ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    onClick={() => persistVault({ ...vault, assets: vault.assets.filter((item) => item.assetId !== asset.assetId) }, setVault)}
                    className="inline-flex items-center gap-2 rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600 transition hover:bg-danger-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        {visibleAssets.length === 0 && (
          <WorkspaceEmptyState
            title="No assets match the current filters"
            description="Upload a batch of SVGs, PNGs, or JPGs, or change the filters to bring archived items back into view."
          />
        )}
      </div>
    </WorkspacePage>
  );
}