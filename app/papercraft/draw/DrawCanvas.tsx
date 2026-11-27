'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  addItem,
  addTab,
  drawingOf,
  flattenItem,
  hitHandle,
  hitTest,
  insertPoint,
  nearestOnItem,
  pageView,
  moveItems,
  rectanglePoints,
  regularPolygonPoints,
  removeItems,
  removePoint,
  setHandle,
  setItemPoint,
  snapPoint,
  toggleCorner,
  type DrawDoc,
  type DrawItem,
  type Hit,
  type Vec2,
} from '@/src/lib/papercraft-engine';
import { useT } from '../../lib/i18n';
import type { DrawAction } from './drawState';
import { nextNumberText, type DrawTool, type ToolOptions } from './drawTools';

interface Props {
  doc: DrawDoc;
  /** The page that is shown and worked on (0 is the first). */
  page: number;
  selection: number[];
  tool: DrawTool;
  options: ToolOptions;
  dispatch: React.Dispatch<DrawAction>;
  /** The number tool puts a number down: the panel counts up. */
  onNumberPlaced: (next: string) => void;
  /** A tool that ends after one thing (the tab tool) or the escape key: back to selecting. */
  onTool: (tool: DrawTool) => void;
}

interface View {
  cx: number;
  cy: number;
  pxPerMm: number;
}

type Gesture =
  | { kind: 'move'; start: Vec2; base: DrawDoc; ids: number[]; moved: boolean }
  | { kind: 'vertex'; base: DrawDoc; id: number; index: number }
  | { kind: 'handle'; base: DrawDoc; id: number; index: number; which: 'in' | 'out'; mirror: boolean }
  | { kind: 'rect' | 'ngon' | 'fold'; start: Vec2 }
  | { kind: 'pan'; startClient: [number, number]; startView: View };

const COLOURS = { cut: '#111827', mountain: '#e11d48', valley: '#2563eb', selected: '#7c3aed', draft: '#7c3aed' } as const;
const DASH: Record<'mountain' | 'valley', string> = { mountain: '10 3 2 3', valley: '7 4' };

const pointsAttr = (points: readonly Vec2[]) => points.map((p) => `${p[0]},${p[1]}`).join(' ');

