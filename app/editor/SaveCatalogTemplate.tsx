'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listCatalog, type CatalogTemplate } from '../lib/catalog/catalogClient';
import type { SaveTemplateOptions, SaveTemplateResult } from '../lib/catalog/saveTemplate';
import { useT } from '../lib/i18n';
import { track } from '../lib/tracking/track';

const fieldClass =
  'h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400';

export type SaveCatalogResult = SaveTemplateResult | { ok: false; reason: 'nothing' };

/**
 * “Save as a catalog template” (Rhinestone and HTV): keeps the design on the screen in the site's template catalog (ADR 0061, 0064) so it can be started from again
 * on any device. A new template every time, never one that replaces another. Renders nothing where there is no catalog.
 */
export default function SaveCatalogTemplate({ studio = 'rhinestone', currentName, canSave, save, onSaved }: { studio?: 'rhinestone' | 'htv'; currentName: string; canSave: boolean; save: (options: SaveTemplateOptions, existingIds: string[]) => Promise<SaveCatalogResult>; onSaved: () => void }) {
  const t = useT();
  const [templates, setTemplates] = useState<CatalogTemplate[] | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const result = await listCatalog({ studio, all: true });
    if (result.ok) setTemplates(result.value);
  }, [studio]);

  useEffect(() => {
    let cancelled = false;
    void listCatalog({ studio, all: true }).then((result) => {
      if (!cancelled && result.ok) setTemplates(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [studio]);

  const categories = useMemo(() => [...new Set((templates ?? []).map((tpl) => tpl.category).filter(Boolean))].sort(), [templates]);
  if (templates === null) return null;

  const run = async () => {
    const chosen = name.trim() || currentName;
    setSaving(true);
    setNote(null);
    const result = await save({ name: chosen, category, published }, templates.map((tpl) => tpl.id));
    setSaving(false);
    if (result.ok) {
      track('template_saved', {}, studio);
      setNote(
        result.value.previewSaved
          ? { kind: 'ok', text: t('Saved “{name}” in the catalog.', { name: chosen }) }
          : { kind: 'error', text: t('Saved “{name}” in the catalog, but its picture could not be saved. It opens as usual; you can add a picture in the admin panel.', { name: chosen }) },
      );
      setName('');
      await refresh();
      onSaved();
    } else if (result.reason === 'nothing') {
      setNote({ kind: 'error', text: t('Create or open a design first.') });
    } else if (result.reason === 'too-big') {
      setNote({ kind: 'error', text: t('This design is too big to save as a template.') });
    } else if (result.reason === 'no-name') {
      setNote({ kind: 'error', text: t('Give the template a name.') });
    } else {
      setNote({ kind: 'error', text: ('message' in result && result.message) || t('Could not save the template.') });
    }
  };

  return (
    <details className="mb-4 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">{t('Save as a catalog template')}</summary>
      <div className="space-y-3 border-t border-[var(--studio-border)] px-3 py-3">
        <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Keep this design in the site’s catalog, so you can start from it again on any device. It is saved as a new template and never replaces another.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="catalog-template-name" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Template name')}</label>
            <input id="catalog-template-name" className={fieldClass} value={name} placeholder={currentName} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="catalog-template-category" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Category')}</label>
            <input id="catalog-template-category" className={fieldClass} value={category} list="catalog-template-categories" maxLength={60} onChange={(event) => setCategory(event.target.value)} />
            <datalist id="catalog-template-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          {t('Show it under “From the catalog”')}
        </label>
        <button type="button" disabled={saving || !canSave} onClick={() => void run()} className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
          {saving ? t('Saving…') : t('Save as a template')}
        </button>
        {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${note.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{note.text}</p>}
      </div>
    </details>
  );
}
