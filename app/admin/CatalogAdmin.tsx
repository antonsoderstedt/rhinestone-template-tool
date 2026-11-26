'use client';

import { Eye, EyeOff, Info, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmptyState, WorkspaceSurface, WorkspaceTag, workspaceInputClassName, workspaceSelectClassName, workspaceTextAreaClassName } from '../components/workspace/WorkspaceChrome';
import {
  deleteCatalogTemplate,
  fetchCatalogFile,
  listCatalog,
  saveCatalogDetails,
  uploadCatalogFile,
  type CatalogFailure,
  type CatalogTemplate,
} from '../lib/catalog/catalogClient';
import { CATALOG_STUDIOS, formatOfFileName, mimeOfFormat, PREVIEW_FORMATS, STUDIO_FORMATS, STUDIO_NAMES, isTextFormat, type CatalogStudio } from '../lib/catalog/catalogFormat';
import { useT } from '../lib/i18n';
import { detailsOf, draftOf, draftProblems, emptyDraft, type CatalogDraft, type DraftProblem } from './catalogDraft';

/** The most a file may be: the Worker stores 30 million characters, and a binary file is a third larger as base64. */
const MAX_TEXT_BYTES = 29_000_000;
const MAX_BINARY_BYTES = 21_000_000;
const MAX_PREVIEW_BYTES = 1_000_000;

type Load = { state: 'loading' } | { state: 'ready'; templates: CatalogTemplate[] } | { state: 'failed'; reason: CatalogFailure };

const label = 'mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted';

