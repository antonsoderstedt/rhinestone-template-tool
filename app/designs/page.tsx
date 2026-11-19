'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, FolderHeart, Gem, Pencil, Search, Star, SwatchBook, Trash2 } from 'lucide-react';
import { LocalStorageTemplateLibraryRepository, type TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';
import {
  type DesignPreference,
  type HtvDesignEntry,
  type WorkspaceVault,
  EMPTY_WORKSPACE_VAULT,
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
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import PromptDialog from '../components/PromptDialog';
import UndoToast from '../components/UndoToast';
import { formatRelativeTime } from '../lib/relativeTime';
import {
  getCalibrationGateSummary,
  getRecoveryActionPlan,
} from '../lib/workspaceRecovery';
import { readActiveCalibrationProfileId } from '../lib/workspaceVault';

type StudioFilter = 'all' | 'rhinestone' | 'htv';
type SortMode = 'recent' | 'name' | 'favorites';

interface RenameTarget {
  studio: 'rhinestone' | 'htv';
  id: string;
  name: string;
}

interface UndoState {
  toastId: number;
  message: string;
  undo: () => void;
}

function persistVault(nextVault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function DesignsPage() {
  const router = useRouter();
  const [vault, setVault] = useState<WorkspaceVault>(EMPTY_WORKSPACE_VAULT);
  const [rhinestoneDesigns, setRhinestoneDesigns] = useState<TemplateLibraryEntry[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [studioFilter, setStudioFilter] = useState<StudioFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [hasAutosave, setHasAutosave] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const savedCount = rhinestoneDesigns.length + vault.htvDesigns.length;
  const recoveryAction = useMemo(() => getRecoveryActionPlan(vault, hasAutosave), [hasAutosave, vault]);
  const calibrationGate = useMemo(
    () => getCalibrationGateSummary(vault, activeProfileId),
    [activeProfileId, vault],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setVault(readWorkspaceVault());
      setActiveProfileId(readActiveCalibrationProfileId());
      setHasAutosave(Boolean(window.localStorage.getItem('rhinestone-template-library-autosave')?.trim()));
      setNow(new Date());
    });
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
      .sort((left, right) => {
        if (sortMode === 'name') return left.name.localeCompare(right.name);
        if (sortMode === 'favorites' && left.favorite !== right.favorite) {
          return Number(right.favorite) - Number(left.favorite);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [query, rhinestoneDesigns, sortMode, statusFilter, studioFilter, vault]);

  const updateDesignArchived = (designKey: string, archived: boolean) => {
    const nextPref: DesignPreference = { designKey, archived };
    persistVault({
      ...vault,
      designPreferences: [...vault.designPreferences.filter((item) => item.designKey !== designKey), nextPref],
    }, setVault);
  };

  const submitRename = async (nextName: string) => {
    const target = renameTarget;
    setRenameTarget(null);
    if (!target) return;
    if (target.studio === 'rhinestone') {
      const repository = new LocalStorageTemplateLibraryRepository();
      await repository.rename(target.id, nextName);
      const record = await repository.list();
      setRhinestoneDesigns(record.userTemplates);
    } else {
      updateHtvDesign(target.id, (current) => ({ ...current, name: nextName, updatedAt: new Date().toISOString() }));
    }
  };

  const showUndo = (message: string, undo: () => void) => {
    setUndoState((current) => ({ toastId: (current?.toastId ?? 0) + 1, message, undo }));
  };

  const favoriteRhinestoneDesign = async (templateId: string, favorite: boolean) => {
    const repository = new LocalStorageTemplateLibraryRepository();
    await repository.favorite(templateId, favorite);
    const record = await repository.list();
    setRhinestoneDesigns(record.userTemplates);
  };

  const deleteRhinestoneDesign = async (entry: TemplateLibraryEntry) => {
    const repository = new LocalStorageTemplateLibraryRepository();
    await repository.delete(entry.templateId);
    const record = await repository.list();
    setRhinestoneDesigns(record.userTemplates);
    showUndo(`Deleted “${entry.name}”.`, () => {
      void (async () => {
        await repository.save(entry);
        const restored = await repository.list();
        setRhinestoneDesigns(restored.userTemplates);
      })();
    });
  };

  const deleteHtvDesign = (entry: HtvDesignEntry) => {
    persistVault({ ...vault, htvDesigns: vault.htvDesigns.filter((item) => item.designId !== entry.designId) }, setVault);
    showUndo(`Deleted “${entry.name}”.`, () => {
      // Restore from the latest stored vault so changes made meanwhile are kept.
      const latest = readWorkspaceVault();
      if (latest.htvDesigns.some((item) => item.designId === entry.designId)) return;
      persistVault({ ...latest, htvDesigns: [entry, ...latest.htvDesigns] }, setVault);
    });
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
        <WorkspaceQuickActions
          actions={[
            {
              label: 'Setup & calibration',
              description: 'Verify calibration before reopening a saved production job.',
              href: '/setup',
              icon: FolderHeart,
              tone: 'brand',
            },
            {
              label: 'Rhinestone studio',
              description: 'Resume an active rhinestone layout with the latest saved context.',
              href: '/rhinestone',
              icon: Gem,
              tone: 'default',
            },
            {
              label: 'HTV studio',
              description: 'Jump to the garment workflow for the next cut or placement pass.',
              href: '/htv',
              icon: SwatchBook,
              tone: 'neutral',
            },
            {
              label: 'Production settings',
              description: 'Tune material defaults and quality checks before export.',
              href: '/settings',
              icon: Search,
              tone: 'neutral',
            },
          ]}
        />

        <WorkspaceModeBanner
          mode="My Designs"
          status="Ready"
          project="Saved in this browser"
          guidance={
            savedCount === 0
              ? 'Designs you save with Save in a studio are kept in this browser and listed here. Use Export file in the Rhinestone studio to back them up as a file.'
              : 'These designs are stored in this browser only. Use Export file in the Rhinestone studio to back one up or move it to another computer.'
          }
        />

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
              <div className="mt-4 rounded-[1.25rem] border border-border bg-surface px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Calibration gate</div>
                <div className="mt-2 text-base font-semibold text-ink">{calibrationGate.activeProfileName ?? 'No active profile'}</div>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {calibrationGate.activeProfileApproved
                    ? `Approved and ready for the next production pass.`
                    : 'Approval is still pending before export or production work.'}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(recoveryAction.href)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] px-4 py-2.5 text-sm font-semibold text-ink-inverse"
                >
                  <FolderHeart className="h-4 w-4" />
                  {recoveryAction.label}
                </button>
              </div>
            </WorkspaceSurface>
          )}
        />

        <section className="grid gap-4 md:grid-cols-4">
          <WorkspaceMetricCard label="Total saved" value={rhinestoneDesigns.length + vault.htvDesigns.length} />
          <WorkspaceMetricCard label="Rhinestone" value={rhinestoneDesigns.length} />
          <WorkspaceMetricCard label="HTV" value={vault.htvDesigns.length} />
          <WorkspaceMetricCard label="Calibration" value={calibrationGate.approvedCalibrationCount > 0 ? `${calibrationGate.approvedCalibrationCount} approved` : 'Pending'} />
        </section>

        <WorkspaceSurface className="p-5">
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <label className="flex items-center gap-3">
              <Search className="h-4 w-4 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or tag" aria-label="Search designs"
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
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={workspaceSelectClassName} aria-label="Sort designs">
              <option value="recent">Recently updated</option>
              <option value="name">Name (A–Z)</option>
              <option value="favorites">Favorites first</option>
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
                  aria-label={design.favorite ? `Remove ${design.name} from favorites` : `Add ${design.name} to favorites`}
                  aria-pressed={design.favorite}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${design.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-muted hover:text-ink'}`}
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-border bg-surface">
                {design.studio === 'rhinestone' && (design.meta as TemplateLibraryEntry).previewRef ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-generated data: URI thumbnail
                  <img
                    src={(design.meta as TemplateLibraryEntry).previewRef ?? undefined}
                    alt={`Preview of ${design.name}`}
                    className="h-36 w-full bg-white object-contain p-2"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-white px-4 text-center text-lg font-semibold text-ink-secondary">
                    {design.studio === 'htv' ? (design.meta as HtvDesignEntry).previewText || design.name : design.name}
                  </div>
                )}
                <div className="border-t border-border px-5 py-3">
                  {design.studio === 'rhinestone' ? (
                    <>
                      <div className="text-sm font-medium text-ink">{(design.meta as TemplateLibraryEntry).stoneCount} stones</div>
                      <div className="mt-1 text-xs text-ink-secondary">Sizes: {(design.meta as TemplateLibraryEntry).stoneSizes.join(', ') || '—'}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-ink">{(design.meta as HtvDesignEntry).layerCount} layers</div>
                      <div className="mt-1 text-xs text-ink-secondary">{(design.meta as HtvDesignEntry).garmentLabel}</div>
                    </>
                  )}
                </div>
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
                  onClick={() => setRenameTarget({ studio: design.studio, id: design.id, name: design.name })}
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
                      void deleteRhinestoneDesign(design.meta as TemplateLibraryEntry);
                    } else {
                      deleteHtvDesign(design.meta as HtvDesignEntry);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600 transition hover:bg-danger-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>

              <div className="mt-4 text-xs text-ink-muted" title={new Date(design.updatedAt).toLocaleString()}>
                Updated {now ? formatRelativeTime(design.updatedAt, now) : '…'}
              </div>
            </article>
          ))}
        </section>

        {visibleDesigns.length === 0 && (
          rhinestoneDesigns.length + vault.htvDesigns.length === 0 ? (
            <WorkspaceEmptyState
              title="No saved designs yet"
              description="Press Save in the Rhinestone or HTV studio to keep a design in this browser. It will appear here. Autosave only protects your current session, so it is not listed."
            />
          ) : (
            <WorkspaceEmptyState
              title="No designs match the current filters"
              description="Switch studio or status filters, or clear the search to see everything again. Archived designs are hidden under the Active filter."
            />
          )
        )}
      </div>

      <PromptDialog
        open={renameTarget !== null}
        title="Rename design"
        label="Design name"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onSubmit={(value) => { void submitRename(value); }}
        onCancel={() => setRenameTarget(null)}
      />
      <UndoToast
        message={undoState?.message ?? null}
        toastId={undoState?.toastId ?? 0}
        onUndo={() => {
          undoState?.undo();
          setUndoState(null);
        }}
        onDismiss={() => setUndoState(null)}
      />
    </WorkspacePage>
  );
}