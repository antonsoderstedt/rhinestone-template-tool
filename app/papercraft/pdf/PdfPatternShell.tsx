'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileArchive, FileUp, Image as ImageIcon, Scissors } from 'lucide-react';
import {
  PdfReadError,
  defaultRoles,
  exportPageDxf,
  exportPageSvg,
  lineStyles,
  patternDrawing,
  readPdf,
  MAX_PDF_BYTES,
  type LineRole,
  type LineStyle,
  type PdfDocument,
  type PdfPage,
  type PdfStroke,
} from '@/src/lib/papercraft-engine';
import StudioThemeToggle from '../../components/StudioThemeToggle';
import { useT } from '../../lib/i18n';
import { useStudioTheme } from '../../lib/studioTheme';
import { CheckField, NumberField, Section } from '../fields';
import { createZip } from '../../lib/zip';
import { downloadExportFile, exportBaseName } from '../papercraftExport';
import { decodeJpegInBrowser } from './decodeJpeg';

/** A page of lines worth showing: a page with only a handful of strokes is a cover or a page of text. */
const MIN_LINES = 20;

/** A page that is a picture: it has pictures over much of the page and hardly any lines of its own. Its lines are found by tracing. */
const isPicturePage = (p: PdfPage) => p.pictureShare >= 0.3 && p.strokes.length < MIN_LINES;

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

