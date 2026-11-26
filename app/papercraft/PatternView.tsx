'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { layoutPages, strokeText, transformPoint, type PapercraftResult, type Part, type Placement, type Vec2 } from '@/src/lib/papercraft-engine';
import { useT } from '../lib/i18n';
import { partColor } from './papercraftColors';

interface PatternViewProps {
  run: PapercraftResult;
  selectedPartId: number | null;
  onSelectPart: (partId: number | null) => void;
  onToggleEdge: (edgeId: number, joined: boolean) => void;
  /** Each part in its own colour (on the screen only). */
  colourParts: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const pointsAttr = (pts: readonly Vec2[]) => pts.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
const pathOf = (pts: readonly Vec2[], closed: boolean) => `M${pts.map((p) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(' L')}${closed ? ' Z' : ''}`;

/** All parts on one big canvas (no page breaks), so the whole pattern can be seen and edited. */
function useCanvasLayout(parts: readonly Part[]) {
  return useMemo(() => {
    if (parts.length === 0) return { placements: new Map<number, Placement>(), bounds: { x: 0, y: 0, w: 100, h: 100 } };
    const total = parts.reduce((s, p) => s + p.widthMm * p.heightMm, 0);
    const widest = Math.max(...parts.map((p) => Math.max(p.widthMm, p.heightMm)));
    const width = Math.max(widest + 20, Math.sqrt(total) * 1.6);
    const layout = layoutPages(parts, { pageWidthMm: width, pageHeightMm: 1e6, marginMm: 5, gapMm: 10, rotation: 'none' });
    const placements = new Map(layout.pages.flatMap((pg) => pg.placements).map((pl) => [pl.partId, pl]));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const part of parts) {
      const pl = placements.get(part.id);
      if (!pl) continue;
      for (const p of part.hull) {
        const [x, y] = transformPoint(pl, p);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const pad = 8;
    // y is up in the pattern; the SVG group below is flipped, so the view box is on the negated y range.
    return { placements, bounds: { x: minX - pad, y: -(maxY + pad), w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad } };
  }, [parts]);
}

export default function PatternView({ run, selectedPartId, onSelectPart, onToggleEdge, colourParts }: PatternViewProps) {
  const t = useT();
  const parts = run.pattern.parts;
  const { placements, bounds } = useCanvasLayout(parts);
  // The view (pan and zoom) belongs to one pattern: a new pattern starts by showing all of it.
  const [view, setView] = useState<{ of: Box; box: Box }>({ of: bounds, box: bounds });
  const box = view.of === bounds ? view.box : bounds;
  const setBox = useCallback(
    (next: Box | ((b: Box) => Box)) =>
      setView((v) => {
        const current = v.of === bounds ? v.box : bounds;
        return { of: bounds, box: typeof next === 'function' ? next(current) : next };
      }),
    [bounds],
  );
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setBox((b) => {
      const w = Math.min(Math.max(b.w * factor, 5), bounds.w * 8);
      const h = (w / b.w) * b.h;
      const px = cx ?? b.x + b.w / 2;
      const py = cy ?? b.y + b.h / 2;
      return { x: px - ((px - b.x) / b.w) * w, y: py - ((py - b.y) / b.h) * h, w, h };
    });
  }, [bounds.w, setBox]);