/** The sheet and everything on it, drawn as SVG (y up), with the tools' mouse handling. */
export default function DrawCanvas({ doc, page, selection, tool, options, dispatch, onNumberPlaced, onTool }: Props) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [view, setView] = useState<View | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  /** The shape being drawn (rectangle, polygon, line) before it is let go. */
  const [draft, setDraft] = useState<{ kind: 'rect' | 'ngon' | 'fold'; a: Vec2; b: Vec2 } | null>(null);
  const [poly, setPoly] = useState<Vec2[]>([]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setSize({ w: Math.max(100, el.clientWidth), h: Math.max(100, el.clientHeight) }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // What is found, snapped to and drawn is what is on this page; a change is made to the whole drawing.
  const shown = useMemo(() => pageView(doc, page), [doc, page]);

  const fit = useMemo<View>(() => {
    const k = Math.min(size.w / (doc.sheet.widthMm + 30), size.h / (doc.sheet.heightMm + 30));
    return { cx: doc.sheet.widthMm / 2, cy: doc.sheet.heightMm / 2, pxPerMm: Math.max(0.2, k) };
  }, [size.w, size.h, doc.sheet.widthMm, doc.sheet.heightMm]);
  const v = view ?? fit;
  const vw = size.w / v.pxPerMm;
  const vh = size.h / v.pxPerMm;
  const left = v.cx - vw / 2;
  const top = v.cy + vh / 2;
  const tol = 8 / v.pxPerMm;
  const snapTol = 10 / v.pxPerMm;

  const toMm = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return [0, 0];
      return [left + (e.clientX - rect.left) / v.pxPerMm, top - (e.clientY - rect.top) / v.pxPerMm];
    },
    [left, top, v.pxPerMm],
  );
  const snapped = (p: Vec2, exclude?: readonly number[]) => snapPoint(shown, p, { gridMm: options.gridMm, tolMm: snapTol, exclude });

  const zoomAt = (factor: number, around: Vec2 | null) => {
    const k = Math.min(40, Math.max(0.2, v.pxPerMm * factor));
    const p = around ?? [v.cx, v.cy];
    // The point under the pointer stays where it is.
    const r = v.pxPerMm / k;
    setView({ cx: p[0] + (v.cx - p[0]) * r, cy: p[1] + (v.cy - p[1]) * r, pxPerMm: k });
  };

  /** A cut is closed unless the person leaves it open; a fold line is always an open line. */
  const closing = options.outlineKind === 'cut' && !options.leaveOpen;
  const finishPolygon = (points: Vec2[]) => {
    if (points.length >= (closing ? 3 : 2)) {
      const added = addItem(doc, { kind: options.outlineKind, points, closed: closing, smooth: options.smooth, page });
      if (added.id !== null) dispatch({ type: 'EDIT', doc: added.doc, selection: [added.id] });
    }
    setPoly([]);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // The point is read before the canvas takes the focus, and the focus does not scroll the page (a scroll would move the sheet under the pointer).
    const raw = toMm(e);
    box.current?.focus({ preventScroll: true });
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      gesture.current = { kind: 'pan', startClient: [e.clientX, e.clientY], startView: v };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* a pointer that is already gone */
    }

    if (tool === 'select') {
      // A handle of the one selected Bézier curve is taken before anything under it.
      const only = selection.length === 1 ? shown.items.find((i) => i.id === selection[0]) : undefined;
      const handle = only ? hitHandle(only, raw, tol) : null;
      if (only && handle) {
        // Alt moves one handle on its own (a corner); without it the other handle follows (a smooth point).
        gesture.current = { kind: 'handle', base: doc, id: only.id, index: handle.index, which: handle.which, mirror: !e.altKey };
        return;
      }
      const hit = hitTest(shown, raw, tol);
      if (!hit) {
        dispatch({ type: 'SELECT', ids: [] });
        gesture.current = { kind: 'pan', startClient: [e.clientX, e.clientY], startView: v };
        return;
      }
      if (hit.vertex !== null && selection.length === 1 && selection[0] === hit.id && (e.ctrlKey || e.metaKey)) {
        // Ctrl- or Cmd-click on a point of the selected line takes the point away (a line keeps two points, a closed shape three).
        dispatch({ type: 'EDIT', doc: removePoint(doc, hit.id, hit.vertex) });
        return;
      }
      if (hit.vertex !== null && selection.length === 1 && selection[0] === hit.id) {
        gesture.current = { kind: 'vertex', base: doc, id: hit.id, index: hit.vertex };
        return;
      }
      const ids = e.shiftKey ? (selection.includes(hit.id) ? selection.filter((i) => i !== hit.id) : [...selection, hit.id]) : selection.includes(hit.id) ? selection : [hit.id];
      dispatch({ type: 'SELECT', ids });
      gesture.current = { kind: 'move', start: raw, base: doc, ids, moved: false };
      return;
    }

    const p = snapped(raw);
    if (tool === 'polygon') {
      if (closing && poly.length >= 3 && Math.hypot(poly[0]![0] - p[0], poly[0]![1] - p[1]) <= snapTol) finishPolygon(poly);
      else setPoly([...poly, p]);
      return;
    }
    if (tool === 'rect' || tool === 'ngon' || tool === 'fold') {
      gesture.current = { kind: tool, start: p };
      setDraft({ kind: tool, a: p, b: p });
      return;
    }
    if (tool === 'tab') {
      const hit: Hit | null = hitTest(shown, raw, tol);
      const item = hit ? shown.items.find((i) => i.id === hit.id) : undefined;
      if (hit && item && hit.edge !== null && item.kind === 'cut' && item.closed && !item.smooth) {
        const result = addTab(doc, hit.id, hit.edge, options.tab);
        if (result.added) dispatch({ type: 'EDIT', doc: result.doc, selection: [hit.id] });
      }
      return;
    }
    if (tool === 'number') {
      const added = addItem(doc, { kind: 'text', points: [p], closed: false, text: options.numberText, heightMm: options.numberHeightMm, page });
      if (added.id !== null) {
        dispatch({ type: 'EDIT', doc: added.doc, selection: [added.id] });
        onNumberPlaced(nextNumberText(options.numberText));
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const raw = toMm(e);
    setCursor(raw);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan') {
      const dx = (e.clientX - g.startClient[0]) / g.startView.pxPerMm;
      const dy = (e.clientY - g.startClient[1]) / g.startView.pxPerMm;
      setView({ ...g.startView, cx: g.startView.cx - dx, cy: g.startView.cy + dy });
      return;
    }
    if (g.kind === 'move') {
      let dx = raw[0] - g.start[0];
      let dy = raw[1] - g.start[1];
      if (options.gridMm > 0) {
        dx = Math.round(dx / options.gridMm) * options.gridMm;
        dy = Math.round(dy / options.gridMm) * options.gridMm;
      }
      if (!g.moved && Math.hypot(raw[0] - g.start[0], raw[1] - g.start[1]) < tol) return;
      gesture.current = { ...g, moved: true };
      dispatch({ type: 'PREVIEW', doc: moveItems(g.base, g.ids, dx, dy) });
      return;
    }
    if (g.kind === 'handle') {
      const at = g.base.items.find((i) => i.id === g.id)?.points[g.index];
      if (at) dispatch({ type: 'PREVIEW', doc: setHandle(g.base, g.id, g.index, g.which, [raw[0] - at[0], raw[1] - at[1]], g.mirror) });
      return;
    }
    if (g.kind === 'vertex') {
      const p = snapPoint(pageView(g.base, page), raw, { gridMm: options.gridMm, tolMm: snapTol, exclude: [g.id] });
      dispatch({ type: 'PREVIEW', doc: setItemPoint(g.base, g.id, g.index, p) });
      return;
    }
    setDraft({ kind: g.kind, a: g.start, b: snapped(raw) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'pan') return;
    if (g.kind === 'move' || g.kind === 'vertex' || g.kind === 'handle') {
      dispatch({ type: 'COMMIT' });
      return;
    }
    const a = g.start;
    const b = snapped(toMm(e));
    setDraft(null);
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) >= 1;
    if (!long) return;
    if (g.kind === 'rect') {
      if (Math.abs(b[0] - a[0]) < 1 || Math.abs(b[1] - a[1]) < 1) return;
      const added = addItem(doc, { kind: 'cut', points: rectanglePoints(a[0], a[1], b[0], b[1]), closed: true, page });
      if (added.id !== null) dispatch({ type: 'EDIT', doc: added.doc, selection: [added.id] });
    } else if (g.kind === 'ngon') {
      const radius = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const start = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const added = addItem(doc, { kind: 'cut', points: regularPolygonPoints(a[0], a[1], radius, options.sides, start), closed: true, page });
      if (added.id !== null) dispatch({ type: 'EDIT', doc: added.doc, selection: [added.id] });
    } else {
      const added = addItem(doc, { kind: options.foldKind, points: [a, b], closed: false, page });
      if (added.id !== null) dispatch({ type: 'EDIT', doc: added.doc, selection: [added.id] });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (e.key === ' ') {
      spaceDown.current = true;
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (gesture.current && gesture.current.kind !== 'pan') {
        gesture.current = null;
        setDraft(null);
        dispatch({ type: 'CANCEL' });
      } else if (poly.length > 0) setPoly([]);
      else if (tool !== 'select') onTool('select');
      else dispatch({ type: 'SELECT', ids: [] });
    } else if (e.key === 'Enter' && tool === 'polygon') finishPolygon(poly);
    else if ((e.key === 'Backspace' || e.key === 'Delete') && tool === 'polygon' && poly.length > 0) setPoly(poly.slice(0, -1));
    else if ((e.key === 'Backspace' || e.key === 'Delete') && selection.length > 0) {
      e.preventDefault();
      dispatch({ type: 'EDIT', doc: removeItems(doc, selection), selection: [] });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      dispatch({ type: 'REDO' });
    } else if (e.key.startsWith('Arrow') && selection.length > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowDown' ? -step : e.key === 'ArrowUp' ? step : 0;
      dispatch({ type: 'EDIT', doc: moveItems(doc, selection, dx, dy) });
    }
  };

  const textStrokes = useMemo(() => drawingOf(doc, { page }).text, [doc, page]);
  const selected = new Set(selection.filter((id) => shown.items.some((i) => i.id === id)));
  const hover: Hit | null = tool === 'tab' && cursor ? hitTest(shown, cursor, tol) : null;
  const hoverItem = hover ? shown.items.find((i) => i.id === hover.id) : undefined;
  const hoverEdge =
    hover && hover.edge !== null && hoverItem && hoverItem.kind === 'cut' && hoverItem.closed && !hoverItem.smooth
      ? ([hoverItem.points[hover.edge]!, hoverItem.points[(hover.edge + 1) % hoverItem.points.length]!] as const)
      : null;
  const px = (n: number) => n / v.pxPerMm;
  const gridShown = options.gridMm > 0 && options.gridMm * v.pxPerMm >= 6;

  const renderItem = (item: DrawItem) => {
    const isSel = selected.has(item.id);
    if (item.kind === 'text') return null;
    const stroke = isSel ? COLOURS.selected : COLOURS[item.kind];
    const common = { fill: 'none', stroke, strokeWidth: isSel ? 2.5 : 1.5, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const, ...(item.kind !== 'cut' ? { strokeDasharray: DASH[item.kind] } : {}) };
    const drawn = flattenItem(item);
    return item.closed ? <polygon key={item.id} points={pointsAttr(drawn)} {...common} fillOpacity={0} style={{ fill: isSel ? 'rgba(124,58,237,0.08)' : 'rgba(17,24,39,0.03)' }} /> : <polyline key={item.id} points={pointsAttr(drawn)} {...common} />;
  };

  const draftShape = (() => {
    if (!draft) return null;
    const { a, b } = draft;
    const common = { fill: 'rgba(124,58,237,0.08)', stroke: COLOURS.draft, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const, strokeDasharray: '4 3' };
    if (draft.kind === 'rect') return <polygon points={pointsAttr(rectanglePoints(a[0], a[1], b[0], b[1]))} {...common} />;
    if (draft.kind === 'ngon') return <polygon points={pointsAttr(regularPolygonPoints(a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]), options.sides, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI))} {...common} />;
    return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} fill="none" />;
  })();

  // What the drawing tools say about the thing being drawn.
  const readout = (() => {
    if (draft) {
      const { a, b } = draft;
      if (draft.kind === 'rect') return `${Math.abs(b[0] - a[0]).toFixed(1)} × ${Math.abs(b[1] - a[1]).toFixed(1)} mm`;
      return `${Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1)} mm`;
    }
    if (poly.length > 0 && cursor) return `${Math.hypot(cursor[0] - poly[poly.length - 1]![0], cursor[1] - poly[poly.length - 1]![1]).toFixed(1)} mm`;
    return null;
  })();

  return (
    <div
      ref={box}
      tabIndex={0}
      role="application"
      aria-label={t('Drawing sheet')}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => { if (e.key === ' ') spaceDown.current = false; }}
      className="relative h-full min-h-[320px] w-full overflow-hidden bg-[var(--studio-well)] outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      style={{ touchAction: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }}
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`${left} ${-top} ${vw} ${vh}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={(e) => {
          if (tool === 'select' && selection.length === 1) {
            const item = shown.items.find((i) => i.id === selection[0]);
            if (!item || item.kind === 'text') return;
            const at = toMm(e);
            const hit = hitTest(shown, at, tol, [item.id]);
            if (hit && hit.vertex !== null) {
              // On a point of a Bézier curve: a corner gets handles, a smooth point becomes a corner.
              if (item.handles) dispatch({ type: 'EDIT', doc: toggleCorner(doc, item.id, hit.vertex) });
              return;
            }
            // On the line, between the points: a new point there (a Bézier curve keeps its shape; a smooth curve becomes the Bézier curve it would be).
            const near = nearestOnItem(item, at);
            if (near && near.distance <= tol) dispatch({ type: 'EDIT', doc: insertPoint(doc, item.id, near.edge, near.t) });
            return;
          }
          if (tool === 'polygon' && poly.length >= 2) { const trimmed = poly.slice(0, -1); finishPolygon(trimmed.length >= (closing ? 3 : 2) ? trimmed : poly); }
        }}
        onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, toMm(e))}
        className="block select-none"
      >
        <g transform="scale(1,-1)">
          <rect x={0} y={0} width={doc.sheet.widthMm} height={doc.sheet.heightMm} fill="#ffffff" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {gridShown && (
            <>
              <defs>
                <pattern id="draw-grid" width={options.gridMm} height={options.gridMm} patternUnits="userSpaceOnUse">
                  <path d={`M ${options.gridMm} 0 L 0 0 0 ${options.gridMm}`} fill="none" stroke="#e2e8f0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                </pattern>
              </defs>
              <rect x={0} y={0} width={doc.sheet.widthMm} height={doc.sheet.heightMm} fill="url(#draw-grid)" pointerEvents="none" />
            </>
          )}
          {shown.items.map(renderItem)}
          {textStrokes.map((line, i) => (
            <polyline key={`t${i}`} points={pointsAttr(line)} fill="none" stroke="#111827" strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {shown.items.filter((i) => i.kind === 'text' && selected.has(i.id)).map((i) => (
            <circle key={`ts${i.id}`} cx={i.points[0]![0]} cy={i.points[0]![1]} r={Math.max((i.heightMm ?? 4) * 1.2, px(10))} fill="none" stroke={COLOURS.selected} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
          ))}
          {selected.size === 1 && shown.items.filter((i) => selected.has(i.id) && i.kind !== 'text').flatMap((i) => i.points.map((p, k) => <rect key={`${i.id}-${k}`} x={p[0] - px(4)} y={p[1] - px(4)} width={px(8)} height={px(8)} fill="#ffffff" stroke={COLOURS.selected} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />))}
          {selected.size === 1 && shown.items.filter((i) => selected.has(i.id) && i.handles).flatMap((i) => i.handles!.flatMap((h, k) => (['in', 'out'] as const).filter((w) => h[w][0] !== 0 || h[w][1] !== 0).map((w) => {
            const p = i.points[k]!;
            const c: Vec2 = [p[0] + h[w][0], p[1] + h[w][1]];
            return (
              <g key={`h${i.id}-${k}-${w}`} pointerEvents="none">
                <line x1={p[0]} y1={p[1]} x2={c[0]} y2={c[1]} stroke={COLOURS.selected} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
                <circle cx={c[0]} cy={c[1]} r={px(4.5)} fill={COLOURS.selected} stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })))}
          {hoverEdge && <line x1={hoverEdge[0][0]} y1={hoverEdge[0][1]} x2={hoverEdge[1][0]} y2={hoverEdge[1][1]} stroke={COLOURS.draft} strokeWidth={4} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={0.6} pointerEvents="none" />}
          {draftShape}
          {poly.length > 0 && (
            <>
              <polyline points={pointsAttr(flattenItem({ points: cursor ? [...poly, snapped(cursor)] : poly, closed: false, smooth: options.smooth }))} fill="none" stroke={COLOURS.draft} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
              {poly.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={px(i === 0 ? 5 : 3)} fill={i === 0 ? COLOURS.draft : '#ffffff'} stroke={COLOURS.draft} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
            </>
          )}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-[var(--studio-surface)]/90 px-2 py-1 text-xs tabular-nums text-[var(--studio-ink-secondary)]">
        {cursor ? `${cursor[0].toFixed(1)}, ${cursor[1].toFixed(1)} mm` : '—'}
        {readout && <span className="ml-2 font-semibold text-[var(--studio-ink)]">{readout}</span>}
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" aria-label={t('Zoom in')} title={t('Zoom in')} onClick={() => zoomAt(1.3, null)} className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1.5 text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"><ZoomIn className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" aria-label={t('Zoom out')} title={t('Zoom out')} onClick={() => zoomAt(1 / 1.3, null)} className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1.5 text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"><ZoomOut className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" aria-label={t('Show the whole sheet')} title={t('Show the whole sheet')} onClick={() => setView(null)} className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1.5 text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"><Maximize2 className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
