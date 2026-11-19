'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import Modal from '../editor/ui/Modal';
import { getMatFit, sanitizeExportFilename } from './exportDialogHelpers';

export interface ExportDialogNote {
  tone: 'warning' | 'info';
  text: string;
}

export interface ExportDialogProps {
  open: boolean;
  title: string;
  /** The exact SVG that will be downloaded. Null while it is being generated. */
  svg: string | null;
  loading?: boolean;
  error?: string | null;
  widthMm: number | null;
  heightMm: number | null;
  /** Extra facts, e.g. stone count or layer count. */
  summaryRows: { label: string; value: string }[];
  /** Design warnings shown under the preview. */
  notes?: ExportDialogNote[];
  /** Set when the material has no approved calibration profile. */
  calibration?: { needsCalibration: boolean; onCalibrate: () => void } | null;
  /** File name without extension, used as the starting value of the file name field. */
  defaultFilename: string;
  onDownload: (filename: string, options: { uncalibratedOverride: boolean }) => void;
  onClose: () => void;
  /**
   * Studio-specific options (e.g. HTV mirror, weed border). A function receives the calibration gate so extra downloads
   * can follow the same rule as the main one.
   */
  children?: ReactNode | ((gate: ExportDialogGate) => ReactNode);
}

export interface ExportDialogGate {
  /** False until the material is calibrated or the user has acknowledged the uncalibrated warning. */
  downloadAllowed: boolean;
  /** True when files must be marked uncalibrated. */
  uncalibrated: boolean;
}

const TITLE_ID = 'export-dialog-title';

function ExportDialogContent({
  title,
  svg,
  loading = false,
  error = null,
  widthMm,
  heightMm,
  summaryRows,
  notes = [],
  calibration = null,
  defaultFilename,
  onDownload,
  onClose,
  children,
}: Omit<ExportDialogProps, 'open'>) {
  const [filename, setFilename] = useState(defaultFilename);
  const [acknowledged, setAcknowledged] = useState(false);

  const needsCalibration = Boolean(calibration?.needsCalibration);
  const matFit = widthMm !== null && heightMm !== null ? getMatFit(widthMm, heightMm) : null;
  const previewSrc = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
  const sanitizedFilename = sanitizeExportFilename(filename, defaultFilename || 'design');
  const downloadFilename = needsCalibration && !/-uncalibrated\.svg$/i.test(sanitizedFilename)
    ? sanitizedFilename.replace(/\.svg$/i, '-uncalibrated.svg')
    : sanitizedFilename;
  const gateOpen = !needsCalibration || acknowledged;
  const canDownload = Boolean(svg) && !loading && !error && gateOpen;
  const extra = typeof children === 'function' ? children({ downloadAllowed: gateOpen, uncalibrated: needsCalibration }) : children;

  const matToneClass = matFit?.status === 'fits-12x12'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

  return (
    <div
      role="document"
      className="flex max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
        <h2 id={TITLE_ID} className="text-base font-semibold text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label="Close export dialog"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div
            className="flex h-56 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-white p-3"
            data-testid="export-preview"
          >
            {loading && <span className="text-sm text-zinc-400">Preparing preview…</span>}
            {!loading && error && <span className="text-center text-sm text-red-600">{error}</span>}
            {!loading && !error && previewSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL preview of the exact export
              <img src={previewSrc} alt="Preview of the exported SVG" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <p className="text-xs leading-5 text-zinc-400">
            Preview of the exact file you will download. It is a vector SVG sized in millimetres.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm text-zinc-300">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Width</dt>
              <dd className="text-sm font-semibold text-white">{widthMm !== null ? `${widthMm.toFixed(1)} mm` : '—'}{widthMm !== null && <span className="ml-1 text-xs font-normal text-zinc-400">({(widthMm / 25.4).toFixed(1)} in)</span>}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Height</dt>
              <dd className="text-sm font-semibold text-white">{heightMm !== null ? `${heightMm.toFixed(1)} mm` : '—'}{heightMm !== null && <span className="ml-1 text-xs font-normal text-zinc-400">({(heightMm / 25.4).toFixed(1)} in)</span>}</dd>
            </div>
            {summaryRows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">{row.label}</dt>
                <dd className="text-sm font-semibold text-white">{row.value}</dd>
              </div>
            ))}
          </dl>

          {matFit && matFit.status !== 'unknown' && (
            <p className={`rounded-lg border px-3 py-2 text-xs ${matToneClass}`} data-testid="export-mat-fit">
              {matFit.message}
            </p>
          )}

          {extra && <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">{extra}</div>}

          {notes.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-xs">
              {notes.map((note, index) => (
                <li
                  key={`${index}-${note.text}`}
                  className={note.tone === 'warning' ? 'text-amber-200' : 'text-zinc-400'}
                >
                  {note.text}
                </li>
              ))}
            </ul>
          )}

          {calibration && (
            <div
              className={`rounded-lg border px-3 py-2.5 text-xs ${needsCalibration ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}
              data-testid="export-calibration-state"
            >
              {needsCalibration ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Material not calibrated
                  </p>
                  <p className="mt-1 text-amber-200/90">
                    Hole sizes are recommended defaults and are not verified. Calibrate first for a production-ready file.
                  </p>
                  <button
                    type="button"
                    onClick={calibration.onCalibrate}
                    className="mt-2 rounded-md border border-amber-400/40 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    Calibrate material
                  </button>
                  <label className="mt-3 flex items-start gap-2 text-amber-100">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I understand this file uses unverified default hole sizes. It will be marked
                      “uncalibrated” and saved as <code>-uncalibrated.svg</code>.
                    </span>
                  </label>
                </>
              ) : (
                <p>Material calibrated (self-attested approval).</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          File name
          <input
            type="text"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-describedby="export-dialog-filename-hint"
          />
          <span id="export-dialog-filename-hint" className="text-xs normal-case tracking-normal text-zinc-400">
            Saved as {downloadFilename}
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={() => onDownload(downloadFilename, { uncalibratedOverride: needsCalibration })}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {needsCalibration ? 'Download uncalibrated SVG' : 'Download SVG'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared export dialog for both studios: previews the exact SVG, shows its
 * physical size and mat fit, the calibration state and a file-name field, and
 * only then downloads. Replaces the silent immediate download.
 */
export default function ExportDialog(props: ExportDialogProps) {
  const { open, onClose, ...content } = props;
  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={TITLE_ID}
      overlayClassName="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <ExportDialogContent {...content} onClose={onClose} />
    </Modal>
  );
}
