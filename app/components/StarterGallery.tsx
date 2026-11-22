'use client';

import Link from 'next/link';
import { getOutlineFontDefinition, getOutlineFontFaceCss } from '@/src/lib/rhinestone-engine/index';
import { useT } from '../lib/i18n';
import { STARTER_DESIGNS, starterLaunchUrl } from '../lib/starterDesigns';

/** Cards that open the studio with a ready-made example. Server-rendered: the lettering is the font itself. */
export default function StarterGallery() {
  const t = useT();
  return (
    <section aria-label={t('Start from an example')} className="space-y-3">
      <style dangerouslySetInnerHTML={{ __html: getOutlineFontFaceCss() }} />
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">{t('Or start from an example')}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STARTER_DESIGNS.map((starter) => {
          const font = getOutlineFontDefinition(starter.fontId);
          return (
            <li key={starter.id}>
              <Link
                href={starterLaunchUrl(starter)}
                className="flex h-full flex-col gap-2 rounded-2xl border border-border/80 bg-[rgba(255,255,255,0.9)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                <span
                  className="flex h-14 items-center justify-center overflow-hidden whitespace-pre text-center text-2xl leading-none text-ink"
                  style={{ fontFamily: font.previewFontFamily }}
                  aria-hidden="true"
                >
                  {starter.text.split('\n')[0]}
                </span>
                <span className="text-sm font-semibold text-ink">{t(starter.title)}</span>
                <span className="text-xs text-ink-secondary">{t(starter.note)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
