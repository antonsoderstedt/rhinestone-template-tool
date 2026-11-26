'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import {
  layoutProblems,
  partBox,
  renderCover,
  renderPage,
  renderPages,
  type CoverContent,
  type PageDrawing,
  type PapercraftResult,
  type Part,
  type Placement,
  type Vec2,
} from '@/src/lib/papercraft-engine';
import { formatSize, useUnit } from '../lib/units';
import { useT } from '../lib/i18n';
import { CheckField, Tip } from './fields';
import { boxesOf, clampBox, freeSpot, fullness, pinsOf, snapBox, turnedBox, type PartBox, type SheetSize } from './papercraftLayout';
import type { PapercraftAction, PapercraftState } from './papercraftState';

const pathOf = (pts: readonly Vec2[], closed: boolean) => `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L')}${closed ? ' Z' : ''}`;
const pointsOf = (pts: readonly Vec2[]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

/** Where a part with this box and turn is, as the placement the drawing code wants. */
function placementFor(part: Part, rotation: number, x: number, y: number): Placement {
  const box = partBox(part, rotation);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { partId: part.id, rotation, x, y, cos, sin, tx: x - box.minX, ty: y - box.minY };
}

interface Drag {
  partId: number;
  /** The part's box where it was when it was picked up. */
  box: PartBox;
  /** Where in the box the pointer took hold. */
  grabX: number;
  grabY: number;
  /** Where the part would go now: a page and the corner of its box (after snapping). */
  page: number | null;
  x: number;
  y: number;
}

interface SheetProps {
  drawing: PageDrawing;
  /** Set for a page of the pattern (not the cover): the parts on it can be moved. */
  pageIndex?: number;
  boxes?: readonly PartBox[];
  selectedPartId?: number | null;
  problemParts?: ReadonlySet<number>;
  ghost?: PageDrawing | null;
  draggingId?: number | null;
  onPartDown?: (event: React.PointerEvent<SVGPolygonElement>, partId: number, svg: SVGSVGElement) => void;
  onPartMove?: (event: React.PointerEvent<SVGPolygonElement>) => void;
  onPartUp?: (event: React.PointerEvent<SVGPolygonElement>) => void;
  onPartKey?: (event: React.KeyboardEvent<SVGPolygonElement>, partId: number) => void;
  hulls?: ReadonlyMap<number, Vec2[]>;
}

function PageSheet({ drawing, pageIndex, boxes, selectedPartId, problemParts, ghost, draggingId, onPartDown, onPartMove, onPartUp, onPartKey, hulls }: SheetProps) {
  const t = useT();
  const ref = useRef<SVGSVGElement>(null);
  const editable = pageIndex !== undefined && boxes !== undefined;
  return (
    <svg
      ref={ref}
      role="group"
      aria-label={t('One page of the pattern')}
      data-sheet={pageIndex}
      viewBox={`0 ${-drawing.heightMm} ${drawing.widthMm} ${drawing.heightMm}`}
      className="h-auto w-full touch-none select-none rounded-sm bg-white shadow-lg ring-1 ring-black/10"
      style={draggingId != null ? { overflow: 'visible' } : undefined}
    >
      <g transform="scale(1,-1)" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke="#000">
        {drawing.fills.map((f, i) => (
          <path
            key={`fill${i}`}
            d={pathOf(f.points, true)}
            fill={`rgb(${f.rgb.map((c) => Math.round(c * 255)).join(',')})`}
            stroke={f.strokeRgb ? `rgb(${f.strokeRgb.map((c) => Math.round(c * 255)).join(',')})` : 'none'}
            strokeWidth={f.strokeMm ?? 0}
          />
        ))}
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
        {editable &&
          boxes.map((b) => {
            const hull = hulls?.get(b.partId);
            if (!hull) return null;
            const selected = selectedPartId === b.partId;
            const problem = problemParts?.has(b.partId) ?? false;
            return (
              <polygon
                key={`h${b.partId}`}
                points={pointsOf(hull)}
                role="button"
                tabIndex={0}
                aria-label={t('Part {n} on page {page}', { n: b.partId, page: b.page + 1 })}
                aria-pressed={selected}
                data-part={b.partId}
                fill={selected ? 'rgba(139,92,246,0.16)' : 'rgba(0,0,0,0)'}
                stroke={problem ? '#dc2626' : selected ? '#7c3aed' : 'none'}
                strokeWidth={problem || selected ? 0.8 : 0}
                strokeDasharray={problem ? '2 1' : undefined}
                style={{ cursor: draggingId === b.partId ? 'grabbing' : 'grab', opacity: draggingId === b.partId ? 0.5 : 1, touchAction: 'none' }}
                onPointerDown={(e) => ref.current && onPartDown?.(e, b.partId, ref.current)}
                onPointerMove={onPartMove}
                onPointerUp={onPartUp}
                onPointerCancel={onPartUp}
                onKeyDown={(e) => onPartKey?.(e, b.partId)}
              />
            );
          })}
        {ghost && (
          <g stroke="#7c3aed" strokeWidth={0.5} opacity={0.85}>
            {ghost.cut.map((c, i) => (
              <path key={`gc${i}`} d={pathOf(c.points, c.closed)} fill="rgba(139,92,246,0.12)" />
            ))}
            {ghost.folds.map((f, i) => (
              <line key={`gf${i}`} x1={f.a[0]} y1={f.a[1]} x2={f.b[0]} y2={f.b[1]} strokeWidth={0.25} strokeDasharray="1.6 1.2" />
            ))}
          </g>
        )}
      </g>
      {/* Text is set the right way up, outside the flipped group (the view box runs from -height to 0). */}
      {drawing.texts.map((r, i) => (
        <text
          key={`x${i}`}
          x={r.x}
          y={-r.y}
          fontSize={r.sizeMm}
          fontWeight={r.bold ? 700 : 400}
          textAnchor={r.align === 'middle' ? 'middle' : 'start'}
          fontFamily="Helvetica, Arial, sans-serif"
          fill={r.rgb ? `rgb(${r.rgb.map((c) => Math.round(c * 255)).join(',')})` : '#000'}
        >
          {r.text}
        </text>
      ))}
    </svg>
  );
}

/** A point on the screen as a point on the page under it, in millimetres with y up. */
function pageCoords(svg: SVGSVGElement, clientX: number, clientY: number): Vec2 | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return [p.x, -p.y];
}

