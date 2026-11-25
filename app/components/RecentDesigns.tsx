'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Box, Gem, SwatchBook } from 'lucide-react';
import { LocalStorageTemplateLibraryRepository } from '@/src/lib/rhinestone-engine/index';
import { getDesignArchived, readWorkspaceVault } from '../lib/workspaceVault';
import { buildRecentDesigns, type RecentDesign } from '../lib/recentDesigns';
import { formatRelativeTime } from '../lib/relativeTime';

import { useT } from '../lib/i18n';
/** The designs you worked on last, with a picture, so you can carry on in one click. Hidden until there is one. */
export default function RecentDesigns() {
  const t = useT();
  const [designs, setDesigns] = useState<RecentDesign[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const vault = readWorkspaceVault();
      const record = await new LocalStorageTemplateLibraryRepository().list();
      const archivedKeys = new Set(
        record.userTemplates
          .filter((entry) => getDesignArchived(vault, `rhinestone:${entry.templateId}`))
          .map((entry) => `rhinestone:${entry.templateId}`),
      );
      const next = buildRecentDesigns({ rhinestoneDesigns: record.userTemplates, htvDesigns: vault.htvDesigns, papercraftDesigns: vault.papercraftDesigns, archivedKeys });
      if (!cancelled) {
        setDesigns(next);
        setNow(new Date());
      }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (designs.length === 0) return null;

  return (
    <section aria-labelledby="recent-designs-heading">
      <div className="flex items-end justify-between gap-3">
        <h2 id="recent-designs-heading" className="text-xl font-semibold text-ink">{t('Pick up where you left off')}</h2>
        <Link href="/designs" className="inline-flex items-center text-sm font-semibold text-accent-600 underline-offset-2 hover:underline">{t('All my designs')}</Link>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {designs.map((design) => {
          const StudioIcon = design.studio === 'rhinestone' ? Gem : design.studio === 'papercraft' ? Box : SwatchBook;
          return (
            <li key={design.key}>
              <Link
                href={design.href}
                className="group block overflow-hidden rounded-[1.5rem] border border-border/80 bg-[rgba(255,255,255,0.9)] shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                {design.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-generated data: URI thumbnail
                  <img src={design.thumbnail} alt="" className="h-32 w-full bg-white object-contain p-2" />
                ) : (
                  <div aria-hidden="true" className="flex h-32 items-center justify-center bg-white px-4 text-center text-lg font-semibold text-ink-secondary">
                    <span className="line-clamp-2">{design.placeholderText}</span>
                  </div>
                )}
                <div className="border-t border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{design.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent-700" aria-hidden="true" />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                    <StudioIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{design.details}</span>
                  </div>
                  {now && <div className="mt-0.5 text-xs text-ink-muted">Edited {formatRelativeTime(design.updatedAt, now)}</div>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
