'use client';

import { useMemo } from 'react';
import { renderPages, type PageDrawing, type PapercraftResult, type Vec2 } from '@/src/lib/papercraft-engine';
import { formatSize, useUnit } from '../lib/units';
import { useT } from '../lib/i18n';

const pathOf = (pts: readonly Vec2[], closed: boolean) => `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L')}${closed ? ' Z' : ''}`;

function PageSheet({ drawing }: { drawing: PageDrawing }) {
  const t = useT();
  return (
    <svg
      role="img"
      aria-label={t('One page of the pattern')}
      viewBox={`0 ${-drawing.heightMm} ${drawing.widthMm} ${drawing.heightMm}`}
      className="h-auto w-full rounded-sm bg-white shadow-lg ring-1 ring-black/10"
    >
      <g transform="scale(1,-1)" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke="#000">
        {drawing.cut.map((c, i) => (
          <path key={`c${i}`} d={pathOf(c.points, c.closed)} strokeWidth={0.25} />
        ))}
        {drawing.folds.map((f, i) => (
          <line
            key={`f${i}`}
            x1={f.a[0]}
            y1={f.a[1]}
            x2={f.b[0]}
            y2={f.b[1]}
            strokeWidth={f.kind === 'flat' ? 0.1 : 0.2}
            stroke={f.kind === 'flat' ? '#888' : '#000'}
            strokeDasharray={f.kind === 'mountain' ? '3 1 0.6 1' : f.kind === 'flat' ? undefined : '1.6 1.2'}
          />
        ))}
        {drawing.text.map((line, i) => (
          <path key={`t${i}`} d={pathOf(line, false)} strokeWidth={0.2} />
        ))}
      </g>
    </svg>
  );
}

/** The sheets as they will be printed or cut: every part placed on a page. */
export default function PagesView({ run }: { run: PapercraftResult }) {
  const t = useT();
  const unit = useUnit();
  const drawings = useMemo(() => renderPages(run.layout.pages, run.pattern.parts, { pageNumbers: true }), [run]);
  return (
    <div className="h-full overflow-y-auto bg-[var(--studio-bg)] p-4">
      <p className="mb-4 text-sm text-[var(--studio-ink-secondary)]">
        {t('{count} pages, {size} each. Solid lines are cut, dashed lines are folds (dash and dot is a mountain fold). Print at 100 % (no "fit to page").', {
          count: drawings.length,
          size: formatSize(run.pageSettings.pageWidthMm, run.pageSettings.pageHeightMm, unit),
        })}
      </p>
      <div className="mx-auto grid max-w-[1400px] gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {drawings.map((d, i) => (
          <figure key={i} className="min-w-0">
            <PageSheet drawing={d} />
            <figcaption className="mt-2 text-center text-xs text-[var(--studio-ink-muted)]">{t('Page {n} of {total}', { n: i + 1, total: drawings.length })}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
