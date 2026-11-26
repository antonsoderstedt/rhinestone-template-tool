'use client';

import { useEffect, useMemo, useState } from 'react';
import { listCatalog, type CatalogTemplate } from '../lib/catalog/catalogClient';
import CatalogPreview from '../components/CatalogPreview';
import { useT } from '../lib/i18n';
import { Section } from './fields';
import { catalogModelFile, catalogModels, searchCatalogModels } from './papercraftCatalog';

const SEARCH_FROM = 8;

/**
 * The models from the owner's catalog (the admin panel). It shows nothing where there is no catalog (GitHub Pages, `next dev`)
 * or nothing published for Papercraft yet, so the studio looks the same as before there.
 */
export default function CatalogModels({ onImportFile, activeFileName }: { onImportFile: (file: File) => void; activeFileName: string | null }) {
  const t = useT();
  const [models, setModels] = useState<CatalogTemplate[]>([]);
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listCatalog({ studio: 'papercraft' }).then((result) => {
      if (!cancelled && result.ok) setModels(catalogModels(result.value));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => searchCatalogModels(models, query), [models, query]);
  if (models.length === 0) return null;

  const open = async (template: CatalogTemplate) => {
    setLoadingId(template.id);
    setFailed(false);
    const file = await catalogModelFile(template);
    setLoadingId(null);
    if (file) onImportFile(file);
    else setFailed(true);
  };

  return (
    <Section title={t('From the catalog')}>
      {models.length >= SEARCH_FROM && (
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
        <p className="text-xs text-[var(--studio-ink-subtle)]">{t('No model matches.')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((template) => {
            const active = activeFileName !== null && template.file?.name === activeFileName;
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={active}
                disabled={loadingId !== null}
                onClick={() => void open(template)}
                title={[template.category, template.description].filter(Boolean).join(' — ') || template.name}
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
  );
}