function Hint({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} role="img" tabIndex={0} className="ml-1 inline-flex align-middle text-ink-muted hover:text-ink focus:text-ink focus:outline-none focus:ring-2 focus:ring-accent-300 rounded-full">
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function formatBytes(chars: number, format: string): string {
  const bytes = isTextFormat(format) ? chars : Math.round((chars * 3) / 4);
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} kB`;
}

/** A template's picture, fetched when the row shows. */
function Preview({ template }: { template: CatalogTemplate }) {
  const [url, setUrl] = useState<string | null>(null);
  const has = template.preview !== null;
  const stamp = template.updatedAt;
  useEffect(() => {
    if (!has) return undefined;
    let cancelled = false;
    let made: string | null = null;
    void fetchCatalogFile(template, 'preview').then((result) => {
      if (cancelled || !result.ok) return;
      const type = mimeOfFormat(formatOfFileName(result.value.name));
      made = URL.createObjectURL(new Blob([result.value.bytes as BlobPart], { type }));
      setUrl(made);
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // The picture is fetched again when the template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, has, stamp]);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-surface">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a picture from the catalog, shown from a blob: address
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : null}
    </div>
  );
}

export default function CatalogAdmin() {
  const t = useT();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [studioFilter, setStudioFilter] = useState<CatalogStudio | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CatalogDraft | null>(null);
  const [existing, setExisting] = useState<CatalogTemplate | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const refresh = useCallback(async () => {
    const result = await listCatalog({ all: true });
    setLoad(result.ok ? { state: 'ready', templates: result.value } : { state: 'failed', reason: result.reason });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listCatalog({ all: true }).then((result) => {
      if (!cancelled) setLoad(result.ok ? { state: 'ready', templates: result.value } : { state: 'failed', reason: result.reason });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const templates = useMemo(() => (load.state === 'ready' ? load.templates : []), [load]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => (studioFilter === 'all' || tpl.studio === studioFilter) && (!q || `${tpl.name} ${tpl.category} ${tpl.tags.join(' ')} ${tpl.id}`.toLowerCase().includes(q)));
  }, [templates, studioFilter, query]);

  const open = (next: CatalogDraft, template: CatalogTemplate | null) => {
    setDraft(next);
    setExisting(template);
    setFile(null);
    setPreviewFile(null);
    setFileKey((k) => k + 1);
    setMessage(null);
  };

  const problemText = (problem: DraftProblem): string => {
    switch (problem) {
      case 'name': return t('Give the template a name.');
      case 'id': return t('The id may only have a–z, 0–9, dot, dash and underscore.');
      case 'format': return t('That file type does not fit this studio.');
      case 'publish-without-file': return t('Add a file before you publish the template.');
    }
  };

  const save = async () => {
    if (!draft) return;
    const problems = draftProblems(draft, file?.name ?? null, existing?.file != null);
    if (problems.length > 0) {
      setMessage({ kind: 'error', text: problems.map(problemText).join(' ') });
      return;
    }
    const fileFormat = file ? formatOfFileName(file.name) : null;
    if (file && file.size > (isTextFormat(fileFormat ?? '') ? MAX_TEXT_BYTES : MAX_BINARY_BYTES)) {
      setMessage({ kind: 'error', text: t('That file is too big. The most is about 29 MB (21 MB for a PDF or a picture).') });
      return;
    }
    if (previewFile && (!(PREVIEW_FORMATS as readonly string[]).includes(formatOfFileName(previewFile.name)) || previewFile.size > MAX_PREVIEW_BYTES)) {
      setMessage({ kind: 'error', text: t('The picture must be an SVG, PNG, JPG or WebP of at most 1 MB.') });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const details = detailsOf(draft, fileFormat);
      const saved = await saveCatalogDetails(details);
      if (!saved.ok) {
        setMessage({ kind: 'error', text: saved.message ?? t('Could not save the template.') });
        return;
      }
      for (const [part, chosen] of [['file', file], ['preview', previewFile]] as const) {
        if (!chosen) continue;
        const uploaded = await uploadCatalogFile(details.id, part, { name: chosen.name, bytes: new Uint8Array(await chosen.arrayBuffer()) });
        if (!uploaded.ok) {
          setMessage({ kind: 'error', text: uploaded.message ?? t('The details were saved, but a file could not be uploaded.') });
          await refresh();
          return;
        }
      }
      await refresh();
      setDraft(null);
      setExisting(null);
      setMessage({ kind: 'ok', text: t('Saved “{name}”.', { name: details.name }) });
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (template: CatalogTemplate) => {
    if (!template.published && !template.file) {
      setMessage({ kind: 'error', text: t('Add a file before you publish the template.') });
      return;
    }
    const draftOfTemplate = { ...draftOf(template), published: !template.published };
    const result = await saveCatalogDetails(detailsOf(draftOfTemplate, null));
    setMessage(result.ok ? null : { kind: 'error', text: result.message ?? t('Could not save the template.') });
    await refresh();
  };

  const remove = async (template: CatalogTemplate) => {
    if (!window.confirm(t('Delete “{name}” and its files for good? This cannot be undone.', { name: template.name }))) return;
    const result = await deleteCatalogTemplate(template.id);
    setMessage(result.ok ? { kind: 'ok', text: t('Deleted “{name}”.', { name: template.name }) } : { kind: 'error', text: result.message ?? t('Could not delete the template.') });
    if (draft?.id === template.id) setDraft(null);
    await refresh();
  };

  if (load.state === 'loading') {
    return <p className="px-2 text-sm text-ink-secondary" role="status">{t('Loading the catalog…')}</p>;
  }
  if (load.state === 'failed') {
    return (
      <WorkspaceEmptyState
        title={load.reason === 'signin' ? t('Sign in to open the admin panel') : load.reason === 'unavailable' ? t('The catalog needs the private site') : t('The catalog could not be loaded')}
        description={
          load.reason === 'signin'
            ? t('Cloudflare Access did not let this request through. Reload the page and sign in.')
            : load.reason === 'unavailable'
              ? t('The catalog is kept on your private Cloudflare site. Open the admin panel there (or run scripts/deploy-private.sh --dev locally).')
              : t('Something went wrong when the catalog was asked for. Try again in a moment.')
        }
      />
    );
  }

  const formats = draft ? STUDIO_FORMATS[draft.studio] : [];

  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-success-200 bg-success-50 text-success-700' : 'border-danger-200 bg-danger-50 text-danger-700'}`}>
          {message.text}
        </p>
      )}

      <WorkspaceSurface className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">{t('Template catalog')}</h2>
            <p className="mt-1 text-sm text-ink-secondary">{templates.length === 1 ? t('1 template') : t('{n} templates', { n: templates.length })}</p>
          </div>
          <button type="button" onClick={() => open(emptyDraft(studioFilter === 'all' ? 'papercraft' : studioFilter), null)} className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse shadow-lg transition hover:bg-sand-800">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('New template')}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="catalog-studio-filter" className={label}>{t('Studio')}</label>
            <select id="catalog-studio-filter" className={workspaceSelectClassName} value={studioFilter} onChange={(e) => setStudioFilter(e.target.value as CatalogStudio | 'all')}>
              <option value="all">{t('All studios')}</option>
              {CATALOG_STUDIOS.map((s) => <option key={s} value={s}>{STUDIO_NAMES[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="catalog-search" className={label}>{t('Search')}</label>
            <input id="catalog-search" className={workspaceInputClassName} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Name, category or tag')} />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border-strong px-4 py-10 text-center text-sm text-ink-secondary">
            {templates.length === 0 ? t('No templates yet. Add the first one with “New template”.') : t('No template matches.')}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/70">
            {shown.map((tpl) => (
              <li key={tpl.id} className="flex flex-wrap items-center gap-4 py-4">
                <Preview template={tpl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{tpl.name}</span>
                    <WorkspaceTag tone="neutral">{STUDIO_NAMES[tpl.studio]}</WorkspaceTag>
                    <WorkspaceTag tone="neutral">{tpl.format.toUpperCase()}</WorkspaceTag>
                    <WorkspaceTag tone={tpl.published ? 'success' : 'neutral'}>{tpl.published ? t('Published') : t('Draft')}</WorkspaceTag>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink-secondary">
                    {[tpl.category, tpl.tags.join(', '), tpl.file ? `${tpl.file.name} · ${formatBytes(tpl.file.chars, tpl.format)}` : t('No file yet')].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void togglePublished(tpl)} aria-label={tpl.published ? t('Unpublish {name}', { name: tpl.name }) : t('Publish {name}', { name: tpl.name })} title={tpl.published ? t('Hide from the studios') : t('Show in the studios')} className="rounded-xl border border-border/80 p-2 text-ink-secondary transition hover:bg-surface">
                    {tpl.published ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => open(draftOf(tpl), tpl)} aria-label={t('Edit {name}', { name: tpl.name })} title={t('Edit')} className="rounded-xl border border-border/80 p-2 text-ink-secondary transition hover:bg-surface">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => void remove(tpl)} aria-label={t('Delete {name}', { name: tpl.name })} title={t('Delete')} className="rounded-xl border border-border/80 p-2 text-danger-600 transition hover:bg-danger-50">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WorkspaceSurface>

      {draft && (
        <WorkspaceSurface className="p-6">
          <h2 className="text-xl font-semibold text-ink">{draft.isNew ? t('New template') : t('Edit template')}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="tpl-studio" className={label}>{t('Studio')}</label>
              <select id="tpl-studio" className={workspaceSelectClassName} value={draft.studio} disabled={!draft.isNew} onChange={(e) => { const studio = e.target.value as CatalogStudio; setDraft({ ...draft, studio, format: STUDIO_FORMATS[studio][0]! }); }}>
                {CATALOG_STUDIOS.map((s) => <option key={s} value={s}>{STUDIO_NAMES[s]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tpl-name" className={label}>{t('Name')}</label>
              <input id="tpl-name" className={workspaceInputClassName} value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tpl-id" className={label}>{t('Id')}<Hint text={t('The short name the template is saved under. Made from the name if you leave it empty. It cannot be changed afterwards.')} /></label>
              <input id="tpl-id" className={workspaceInputClassName} value={draft.id} disabled={!draft.isNew} placeholder={t('Made from the name')} maxLength={80} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tpl-category" className={label}>{t('Category')}</label>
              <input id="tpl-category" className={workspaceInputClassName} value={draft.category} maxLength={60} placeholder={t('For example Animals, Boxes, Letters')} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="tpl-description" className={label}>{t('Description')}</label>
              <textarea id="tpl-description" rows={3} className={workspaceTextAreaClassName} value={draft.description} maxLength={4000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tpl-tags" className={label}>{t('Tags')}<Hint text={t('Words to search by, separated by commas.')} /></label>
              <input id="tpl-tags" className={workspaceInputClassName} value={draft.tagsText} onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tpl-licence" className={label}>{t('Licence')}<Hint text={t('Who made it and what you may do with it. Write it down so you know later.')} /></label>
              <input id="tpl-licence" className={workspaceInputClassName} value={draft.licence} maxLength={200} onChange={(e) => setDraft({ ...draft, licence: e.target.value })} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="tpl-file" className={label}>{t('File')}<Hint text={t('Papercraft: an OBJ model, a PDF pattern, an SVG or a saved JSON. Rhinestone and HTV: an SVG or a saved JSON.')} /></label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border/80 bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-raised">
                  <Upload className="h-4 w-4" aria-hidden="true" /> {file ? t('Choose another file') : existing?.file ? t('Replace the file') : t('Choose a file')}
                  <input id="tpl-file" key={`f${fileKey}`} type="file" className="sr-only" accept={formats.map((f) => `.${f}`).join(',')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <span className="text-sm text-ink-secondary">{file ? `${file.name} · ${(file.size / 1000).toFixed(0)} kB` : existing?.file ? `${existing.file.name} · ${formatBytes(existing.file.chars, existing.format)}` : t('No file yet')}</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="tpl-preview" className={label}>{t('Picture')}<Hint text={t('A small picture shown in the list: SVG, PNG, JPG or WebP, at most 1 MB.')} /></label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border/80 bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-raised">
                  <Upload className="h-4 w-4" aria-hidden="true" /> {previewFile ? t('Choose another picture') : existing?.preview ? t('Replace the picture') : t('Choose a picture')}
                  <input id="tpl-preview" key={`p${fileKey}`} type="file" className="sr-only" accept={PREVIEW_FORMATS.map((f) => `.${f}`).join(',')} onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} />
                </label>
                <span className="text-sm text-ink-secondary">{previewFile ? previewFile.name : existing?.preview ? existing.preview.name : t('No picture yet')}</span>
              </div>
            </div>

            <fieldset className="md:col-span-2">
              <legend className={label}>{t('Your own fields')}<Hint text={t('Extra facts you want to keep, such as source, designer, difficulty or finished size.')} /></legend>
              <div className="space-y-2">
                {draft.fields.map((row, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[14rem_1fr_auto]">
                    <input aria-label={t('Field name')} className={workspaceInputClassName} value={row.key} maxLength={40} placeholder={t('Field name')} onChange={(e) => setDraft({ ...draft, fields: draft.fields.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)) })} />
                    <input aria-label={t('Field value')} className={workspaceInputClassName} value={row.value} maxLength={500} placeholder={t('Value')} onChange={(e) => setDraft({ ...draft, fields: draft.fields.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)) })} />
                    <button type="button" aria-label={t('Remove the field')} onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })} className="rounded-xl border border-border/80 px-3 text-ink-secondary transition hover:bg-surface"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: '', value: '' }] })} className="inline-flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 text-sm font-semibold text-ink-secondary transition hover:bg-surface">
                  <Plus className="h-4 w-4" aria-hidden="true" /> {t('Add a field')}
                </button>
              </div>
            </fieldset>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-ink">
                <input type="checkbox" className="h-4 w-4" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
                {t('Published (the studios can show it)')}
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void save()} className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-ink-inverse shadow-lg transition hover:bg-sand-800 disabled:opacity-60">
              {busy ? t('Saving…') : t('Save')}
            </button>
            <button type="button" disabled={busy} onClick={() => { setDraft(null); setExisting(null); setMessage(null); }} className="rounded-2xl border border-border/80 px-6 py-3 text-sm font-semibold text-ink-secondary transition hover:bg-surface">
              {t('Cancel')}
            </button>
          </div>
        </WorkspaceSurface>
      )}
    </div>
  );
}
