'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DrawDoc } from '@/src/lib/papercraft-engine';
import CatalogPreview from '../../components/CatalogPreview';
import { listCatalog, type CatalogTemplate } from '../../lib/catalog/catalogClient';
import { useT } from '../../lib/i18n';
import { Section } from '../fields';
import { catalogDrawingDoc, drawingEntries, saveDrawingAsTemplate } from './drawCatalog';

const fieldClass =
  'h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400';

/**
 * The owner's catalog (the admin panel) in the drawing tool: the published drawings to start from, and a form to save the drawing that is open
 * as a new template. Nothing shows where there is no catalog (GitHub Pages, `next dev`).
 */
export default function DrawCatalog({ doc, onOpen }: { doc: DrawDoc; onOpen: (doc: DrawDoc) => void }) {
  const t = useT();
  const [templates, setTemplates] = useState<CatalogTemplate[] | null>(null);
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

  const entries = useMemo(() => drawingEntries(templates ?? []), [templates]);
  const categories = useMemo(() => [...new Set((templates ?? []).map((tpl) => tpl.category).filter(Boolean))].sort(), [templates]);
  if (templates === null) return null;

  const open = async (template: CatalogTemplate) => {
    if (doc.items.length > 0 && !window.confirm(t('Open this drawing? The one you have now is lost unless you saved it.'))) return;
    setLoadingId(template.id);
    setFailed(false);
    const opened = await catalogDrawingDoc(template);
    setLoadingId(null);
    if (opened) onOpen(opened);
    else setFailed(true);
  };

  const save = async () => {
    const chosen = name.trim() || doc.name;
    setSaving(true);
    setNote(null);
    const result = await saveDrawingAsTemplate(doc, { name: chosen, category, published }, templates.map((tpl) => tpl.id));
    setSaving(false);
    if (result.ok) {
      setNote(
        result.value.previewSaved
          ? { kind: 'ok', text: t('Saved “{name}” in the catalog.', { name: chosen }) }
          : { kind: 'error', text: t('Saved “{name}” in the catalog, but its picture could not be saved. It opens as usual; you can add a picture in the admin panel.', { name: chosen }) },
      );
      setName('');
      await refresh();
    } else if (result.reason === 'nothing-drawn') {
      setNote({ kind: 'error', text: t('Draw something first.') });
    } else if (result.reason === 'no-name') {
      setNote({ kind: 'error', text: t('Give the template a name.') });
    } else {
      setNote({ kind: 'error', text: result.message || t('Could not save the template.') });
    }
  };

  return (
    <>
      {entries.length > 0 && (
        <Section title={t('Drawings from the catalog')}>
          <div className="grid grid-cols-2 gap-2">
            {entries.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={loadingId !== null}
                onClick={() => void open(template)}
                title={[template.category, template.description].filter(Boolean).join(' — ') || template.name}
                className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-1.5 py-2 text-center text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)] disabled:opacity-60"
              >
                <CatalogPreview template={template} className="h-14 w-14 rounded-md bg-white" />
                <span className="min-w-0 max-w-full break-words leading-tight">{loadingId === template.id ? t('Opening…') : template.name}</span>
              </button>
            ))}
          </div>
          {failed && <p role="alert" className="text-xs text-red-300">{t('The drawing could not be fetched from the catalog.')}</p>}
        </Section>
      )}

      <Section title={t('Save as a template')} defaultOpen={false}>
        <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Keep this drawing in your catalog so you can start from it again, from this tool.')}</p>
        <div>
          <label htmlFor="draw-template-name" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Template name')}</label>
          <input id="draw-template-name" className={fieldClass} value={name} placeholder={doc.name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="draw-template-category" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Category')}</label>
          <input id="draw-template-category" className={fieldClass} value={category} list="draw-template-categories" maxLength={60} onChange={(event) => setCategory(event.target.value)} />
          <datalist id="draw-template-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          {t('Show it under “Drawings from the catalog”')}
        </label>
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
          {saving ? t('Saving…') : t('Save as a template')}
        </button>
        {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${note.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{note.text}</p>}
      </Section>
    </>
  );
}
