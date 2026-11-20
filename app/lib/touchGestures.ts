'use client';

/**
 * Two-finger pinch-zoom and pan for the studio canvases.
 *
 * `computePinchStep` is pure (it only turns two finger positions into a new view box); the
 * `useTouchViewGestures` hook wires it to an SVG element. One finger is left alone, so the
 * tools (select, drag, draw, box-select) keep working; a second finger takes over the view and
 * cancels whatever the first finger had started.
 */

import { useEffect, useRef, type RefObject } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PinchStepInput {
  /** The SVG's on-screen rectangle (px). */
  rect: { left: number; top: number; width: number; height: number };
  /** The view box currently shown, in mm. */
  viewBox: ViewBox;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  /** Midpoint and finger distance (px) at the previous and current event. */
  prev: { mid: Point; dist: number };
  next: { mid: Point; dist: number };
}

export interface PinchStepResult {
  zoom: number;
  viewBox: ViewBox;
}

/**
 * New zoom and view box for one pinch/pan step. The point of the drawing that was under the
 * previous midpoint ends up under the new midpoint, so fingers "hold" the artwork: spreading
 * zooms in around them, moving both together pans.
 */
export function computePinchStep(input: PinchStepInput): PinchStepResult {
  const { rect, viewBox, zoom, minZoom, maxZoom, prev, next } = input;
  if (rect.width <= 0 || rect.height <= 0 || prev.dist <= 0 || next.dist <= 0) {
    return { zoom, viewBox };
  }

  const newZoom = Math.min(maxZoom, Math.max(minZoom, zoom * (next.dist / prev.dist)));
  const ratio = zoom / newZoom;
  const width = viewBox.width * ratio;
  const height = viewBox.height * ratio;

  // The drawing point under the previous midpoint…
  const anchorX = viewBox.x + ((prev.mid.x - rect.left) / rect.width) * viewBox.width;
  const anchorY = viewBox.y + ((prev.mid.y - rect.top) / rect.height) * viewBox.height;
  // …must sit under the new midpoint in the new view box.
  const x = anchorX - ((next.mid.x - rect.left) / rect.width) * width;
  const y = anchorY - ((next.mid.y - rect.top) / rect.height) * height;

  return { zoom: newZoom, viewBox: { x, y, width, height } };
}

/**
 * The part of `rect` an SVG with `preserveAspectRatio="xMidYMid meet"` actually draws its view box in.
 * When the element's aspect differs from the view box's, the view box is centred with empty bands.
 */
export function fitRect(
  rect: { left: number; top: number; width: number; height: number },
  viewBox: { width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  if (viewBox.width <= 0 || viewBox.height <= 0 || rect.width <= 0 || rect.height <= 0) return rect;
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface TouchViewGestureOptions {
  /** Current zoom and displayed view box. Read at every step, so closures stay fresh. */
  getView: () => { zoom: number; viewBox: ViewBox };
  /** Applies a step's result to the canvas state. */
  applyView: (result: PinchStepResult) => void;
  minZoom: number;
  maxZoom: number;
  /** Called once when a second finger lands: cancel any drag/draw/selection the first finger began. */
  onGestureStart?: () => void;
}

/** After a gesture, ignore the click the lifting finger would otherwise produce. */
const CLICK_SUPPRESS_MS = 350;

export function useTouchViewGestures(svgRef: RefObject<SVGSVGElement | null>, options: TouchViewGestureOptions): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const pointers = new Map<number, Point>();
    let gestureActive = false;
    let prev: { mid: Point; dist: number } | null = null;
    let suppressClickUntil = 0;
    // Touch events can arrive faster than React re-renders, so the gesture tracks the view itself
    // instead of re-reading state for every event (which would apply some steps to a stale view).
    let liveView: { zoom: number; viewBox: ViewBox } | null = null;

    const firstTwo = (): [Point, Point] | null => {
      const [a, b] = [...pointers.values()];
      return a && b ? [a, b] : null;
    };

    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const pair = firstTwo()!;
        if (!gestureActive) {
          optionsRef.current.onGestureStart?.();
          liveView = optionsRef.current.getView();
        }
        gestureActive = true;
        prev = { mid: midpoint(pair[0], pair[1]), dist: distance(pair[0], pair[1]) };
        swallow(event);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!gestureActive) return;
      swallow(event);

      const pair = firstTwo();
      if (!pair || !prev) return;
      const next = { mid: midpoint(pair[0], pair[1]), dist: distance(pair[0], pair[1]) };
      const { getView, applyView, minZoom, maxZoom } = optionsRef.current;
      const view = liveView ?? getView();
      const rect = fitRect(svg.getBoundingClientRect(), view.viewBox);
      const result = computePinchStep({ rect, viewBox: view.viewBox, zoom: view.zoom, minZoom, maxZoom, prev, next });
      liveView = result;
      applyView(result);
      prev = next;
    };

    const onEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointers.delete(event.pointerId);
      if (!gestureActive) return;
      swallow(event);
      suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      if (pointers.size === 0) {
        gestureActive = false;
        liveView = null;
        prev = null;
      } else if (pointers.size === 1) {
        // The remaining finger must not start a drag mid-way; it is ignored until it lifts.
        prev = null;
      } else {
        const pair = firstTwo()!;
        prev = { mid: midpoint(pair[0], pair[1]), dist: distance(pair[0], pair[1]) };
      }
    };

    const onClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) swallow(event);
    };

    svg.addEventListener('pointerdown', onDown, true);
    svg.addEventListener('pointermove', onMove, true);
    svg.addEventListener('pointerup', onEnd, true);
    svg.addEventListener('pointercancel', onEnd, true);
    svg.addEventListener('click', onClick, true);
    return () => {
      svg.removeEventListener('pointerdown', onDown, true);
      svg.removeEventListener('pointermove', onMove, true);
      svg.removeEventListener('pointerup', onEnd, true);
      svg.removeEventListener('pointercancel', onEnd, true);
      svg.removeEventListener('click', onClick, true);
    };
  }, [svgRef]);
}
