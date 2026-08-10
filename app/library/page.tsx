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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,107,61,0.12),transparent_26%),linear-gradient(180deg,#faf8f5_0%,#f6f0e6_100%)] px-4 py-8 md:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[2.5rem] border border-border bg-surface-raised/90 p-8 shadow-xl shadow-sand-900/5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                Library
              </div>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Your asset command center</h1>
              <p className="mt-4 text-base leading-8 text-ink-secondary md:text-lg">
                Bulk upload artwork, clean up naming, tag everything that matters, and launch the right asset straight into Rhinestone or HTV Studio.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] px-5 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-brand-500/20 transition hover:brightness-105">
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
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Assets</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{vault.assets.length}</div>
          </div>
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Vectors</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{vault.assets.filter((asset) => asset.kind === 'svg').length}</div>
          </div>
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Favorited</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{vault.assets.filter((asset) => asset.favorite).length}</div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-surface-raised/90 p-5 shadow-lg shadow-sand-900/5">
          <div className="grid gap-3 lg:grid-cols-[1.8fr_repeat(4,minmax(0,1fr))]">
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, filename, or tag"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </label>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="all">All kinds</option>
              <option value="svg">SVG only</option>
              <option value="image">Image only</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="all">All tags</option>
              {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="recent">Recently updated</option>
              <option value="name">Name</option>
              <option value="favorites">Favorites first</option>
            </select>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {visibleAssets.map((asset) => (
            <article key={asset.assetId} className="overflow-hidden rounded-[2rem] border border-border bg-surface-raised shadow-lg shadow-sand-900/5">
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
                    <span key={tag} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">{tag}</span>
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
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${asset.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-secondary hover:text-ink'}`}
                  >
                    <Star className="h-4 w-4" />
                    {asset.favorite ? 'Favorited' : 'Favorite'}
                  </button>
                  <button
                    onClick={() => updateAsset(asset.assetId, (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }))}
                    className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink"
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
          <section className="rounded-[2rem] border border-dashed border-border-strong bg-surface-raised/80 px-8 py-16 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-ink">No assets match the current filters</h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Upload a batch of SVGs, PNGs, or JPGs, or change the filters to bring archived items back into view.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}