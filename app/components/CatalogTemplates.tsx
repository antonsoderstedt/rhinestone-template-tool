'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { listCatalog, type CatalogTemplate } from '../lib/catalog/catalogClient';
import { catalogTemplateFile, openableTemplates, searchTemplates, type SvgStudio } from '../lib/catalog/studioCatalog';
import { useT } from '../lib/i18n';
import { track } from '../lib/tracking/track';
import CatalogPreview from './CatalogPreview';

const SEARCH_FROM = 6;

/**
 * The published templates of a studio, from the template catalog (ADR 0061): a grid of pictures. A click fetches the file and hands
 * it to `onOpen`, which returns whether the studio could open it. Renders nothing where there is no catalog or nothing published, so
 * the studio looks the same as before there (GitHub Pages, local development).
 */
export default function CatalogTemplates({ studio, onOpen, wrap }: { studio: SvgStudio; onOpen: (file: File, template: CatalogTemplate) => boolean | Promise<boolean>; wrap?: (content: ReactNode) => ReactNode }) {
  const t = useT();
  const [templates, setTemplates] = useState<CatalogTemplate[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listCatalog({ studio }).then((result) => {
      if (!cancelled && result.ok) setTemplates(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, [studio]);

  const entries = useMemo(() => openableTemplates(studio, templates ?? []), [studio, templates]);
  const shown = useMemo(() => searchTemplates(entries, query), [entries, query]);
  if (entries.length === 0) return null;

  const open = async (template: CatalogTemplate) => {
    setLoadingId(template.id);
    setFailed(false);
    const file = await catalogTemplateFile(template);
    const ok = file ? await onOpen(file, template) : false;
    setLoadingId(null);
    setFailed(!ok);
    if (ok) track('catalog_template_used', { kind: template.format }, template.id);
  };

  const content = (
    <section aria-label={t('From the catalog')} className="space-y-2">
      {entries.length >= SEARCH_FROM && (
        <input
          type="search"
          aria-label={t('Search the catalog')}
          placeholder={t('Search the catalog')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400"
        />
      )}
      {shown.length === 0 ? (
        <p className="text-xs text-[var(--studio-ink-subtle)]">{t('No template matches.')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {shown.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={loadingId !== null}
              onClick={() => void open(template)}
              title={[template.category, template.description].filter(Boolean).join(' — ') || template.name}
              className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-1.5 py-2 text-center text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)] disabled:opacity-60"
            >
              <CatalogPreview template={template} className="h-14 w-14 rounded-md bg-[var(--studio-surface)]" />
              <span className="min-w-0 max-w-full break-words leading-tight">{loadingId === template.id ? t('Opening…') : template.name}</span>
            </button>
          ))}
        </div>
      )}
      {failed && <p role="alert" className="text-xs text-red-300">{t('The template could not be opened.')}</p>}
    </section>
  );
  // `wrap` puts a heading or a panel section around the grid, only when there is something to show.
  return <>{wrap ? wrap(content) : content}</>;
}
