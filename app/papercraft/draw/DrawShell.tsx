'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeft, FileUp, Hash, Hexagon, MousePointer2, Pentagon, Plus, RectangleHorizontal, Redo2, Slash, Tag, Undo2 } from 'lucide-react';
import {
  PAGE_PRESETS,
  addPage,
  boundsOf,
  DRAW_LIMITS,
  drawProblems,
  drawingsOf,
  duplicateItems,
  flattenItem,
  exportPageDxf,
  exportPageSvg,
  exportPdf,
  flipFolds,
  mirrorItems,
  moveToPage,
  newDoc,
  parseDoc,
  removeItems,
  removePage,
  rotateItems,
  scaleItems,
  serializeDoc,
  setBezier,
  setSmooth,
  setText,
  signedArea,
  type DrawDoc,
  type DrawProblem,
} from '@/src/lib/papercraft-engine';
import StudioThemeToggle from '../../components/StudioThemeToggle';
import { useT } from '../../lib/i18n';
import { useStudioTheme } from '../../lib/studioTheme';
import { CheckField, LengthField, NumberField, Section, SelectField } from '../fields';
import { createZip } from '../../lib/zip';
import { downloadExportFile, exportBaseName } from '../papercraftExport';
import DrawCanvas from './DrawCanvas';
import DrawCatalogPanel from './DrawCatalogPanel';
import { readDrawDraft, writeDrawDraft } from './drawDraft';
import { drawReducer, initialDrawState } from './drawState';
import { DEFAULT_TOOL_OPTIONS, type DrawTool, type ToolOptions } from './drawTools';

type PresetKey = keyof typeof PAGE_PRESETS | 'custom';

const buttonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-surface-hover)] disabled:opacity-40';

/** The preset a sheet size matches (either way up), or `custom`. */
function presetOf(doc: DrawDoc): PresetKey {
  for (const [key, p] of Object.entries(PAGE_PRESETS)) {
    const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
    if ((near(doc.sheet.widthMm, p.pageWidthMm) && near(doc.sheet.heightMm, p.pageHeightMm)) || (near(doc.sheet.widthMm, p.pageHeightMm) && near(doc.sheet.heightMm, p.pageWidthMm))) return key as PresetKey;
  }
  return 'custom';
}

