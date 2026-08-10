'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, FolderHeart, Gem, Pencil, Search, Star, SwatchBook, Trash2 } from 'lucide-react';
import { LocalStorageTemplateLibraryRepository, type TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';
import {
  type DesignPreference,
  type HtvDesignEntry,
  type WorkspaceVault,
  getDesignArchived,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';

type StudioFilter = 'all' | 'rhinestone' | 'htv';

function persistVault(nextVault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function DesignsPage() {
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(() => readWorkspaceVault());
  const [rhinestoneDesigns, setRhinestoneDesigns] = useState<TemplateLibraryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [studioFilter, setStudioFilter] = useState<StudioFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  useEffect(() => {
    const repository = new LocalStorageTemplateLibraryRepository();
    void repository.list().then((record) => {
      setRhinestoneDesigns(record.userTemplates);
    });
  }, []);

  const visibleDesigns = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    const combined = [
      ...rhinestoneDesigns.map((design) => ({
        id: design.templateId,
        studio: 'rhinestone' as const,
        name: design.name,
        tags: design.tags,
        favorite: design.favorite,
        archived: getDesignArchived(vault, `rhinestone:${design.templateId}`),
        updatedAt: design.updatedAt,
        createdAt: design.createdAt,
        meta: design,
      })),
      ...vault.htvDesigns.map((design) => ({
        id: design.designId,
        studio: 'htv' as const,
        name: design.name,
        tags: design.tags,
        favorite: design.favorite,
        archived: design.archived,
        updatedAt: design.updatedAt,
        createdAt: design.createdAt,
        meta: design,
      })),
    ];

    return combined
      .filter((design) => {
        if (studioFilter !== 'all' && design.studio !== studioFilter) return false;
        if (statusFilter === 'active' && design.archived) return false;
        if (statusFilter === 'archived' && !design.archived) return false;
        if (!loweredQuery) return true;
        return `${design.name} ${design.tags.join(' ')}`.toLowerCase().includes(loweredQuery);
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [query, rhinestoneDesigns, statusFilter, studioFilter, vault]);

  const updateDesignArchived = (designKey: string, archived: boolean) => {
    const nextPref: DesignPreference = { designKey, archived };
    persistVault({
      ...vault,
      designPreferences: [...vault.designPreferences.filter((item) => item.designKey !== designKey), nextPref],
    }, setVault);
  };

  const renameRhinestoneDesign = async (templateId: string) => {
    const repository = new LocalStorageTemplateLibraryRepository();
    const nextName = window.prompt('Rename design');
    if (!nextName || !nextName.trim()) return;
    await repository.rename(templateId, nextName.trim());
    const record = await repository.list();
    setRhinestoneDesigns(record.userTemplates);
  };

  const favoriteRhinestoneDesign = async (templateId: string, favorite: boolean) => {
    const repository = new LocalStorageTemplateLibraryRepository();
    await repository.favorite(templateId, favorite);
    const record = await repository.list();
    setRhinestoneDesigns(record.userTemplates);
  };

  const deleteRhinestoneDesign = async (templateId: string) => {
    const repository = new LocalStorageTemplateLibraryRepository();
    await repository.delete(templateId);
    const record = await repository.list();
    setRhinestoneDesigns(record.userTemplates);
  };

  const updateHtvDesign = (designId: string, updater: (design: HtvDesignEntry) => HtvDesignEntry) => {
    persistVault({
      ...vault,
      htvDesigns: vault.htvDesigns.map((design) => (design.designId === designId ? updater(design) : design)),
    }, setVault);
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(255,107,61,0.14),transparent_26%),linear-gradient(180deg,#faf8f5_0%,#f6f1e8_100%)] px-4 py-8 md:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="rounded-[2.5rem] border border-border bg-surface-raised/90 p-8 shadow-xl shadow-sand-900/5">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            My Designs
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Everything you have already made, still usable</h1>
          <p className="mt-4 max-w-4xl text-base leading-8 text-ink-secondary md:text-lg">
            Reopen saved rhinestone templates, continue HTV layouts, favorite the winners, archive the old versions, and keep names and tags clean enough to find what you need under pressure.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Total saved</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{rhinestoneDesigns.length + vault.htvDesigns.length}</div>
          </div>
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Rhinestone</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{rhinestoneDesigns.length}</div>
          </div>
          <div className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">HTV</div>
            <div className="mt-3 text-4xl font-semibold text-ink">{vault.htvDesigns.length}</div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-surface-raised/90 p-5 shadow-lg shadow-sand-900/5">
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr]">
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or tag"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </label>
            <select value={studioFilter} onChange={(event) => setStudioFilter(event.target.value as StudioFilter)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="all">All studios</option>
              <option value="rhinestone">Rhinestone</option>
              <option value="htv">HTV</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {visibleDesigns.map((design) => (
            <article key={`${design.studio}:${design.id}`} className="rounded-[2rem] border border-border bg-surface-raised p-6 shadow-lg shadow-sand-900/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">
                    {design.studio === 'rhinestone' ? <Gem className="h-3.5 w-3.5" /> : <SwatchBook className="h-3.5 w-3.5" />}
                    {design.studio}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-ink">{design.name}</h2>
                </div>
                <button
                  onClick={() => {
                    if (design.studio === 'rhinestone') {
                      void favoriteRhinestoneDesign(design.id, !design.favorite);
                    } else {
                      updateHtvDesign(design.id, (current) => ({ ...current, favorite: !current.favorite, updatedAt: new Date().toISOString() }));
                    }
                  }}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${design.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-muted hover:text-ink'}`}
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-border bg-surface px-5 py-5">
                {design.studio === 'rhinestone' ? (
                  <>
                    <div className="text-sm font-medium text-ink">{(design.meta as TemplateLibraryEntry).stoneCount} stones</div>
                    <div className="mt-2 text-sm text-ink-secondary">Sizes: {(design.meta as TemplateLibraryEntry).stoneSizes.join(', ')}</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-ink">{(design.meta as HtvDesignEntry).previewText}</div>
                    <div className="mt-2 text-sm text-ink-secondary">{(design.meta as HtvDesignEntry).layerCount} layers · {(design.meta as HtvDesignEntry).garmentLabel}</div>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {design.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">{tag}</span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => router.push(design.studio === 'rhinestone' ? `/rhinestone?designId=${design.id}` : `/htv?designId=${design.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] px-4 py-3 text-sm font-semibold text-ink-inverse"
                >
                  <FolderHeart className="h-4 w-4" />
                  Open and continue
                </button>
                <button
                  onClick={() => {
                    if (design.studio === 'rhinestone') {
                      void renameRhinestoneDesign(design.id);
                    } else {
                      const nextName = window.prompt('Rename design', design.name);
                      if (!nextName || !nextName.trim()) return;
                      updateHtvDesign(design.id, (current) => ({ ...current, name: nextName.trim(), updatedAt: new Date().toISOString() }));
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-secondary transition hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    if (design.studio === 'rhinestone') {
                      updateDesignArchived(`rhinestone:${design.id}`, !design.archived);
                    } else {
                      updateHtvDesign(design.id, (current) => ({ ...current, archived: !current.archived, updatedAt: new Date().toISOString() }));
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink-secondary transition hover:text-ink"
                >
                  <Archive className="h-4 w-4" />
                  {design.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  onClick={() => {
                    if (design.studio === 'rhinestone') {
                      void deleteRhinestoneDesign(design.id);
                    } else {
                      persistVault({ ...vault, htvDesigns: vault.htvDesigns.filter((item) => item.designId !== design.id) }, setVault);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600 transition hover:bg-danger-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>

              <div className="mt-4 text-xs text-ink-muted">
                Updated {new Date(design.updatedAt).toLocaleString()}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}