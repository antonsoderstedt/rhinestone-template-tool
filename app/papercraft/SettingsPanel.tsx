'use client';

import Link from 'next/link';
import { Download, FileText, FolderHeart, History, Link2, RotateCcw, Save, Scissors } from 'lucide-react';
import type { PapercraftResult } from '@/src/lib/papercraft-engine';
import { useT } from '../lib/i18n';
import { CheckField, LengthField, NumberField, Section, SelectField } from './fields';
import { formatRelativeTime } from '../lib/relativeTime';
import { formatLength, formatSize, useUnit } from '../lib/units';
import type { PapercraftVersion } from './papercraftVersions';
import { describeLayoutWarning, describeMeshWarning, describePatternWarning, describeSizeWarnings, type WarningLine } from './papercraftWarnings';
import type { PapercraftAction, PapercraftState, PaperPreset } from './papercraftState';

export interface SaveInfo {
  /** The saved design this one is, if it has been saved. */
  activeId: string | null;
  /** There are changes that are not saved. */
  dirty: boolean;
  /** When the saved copy was made. */
  savedAt: string | null;
  versions: PapercraftVersion[];
  canSave: boolean;
}

interface SettingsPanelProps {
  state: PapercraftState;
  dispatch: React.Dispatch<PapercraftAction>;
  run: PapercraftResult | null;
  save: SaveInfo;
  onSave: () => void;
  onShare: () => void;
  onRestoreVersion: (version: PapercraftVersion) => void;
  onExportPdf: () => void;
  onExportCricut: () => void;
  onExportSilhouette: () => void;
}

