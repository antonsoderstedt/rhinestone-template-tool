'use client';

/**
 * Image → silhouette conversion tool. Lives entirely client-side: the
 * source raster is only ever used to compute a trace preview here — the
 * layer that gets added to the design is pure vector geometry (Polyline[]),
 * never the raster itself, so the eventual export stays vector-only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Polyline, TraceableImageData } from '@/src/lib/rhinestone-engine/index';
import { centerPolylines, polylinesToPathD } from './htvGeometry';
import { prepareTraceImage, runSilhouetteTrace, type PreparedTraceImage, type SilhouetteTraceOutcome, type SilhouetteTraceParams } from './silhouetteTrace';
import Modal from '../editor/ui/Modal';

import { useT } from '../lib/i18n';
/** Wait this long after the last slider move before tracing, so dragging stays smooth. */
const TRACE_DEBOUNCE_MS = 150;

interface HtvSilhouetteConverterModalProps {
  image: TraceableImageData | null;
  previewDataUrl: string | null;
  onCancel: () => void;
  onApply: (result: { polylines: Polyline[]; widthMm: number; heightMm: number }) => void;
}

export default function HtvSilhouetteConverterModal({ image, previewDataUrl, onCancel, onApply }: HtvSilhouetteConverterModalProps) {
  const t = useT();
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [smoothingToleranceMm, setSmoothingToleranceMm] = useState(0.35);
  const [minAreaMm2, setMinAreaMm2] = useState(1.5);
  const [targetWidthMm, setTargetWidthMm] = useState(100);

  const params = useMemo<SilhouetteTraceParams>(
    () => ({ threshold, invert, smoothingToleranceMm, minAreaMm2, targetWidthMm }),
    [threshold, invert, smoothingToleranceMm, minAreaMm2, targetWidthMm],
  );

  // Tracing is CPU-heavy and runs on this thread, so it is deferred a tick (letting the "Tracing…"
  // state paint first) and debounced while a slider is being dragged.
  const [settled, setSettled] = useState<{ params: SilhouetteTraceParams; outcome: SilhouetteTraceOutcome } | null>(null);
  const [prepared, setPrepared] = useState<PreparedTraceImage | null>(null);
  const preparedRef = useRef<{ source: TraceableImageData; prepared: PreparedTraceImage } | null>(null);

  useEffect(() => {
    if (!image) return undefined;
    const handle = window.setTimeout(() => {
      let current = preparedRef.current;
      if (!current || current.source !== image) {
        current = { source: image, prepared: prepareTraceImage(image) };
        preparedRef.current = current;
        setPrepared(current.prepared);
      }
      setSettled({ params, outcome: runSilhouetteTrace(current.prepared.image, params) });
    }, settled === null ? 30 : TRACE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // `settled === null` only picks the first delay; re-running when it changes would retrace needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, params]);

  const tracing = settled === null || settled.params !== params;
  const outcome = settled?.outcome ?? null;
  const trace = outcome && outcome.status !== 'error' ? outcome.trace : null;

  if (!image) return null;

  const handleApply = () => {
    if (tracing || !trace || trace.polylines.length === 0) return;
    const centered = centerPolylines(trace.polylines);
    onApply({ polylines: centered.polylines, widthMm: centered.widthMm, heightMm: centered.heightMm });
  };

  return (
    <Modal open={Boolean(image)} onClose={onCancel} titleId="htv-silhouette-title" overlayClassName="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="htv-silhouette-title" className="text-sm font-semibold text-ink">{t('Convert image to silhouette')}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{t('Adjust the sliders until the outline looks right, then apply.')}</p>
          </div>
          <button onClick={onCancel} aria-label={t('Cancel')} className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:flex-row md:overflow-hidden">
          <div className="relative flex min-h-[280px] flex-1 items-center justify-center rounded-xl bg-surface-raised p-4">
            <svg viewBox="-60 -60 120 120" className="h-full max-h-full w-full max-w-full">
              {previewDataUrl && (
                <image href={previewDataUrl} x={-50} y={-50} width={100} height={100} opacity={0.25} preserveAspectRatio="xMidYMid meet" />
              )}
              {trace && trace.polylines.length > 0 && (
                <g transform={`scale(${100 / Math.max(trace.widthMm, trace.heightMm, 1)})`}>
                  <path
                    d={polylinesToPathD(centerPolylines(trace.polylines).polylines)}
                    fill="#1c1c1e"
                    fillRule="nonzero"
                  />
                </g>
              )}
            </svg>
            {tracing && (
              <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-raised/70">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {settled === null ? 'Preparing image…' : 'Tracing…'}
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-4 md:w-64 md:shrink-0 md:overflow-y-auto">
            <SliderField label={t('Threshold')} value={threshold} min={0} max={255} step={1} onChange={setThreshold} />
            <SliderField label={t('Smoothing')} value={smoothingToleranceMm} min={0} max={3} step={0.05} onChange={setSmoothingToleranceMm} unit="mm" />
            <SliderField label={t('Min blob size')} value={minAreaMm2} min={0} max={20} step={0.5} onChange={setMinAreaMm2} unit="mm²" />
            <SliderField label={t('Target width')} value={targetWidthMm} min={10} max={400} step={5} onChange={setTargetWidthMm} unit="mm" />

            <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="rounded border-border bg-surface-sunken text-accent-600" />
              {t('Invert (trace the light areas instead)')}
            </label>

            {!tracing && outcome?.status === 'error' && (
              <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                <p className="font-semibold">{t('Could not trace this image')}</p>
                <p className="mt-0.5">{outcome.message}</p>
              </div>
            )}

            {!tracing && outcome?.status === 'empty' && (
              <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                {outcome.message}
              </div>
            )}

            {!tracing && outcome?.status === 'ok' && trace && trace.warnings.length > 0 && (
              <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                {trace.warnings.join(' ')}
              </div>
            )}

            {prepared?.downscaledFrom && (
              <p className="text-xs text-ink-muted">
                Large image: traced at {prepared.image.widthPx} × {prepared.image.heightPx} px (original {prepared.downscaledFrom.widthPx} × {prepared.downscaledFrom.heightPx} px) to keep this fast.
              </p>
            )}

            <button
              onClick={handleApply}
              disabled={tracing || !trace || trace.polylines.length === 0}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-3 py-2.5 text-sm font-medium text-ink-inverse transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted"
            >
              {tracing ? 'Tracing…' : 'Apply as layer'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-ink-secondary">
        <span>{label}</span>
        <span className="text-ink-muted">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent-500"
      />
    </label>
  );
}