  // The wheel must be a non-passive listener to stop the page from scrolling while zooming.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      setBox((b) => {
        const fx = (event.clientX - rect.left) / rect.width;
        const fy = (event.clientY - rect.top) / rect.height;
        const factor = Math.exp(event.deltaY * 0.0015);
        const w = Math.min(Math.max(b.w * factor, 5), bounds.w * 8);
        const h = (w / b.w) * b.h;
        const px = b.x + fx * b.w;
        const py = b.y + fy * b.h;
        return { x: px - fx * w, y: py - fy * h, w, h };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bounds.w, setBox]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-edge-hit]')) return;
    drag.current = { x: event.clientX, y: event.clientY, box, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - d.x) / rect.width) * d.box.w;
    const dy = ((event.clientY - d.y) / rect.height) * d.box.h;
    if (Math.abs(event.clientX - d.x) + Math.abs(event.clientY - d.y) > 3) d.moved = true;
    setBox({ ...d.box, x: d.box.x - dx, y: d.box.y - dy });
  };
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && !(event.target as Element).closest('[data-part]')) onSelectPart(null);
  };

  const strokeWidth = box.w / 900; // thin lines that stay readable when zoomed

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--studio-bg)]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={t('Pattern: the parts of the model laid flat')}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <g transform="scale(1,-1)">
          {parts.map((part) => {
            const pl = placements.get(part.id);
            if (!pl) return null;
            const T = (p: Vec2) => transformPoint(pl, p);
            const selected = selectedPartId === part.id;
            return (
              <g key={part.id} data-part={part.id} onClick={() => onSelectPart(part.id)}>
                {part.tabs.map((tab) => (
                  <polygon key={`t${tab.edgeNumber}`} points={pointsAttr(tab.points.map(T))} fill="rgba(255,255,255,0.18)" stroke="var(--studio-ink-muted)" strokeWidth={strokeWidth} />
                ))}
                {part.faces.map((f) => (
                  <polygon key={f.faceId} points={pointsAttr(f.points.map(T))} fill={colourParts ? partColor(part.id, selected ? 72 : 58) : selected ? '#f6e7a8' : '#e6e0d0'} fillOpacity={selected ? 0.95 : colourParts ? 0.8 : 0.9} stroke="none" />
                ))}
                {part.foldLines.map((line, i) => (
                  <line
                    key={`f${i}`}
                    x1={T(line.a)[0]}
                    y1={T(line.a)[1]}
                    x2={T(line.b)[0]}
                    y2={T(line.b)[1]}
                    stroke={line.kind === 'mountain' ? '#ef4444' : line.kind === 'valley' ? '#3b82f6' : 'var(--studio-ink-muted)'}
                    strokeWidth={strokeWidth * 1.4}
                    strokeDasharray={line.kind === 'mountain' ? `${strokeWidth * 14} ${strokeWidth * 4} ${strokeWidth * 3} ${strokeWidth * 4}` : line.kind === 'flat' ? undefined : `${strokeWidth * 8} ${strokeWidth * 5}`}
                  />
                ))}
                {part.cutPaths.map((c, i) => (
                  <path key={`c${i}`} d={pathOf(c.points.map(T), c.closed)} fill="none" stroke={selected ? '#fbbf24' : 'var(--studio-ink)'} strokeWidth={strokeWidth * (selected ? 3 : 2)} strokeLinejoin="round" />
                ))}
                {part.labels.flatMap((l, i) => {
                  const [cx, cy] = T([l.x, l.y]);
                  let angle = l.angle + pl.rotation;
                  if (Math.cos(angle) < -1e-9) angle += Math.PI; // keep the text readable
                  return strokeText(l.text, cx, cy, l.height, angle).map((line, j) => (
                    <path key={`l${i}-${j}`} d={pathOf(line, false)} fill="none" stroke="var(--studio-ink)" strokeWidth={strokeWidth * 1.6} strokeLinecap="round" />
                  ));
                })}
                {part.edgeSegments
                  .filter((e) => e.state !== 'open')
                  .map((e, i) => {
                    const a = T(e.a);
                    const b = T(e.b);
                    const hot = hoverEdge === e.edgeId;
                    return (
                      <g key={`e${i}`}>
                        {hot && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#f59e0b" strokeWidth={strokeWidth * 5} strokeLinecap="round" pointerEvents="none" />}
                        <line
                          data-edge-hit
                          x1={a[0]}
                          y1={a[1]}
                          x2={b[0]}
                          y2={b[1]}
                          stroke="transparent"
                          strokeWidth={Math.max(strokeWidth * 14, 2)}
                          strokeLinecap="round"
                          className="cursor-pointer"
                          onPointerEnter={() => setHoverEdge(e.edgeId)}
                          onPointerLeave={() => setHoverEdge((cur) => (cur === e.edgeId ? null : cur))}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleEdge(e.edgeId, e.state === 'joined');
                          }}
                        >
                          <title>{e.state === 'joined' ? t('Fold. Click to cut here instead.') : t('Cut edge {number}. Click to fold here instead.', { number: e.number ?? 0 })}</title>
                        </line>
                      </g>
                    );
                  })}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex gap-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1 shadow-lg">
        <button type="button" onClick={() => zoomAt(0.75)} aria-label={t('Zoom in')} title={t('Zoom in')} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-hover-overlay)]">
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomAt(1.33)} aria-label={t('Zoom out')} title={t('Zoom out')} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-hover-overlay)]">
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setBox(bounds)} aria-label={t('Show all')} title={t('Show all the parts')} className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-hover-overlay)]">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 max-w-[60%] rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)]/90 px-3 py-2 text-xs text-[var(--studio-ink-secondary)] shadow">
        <span className="font-medium text-[var(--studio-ink)]">{t('Click an edge to change it:')}</span>{' '}
        {t('a fold becomes a cut, a cut becomes a fold.')}
        <span className="ml-2 inline-flex items-center gap-1" title={t('A mountain fold: the fold points up towards you when the paper is folded.')}><span className="inline-block h-0.5 w-4 bg-red-500" aria-hidden="true" />{t('mountain')}</span>
        <span className="ml-2 inline-flex items-center gap-1" title={t('A valley fold: the fold points away from you when the paper is folded.')}><span className="inline-block h-0.5 w-4 bg-blue-500" aria-hidden="true" />{t('valley')}</span>
        <span className="mt-1 block text-[var(--studio-ink-subtle)]">
          {colourParts
            ? t('Each part has its own colour only to tell the parts apart on the screen. You can turn the colours off under View in the settings. Nothing is printed or cut in colour.')
            : t('Red and blue are only on the screen, to show mountain and valley folds. On paper they are dash patterns.')}
        </span>
      </div>
    </div>
  );
}
