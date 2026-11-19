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
    if (!normalizedQuery) return true;
    const haystack = [entry.name, entry.category, ...entry.tags, ...entry.stoneSizes].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  }, [normalizedQuery]);

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

  const totalVisibleEntries = (visibleAutosaveEntry ? 1 : 0) + filteredBuiltInEntries.length + filteredUserEntries.length;

  if (!open) return null;

  const renderEntry = (entry: TemplateLibraryEntry) => (
    <article key={entry.templateId} className="flex-none w-[200px] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-3 transition hover:border-violet-400/40 hover:bg-[var(--studio-hover-overlay-soft)]">
      <div className="overflow-hidden rounded border border-[var(--studio-border)] bg-[var(--studio-bg)]">
        {entry.previewRef ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-generated data: URI thumbnail, no network fetch for next/image to optimize
          <img src={entry.previewRef} alt={entry.name} className="h-20 w-full object-contain" />
        ) : (
          <div className="flex h-20 items-center justify-center text-[10px] text-[var(--studio-ink-muted)] px-2 text-center">
            {entry.name}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold text-[var(--studio-ink)]">{entry.name}</h3>
          <p className="mt-0.5 text-[10px] text-[var(--studio-ink-muted)]">
            {entry.stoneCount} stones
            {entry.widthMm && entry.heightMm ? ` · ${entry.widthMm.toFixed(0)}×${entry.heightMm.toFixed(0)} mm` : ''}
          </p>
        </div>
        <button
          onClick={() => onFavorite(entry.templateId, !entry.favorite)}
          aria-label={entry.favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`}
          className="rounded p-1 text-[var(--studio-ink-muted)] transition hover:text-[var(--studio-ink)]"
          title={entry.favorite ? 'Remove favorite' : 'Favorite'}
        >
          {entry.favorite ? <Heart className="h-3.5 w-3.5 fill-current text-rose-400" /> : <HeartOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          onClick={() => entry.tags.includes('autosave') ? onLoadAutosave() : onLoad(entry.templateId)}
          className="inline-flex items-center gap-1 rounded bg-violet-500/20 px-2 py-1 text-[10px] font-medium text-violet-200 transition hover:bg-violet-500/35"
        >
          <FolderOpen className="h-3 w-3" />
          Open
        </button>
        {!entry.tags.includes('autosave') && (
          <button
            onClick={() => onDuplicate(entry.templateId)}
            className="inline-flex items-center gap-1 rounded border border-[var(--studio-border)] px-2 py-1 text-[10px] text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
          >
            Copy
          </button>
        )}
        {!entry.builtIn && !entry.tags.includes('autosave') && (
          <button
            onClick={() => onRename(entry.templateId)}
            className="inline-flex items-center gap-1 rounded border border-[var(--studio-border)] px-2 py-1 text-[10px] text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
          >
            Rename
          </button>
        )}
        {!entry.builtIn && !entry.tags.includes('autosave') && (
          <button
            onClick={() => onDelete(entry.templateId)}
            aria-label={`Delete ${entry.name}`}
            className="inline-flex items-center gap-1 rounded border border-[var(--studio-border)] px-2 py-1 text-[10px] text-[var(--studio-ink-muted)] transition hover:border-rose-400/40 hover:text-rose-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50 backdrop-blur-sm">
      <aside className="flex max-h-[65vh] w-full flex-col border-t border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-2xl">
        <div className="border-b border-[var(--studio-border)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-full border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-ink-muted)]">
                Saved in this browser
              </div>
              <div className="flex items-center gap-2 text-[var(--studio-ink)]">
                <LibraryBig className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold">My Designs</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--studio-border)] px-4 py-2">
          <button
            onClick={onSaveCurrent}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400"
          >
            <Save className="h-3.5 w-3.5" />
            Save to My Designs
          </button>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search…"
            className="min-w-0 flex-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5 text-xs text-[var(--studio-ink)] placeholder:text-[var(--studio-ink-muted)] focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          />
          <div className="flex items-center gap-1">
            {([
              ['all', 'All'],
              ['favorites', '★'],
              ['starter', 'Starter'],
              ['saved', 'Saved'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilterMode(value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${filterMode === value ? 'bg-violet-500/35 text-white' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as 'recent' | 'name' | 'stones')}
            className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 py-1.5 text-xs text-[var(--studio-ink)] focus:outline-none"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="stones">Stones</option>
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {builtInEntries.length === 0 && userEntries.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--studio-border)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--studio-ink-secondary)]">No saved designs yet.</p>
              <p className="mt-1 text-xs text-[var(--studio-ink-muted)]">Press “Save to My Designs” to keep the current canvas in this browser.</p>
            </div>
          ) : totalVisibleEntries === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--studio-border)] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--studio-ink-secondary)]">No designs match these filters.</p>
              <p className="mt-1 text-xs text-[var(--studio-ink-muted)]">Try a different search term or switch the active filter.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[
                ...(visibleAutosaveEntry ? [visibleAutosaveEntry] : []),
                ...favoriteEntries,
                ...recentEntries,
                ...remainingBuiltInEntries,
                ...remainingUserEntries,
              ].map(renderEntry)}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}