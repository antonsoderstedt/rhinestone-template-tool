'use client';

import { Eye, EyeOff, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmptyState, WorkspaceSurface, WorkspaceTag, workspaceInputClassName, workspaceSelectClassName } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import { deleteLibraryItem, fetchLibrary, patchLibrary, uploadLibraryItem, type LibraryState } from '../lib/library/libraryClient';
import { prepareDesign, prepareFont, type DesignReason, type FontReason } from '../lib/library/prepareUpload';
import type { TrackingFailure } from '../lib/tracking/trackingClient';
import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { FONT_CATEGORIES, LIBRARY_LIMITS, patchOverlay, type LibraryKind, type LibraryPatch } from '@/src/lib/library/library';
import { uniqueUploadId } from '@/src/lib/library/libraryItems';
import { EMPTY_FILTER, categoryCounts, filterRows, pageCount, pageOf, shownRows, uploadedRows, type LibraryRow, type ListFilter, type ShownRow, type StatusFilter } from './libraryView';

const PAGE_SIZE = 50;

/** The built library's rows (none when no library was published to this site). */
type Load = { state: 'loading' } | { state: 'ready'; rows: LibraryRow[]; built: boolean };

/** What a library file lists: the designs of `index.json` and the fonts of `catalog.json`, as rows. */
async function loadRows(kind: LibraryKind): Promise<LibraryRow[] | null> {
  try {
    const response = await fetch(withBasePath(kind === 'design' ? '/design-library/index.json' : '/font-library/catalog.json'), { cache: 'no-store' });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return null;
    const body = (await response.json()) as { designs?: Record<string, unknown>[]; fonts?: Record<string, unknown>[] };
    if (kind === 'design') {
      if (!Array.isArray(body.designs)) return null;
      return body.designs.map((d) => ({ id: String(d.id), name: String(d.title ?? ''), category: String(d.category ?? ''), detail: `${d.stones} · ${d.widthMm}×${d.heightMm} mm` }));
    }
    if (!Array.isArray(body.fonts)) return null;
    return body.fonts.map((f) => ({ id: String(f.id), name: String(f.name ?? ''), category: String(f.category ?? ''), detail: String(f.family ?? '') }));
  } catch {
    return null;
  }
}

const label = 'mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted';
const smallButton = 'inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand-100 disabled:opacity-60';