/** Draw a pattern flat: cut outlines, fold lines, glue tabs and numbers on a sheet, then download it for the cutting machine or the printer. */
export default function DrawShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  const [state, dispatch] = useReducer(drawReducer, undefined, () => initialDrawState());
  const [tool, setTool] = useState<DrawTool>('polygon');
  const [options, setOptions] = useState<ToolOptions>(DEFAULT_TOOL_OPTIONS);
  const [crop, setCrop] = useState(true);
  const [rotateBy, setRotateBy] = useState(15);
  const [scalePct, setScalePct] = useState(110);
  const [message, setMessage] = useState<string | null>(null);
  const [pageAt, setPageAt] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { doc } = state;
  /** The page being worked on: always one the drawing has (a page that was taken away leaves the view on the last). */
  const page = Math.min(pageAt, doc.pageCount - 1);
  const onPage = (id: number) => doc.items.some((i) => i.id === id && i.page === page);
  // Only what is on this page can be selected.
  const selection = state.selection.filter(onPage);

  // The drawing of the last visit comes back (read after load: the first render is the same on the server and in the browser).
  useEffect(() => {
    const draft = readDrawDraft();
    if (draft && draft.items.length > 0) dispatch({ type: 'REPLACE', doc: draft });
  }, []);
  useEffect(() => {
    if (state.pending) return undefined;
    const id = window.setTimeout(() => writeDrawDraft(doc), 600);
    return () => window.clearTimeout(id);
  }, [doc, state.pending]);

  const problems = useMemo(() => drawProblems(doc), [doc]);
  const selectedItems = doc.items.filter((i) => i.page === page && selection.includes(i.id));
  const only = selectedItems.length === 1 ? selectedItems[0]! : null;
  const set = (patch: Partial<ToolOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const edit = (next: DrawDoc, ids?: number[]) => dispatch({ type: 'EDIT', doc: next, selection: ids });

  const presetOptions: { value: PresetKey; label: string }[] = [
    { value: 'a3', label: t('A3 sheet') },
    { value: 'a4', label: t('A4 sheet') },
    { value: 'a5', label: t('A5 sheet') },
    { value: 'letter', label: t('US Letter sheet') },
    { value: 'tabloid', label: t('US Tabloid sheet (11 × 17 in)') },
    { value: 'cricut12x12', label: t('Cricut mat 12 × 12 in') },
    { value: 'cricut12x24', label: t('Cricut mat 12 × 24 in') },
    { value: 'custom', label: t('Your own size') },
  ];

  const tools: { id: DrawTool; label: string; tip: string; icon: React.ReactNode }[] = [
    { id: 'select', label: t('Select'), tip: t('Click a shape or a line to select it. Drag it to move it, or drag a corner to change it. Drag on the empty sheet to move the view.'), icon: <MousePointer2 className="h-4 w-4" aria-hidden="true" /> },
    { id: 'polygon', label: t('Outline'), tip: t('Click the corners of a part. Click the first corner again, press Enter or double-click to close it. Backspace takes the last corner back.'), icon: <Pentagon className="h-4 w-4" aria-hidden="true" /> },
    { id: 'rect', label: t('Rectangle'), tip: t('Drag from one corner to the opposite corner.'), icon: <RectangleHorizontal className="h-4 w-4" aria-hidden="true" /> },
    { id: 'ngon', label: t('Polygon'), tip: t('Drag from the middle out to the first corner. Many sides make a circle.'), icon: <Hexagon className="h-4 w-4" aria-hidden="true" /> },
    { id: 'fold', label: t('Fold line'), tip: t('Drag a fold line. It is drawn in the kind chosen below: mountain (red) or valley (blue).'), icon: <Slash className="h-4 w-4" aria-hidden="true" /> },
    { id: 'addpoint', label: t('Add a point'), tip: t('Click a line to put a new point on it. A Bézier curve keeps its shape; a smooth curve becomes the Bézier curve it would be.'), icon: <Plus className="h-4 w-4" aria-hidden="true" /> },
    { id: 'tab', label: t('Glue tab'), tip: t('Click an edge of a closed outline to put a glue tab on it, with a fold line along the edge.'), icon: <Tag className="h-4 w-4" aria-hidden="true" /> },
    { id: 'number', label: t('Number'), tip: t('Click to put a number on a part. It counts up by one each time. It is drawn as lines, so it can be cut or drawn with a pen.'), icon: <Hash className="h-4 w-4" aria-hidden="true" /> },
  ];

  const problemText = (p: DrawProblem): string => {
    switch (p.code) {
      case 'nothing-to-cut': return t('There is nothing to cut yet: draw an outline.');
      case 'outside-sheet': return t('Part of the drawing is outside the sheet.');
      case 'self-intersecting': return t('An outline crosses itself.');
      case 'open-outline': return t('An outline is not closed.');
      case 'tiny': return t('Something is smaller than half a millimetre.');
      case 'empty-page': return t('A page has nothing on it.');
    }
  };
  const problemCounts = useMemo(() => {
    const map = new Map<string, { problem: DrawProblem; count: number }>();
    for (const p of problems) map.set(p.code, { problem: p, count: (map.get(p.code)?.count ?? 0) + 1 });
    return [...map.values()];
  }, [problems]);

  const base = exportBaseName(doc.name || 'pattern');
  const download = (kind: 'svg' | 'dxf' | 'pdf') => {
    if (!doc.items.some((i) => i.kind === 'cut')) {
      setMessage(t('There is nothing to cut yet: draw an outline.'));
      return;
    }
    setMessage(null);
    if (kind === 'pdf') {
      // One PDF with every page, each at the size of the sheet.
      downloadExportFile({ fileName: `${base}.pdf`, mime: 'application/pdf', data: exportPdf(drawingsOf(doc)) });
      return;
    }
    // The cutting machine takes one page at a time: one file for one page, a zip for several (empty pages are left out).
    const drawings = drawingsOf(doc, { crop }).map((drawing, i) => ({ drawing, i })).filter(({ drawing }) => drawing.cut.length > 0 || drawing.folds.length > 0 || drawing.text.length > 0);
    const files = drawings.map(({ drawing, i }) => {
      const suffix = doc.pageCount === 1 ? '' : `-page-${i + 1}`;
      return kind === 'svg'
        ? { name: `${base}-cricut${suffix}.svg`, data: exportPageSvg(drawing, 'cricut') }
        : { name: `${base}-silhouette${suffix}.dxf`, data: exportPageDxf(drawing) };
    });
    if (files.length === 1) downloadExportFile({ fileName: files[0]!.name, mime: kind === 'svg' ? 'image/svg+xml' : 'application/dxf', data: files[0]!.data });
    else downloadExportFile({ fileName: `${base}-${kind === 'svg' ? 'cricut' : 'silhouette'}.zip`, mime: 'application/zip', data: createZip(files) });
  };

  const openFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('big');
      const opened = parseDoc(JSON.parse(await file.text()));
      if (!opened) throw new Error('not ours');
      dispatch({ type: 'REPLACE', doc: opened });
      setMessage(null);
    } catch {
      setMessage(t('That file is not a drawing from this tool.'));
    }
  };

  const size = boundsOf(selectedItems);
  const area = only && only.kind === 'cut' && only.closed ? Math.abs(signedArea(flattenItem(only))) : null;
  const preset = presetOf(doc);

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-ink)]">
      <section aria-label={t('Project actions')} className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)]">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
          <Link href="/papercraft" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:text-[var(--studio-ink)]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('Papercraft Studio')}
          </Link>
          <h1 className="text-sm font-semibold">{t('Draw a pattern flat')}</h1>
          <input
            aria-label={t('Name of the drawing')}
            value={doc.name}
            maxLength={120}
            onChange={(e) => edit({ ...doc, name: e.target.value })}
            className="h-8 w-48 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm"
          />
          <button type="button" className={buttonClass} disabled={state.past.length === 0 && !state.pending} onClick={() => dispatch({ type: 'UNDO' })} title={t('Undo (Ctrl+Z)')}><Undo2 className="h-4 w-4" aria-hidden="true" />{t('Undo')}</button>
          <button type="button" className={buttonClass} disabled={state.future.length === 0} onClick={() => dispatch({ type: 'REDO' })} title={t('Redo (Ctrl+Shift+Z)')}><Redo2 className="h-4 w-4" aria-hidden="true" />{t('Redo')}</button>
          <div className="ml-auto">
            <StudioThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="htv-studio-panel flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 lg:h-full lg:w-[300px] lg:border-b-0 lg:border-r">
          <Section title={t('Tools')}>
            <div className="grid grid-cols-2 gap-1.5">
              {tools.map((tl) => (
                <button key={tl.id} type="button" aria-pressed={tool === tl.id} title={tl.tip} onClick={() => setTool(tl.id)} className={`${buttonClass} justify-start ${tool === tl.id ? '!border-violet-500 !bg-violet-500/20 !text-[var(--studio-ink)]' : ''}`}>
                  {tl.icon}
                  {tl.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--studio-ink-subtle)]">{tools.find((x) => x.id === tool)?.tip}</p>
            {tool === 'ngon' && <NumberField label={t('Sides')} tip={t('How many sides the polygon has. 48 is a circle for most uses.')} value={options.sides} min={3} max={200} onChange={(sides) => set({ sides })} />}
            {tool === 'polygon' && (
              <>
                <SelectField<'cut' | 'mountain' | 'valley'>
                  label={t('Draws a')}
                  tip={t('The outline tool can draw a cut, or a mountain or valley fold line.')}
                  value={options.outlineKind}
                  options={[{ value: 'cut', label: t('Cut outline') }, { value: 'valley', label: t('Valley fold line (blue)') }, { value: 'mountain', label: t('Mountain fold line (red)') }]}
                  onChange={(outlineKind) => set({ outlineKind })}
                />
                <CheckField label={t('Smooth curve')} tip={t('The line runs in a smooth curve through the points you click, instead of straight between them. Needs three points.')} checked={options.smooth} onChange={(smooth) => set({ smooth })} />
                {options.outlineKind === 'cut' && <CheckField label={t('Leave it open')} tip={t('Do not close the outline: it stays a line, for a curved cut. Press Enter or double-click to finish.')} checked={options.leaveOpen} onChange={(leaveOpen) => set({ leaveOpen })} />}
              </>
            )}
            {tool === 'fold' && (
              <SelectField<'mountain' | 'valley'>
                label={t('Kind of fold')}
                tip={t('A mountain fold points up towards you, a valley fold away from you. They are drawn red and blue.')}
                value={options.foldKind}
                options={[{ value: 'valley', label: t('Valley (blue)') }, { value: 'mountain', label: t('Mountain (red)') }]}
                onChange={(foldKind) => set({ foldKind })}
              />
            )}
            {tool === 'tab' && (
              <>
                <LengthField label={t('Tab width')} tip={t('How far the tab reaches out from the edge.')} valueMm={options.tab.widthMm} minMm={1} maxMm={100} onChange={(widthMm) => set({ tab: { ...options.tab, widthMm } })} />
                <NumberField label={t('Tab angle')} tip={t('The angle of the sides of the tab. 45 is usual; a smaller angle makes a more pointed tab.')} suffix="°" value={options.tab.angleDeg} min={20} max={90} step={5} onChange={(angleDeg) => set({ tab: { ...options.tab, angleDeg } })} />
              </>
            )}
            {tool === 'number' && (
              <>
                <div>
                  <label htmlFor="draw-number" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Number')}</label>
                  <input id="draw-number" value={options.numberText} maxLength={12} onChange={(e) => set({ numberText: e.target.value })} className="h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm" />
                </div>
                <LengthField label={t('Number height')} valueMm={options.numberHeightMm} minMm={1} maxMm={50} onChange={(numberHeightMm) => set({ numberHeightMm })} />
              </>
            )}
            <SelectField<string>
              label={t('Snap to a grid')}
              tip={t('Corners jump to a grid so lines meet exactly. They always snap to the corners of other shapes. 0 is off.')}
              value={String(options.gridMm)}
              options={[{ value: '0', label: t('Off') }, { value: '1', label: '1 mm' }, { value: '2', label: '2 mm' }, { value: '5', label: '5 mm' }, { value: '10', label: '10 mm' }]}
              onChange={(gridMm) => set({ gridMm: Number(gridMm) })}
            />
          </Section>

          {selectedItems.length > 0 && (
            <Section title={t('Selected')}>
              <p className="text-xs text-[var(--studio-ink-secondary)]">
                {selectedItems.length === 1 ? t('One item') : t('{count} items', { count: selectedItems.length })}
                {size && ` · ${(size.maxX - size.minX).toFixed(1)} × ${(size.maxY - size.minY).toFixed(1)} mm`}
                {area !== null && ` · ${(area / 100).toFixed(1)} cm²`}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className={buttonClass} onClick={() => edit(rotateItems(doc, selection, 90))}>{t('Turn 90° left')}</button>
                <button type="button" className={buttonClass} onClick={() => edit(rotateItems(doc, selection, -90))}>{t('Turn 90° right')}</button>
                <button type="button" className={buttonClass} onClick={() => edit(mirrorItems(doc, selection, 'horizontal'))}>{t('Mirror left–right')}</button>
                <button type="button" className={buttonClass} onClick={() => edit(mirrorItems(doc, selection, 'vertical'))}>{t('Mirror up–down')}</button>
                <button type="button" className={buttonClass} onClick={() => { const copy = duplicateItems(doc, selection, 10, -10); edit(copy.doc, copy.ids); }}>{t('Copy')}</button>
                <button type="button" className={`${buttonClass} text-red-300`} onClick={() => edit(removeItems(doc, selection), [])}>{t('Delete')}</button>
              </div>
              <div className="flex items-end gap-1.5">
                <div className="flex-1"><NumberField label={t('Turn by')} suffix="°" value={rotateBy} min={-360} max={360} step={5} onChange={setRotateBy} /></div>
                <button type="button" className={buttonClass} onClick={() => edit(rotateItems(doc, selection, rotateBy))}>{t('Turn')}</button>
              </div>
              <div className="flex items-end gap-1.5">
                <div className="flex-1"><NumberField label={t('Scale')} suffix="%" value={scalePct} min={10} max={1000} step={5} onChange={setScalePct} /></div>
                <button type="button" className={buttonClass} onClick={() => edit(scaleItems(doc, selection, scalePct / 100))}>{t('Scale')}</button>
              </div>
              {selectedItems.some((i) => i.kind === 'mountain' || i.kind === 'valley') && (
                <button type="button" className={buttonClass} onClick={() => edit(flipFolds(doc, selection))}>{t('Swap mountain and valley')}</button>
              )}
              {selectedItems.some((i) => i.kind !== 'text' && i.points.length >= 3) && (
                <button type="button" className={buttonClass} onClick={() => edit(setSmooth(doc, selection, !selectedItems.filter((i) => i.kind !== 'text' && i.points.length >= 3).every((i) => i.smooth)))}>
                  {selectedItems.filter((i) => i.kind !== 'text' && i.points.length >= 3).every((i) => i.smooth) ? t('Make it straight') : t('Make it a smooth curve')}
                </button>
              )}
              {selectedItems.some((i) => i.kind !== 'text' && i.points.length >= 2) && (
                <button type="button" className={buttonClass} title={t('Each point gets handles you can drag to bend the line, as in a drawing program.')} onClick={() => edit(setBezier(doc, selection, !selectedItems.filter((i) => i.kind !== 'text' && i.points.length >= 2).every((i) => i.handles)))}>
                  {selectedItems.filter((i) => i.kind !== 'text' && i.points.length >= 2).every((i) => i.handles) ? t('Remove the handles') : t('Edit with Bézier handles')}
                </button>
              )}
              {only && only.kind !== 'text' && (
                <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Double-click the line, or use the Add a point tool, to put a point there. Ctrl- or Cmd-click a point to take it away. Shift-click points, or Shift-drag a rectangle, to choose several and press Delete.')}</p>
              )}
              {only?.handles && (
                <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Drag a round handle to bend the curve. Hold Alt to move one handle on its own. Double-click a point to make it a corner or to give it handles.')}</p>
              )}
              {doc.pageCount > 1 && (
                <SelectField<string>
                  label={t('Move to page')}
                  value=""
                  options={[{ value: '', label: t('Choose a page') }, ...Array.from({ length: doc.pageCount }, (_, i) => ({ value: String(i), label: t('Page {n}', { n: i + 1 }) })).filter((_, i) => i !== page)]}
                  onChange={(target) => { if (target !== '') { edit(moveToPage(doc, selection, Number(target)), []); } }}
                />
              )}
              {only?.kind === 'text' && (
                <>
                  <div>
                    <label htmlFor="draw-text" className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{t('Number')}</label>
                    <input id="draw-text" value={only.text ?? ''} maxLength={12} onChange={(e) => edit(setText(doc, only.id, { text: e.target.value }))} className="h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm" />
                  </div>
                  <LengthField label={t('Number height')} valueMm={only.heightMm ?? 4} minMm={1} maxMm={50} onChange={(heightMm) => edit(setText(doc, only.id, { heightMm }))} />
                </>
              )}
              <p className="text-xs text-[var(--studio-ink-subtle)]">{t('The arrow keys move the selection by 1 mm (10 mm with Shift). Delete removes it.')}</p>
            </Section>
          )}

          <Section title={t('Sheet')} defaultOpen={false}>
            <SelectField<PresetKey>
              label={t('Page')}
              tip={t('The sheet of paper or the cutting mat you draw on.')}
              value={preset}
              options={presetOptions}
              onChange={(key) => {
                if (key === 'custom') return;
                const p = PAGE_PRESETS[key];
                const landscape = doc.sheet.widthMm > doc.sheet.heightMm;
                edit({ ...doc, sheet: landscape ? { widthMm: p.pageHeightMm, heightMm: p.pageWidthMm } : { widthMm: p.pageWidthMm, heightMm: p.pageHeightMm } });
              }}
            />
            <LengthField label={t('Sheet width')} valueMm={doc.sheet.widthMm} minMm={20} maxMm={2000} onChange={(widthMm) => edit({ ...doc, sheet: { ...doc.sheet, widthMm } })} />
            <LengthField label={t('Sheet height')} valueMm={doc.sheet.heightMm} minMm={20} maxMm={2000} onChange={(heightMm) => edit({ ...doc, sheet: { ...doc.sheet, heightMm } })} />
            <button type="button" className={buttonClass} onClick={() => edit({ ...doc, sheet: { widthMm: doc.sheet.heightMm, heightMm: doc.sheet.widthMm } })}>{t('Turn the sheet')}</button>
          </Section>

          <Section title={t('Checks')}>
            {problemCounts.length === 0 ? (
              <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Nothing to point out.')}</p>
            ) : (
              <ul className="space-y-2">
                {problemCounts.map(({ problem, count }) => (
                  <li key={problem.code} className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs">
                    {problemText(problem)}
                    {count > 1 && ` (${count})`}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <DrawCatalogPanel doc={doc} onOpen={(opened) => { dispatch({ type: 'REPLACE', doc: opened }); setMessage(null); }} />

          <Section title={t('Save and download')}>
            <CheckField label={t('Make the file only as big as the drawing')} tip={t('For the cutting machine: the sheet is cut down to the drawing plus a small margin, so the machine does not think the whole mat is used.')} checked={crop} onChange={setCrop} />
            <div className="grid grid-cols-1 gap-1.5">
              <button type="button" className={buttonClass} onClick={() => download('svg')}>{t('Cricut SVG')}</button>
              <button type="button" className={buttonClass} onClick={() => download('dxf')}>{t('Silhouette DXF')}</button>
              <button type="button" className={buttonClass} onClick={() => download('pdf')}>{t('PDF to print')}</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={buttonClass} onClick={() => downloadExportFile({ fileName: `${base}.drawing.json`, mime: 'application/json', data: JSON.stringify(serializeDoc(doc)) })}>{t('Save a file')}</button>
              <button type="button" className={buttonClass} onClick={() => fileRef.current?.click()}><FileUp className="h-3.5 w-3.5" aria-hidden="true" />{t('Open a file')}</button>
            </div>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label={t('Choose a drawing file')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ''; }} />
            <button type="button" className={`${buttonClass} text-red-300`} onClick={() => { if (doc.items.length === 0 || window.confirm(t('Start a new drawing? The one you have now is lost unless you saved a file.'))) dispatch({ type: 'REPLACE', doc: newDoc(doc.sheet.widthMm, doc.sheet.heightMm) }); }}>{t('New drawing')}</button>
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('The drawing is also kept in this browser, so it is here next time.')}</p>
            {message && <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs">{message}</p>}
          </Section>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <nav aria-label={t('Pages')} className="flex flex-wrap items-center gap-1.5 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-1.5">
            {Array.from({ length: doc.pageCount }, (_, i) => (
              <button key={i} type="button" aria-pressed={i === page} onClick={() => { setPageAt(i); dispatch({ type: 'SELECT', ids: [] }); }} className={`${buttonClass} ${i === page ? '!border-violet-500 !bg-violet-500/20 !text-[var(--studio-ink)]' : ''}`}>
                {t('Page {n}', { n: i + 1 })}
              </button>
            ))}
            <button type="button" className={buttonClass} disabled={doc.pageCount >= DRAW_LIMITS.pages} title={t('Add a page: another sheet of the same size.')} onClick={() => { edit(addPage(doc)); setPageAt(doc.pageCount); }}>+ {t('Add a page')}</button>
            {doc.pageCount > 1 && (
              <button type="button" className={`${buttonClass} text-red-300`} title={t('Remove this page and what is on it.')} onClick={() => { if (!doc.items.some((i) => i.page === page) || window.confirm(t('Remove page {n} and everything on it?', { n: page + 1 }))) { edit(removePage(doc, page), []); } }}>{t('Remove this page')}</button>
            )}
          </nav>
          <div className="min-h-0 flex-1">
          <DrawCanvas
            doc={doc}
            page={page}
            selection={selection}
            tool={tool}
            options={options}
            dispatch={dispatch}
            onNumberPlaced={(next) => set({ numberText: next })}
            onTool={setTool}
          />
          </div>
        </main>
      </div>
    </div>
  );
}