/** Turn a finished PDF pattern into a cutting file: pick a page, say which lines are cuts and which are folds, download. */
export default function PdfPatternShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [roles, setRoles] = useState<Record<string, LineRole>>({});
  const [scalePct, setScalePct] = useState(100);
  const [crop, setCrop] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** The lines traced from the pictures of a page, by page index. */
  const [traced, setTraced] = useState<Record<number, PdfStroke[]>>({});
  const [zipping, setZipping] = useState<string | null>(null);

  const open = useCallback(
    async (file: File) => {
      setError(null);
      setToast(null);
      if (file.size > MAX_PDF_BYTES) {
        setError(t('That file is too big (over 60 MB).'));
        return;
      }
      setBusy(true);
      try {
        const read = await readPdf(new Uint8Array(await file.arrayBuffer()), { decodeJpeg: decodeJpegInBrowser });
        setTraced({});
        const all = new Map<string, LineStyle>();
        for (const p of read.pages) for (const s of lineStyles(p)) all.set(s.id, s);
        setRoles(defaultRoles([...all.values()]));
        setDoc(read);
        setFileName(file.name);
        const first = read.pages.findIndex((p) => p.strokes.length >= MIN_LINES || isPicturePage(p));
        setPageIndex(Math.max(0, first));
        if (read.pages.every((p) => p.strokes.length === 0 && p.pictureShare < 0.3)) setError(t('This PDF has no lines to cut: it is made of pictures. Use a PDF with vector lines.'));
      } catch (e) {
        setDoc(null);
        setError(
          e instanceof PdfReadError
            ? e.code === 'encrypted'
              ? t('This PDF is protected with a password and cannot be read.')
              : e.code === 'too-big'
                ? t('That file is too big (over 60 MB).')
                : e.code === 'no-pages'
                  ? t('This PDF has no pages.')
                  : t('This file could not be read as a PDF.')
            : t('This file could not be read as a PDF.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const rawPage = doc?.pages[pageIndex] ?? null;
  // A page made of pictures has the lines that were traced from them, in place of the few it has itself.
  const page = useMemo(() => (rawPage && traced[pageIndex] ? { ...rawPage, strokes: traced[pageIndex] } : rawPage), [rawPage, traced, pageIndex]);
  const needsTrace = rawPage !== null && isPicturePage(rawPage) && traced[pageIndex] === undefined;
  // While the lines of the page are not there yet, they are being traced.
  const tracing = needsTrace;

  // A page that is a picture is traced when it is opened.
  useEffect(() => {
    if (!doc || !needsTrace) return;
    let cancelled = false;
    void (async () => {
      await nextFrame();
      const strokes = await doc.tracePage(pageIndex);
      if (cancelled) return;
      setTraced((t) => ({ ...t, [pageIndex]: strokes }));
      setRoles((r) => ({ ...defaultRoles(lineStyles({ ...doc.pages[pageIndex], strokes })), ...r }));
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, needsTrace, pageIndex]);

  /** Everything the person can download: the pages that have lines, each as a file, in one zip. Picture pages are traced first. */
  const downloadAll = async (kind: 'svg' | 'dxf') => {
    if (!doc) return;
    setZipping(t('Making the files…'));
    const files: { name: string; data: string }[] = [];
    try {
      for (let i = 0; i < doc.pages.length; i++) {
        const p = doc.pages[i];
        let strokes = traced[i];
        if (strokes === undefined && isPicturePage(p)) {
          await nextFrame();
          strokes = await doc.tracePage(i);
          setTraced((tr) => ({ ...tr, [i]: strokes! }));
        }
        const withLines = { ...p, strokes: strokes ?? p.strokes };
        if (withLines.strokes.length < MIN_LINES && !strokes) continue;
        const merged = { ...defaultRoles(lineStyles(withLines)), ...roles };
        const drawing = patternDrawing(withLines, merged, { scalePct, crop });
        if (drawing.cut.length + drawing.folds.length === 0) continue;
        const name = `${exportBaseName(fileName.replace(/\.pdf$/i, '') || 'pattern')}-page-${p.number}`;
        files.push(kind === 'svg' ? { name: `${name}-cricut.svg`, data: exportPageSvg(drawing, 'cricut') } : { name: `${name}-silhouette.dxf`, data: exportPageDxf(drawing) });
      }
      if (files.length === 0) {
        setToast(t('No page has lines to make a file from.'));
        return;
      }
      const base = exportBaseName(fileName.replace(/\.pdf$/i, '') || 'pattern');
      downloadExportFile({ fileName: `${base}-${kind === 'svg' ? 'cricut' : 'silhouette'}.zip`, mime: 'application/zip', data: createZip(files) });
      setToast(t('{count} files made.', { count: files.length }));
    } finally {
      setZipping(null);
    }
  };
  const styles = useMemo(() => (page ? lineStyles(page) : []), [page]);
  const drawing = useMemo(() => (page ? patternDrawing(page, roles, { scalePct, crop }) : null), [page, roles, scalePct, crop]);
  const preview = useMemo(() => {
    if (!drawing) return null;
    // Our own SVG, made from numbers: shown at the size of the box it is in.
    return exportPageSvg(drawing, 'cricut').replace(/^<svg ([^>]*?) width="[^"]*" height="[^"]*"/, '<svg $1 width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
  }, [drawing]);
  const counts = useMemo(() => ({ cut: drawing?.cut.length ?? 0, score: drawing?.folds.length ?? 0 }), [drawing]);

  const base = exportBaseName(fileName.replace(/\.pdf$/i, '') || 'pattern') + (page ? `-page-${page.number}` : '');
  const roleOptions: { value: LineRole; label: string }[] = [
    { value: 'cut', label: t('Cut') },
    { value: 'score', label: t('Score (fold)') },
    { value: 'ignore', label: t('Leave out') },
  ];

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-ink)]">
      <section aria-label={t('Project actions')} className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)]">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
          <Link href="/papercraft" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:text-[var(--studio-ink)]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('Papercraft Studio')}
          </Link>
          <h1 className="text-sm font-semibold">{t('PDF pattern to cutting file')}</h1>
          <div className="ml-auto">
            <StudioThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="htv-studio-panel flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 lg:h-full lg:w-[300px] lg:border-b-0 lg:border-r">
          <Section title={t('Your PDF')}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              aria-label={t('Choose a PDF file')}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void open(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--studio-border-strong)] bg-[var(--studio-well)] px-3 py-3 text-left text-sm transition hover:bg-[var(--studio-surface-hover)] disabled:opacity-50"
            >
              <FileUp className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium">{busy ? t('Reading…') : t('Choose a PDF pattern')}</span>
                <span className="block truncate text-xs text-[var(--studio-ink-subtle)]">{fileName || t('A pattern with cut lines and fold lines drawn as lines.')}</span>
              </span>
            </button>
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Use patterns you have the right to use. The file stays on your computer: it is read in the browser and not sent anywhere.')}</p>
            {error && (
              <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs">
                {error}
              </p>
            )}
            {doc && doc.warnings.length > 0 && <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Some parts of the file were skipped.')}</p>}
          </Section>

          {doc && (
            <Section title={t('Page')}>
              <ul className="grid grid-cols-4 gap-1.5">
                {doc.pages.map((p, i) => (
                  <li key={p.number}>
                    <button
                      type="button"
                      onClick={() => setPageIndex(i)}
                      aria-pressed={i === pageIndex}
                      title={isPicturePage(p) ? t('A picture: its lines are traced when you open the page.') : t('{count} lines', { count: p.strokes.length })}
                      className={`w-full rounded-md border px-1.5 py-1.5 text-xs transition ${i === pageIndex ? 'border-violet-500 bg-violet-500/20' : 'border-[var(--studio-border)] bg-[var(--studio-well)] hover:border-violet-400/50'} ${p.strokes.length < MIN_LINES && !isPicturePage(p) ? 'opacity-50' : ''}`}
                    >
                      {p.number}
                      <span className="block text-xs text-[var(--studio-ink-subtle)]">
                        {isPicturePage(p) ? (
                          <ImageIcon className="mx-auto h-3 w-3" aria-label={t('A picture: its lines are traced')} />
                        ) : (
                          p.strokes.length
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--studio-ink-subtle)]">{t('The number under a page is how many lines it has. A picture symbol means the page is a picture: its lines are traced. Pages with few lines are covers or text.')}</p>
            </Section>
          )}
        </aside>

        <main aria-label={t('Preview')} className="relative min-h-[320px] min-w-0 flex-1 overflow-hidden bg-[var(--studio-well)] p-3">
          {tracing && (
            <p role="status" className="absolute left-5 top-5 z-10 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2 text-xs shadow">
              {t('Tracing the lines from the picture…')}
            </p>
          )}
          {preview ? (
            <div className="h-full w-full rounded-md border border-[var(--studio-border)] bg-white" dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--studio-ink-subtle)]">{t('Choose a PDF to see its lines here.')}</div>
          )}
        </main>

        <aside className="htv-studio-panel flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 lg:h-full lg:w-[300px] lg:border-l lg:border-t-0">
          <Section title={t('Lines on this page')}>
            {styles.length === 0 ? (
              <p className="text-xs text-[var(--studio-ink-subtle)]">{t('This page has no lines.')}</p>
            ) : (
              <ul className="space-y-2">
                {styles.map((s) => (
                  <li key={s.id} className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-2">
                    <div className="mb-1.5 flex items-center gap-2 text-xs">
                      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border border-[var(--studio-border-strong)]" style={{ background: s.hex }} />
                      <span className="font-medium">{s.dashed ? t('Dashed') : t('Solid')}</span>
                      <span className="ml-auto text-[var(--studio-ink-subtle)]">{t('{count} lines, {length} mm', { count: s.count, length: Math.round(s.lengthMm) })}</span>
                    </div>
                    <select
                      aria-label={t('What {colour} {kind} lines are', { colour: s.hex, kind: s.dashed ? t('dashed') : t('solid') })}
                      value={roles[s.id] ?? 'ignore'}
                      onChange={(event) => setRoles((r) => ({ ...r, [s.id]: event.target.value as LineRole }))}
                      className="h-8 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 text-xs focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Solid lines are cut, dashed lines are scored (folded). Change any group here; the picture follows.')}</p>
            {rawPage && traced[pageIndex] !== undefined && (
              <p className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs">
                {t('This page is a picture, so its lines were traced from it. Check the result against the original: a very thin or faint line can be missing, and numbers and text are left out.')}
              </p>
            )}
          </Section>

          <Section title={t('Size')}>
            <NumberField label={t('Scale')} suffix="%" value={scalePct} min={10} max={1000} step={5} onChange={setScalePct} />
            <CheckField label={t('Make the sheet as big as the pattern')} checked={crop} onChange={setCrop} />
            {drawing && (
              <p className="text-xs text-[var(--studio-ink-subtle)]">
                {t('{width} × {height} mm, {cuts} cut lines, {scores} score lines', { width: Math.round(drawing.widthMm), height: Math.round(drawing.heightMm), cuts: counts.cut, scores: counts.score })}
              </p>
            )}
          </Section>

          <Section title={t('Download')}>
            <button
              type="button"
              disabled={!drawing || counts.cut + counts.score === 0}
              onClick={() => {
                if (!drawing) return;
                downloadExportFile({ fileName: `${base}-cricut.svg`, mime: 'image/svg+xml', data: exportPageSvg(drawing, 'cricut') });
                setToast(t('Cricut SVG made: {name}', { name: `${base}-cricut.svg` }));
              }}
              className="flex w-full items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Scissors className="h-4 w-4" aria-hidden="true" />
              {t('Download SVG for Cricut')}
            </button>
            <button
              type="button"
              disabled={!drawing || counts.cut + counts.score === 0}
              onClick={() => {
                if (!drawing) return;
                downloadExportFile({ fileName: `${base}-silhouette.dxf`, mime: 'application/dxf', data: exportPageDxf(drawing) });
                setToast(t('Silhouette DXF made: {name}', { name: `${base}-silhouette.dxf` }));
              }}
              className="flex w-full items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Scissors className="h-4 w-4" aria-hidden="true" />
              {t('Download DXF for Silhouette')}
            </button>
            <button
              type="button"
              disabled={!doc || zipping !== null}
              onClick={() => void downloadAll('svg')}
              className="flex w-full items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--studio-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              title={t('Makes one SVG for every page that has lines, and puts them in one zip file.')}
            >
              <FileArchive className="h-4 w-4" aria-hidden="true" />
              {zipping ?? t('All pages as SVG (zip)')}
            </button>
            <button
              type="button"
              disabled={!doc || zipping !== null}
              onClick={() => void downloadAll('dxf')}
              className="flex w-full items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--studio-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              title={t('Makes one DXF for every page that has lines, and puts them in one zip file.')}
            >
              <FileArchive className="h-4 w-4" aria-hidden="true" />
              {t('All pages as DXF (zip)')}
            </button>
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Check the size against a ruler before you cut: a PDF can be scaled when it was made.')}</p>
            {toast && (
              <p role="status" className="text-xs text-[var(--studio-ink-secondary)]">
                {toast}
              </p>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