export default function LibraryAdmin() {
  const t = useT();
  const [kind, setKind] = useState<LibraryKind>('design');
  const [libraryState, setLibraryState] = useState<{ state: 'loading' } | { state: 'ready'; library: LibraryState } | { state: 'failed'; reason: TrackingFailure }>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchLibrary().then((result) => {
      if (cancelled) return;
      setLibraryState(result.ok ? { state: 'ready', library: result.value } : { state: 'failed', reason: result.reason });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (libraryState.state === 'loading') return <p className="px-2 text-sm text-ink-secondary" role="status">{t('Loading the libraries…')}</p>;
  if (libraryState.state === 'failed') {
    const reason = libraryState.reason;
    return (
      <WorkspaceEmptyState
        title={reason === 'signin' ? t('Sign in to open the libraries') : reason === 'unavailable' ? t('The libraries need the private site') : t('The libraries could not be loaded')}
        description={
          reason === 'signin'
            ? t('Cloudflare Access did not let this request through. Reload the page and sign in.')
            : reason === 'unavailable'
              ? t('Your changes are kept in the database of your private Cloudflare site. Open the admin panel there (or run scripts/deploy-private.sh --dev locally).')
              : t('Something went wrong when the libraries were asked for. Try again in a moment.')
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={t('Libraries')} className="flex gap-2">
        {(['design', 'font'] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${kind === id ? 'bg-ink text-ink-inverse' : 'border border-border text-ink hover:bg-sand-100'}`}>
            {id === 'design' ? t('Designs') : t('Fonts')}
          </button>
        ))}
      </div>
      <LibraryList key={kind} kind={kind} initial={libraryState.library} />
    </div>
  );
}

function LibraryList({ kind, initial }: { kind: LibraryKind; initial: LibraryState }) {
  const t = useT();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [library, setLibrary] = useState<LibraryState>(initial);
  const overlay = library.overlay;
  const [filter, setFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; name: string; category: string } | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [uploadCategory, setUploadCategory] = useState('');
  const [report, setReport] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRows(kind).then((rows) => {
      if (!cancelled) setLoad({ state: 'ready', rows: rows ?? [], built: rows !== null });
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const uploaded = library.items[kind];
  const shown = useMemo(() => shownRows([...(load.state === 'ready' ? load.rows : []), ...uploadedRows(kind, uploaded)], overlay, kind), [load, uploaded, overlay, kind]);
  const filtered = useMemo(() => filterRows(shown, filter), [shown, filter]);
  const categories = useMemo(() => categoryCounts(shown), [shown]);
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const visible = pageOf(filtered, page, PAGE_SIZE);
  const hiddenCount = useMemo(() => shown.filter((r) => r.hidden).length, [shown]);

  const apply = useCallback(
    async (ids: readonly string[], patch: LibraryPatch, done: string): Promise<boolean> => {
      setBusy(true);
      setMessage(null);
      const result = await patchLibrary(kind, ids, patch);
      setBusy(false);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.message ?? t('Could not save the change.') });
        return false;
      }
      setLibrary((old) => ({ ...old, overlay: patchOverlay(old.overlay, kind, ids, patch) }));
      setMessage({ kind: 'ok', text: done });
      return true;
    },
    [kind, t],
  );

  if (load.state === 'loading') return <p className="px-2 text-sm text-ink-secondary" role="status">{t('Loading the list…')}</p>;

  const changeFilter = (next: Partial<ListFilter>) => {
    setFilter({ ...filter, ...next });
    setPage(0);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const selectedIds = [...selected];
  const allOnPage = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const nothing = kind === 'design' ? t('designs') : t('fonts');

  const reasonText = (reason: DesignReason | FontReason, detail?: string): string => {
    switch (reason) {
      case 'unreadable': return t('This file is not a readable SVG.');
      case 'no-stones': return t('No stones were found in it. It looks like artwork, not a rhinestone template.');
      case 'format': return t('Only TTF, OTF and WOFF fonts can be added.');
      case 'unusable': return detail ? t('The font cannot be used: {why}', { why: detail }) : t('The font has no usable outlines.');
      default: return kind === 'design' ? t('The design is too large.') : t('The font is larger than 1.5 MB. Use a smaller version of it.');
    }
  };

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    const taken = new Set(shown.map((r) => r.id));
    const lines: string[] = [];
    let added = 0;
    for (const file of files) {
      let ready: { name: string; format: string; data: string; design?: { stones: number; widthMm: number; heightMm: number; stoneMm: number } } | null = null;
      if (kind === 'design') {
        if (file.size > 25 * 1024 * 1024) {
          lines.push(`${file.name}: ${reasonText('too-large')}`);
          continue;
        }
        const prepared = prepareDesign(await file.text(), file.name);
        if (!prepared.ok) {
          lines.push(`${file.name}: ${reasonText(prepared.reason)}`);
          continue;
        }
        ready = { name: prepared.name, format: 'json', data: prepared.data, design: prepared.design };
      } else {
        const prepared = prepareFont(file.name, new Uint8Array(await file.arrayBuffer()));
        if (!prepared.ok) {
          lines.push(`${file.name}: ${reasonText(prepared.reason, prepared.detail)}`);
          continue;
        }
        ready = { name: prepared.name, format: prepared.format, data: prepared.data };
      }
      const id = uniqueUploadId(ready.name, taken);
      const category = uploadCategory.trim() || (kind === 'font' ? 'Uploads' : 'Uploaded');
      const result = await uploadLibraryItem({ kind, id, name: ready.name, category, format: ready.format, family: kind === 'font' ? ready.name : undefined, design: ready.design, data: ready.data });
      if (result.ok) {
        taken.add(id);
        added += 1;
      } else lines.push(`${file.name}: ${result.message ?? t('Could not upload the file.')}`);
    }
    const fresh = await fetchLibrary();
    if (fresh.ok) setLibrary(fresh.value);
    setBusy(false);
    setFiles([]);
    setFileKey((n) => n + 1);
    setReport(lines.length > 0 ? lines : null);
    setMessage({ kind: added > 0 ? 'ok' : 'error', text: added > 0 ? t('Added: {n}', { n: added }) : t('Nothing was added.') });
    if (added > 0) setFilter({ ...EMPTY_FILTER, status: 'uploaded' });
  };

  const remove = async (row: ShownRow) => {
    if (!window.confirm(t('Delete “{name}” and its file for good? This cannot be undone.', { name: row.shownName }))) return;
    setBusy(true);
    setMessage(null);
    const result = await deleteLibraryItem(kind, row.id);
    if (result.ok) {
      const fresh = await fetchLibrary();
      if (fresh.ok) setLibrary(fresh.value);
      setSelected((old) => new Set([...old].filter((id) => id !== row.id)));
      setMessage({ kind: 'ok', text: t('Deleted.') });
    } else setMessage({ kind: 'error', text: result.message ?? t('Could not delete it.') });
    setBusy(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const row = shown.find((r) => r.id === editing.id);
    if (!row) return;
    // Writing the library's own text back means "no change", so it is stored as empty.
    const name = editing.name.trim() === row.name ? '' : editing.name;
    const category = editing.category.trim() === row.category ? '' : editing.category;
    if (await apply([editing.id], { name, category }, t('Saved.'))) setEditing(null);
  };

  return (
    <WorkspaceSurface className="p-6">
      <h2 className="text-xl font-semibold text-ink">{kind === 'design' ? t('Design library') : t('Font library')}</h2>
      <p className="mt-1 text-sm text-ink-secondary">
        {kind === 'design'
          ? t('Hide designs, or change their title and category. The studios show the list as you leave it here, with no new deploy. The files themselves are not changed.')
          : t('Hide fonts, or change their name and category. A hidden font is left out of the font pickers, but a saved design that uses it still finds it. The files themselves are not changed.')}
      </p>
      <p className="mt-2 text-sm text-ink-secondary">{t('{total} in the library, {hidden} hidden.', { total: shown.length, hidden: hiddenCount })}</p>

      {message && (
        <p role="status" className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-success-500/40 bg-success-50 text-success-700' : 'border-danger-500/40 bg-danger-50 text-danger-700'}`}>
          {message.text}
        </p>
      )}

      {load.state === 'ready' && !load.built && (
        <p className="mt-4 rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {kind === 'design'
            ? t('No design library was published to this site (npm run deploy:cloudflare:libs). Only the designs you upload here are listed.')
            : t('No font library was published to this site (npm run deploy:cloudflare:libs). Only the fonts you upload here are listed.')}
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-border/70 p-4">
        <h3 className="text-sm font-semibold text-ink">{kind === 'design' ? t('Add designs') : t('Add fonts')}</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          {kind === 'design'
            ? t('Choose SVG rhinestone templates. Each becomes a design in the collection, with its stones counted, and is named after its file.')
            : t('Choose TTF, OTF or WOFF files up to 1.5 MB. Each becomes a font in the font pickers, named after its file.')}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1.5fr_auto] md:items-end">
          <div>
            <label htmlFor="lib-upload-files" className={label}>{t('Files')}</label>
            <input
              key={fileKey}
              id="lib-upload-files"
              type="file"
              multiple
              accept={kind === 'design' ? '.svg,image/svg+xml' : '.ttf,.otf,.woff'}
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
              className="w-full text-sm text-ink-secondary file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-accent-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink-inverse hover:file:bg-accent-600"
            />
          </div>
          <div>
            <label htmlFor="lib-upload-category" className={label}>{t('Category')}</label>
            {kind === 'font' ? (
              <select id="lib-upload-category" className={workspaceSelectClassName} value={uploadCategory || 'Uploads'} onChange={(e) => setUploadCategory(e.target.value)}>
                {FONT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input id="lib-upload-category" className={workspaceInputClassName} list="lib-upload-categories" value={uploadCategory} maxLength={LIBRARY_LIMITS.category} placeholder={t('Uploaded')} onChange={(e) => setUploadCategory(e.target.value)} />
            )}
            <datalist id="lib-upload-categories">
              {categories.map((c) => <option key={c.category} value={c.category} />)}
            </datalist>
          </div>
          <button type="button" disabled={busy || files.length === 0} onClick={() => void upload()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-ink-inverse shadow-lg transition hover:bg-sand-800 disabled:opacity-60">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {busy ? t('Uploading…') : t('Upload {n} files', { n: files.length })}
          </button>
        </div>
        {report && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-danger-700">
            {report.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[2fr_1.5fr_1fr]">
        <div>
          <label htmlFor="lib-query" className={label}>{t('Search')}</label>
          <input id="lib-query" className={workspaceInputClassName} value={filter.query} onChange={(e) => changeFilter({ query: e.target.value })} />
        </div>
        <div>
          <label htmlFor="lib-category" className={label}>{t('Category')}</label>
          <select id="lib-category" className={workspaceSelectClassName} value={filter.category} onChange={(e) => changeFilter({ category: e.target.value })}>
            <option value="">{t('All categories')}</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>{`${c.category || t('(none)')} (${c.count})`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lib-status" className={label}>{t('Show')}</label>
          <select id="lib-status" className={workspaceSelectClassName} value={filter.status} onChange={(e) => changeFilter({ status: e.target.value as StatusFilter })}>
            <option value="all">{t('All')}</option>
            <option value="visible">{t('Visible')}</option>
            <option value="hidden">{t('Hidden')}</option>
            <option value="changed">{t('Changed by me')}</option>
            <option value="uploaded">{t('Uploaded by me')}</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t('Actions for the selected')}>
        <span className="text-sm text-ink-secondary">{t('{n} selected', { n: selected.size })}</span>
        <button type="button" className={smallButton} disabled={busy || filtered.length === 0} onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}>{t('Select all {n} found', { n: filtered.length })}</button>
        <button type="button" className={smallButton} disabled={busy || selected.size === 0} onClick={() => setSelected(new Set())}>{t('Clear')}</button>
        <button type="button" className={smallButton} disabled={busy || selected.size === 0} onClick={() => void apply(selectedIds, { hidden: true }, t('Hidden: {n}', { n: selected.size }))}><EyeOff className="h-4 w-4" aria-hidden="true" />{t('Hide')}</button>
        <button type="button" className={smallButton} disabled={busy || selected.size === 0} onClick={() => void apply(selectedIds, { hidden: false }, t('Shown: {n}', { n: selected.size }))}><Eye className="h-4 w-4" aria-hidden="true" />{t('Show')}</button>
        <button type="button" className={smallButton} disabled={busy || selected.size === 0} onClick={() => void apply(selectedIds, { hidden: false, name: '', category: '' }, t('Back to the library’s own: {n}', { n: selected.size }))}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('Reset')}</button>
        <input aria-label={t('Category for the selected')} className={`${workspaceInputClassName} !w-48`} value={bulkCategory} maxLength={LIBRARY_LIMITS.category} placeholder={t('Category for the selected')} onChange={(e) => setBulkCategory(e.target.value)} />
        <button type="button" className={smallButton} disabled={busy || selected.size === 0 || bulkCategory.trim() === ''} onClick={() => void apply(selectedIds, { category: bulkCategory }, t('Category set: {n}', { n: selected.size }))}>{t('Set category')}</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand-100/60 text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="w-10 px-3 py-2"><input type="checkbox" aria-label={t('Select this page')} checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set([...selected].filter((id) => !visible.some((r) => r.id === id))) : new Set([...selected, ...visible.map((r) => r.id)]))} /></th>
              <th className="px-3 py-2">{kind === 'design' ? t('Title') : t('Name')}</th>
              <th className="px-3 py-2">{t('Category')}</th>
              <th className="px-3 py-2">{kind === 'design' ? t('Stones and size') : t('Family')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <LibraryRowView key={row.id} row={row} checked={selected.has(row.id)} onToggle={() => toggle(row.id)} kind={kind} editing={editing?.id === row.id ? editing : null} setEditing={setEditing} onDelete={() => void remove(row)} onSave={() => void saveEdit()} busy={busy} onToggleHidden={() => void apply([row.id], { hidden: !row.hidden }, row.hidden ? t('Shown.') : t('Hidden.'))} />
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-secondary">{t('No {what} match.', { what: nothing })}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-secondary">
        <span>{t('Page {n} of {total}', { n: Math.min(page, pages - 1) + 1, total: pages })}</span>
        <span className="flex gap-2">
          <button type="button" className={smallButton} disabled={page <= 0} onClick={() => setPage(page - 1)}>{t('Previous')}</button>
          <button type="button" className={smallButton} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t('Next')}</button>
        </span>
      </div>
    </WorkspaceSurface>
  );
}

function LibraryRowView({ row, kind, checked, onToggle, editing, setEditing, onSave, busy, onToggleHidden, onDelete }: {
  row: ShownRow;
  kind: LibraryKind;
  checked: boolean;
  onToggle: () => void;
  editing: { id: string; name: string; category: string } | null;
  setEditing: (value: { id: string; name: string; category: string } | null) => void;
  onSave: () => void;
  busy: boolean;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <tr className={`border-t border-border/60 ${row.hidden ? 'bg-sand-100/40 text-ink-muted' : ''}`}>
      <td className="px-3 py-2"><input type="checkbox" aria-label={t('Select {name}', { name: row.shownName })} checked={checked} onChange={onToggle} /></td>
      {editing ? (
        <>
          <td className="px-3 py-2"><input aria-label={t('Name')} className={workspaceInputClassName} value={editing.name} maxLength={LIBRARY_LIMITS.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
          <td className="px-3 py-2">
            {kind === 'font' ? (
              <select aria-label={t('Category')} className={workspaceSelectClassName} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {[...new Set([editing.category, ...FONT_CATEGORIES])].filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input aria-label={t('Category')} className={workspaceInputClassName} value={editing.category} maxLength={LIBRARY_LIMITS.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            )}
          </td>
          <td className="px-3 py-2 text-ink-secondary">{row.detail}</td>
          <td className="px-3 py-2">
            <span className="flex justify-end gap-2">
              <button type="button" className={smallButton} disabled={busy || editing.name.trim() === ''} onClick={onSave}>{t('Save')}</button>
              <button type="button" className={smallButton} disabled={busy} onClick={() => setEditing(null)}>{t('Cancel')}</button>
            </span>
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 font-medium">
            {row.shownName}
            {row.shownName !== row.name && <span className="ml-2 text-xs text-ink-muted">{t('was {name}', { name: row.name })}</span>}
            {row.uploaded && <span className="ml-2"><WorkspaceTag tone="success">{t('Uploaded')}</WorkspaceTag></span>}
            {row.hidden && <span className="ml-2"><WorkspaceTag tone="neutral">{t('Hidden')}</WorkspaceTag></span>}
          </td>
          <td className="px-3 py-2">{row.shownCategory || '—'}</td>
          <td className="px-3 py-2 text-ink-secondary">{row.detail}</td>
          <td className="px-3 py-2">
            <span className="flex justify-end gap-2">
              <button type="button" className={smallButton} disabled={busy} aria-label={t('Edit {name}', { name: row.shownName })} onClick={() => setEditing({ id: row.id, name: row.shownName, category: row.shownCategory })}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" className={smallButton} disabled={busy} aria-label={row.hidden ? t('Show {name}', { name: row.shownName }) : t('Hide {name}', { name: row.shownName })} onClick={onToggleHidden}>{row.hidden ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}</button>
              {row.uploaded && <button type="button" className={smallButton} disabled={busy} aria-label={t('Delete {name}', { name: row.shownName })} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
            </span>
          </td>
        </>
      )}
    </tr>
  );
}
