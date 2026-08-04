'use client';

import { FolderOpen, Heart, HeartOff, LibraryBig, Save, Trash2 } from 'lucide-react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';

interface TemplateLibraryPanelProps {
  open: boolean;
  autosaveEntry: TemplateLibraryEntry | null;
  builtInEntries: readonly TemplateLibraryEntry[];
  userEntries: readonly TemplateLibraryEntry[];
  onClose: () => void;
  onSaveCurrent: () => void;
  onLoad: (templateId: string) => void;
  onLoadAutosave: () => void;
  onFavorite: (templateId: string, favorite: boolean) => void;
  onDelete: (templateId: string) => void;
  onRename: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
}

export default function TemplateLibraryPanel({
  open,
  autosaveEntry,
  builtInEntries,
  userEntries,
  onClose,
  onSaveCurrent,
  onLoad,
  onLoadAutosave,
  onFavorite,
  onDelete,
  onRename,
  onDuplicate,
}: TemplateLibraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'starter' | 'saved'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'name' | 'stones'>('recent');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  const sortEntries = useCallback((entries: readonly TemplateLibraryEntry[]) => {
    const copy = [...entries];
    copy.sort((left, right) => {
      if (sortMode === 'name') return left.name.localeCompare(right.name);
      if (sortMode === 'stones') return right.stoneCount - left.stoneCount || left.name.localeCompare(right.name);
      return right.updatedAt.localeCompare(left.updatedAt);
    });
    return copy;
  }, [sortMode]);

  const matchesQuery = useCallback((entry: TemplateLibraryEntry) => {
    if (!normalizedQuery && !selectedTag) return true;
    const haystack = [entry.name, entry.category, ...entry.tags, ...entry.stoneSizes].join(' ').toLowerCase();
    const queryMatch = !normalizedQuery || haystack.includes(normalizedQuery);
    const tagMatch = !selectedTag || entry.tags.includes(selectedTag) || entry.category === selectedTag;
    return queryMatch && tagMatch;
  }, [normalizedQuery, selectedTag]);

  const matchesFilter = useCallback((entry: TemplateLibraryEntry) => {
    if (filterMode === 'favorites') return entry.favorite;
    if (filterMode === 'starter') return entry.builtIn;
    if (filterMode === 'saved') return !entry.builtIn;
    return true;
  }, [filterMode]);

  const visibleAutosaveEntry = useMemo(() => {
    if (!autosaveEntry) return null;
    return matchesFilter(autosaveEntry) && matchesQuery(autosaveEntry) ? autosaveEntry : null;
  }, [autosaveEntry, matchesFilter, matchesQuery]);

  const filteredBuiltInEntries = useMemo(
    () => sortEntries(builtInEntries.filter((entry) => matchesFilter(entry) && matchesQuery(entry))),
    [builtInEntries, matchesFilter, matchesQuery, sortEntries],
  );

  const filteredUserEntries = useMemo(
    () => sortEntries(userEntries.filter((entry) => matchesFilter(entry) && matchesQuery(entry))),
    [userEntries, matchesFilter, matchesQuery, sortEntries],
  );

  const favoriteEntries = useMemo(
    () => sortEntries([...filteredBuiltInEntries, ...filteredUserEntries].filter((entry) => entry.favorite)),
    [filteredBuiltInEntries, filteredUserEntries, sortEntries],
  );

  const recentEntries = useMemo(() => filteredUserEntries.slice(0, 3), [filteredUserEntries]);

  const remainingUserEntries = useMemo(() => {
    const excludedIds = new Set([...recentEntries, ...favoriteEntries].map((entry) => entry.templateId));
    return filteredUserEntries.filter((entry) => !excludedIds.has(entry.templateId));
  }, [favoriteEntries, filteredUserEntries, recentEntries]);

  const remainingBuiltInEntries = useMemo(() => {
    const favoriteIds = new Set(favoriteEntries.map((entry) => entry.templateId));
    return filteredBuiltInEntries.filter((entry) => !favoriteIds.has(entry.templateId));
  }, [favoriteEntries, filteredBuiltInEntries]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const entry of [...builtInEntries, ...userEntries]) {
      tags.add(entry.category);
      for (const tag of entry.tags) tags.add(tag);
    }
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [builtInEntries, userEntries]);

  const totalVisibleEntries = (visibleAutosaveEntry ? 1 : 0) + filteredBuiltInEntries.length + filteredUserEntries.length;

  if (!open) return null;

  const renderEntry = (entry: TemplateLibraryEntry) => (
    <article key={entry.templateId} className="rounded-xl border border-border bg-surface-raised p-4">
      <div className="overflow-hidden rounded-lg border border-border bg-surface-sunken">
        {entry.previewRef ? (
          <img src={entry.previewRef} alt={entry.name} className="h-28 w-full object-contain bg-surface-sunken" />
        ) : (
          <div className="flex h-28 items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_45%),linear-gradient(135deg,_#18181b,_#09090b)] px-4 text-center text-xs text-ink-secondary">
            {entry.name}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink">{entry.name}</h3>
            {entry.builtIn && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">Built-in</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTag((current) => current === entry.category ? null : entry.category)}
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide transition ${selectedTag === entry.category ? 'bg-success-500 text-ink-inverse' : 'bg-surface-sunken text-ink-secondary hover:bg-sand-200 hover:text-ink'}`}
            >
              {entry.category}
            </button>
            {entry.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag((current) => current === tag ? null : tag)}
                className={`rounded-full px-2 py-0.5 text-[10px] transition ${selectedTag === tag ? 'bg-success-500 text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {entry.stoneCount} stones
            {entry.widthMm && entry.heightMm ? ` • ${entry.widthMm.toFixed(0)}×${entry.heightMm.toFixed(0)} mm` : ''}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Updated {new Date(entry.updatedAt).toLocaleString()}</p>
        </div>
        <button
          onClick={() => onFavorite(entry.templateId, !entry.favorite)}
          className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
          title={entry.favorite ? 'Remove favorite' : 'Favorite'}
        >
          {entry.favorite ? <Heart className="h-4 w-4 fill-current text-rose-300" /> : <HeartOff className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onLoad(entry.templateId)}
          className="inline-flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-sand-200"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Open
        </button>
        <button
          onClick={() => onDuplicate(entry.templateId)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
        >
          Duplicate
        </button>
        {!entry.builtIn && (
          <button
            onClick={() => onRename(entry.templateId)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
          >
            Rename
          </button>
        )}
        {!entry.builtIn && (
          <button
            onClick={() => onDelete(entry.templateId)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/40 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface-sunken shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-ink">
              <LibraryBig className="h-4 w-4 text-warning-600" />
              <h2 className="text-sm font-semibold">Template Library</h2>
            </div>
            <p className="mt-1 text-xs text-ink-muted">Save and reopen designs directly in the browser.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <button
            onClick={onSaveCurrent}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-warning-500 px-3 py-2 text-sm font-medium text-ink-inverse transition hover:bg-warning-600"
          >
            <Save className="h-4 w-4" />
            Save Current Design
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <div className="space-y-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search names, tags, sizes..."
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-warning-500 focus:outline-none"
            />

            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['favorites', 'Favorites'],
                ['starter', 'Starter'],
                ['saved', 'Saved'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilterMode(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filterMode === value ? 'bg-warning-500 text-ink-inverse' : 'bg-surface-raised text-ink-secondary hover:bg-surface-sunken hover:text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTags.slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag((current) => current === tag ? null : tag)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${selectedTag === tag ? 'bg-success-500 text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink'}`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between gap-3 text-xs text-ink-muted">
              <span>Sort by</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as 'recent' | 'name' | 'stones')}
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-ink focus:border-warning-500 focus:outline-none"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name</option>
                <option value="stones">Stone count</option>
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {builtInEntries.length === 0 && userEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 px-4 py-8 text-center">
              <p className="text-sm text-ink">No saved designs yet.</p>
              <p className="mt-2 text-xs text-ink-muted">Save the current canvas to start building a reusable design library.</p>
            </div>
          ) : totalVisibleEntries === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised/50 px-4 py-8 text-center">
              <p className="text-sm text-ink">No designs match the current filters.</p>
              <p className="mt-2 text-xs text-ink-muted">Try a different search term or switch the active filter.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {visibleAutosaveEntry && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Autosave</h3>
                    <span className="text-xs text-ink-muted">1</span>
                  </div>
                  <div className="space-y-3">
                    <article className="rounded-xl border border-warning-500/20 bg-surface-raised p-4">
                      <div className="overflow-hidden rounded-lg border border-border bg-surface-sunken">
                        {visibleAutosaveEntry.previewRef ? (
                          <img src={visibleAutosaveEntry.previewRef} alt={visibleAutosaveEntry.name} className="h-28 w-full object-contain bg-surface-sunken" />
                        ) : null}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-ink">{visibleAutosaveEntry.name}</h3>
                          <span className="rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning-600">Autosave</span>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">Updated {new Date(visibleAutosaveEntry.updatedAt).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={onLoadAutosave}
                          className="inline-flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-sand-200"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          Open Autosave
                        </button>
                      </div>
                    </article>
                  </div>
                </section>
              )}

              {favoriteEntries.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Favorites</h3>
                    <span className="text-xs text-ink-muted">{favoriteEntries.length}</span>
                  </div>
                  <div className="space-y-3">{favoriteEntries.map(renderEntry)}</div>
                </section>
              )}

              {recentEntries.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Recent Designs</h3>
                    <span className="text-xs text-ink-muted">{recentEntries.length}</span>
                  </div>
                  <div className="space-y-3">{recentEntries.map(renderEntry)}</div>
                </section>
              )}

              {remainingBuiltInEntries.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Starter Templates</h3>
                    <span className="text-xs text-ink-muted">{remainingBuiltInEntries.length}</span>
                  </div>
                  <div className="space-y-3">{remainingBuiltInEntries.map(renderEntry)}</div>
                </section>
              )}

              {remainingUserEntries.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Saved Designs</h3>
                    <span className="text-xs text-ink-muted">{remainingUserEntries.length}</span>
                  </div>
                  <div className="space-y-3">{remainingUserEntries.map(renderEntry)}</div>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}