interface PagesViewProps {
  run: PapercraftResult;
  cover: { content: CoverContent; size: { widthMm: number; heightMm: number } } | null;
  layout: PapercraftState['layout'];
  dispatch: React.Dispatch<PapercraftAction>;
  selectedPartId: number | null;
  onSelectPart: (partId: number | null) => void;
}

/** The sheets as they will be printed or cut: every part placed on a page, and the parts can be moved, turned and put on another page. */
export default function PagesView({ run, cover, layout, dispatch, selectedPartId, onSelectPart }: PagesViewProps) {
  const t = useT();
  const unit = useUnit();
  const parts = run.pattern.parts;
  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const drawings = useMemo(() => renderPages(run.layout.pages, parts, { pageNumbers: true }), [run, parts]);
  const coverDrawing = useMemo(() => (cover ? renderCover(cover.content, run.solid, run.pattern, run.layout, cover.size) : null), [cover, run]);
  const boxes = useMemo(() => boxesOf(run.layout, parts), [run, parts]);
  const hulls = useMemo(() => {
    const m = new Map<number, Vec2[]>();
    for (const page of run.layout.pages) {
      for (const pl of page.placements) {
        const part = partById.get(pl.partId);
        if (part) m.set(pl.partId, part.hull.map((q): Vec2 => [pl.cos * q[0] - pl.sin * q[1] + pl.tx, pl.sin * q[0] + pl.cos * q[1] + pl.ty]));
      }
    }
    return m;
  }, [run, partById]);
  const problems = useMemo(() => layoutProblems(run.layout, parts), [run, parts]);
  const problemParts = useMemo(() => new Set(problems.map((p) => p.partId)), [problems]);
  const sheet: SheetSize = useMemo(
    () => ({ widthMm: run.pageSettings.pageWidthMm, heightMm: run.pageSettings.pageHeightMm, marginMm: run.pageSettings.marginMm, gapMm: run.pageSettings.gapMm }),
    [run],
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const place = useCallback(
    (moved: PartBox[]) => {
      const byId = new Map(boxes.map((b) => [b.partId, b]));
      for (const b of moved) byId.set(b.partId, b);
      dispatch({ type: 'SET_PINS', pins: pinsOf([...byId.values()]) });
    },
    [boxes, dispatch],
  );

  const onPartDown = useCallback(
    (event: React.PointerEvent<SVGPolygonElement>, partId: number, svg: SVGSVGElement) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const box = boxes.find((b) => b.partId === partId);
      const p = pageCoords(svg, event.clientX, event.clientY);
      if (!box || !p) return;
      try {
        // So the part keeps getting the movements when the pointer leaves it; a pointer that cannot be captured still works while it is over the part.
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Not every pointer can be captured.
      }
      onSelectPart(partId);
      setDrag({ partId, box, grabX: p[0] - box.x, grabY: p[1] - box.y, page: box.page, x: box.x, y: box.y });
    },
    [boxes, onSelectPart],
  );

  /** The page under the pointer and the box corner there (snapped), or no page when the pointer is not over one. */
  const targetOf = useCallback(
    (clientX: number, clientY: number, d: Drag): { page: number | null; x: number; y: number } => {
      const box = d.box;
      const under = document.elementsFromPoint(clientX, clientY).find((el): el is SVGSVGElement => el instanceof SVGSVGElement && el.dataset.sheet !== undefined);
      if (!under) return { page: null, x: d.x, y: d.y };
      const page = Number(under.dataset.sheet);
      const p = pageCoords(under, clientX, clientY);
      if (!p) return { page: null, x: d.x, y: d.y };
      const raw = { x: p[0] - d.grabX, y: p[1] - d.grabY, w: box.w, h: box.h };
      const others = boxes.filter((b) => b.page === page && b.partId !== d.partId);
      const snapped = snapBox(raw, sheet, others);
      const clamped = clampBox({ ...raw, ...snapped }, sheet);
      return { page, ...clamped };
    },
    [boxes, sheet],
  );

  const onPartMove = useCallback(
    (event: React.PointerEvent<SVGPolygonElement>) => {
      if (!drag) return;
      // Near the top or bottom edge the view scrolls, so a part can be carried to a page that is not on the screen.
      const scroller = scrollerRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (event.clientY < r.top + 60) scroller.scrollTop -= 24;
        else if (event.clientY > r.bottom - 60) scroller.scrollTop += 24;
      }
      const target = targetOf(event.clientX, event.clientY, drag);
      setDrag({ ...drag, ...target });
    },
    [drag, targetOf],
  );

  const onPartUp = useCallback(
    (event: React.PointerEvent<SVGPolygonElement>) => {
      if (!drag) return;
      const box = drag.box;
      const target = event.type === 'pointercancel' ? { page: null, x: drag.x, y: drag.y } : targetOf(event.clientX, event.clientY, drag);
      setDrag(null);
      // A click that did not move the part only selects it.
      if (target.page === null || (target.page === box.page && Math.abs(target.x - box.x) < 0.05 && Math.abs(target.y - box.y) < 0.05)) return;
      place([{ ...box, page: target.page, x: target.x, y: target.y }]);
    },
    [drag, targetOf, place],
  );

  const turn = useCallback(
    (partId: number, quarterTurns: number) => {
      const box = boxes.find((b) => b.partId === partId);
      const part = partById.get(partId);
      if (box && part) place([turnedBox(part, box, quarterTurns, sheet)]);
    },
    [boxes, partById, place, sheet],
  );

  const moveToPage = useCallback(
    (partId: number, page: number) => {
      const box = boxes.find((b) => b.partId === partId);
      if (!box || box.page === page) return;
      const others = boxes.filter((b) => b.page === page && b.partId !== partId);
      const spot = freeSpot(box.w, box.h, sheet, others) ?? { x: sheet.marginMm, y: sheet.marginMm };
      place([{ ...box, page, x: spot.x, y: spot.y }]);
    },
    [boxes, place, sheet],
  );

  const onPartKey = useCallback(
    (event: React.KeyboardEvent<SVGPolygonElement>, partId: number) => {
      const box = boxes.find((b) => b.partId === partId);
      if (!box) return;
      const step = event.shiftKey ? 5 : 1;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[event.key]) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        place([{ ...box, ...clampBox({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h }, sheet) }]);
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        turn(partId, event.shiftKey ? -1 : 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectPart(partId);
      }
    },
    [boxes, place, sheet, turn, onSelectPart],
  );

  const ghostFor = (pageIndex: number): PageDrawing | null => {
    if (!drag || drag.page !== pageIndex) return null;
    const part = partById.get(drag.partId);
    if (!part) return null;
    const page = run.layout.pages[0] ?? { index: 0, widthMm: sheet.widthMm, heightMm: sheet.heightMm, placements: [] };
    return renderPage({ ...page, index: pageIndex, placements: [placementFor(part, drag.box.rotation, drag.x, drag.y)] }, [part], 1);
  };

  const selectedBox = selectedPartId === null ? null : boxes.find((b) => b.partId === selectedPartId) ?? null;
  const pageCount = run.layout.pages.length;
  const pinned = Object.keys(layout.pins).length > 0;
  const outside = problems.filter((p) => p.kind === 'outside').length;
  const over = new Set(problems.filter((p) => p.kind === 'overlap').map((p) => p.partId)).size;
  const btn = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div ref={scrollerRef} className="h-full overflow-y-auto bg-[var(--studio-bg)] p-4">
      <div className="mx-auto mb-4 max-w-[1400px] space-y-3">
        <p className="text-sm text-[var(--studio-ink-secondary)]">
          {t('{count} pages, {size} each. Solid lines are cut, dashed lines are folds (dash and dot is a mountain fold). Print at 100 % (no "fit to page").', {
            count: drawings.length,
            size: formatSize(run.pageSettings.pageWidthMm, run.pageSettings.pageHeightMm, unit),
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-2">
          <span className="px-1 text-xs font-semibold text-[var(--studio-ink)]">
            {t('Place the parts')}
            <Tip text={t('Drag a part to move it on its page, or drop it on another page to put it there. Use the arrow keys to nudge it and R to turn it.')} />
          </span>
          <button type="button" className={btn} onClick={() => dispatch({ type: 'RESET_LAYOUT' })} disabled={!pinned} title={t('Let the program place all the parts again.')}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Place them again')}
          </button>
          <CheckField
            label={t('Pack tightly')}
            tip={t('Tries several ways to arrange the parts and keeps the one that needs the fewest pages. It places all the parts again.')}
            checked={layout.tight}
            onChange={(on) => dispatch({ type: 'SET_TIGHT', on })}
          />
          <label className="flex items-center gap-1.5 text-xs text-[var(--studio-ink-secondary)]" title={t('The most parts on one page. Choose Any to fill every page as much as possible. It places all the parts again.')}>
            {t('Parts per page')}
            <select
              value={layout.maxPartsPerPage ?? 0}
              onChange={(event) => dispatch({ type: 'SET_PAGE_LIMIT', limit: Number(event.target.value) || null })}
              className="h-8 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-1.5 text-xs text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <option value={0}>{t('Any')}</option>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-2">
          {selectedBox ? (
            <>
              <span className="px-1 text-xs font-semibold text-[var(--studio-ink)]">{t('Part {n}', { n: selectedBox.partId })}</span>
              <button type="button" className={btn} onClick={() => turn(selectedBox.partId, -1)} title={t('Turn the part a quarter turn to the left (Shift+R).')}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Turn left')}
              </button>
              <button type="button" className={btn} onClick={() => turn(selectedBox.partId, 1)} title={t('Turn the part a quarter turn to the right (R).')}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Turn right')}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-[var(--studio-ink-secondary)]" title={t('Put the part on another page, where there is room for it.')}>
                {t('Move to page')}
                <select
                  value={selectedBox.page}
                  onChange={(event) => moveToPage(selectedBox.partId, Number(event.target.value))}
                  className="h-8 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-1.5 text-xs text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  {Array.from({ length: pageCount + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === pageCount ? t('A new page') : String(i + 1)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={btn} onClick={() => onSelectPart(null)} title={t('Stop working with this part.')}>
                {t('Done')}
              </button>
            </>
          ) : (
            <span className="px-1 text-xs text-[var(--studio-ink-subtle)]">{t('Click a part to turn it or move it to another page.')}</span>
          )}
          {outside > 0 && <span className="ml-auto rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs">{t('{count} parts stick out over the edge of the page.', { count: outside })}</span>}
          {over > 0 && <span className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs">{t('{count} parts lie over each other.', { count: over })}</span>}
        </div>
      </div>
      <div className="mx-auto grid max-w-[1400px] gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {coverDrawing && (
          <figure className="min-w-0 sm:col-span-2 sm:row-span-2">
            <PageSheet drawing={coverDrawing} />
            <figcaption className="mt-2 text-center text-xs text-[var(--studio-ink-muted)]">{t('Cover page (PDF only)')}</figcaption>
          </figure>
        )}
        {drawings.map((d, i) => {
          const onPage = boxes.filter((b) => b.page === i);
          return (
            <figure key={i} className={`min-w-0 ${drag && drag.box.page === i ? 'relative z-20' : ''}`}>
              <PageSheet
                drawing={d}
                pageIndex={i}
                boxes={onPage}
                hulls={hulls}
                selectedPartId={selectedPartId}
                problemParts={problemParts}
                ghost={ghostFor(i)}
                draggingId={drag?.partId ?? null}
                onPartDown={onPartDown}
                onPartMove={onPartMove}
                onPartUp={onPartUp}
                onPartKey={onPartKey}
              />
              <figcaption className="mt-2 text-center text-xs text-[var(--studio-ink-muted)]">
                {t('Page {n} of {total}', { n: i + 1, total: drawings.length })} · {t('{count} parts, {percent} % full', { count: onPage.length, percent: fullness(onPage, sheet) })}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
