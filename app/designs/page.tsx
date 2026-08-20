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
    <WorkspacePage tone="neutral">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <WorkspaceHero
          eyebrow="My Designs"
          title="Everything you have already made, still usable"
          description="Reopen saved rhinestone templates, continue HTV layouts, favorite the winners, archive old variants, and keep names tidy enough to find under pressure."
          tone="neutral"
          aside={(
            <WorkspaceSurface className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Recovery cue</div>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">
                This page is optimized for returning to production work fast, not for browsing a gallery without context.
              </p>
            </WorkspaceSurface>
          )}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetricCard label="Total saved" value={rhinestoneDesigns.length + vault.htvDesigns.length} />
          <WorkspaceMetricCard label="Rhinestone" value={rhinestoneDesigns.length} />
          <WorkspaceMetricCard label="HTV" value={vault.htvDesigns.length} />
        </section>

        <WorkspaceSurface className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr]">
            <label className="flex items-center gap-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or tag"
                className={workspaceInputClassName}
              />
            </label>
            <select value={studioFilter} onChange={(event) => setStudioFilter(event.target.value as StudioFilter)} className={workspaceSelectClassName}>
              <option value="all">All studios</option>
              <option value="rhinestone">Rhinestone</option>
              <option value="htv">HTV</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className={workspaceSelectClassName}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </WorkspaceSurface>

        <section className="grid gap-5 xl:grid-cols-2">
          {visibleDesigns.map((design) => (
            <article key={`${design.studio}:${design.id}`} className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.92)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
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
                  <WorkspaceTag key={tag}>{tag}</WorkspaceTag>
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

        {visibleDesigns.length === 0 && (
          <WorkspaceEmptyState
            title="No designs match the current filters"
            description="Switch studio or status filters, or clear the search term to bring saved and archived work back into view."
          />
        )}
      </div>
    </WorkspacePage>
  );
}