export default function SettingsPanel({ state, dispatch, run, save, onSave, onShare, onRestoreVersion, onExportPdf, onExportCricut, onExportSilhouette }: SettingsPanelProps) {
  const t = useT();
  const unit = useUnit();
  const presetOptions: { value: PaperPreset; label: string }[] = [
    { value: 'a3', label: t('A3 sheet') },
    { value: 'a4', label: t('A4 sheet') },
    { value: 'a5', label: t('A5 sheet') },
    { value: 'letter', label: t('US Letter sheet') },
    { value: 'tabloid', label: t('US Tabloid sheet (11 × 17 in)') },
    { value: 'cricut12x12', label: t('Cricut mat 12 × 12 in') },
    { value: 'cricut12x24', label: t('Cricut mat 12 × 24 in') },
    { value: 'custom', label: t('Your own size') },
  ];
  const lines: WarningLine[] = run
    ? [
        ...run.solid.warnings.map((w) => describeMeshWarning(t, w)),
        ...run.pattern.warnings.map((w) => describePatternWarning(t, w)).filter((l): l is WarningLine => l !== null),
        ...run.layout.warnings.map((w) => describeLayoutWarning(t, w)),
        ...describeSizeWarnings(t, run.solid, (mm) => formatLength(mm, unit)),
      ]
    : [];
  const edited = state.edits.forceCut.length + state.edits.forceJoin.length;
  const stats = run?.pattern.stats;

  return (
    <aside aria-label={t('Settings')} className="htv-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-l border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
      <Section title={t('Save')}>
        <p className="text-xs text-[var(--studio-ink-secondary)]" role="status">
          {!save.activeId
            ? t('Not saved yet.')
            : save.dirty
              ? t('Changes since the last save.')
              : t('Saved to My Designs. Last save: {time}.', { time: save.savedAt ? formatRelativeTime(save.savedAt, new Date()) : '' })}
        </p>
        <button
          type="button"
          onClick={onSave}
          title={t('Save this model in My Designs in this browser.')}
          disabled={!save.canSave}
          className="flex w-full items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {t('Save to My Designs')}
        </button>
        {!save.canSave && <p className="text-xs text-[var(--studio-ink-subtle)]">{t('This model is too big to save in the browser. Keep the model file.')}</p>}
        <button
          type="button"
          onClick={onShare}
          title={t('Copy a link that opens this model, with its size and settings, on another device.')}
          className="flex w-full items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-sm font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {t('Copy a link to this model')}
        </button>
        <Link href="/designs" className="flex items-center gap-2 text-xs font-medium text-violet-300 underline-offset-2 hover:underline">
          <FolderHeart className="h-3.5 w-3.5" aria-hidden="true" />
          {t('All my designs')}
        </Link>
        {save.versions.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-ink-subtle)]">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Earlier versions')}
            </h3>
            <ul className="space-y-1.5">
              {save.versions.map((v) => (
                <li key={v.savedAt} className="flex items-center justify-between gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-1.5 text-xs text-[var(--studio-ink-secondary)]">
                  <span className="min-w-0 truncate">{formatRelativeTime(v.savedAt, new Date())}</span>
                  <button type="button" onClick={() => onRestoreVersion(v)} className="shrink-0 rounded px-2 py-1 font-medium text-violet-300 hover:bg-[var(--studio-hover-overlay)]">
                    {t('Open this version')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={t('Result')}>
        {stats && run ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm text-[var(--studio-ink-secondary)]">
            <dt>{t('Parts')}</dt>
            <dd className="font-medium text-[var(--studio-ink)]">{stats.partCount}</dd>
            <dt>{t('Faces')}</dt>
            <dd className="font-medium text-[var(--studio-ink)]">{stats.faceCount}</dd>
            <dt>{t('Edges to glue')}</dt>
            <dd className="font-medium text-[var(--studio-ink)]">{run.pattern.edgePairCount}</dd>
            <dt>{t('Pages')}</dt>
            <dd className="font-medium text-[var(--studio-ink)]">{run.layout.pages.length}</dd>
          </dl>
        ) : (
          <p className="text-sm text-[var(--studio-ink-muted)]">{t('Choose a model to see its pattern.')}</p>
        )}
        {edited > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_EDITS' })}
          title={t('Put back the folds and cuts the program chose.')}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Undo my {count} edge changes', { count: edited })}
          </button>
        )}
      </Section>

      {lines.length > 0 && (
        <Section title={t('Checks')}>
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li
                key={i}
                className={`rounded-md border px-3 py-2 text-xs text-[var(--studio-ink)] ${line.tone === 'warning' ? 'border-amber-400/40 bg-amber-500/10' : 'border-[var(--studio-border)] bg-[var(--studio-well)]'}`}
              >
                {line.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('Paper')}>
        <SelectField
          label={t('Page')}
          tip={t('The sheet of paper or the cutting mat the parts are placed on. The number of pages follows from it.')}
          value={state.paper.preset}
          options={presetOptions}
          onChange={(preset) => dispatch({ type: 'SET_PAPER', paper: { preset } })}
        />
        {state.paper.preset === 'custom' && (
          <>
            <LengthField label={t('Sheet width')} tip={t('The width of your own sheet or mat.')} valueMm={state.paper.customWidthMm} minMm={50} maxMm={2000} onChange={(customWidthMm) => dispatch({ type: 'SET_PAPER', paper: { customWidthMm } })} />
            <LengthField label={t('Sheet height')} tip={t('The height of your own sheet or mat.')} valueMm={state.paper.customHeightMm} minMm={50} maxMm={2000} onChange={(customHeightMm) => dispatch({ type: 'SET_PAPER', paper: { customHeightMm } })} />
          </>
        )}
        {run && <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Sheet: {size}', { size: formatSize(run.pageSettings.pageWidthMm, run.pageSettings.pageHeightMm, unit) })}</p>}
        <LengthField label={t('Margin')} tip={t('The empty edge of every page. Printers cannot print to the very edge, and a cutting mat has an edge that cannot be cut.')} valueMm={state.paper.marginMm} minMm={0} maxMm={50} onChange={(marginMm) => dispatch({ type: 'SET_PAPER', paper: { marginMm } })} />
        <LengthField label={t('Space between parts')} tip={t('The gap left between two parts on a page. A small gap fits more on a page; leave room for the blade.')} valueMm={state.paper.gapMm} minMm={0} maxMm={30} onChange={(gapMm) => dispatch({ type: 'SET_PAPER', paper: { gapMm } })} />
      </Section>

      <Section title={t('View')}>
        <CheckField
          label={t('Colour the parts')}
          tip={t('Gives every part its own colour on the screen so you can tell the parts apart. It does not change the pattern: nothing is printed or cut in colour.')}
          checked={state.colourParts}
          onChange={(on) => dispatch({ type: 'SET_COLOURS', on })}
        />
      </Section>

      <Section title={t('Folds and glue tabs')}>
        <LengthField label={t('Glue tab width')} tip={t('How deep the flaps are that you spread glue on. Wider is easier to glue but needs more room on the page.')} valueMm={state.pattern.tabWidthMm} minMm={3} maxMm={30} onChange={(tabWidthMm) => dispatch({ type: 'SET_PATTERN', pattern: { tabWidthMm } })} />
        <NumberField label={t('Tab side angle')} tip={t('How slanted the sides of a glue flap are. 90 degrees is a rectangle; 45 degrees is easier to fit into a corner.')} suffix="°" value={state.pattern.tabAngleDeg} min={10} max={90} onChange={(tabAngleDeg) => dispatch({ type: 'SET_PATTERN', pattern: { tabAngleDeg } })} />
        <SelectField
          label={t('Which side is printed')}
          tip={t('Decides which folds are mountain and which are valley. Choose where the printed side ends up when the model is built.')}
          value={state.pattern.printedSide}
          options={[
            { value: 'outside', label: t('The print ends up outside') },
            { value: 'inside', label: t('The print ends up inside') },
          ]}
          onChange={(printedSide) => dispatch({ type: 'SET_PATTERN', pattern: { printedSide } })}
        />
        <LengthField label={t('Number height')} tip={t('The height of the numbers that show which edges are glued together.')} valueMm={state.pattern.numberHeightMm} minMm={1.5} maxMm={15} onChange={(numberHeightMm) => dispatch({ type: 'SET_PATTERN', pattern: { numberHeightMm } })} />
        <CheckField label={t('Number the parts')} tip={t('Writes a number on every part so you can find them in the right order.')} checked={state.pattern.partLabels} onChange={(partLabels) => dispatch({ type: 'SET_PATTERN', pattern: { partLabels } })} />
      </Section>

      <Section title={t('Print or cut')}>
        <button
          type="button"
          onClick={onExportPdf}
          title={t('Download a PDF to print at 100 % scale. Turn off any \'fit to page\' in the print dialog.')}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {t('Download PDF to print')}
        </button>
        <button
          type="button"
          onClick={onExportCricut}
          title={t('Download SVG files for Cricut Design Space: black is cut, red is score, blue is the numbers.')}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          {t('Download SVG for Cricut')}
        </button>
        <button
          type="button"
          onClick={onExportSilhouette}
          title={t('Download DXF files for Silhouette Studio: black is cut, red is score, blue is the numbers.')}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          {t('Download DXF for Silhouette')}
        </button>
        <CheckField label={t('Cover page in the PDF (picture, facts, steps)')} tip={t('Adds a first page to the PDF with a picture of the model, how hard it is and the steps. It is not in the cutting files.')} checked={state.cover} onChange={(cover) => dispatch({ type: 'SET_COVER', cover })} />
        <p className="flex gap-2 text-xs leading-5 text-[var(--studio-ink-subtle)]">
          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t('In Cricut Design Space each colour is its own layer: set black to Cut, red to Score and blue (the numbers) to Draw, or delete it. Try the Test cube on your paper first.')}</span>
        </p>
        <p className="flex gap-2 text-xs leading-5 text-[var(--studio-ink-subtle)]">
          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t('In Silhouette Studio open the DXF and give each colour its own setting: black is Cut, red is Score, blue (the numbers) can be deleted. The unit is millimetres.')}</span>
        </p>
      </Section>
    </aside>
  );
}
