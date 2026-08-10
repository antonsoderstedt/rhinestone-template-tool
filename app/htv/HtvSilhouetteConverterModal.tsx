'use client';

/**
 * Image → silhouette conversion tool. Lives entirely client-side: the
 * source raster is only ever used to compute a trace preview here — the
 * layer that gets added to the design is pure vector geometry (Polyline[]),
 * never the raster itself, so the eventual export stays vector-only.
 */

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { traceImageSilhouette, type Polyline, type TraceableImageData } from '@/src/lib/rhinestone-engine/index';
import { centerPolylines, polylinesToPathD } from './htvGeometry';

interface HtvSilhouetteConverterModalProps {
  image: TraceableImageData | null;
  previewDataUrl: string | null;
  onCancel: () => void;
  onApply: (result: { polylines: Polyline[]; widthMm: number; heightMm: number }) => void;
}

export default function HtvSilhouetteConverterModal({ image, previewDataUrl, onCancel, onApply }: HtvSilhouetteConverterModalProps) {
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [smoothingToleranceMm, setSmoothingToleranceMm] = useState(0.35);
  const [minAreaMm2, setMinAreaMm2] = useState(1.5);
  const [targetWidthMm, setTargetWidthMm] = useState(100);

  const trace = useMemo(() => {
    if (!image) return null;
    try {
      return traceImageSilhouette({
        image,
        threshold,
        invert,
        smoothingToleranceMm,
        minAreaMm2,
        targetWidthMm,
        preserveAspectRatio: true,
      });
    } catch {
      return null;
    }
  }, [image, threshold, invert, smoothingToleranceMm, minAreaMm2, targetWidthMm]);

  if (!image) return null;

  const handleApply = () => {
    if (!trace || trace.polylines.length === 0) return;
    const centered = centerPolylines(trace.polylines);
    onApply({ polylines: centered.polylines, widthMm: centered.widthMm, heightMm: centered.heightMm });
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div className="flex h-full max-h-[720px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Convert image to silhouette</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Adjust the sliders until the outline looks right, then apply.</p>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="rounded-lg p-2 text-ink-secondary transition hover:bg-surface-raised hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 md:flex-row md:overflow-hidden">
          <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-xl bg-surface-raised p-4">
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
          </div>

          <div className="flex w-full flex-col gap-4 md:w-64 md:shrink-0 md:overflow-y-auto">
            <SliderField label="Threshold" value={threshold} min={0} max={255} step={1} onChange={setThreshold} />
            <SliderField label="Smoothing" value={smoothingToleranceMm} min={0} max={3} step={0.05} onChange={setSmoothingToleranceMm} unit="mm" />
            <SliderField label="Min blob size" value={minAreaMm2} min={0} max={20} step={0.5} onChange={setMinAreaMm2} unit="mm²" />
            <SliderField label="Target width" value={targetWidthMm} min={10} max={400} step={5} onChange={setTargetWidthMm} unit="mm" />

            <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="rounded border-border bg-surface-sunken text-accent-600" />
              Invert (trace the light areas instead)
            </label>

            {trace && trace.warnings.length > 0 && (
              <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-2 text-[11px] text-warning-600">
                {trace.warnings.join(' ')}
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={!trace || trace.polylines.length === 0}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-3 py-2.5 text-sm font-medium text-ink-inverse transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted"
            >
              Apply as layer
            </button>
          </div>
        </div>
      </div>
    </div>
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
