'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listCatalog, type CatalogTemplate } from '../lib/catalog/catalogClient';
import CatalogPreview from '../components/CatalogPreview';
import { useT } from '../lib/i18n';
import { Section } from './fields';
import { catalogDesignState, catalogModelFile, catalogModels, entryKindOf, saveDesignAsTemplate, searchCatalogModels } from './papercraftCatalog';
import type { PapercraftState } from './papercraftState';

const SEARCH_FROM = 8;

const fieldClass =
  'h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400';

/**
 * The owner's catalog (the admin panel) inside the Model panel: the published models and saved templates to start from, and a form to
 * save the model that is open as a new template. Nothing shows where there is no catalog (GitHub Pages, `next dev`), so the studio
 * looks the same as before there.
 */
export default function CatalogSections({ state, onImportFile, onLoadState }: { state: PapercraftState; onImportFile: (file: File) => void; onLoadState: (state: PapercraftState) => void }) {
  const t = useT();
  const [templates, setTemplates] = useState<CatalogTemplate[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const result = await listCatalog({ studio: 'papercraft', all: true });
    if (result.ok) setTemplates(result.value);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listCatalog({ studio: 'papercraft', all: true }).then((result) => {
      if (!cancelled && result.ok) setTemplates(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(() => catalogModels(templates ?? []), [templates]);
  const shown = useMemo(() => searchCatalogModels(entries, query), [entries, query]);
  const categories = useMemo(() => [...new Set((templates ?? []).map((tpl) => tpl.category).filter(Boolean))].sort(), [templates]);
  if (templates === null) return null;

  const open = async (template: CatalogTemplate) => {
    setLoadingId(template.id);
    setFailed(false);
    let ok = false;
    if (entryKindOf(template) === 'design') {
      const loaded = await catalogDesignState(template);
      if (loaded) {
        onLoadState(loaded);
        ok = true;
      }
    } else {
      const file = await catalogModelFile(template);
      if (file) {
        onImportFile(file);
        ok = true;
      }
    }
    setLoadingId(null);
    setFailed(!ok);
  };

  const save = async () => {
    const chosen = name.trim() || state.projectName;
    setSaving(true);
    setNote(null);
    const result = await saveDesignAsTemplate(state, { name: chosen, category, published }, templates.map((tpl) => tpl.id));
    setSaving(false);
    if (result.ok) {
      setNote(
        result.value.previewSaved
          ? { kind: 'ok', text: t('Saved “{name}” in the catalog.', { name: chosen }) }
          : { kind: 'error', text: t('Saved “{name}” in the catalog, but its picture could not be saved. It opens as usual; you can add a picture in the admin panel.', { name: chosen }) },
      );
      setName('');
      await refresh();
    } else if (result.reason === 'too-big') {
      setNote({ kind: 'error', text: t('This model is too big to save as a template.') });
    } else if (result.reason === 'no-name') {
      setNote({ kind: 'error', text: t('Give the template a name.') });
    } else {
      setNote({ kind: 'error', text: ('message' in result && result.message) || t('Could not save the template.') });
    }
  };

  return (
    <>
      {entries.length > 0 && (
        <Section title={t('From the catalog')}>
          {entries.length >= SEARCH_FROM && (
            <input type="search" aria-label={t('Search the catalog')} placeholder={t('Search the catalog')} value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass} />
          )}
          {shown.length === 0 ? (
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('No model matches.')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {shown.map((template) => {
                const design = entryKindOf(template) === 'design';
                const active = !design && state.source.kind === 'file' && template.file?.name === state.source.fileName;
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={active}
                    disabled={loadingId !== null}
                    onClick={() => void open(template)}
                    title={[design ? t('A saved template: it opens with its size and settings.') : '', template.category, template.description].filter(Boolean).join(' — ') || template.name}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-xs font-medium transition disabled:opacity-60 ${active ? 'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]'}`}
                  >
                    <CatalogPreview template={template} className="h-14 w-14 rounded-md bg-[var(--studio-surface)]" />
                    <span className="min-w-0 max-w-full break-words leading-tight">{loadingId === template.id ? t('Opening…') : template.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {failed && <p role="alert" className="text-xs text-red-300">{t('The model could not be fetched from the catalog.')}</p>}
        </Section>
      )}

      <Section title={t('Save as a template')} defaultOpen={false}>
        <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Keep this model, with its size and settings (and how it is built, if you built it here), in your catalog so you can start from it again.')}</p>
        <div>
          <label htmlFor="template-name" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Template name')}</label>
          <input id="template-name" className={fieldClass} value={name} placeholder={state.projectName} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="template-category" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Category')}</label>
          <input id="template-category" className={fieldClass} value={category} list="template-categories" maxLength={60} onChange={(event) => setCategory(event.target.value)} />
          <datalist id="template-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          {t('Show it under “From the catalog”')}
        </label>
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
          {saving ? t('Saving…') : t('Save as a template')}
        </button>
        {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${note.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{note.text}</p>}
      </Section>
    </>
  );
}
