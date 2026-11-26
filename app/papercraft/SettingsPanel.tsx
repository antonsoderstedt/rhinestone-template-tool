'use client';

import Link from 'next/link';
import { Download, FileText, FolderHeart, History, Link2, RotateCcw, Save, Scissors } from 'lucide-react';
import type { PapercraftResult } from '@/src/lib/papercraft-engine';
import { useT } from '../lib/i18n';
import { CheckField, LengthField, NumberField, Section, SelectField } from './fields';
import { formatRelativeTime } from '../lib/relativeTime';
import { formatLength, useUnit } from '../lib/units';
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
    { value: 'a4', label: t('A4 sheet') },
    { value: 'letter', label: t('US Letter sheet') },
    { value: 'cricut12x12', label: t('Cricut mat 12 × 12 in') },
    { value: 'cricut12x24', label: t('Cricut mat 12 × 24 in') },
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
        <SelectField label={t('Page')} value={state.paper.preset} options={presetOptions} onChange={(preset) => dispatch({ type: 'SET_PAPER', paper: { preset } })} />
        <LengthField label={t('Margin')} valueMm={state.paper.marginMm} minMm={0} maxMm={50} onChange={(marginMm) => dispatch({ type: 'SET_PAPER', paper: { marginMm } })} />
        <LengthField label={t('Space between parts')} valueMm={state.paper.gapMm} minMm={0} maxMm={30} onChange={(gapMm) => dispatch({ type: 'SET_PAPER', paper: { gapMm } })} />
      </Section>

      <Section title={t('Folds and glue tabs')}>
        <LengthField label={t('Glue tab width')} valueMm={state.pattern.tabWidthMm} minMm={3} maxMm={30} onChange={(tabWidthMm) => dispatch({ type: 'SET_PATTERN', pattern: { tabWidthMm } })} />
        <NumberField label={t('Tab side angle')} suffix="°" value={state.pattern.tabAngleDeg} min={10} max={90} onChange={(tabAngleDeg) => dispatch({ type: 'SET_PATTERN', pattern: { tabAngleDeg } })} />
        <SelectField
          label={t('Which side is printed')}
          value={state.pattern.printedSide}
          options={[
            { value: 'outside', label: t('The print ends up outside') },
            { value: 'inside', label: t('The print ends up inside') },
          ]}
          onChange={(printedSide) => dispatch({ type: 'SET_PATTERN', pattern: { printedSide } })}
        />
        <LengthField label={t('Number height')} valueMm={state.pattern.numberHeightMm} minMm={1.5} maxMm={15} onChange={(numberHeightMm) => dispatch({ type: 'SET_PATTERN', pattern: { numberHeightMm } })} />
        <CheckField label={t('Number the parts')} checked={state.pattern.partLabels} onChange={(partLabels) => dispatch({ type: 'SET_PATTERN', pattern: { partLabels } })} />
      </Section>

      <Section title={t('Print or cut')}>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {t('Download PDF to print')}
        </button>
        <button
          type="button"
          onClick={onExportCricut}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          {t('Download SVG for Cricut')}
        </button>
        <button
          type="button"
          onClick={onExportSilhouette}
          disabled={!run}
          className="flex w-full items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          {t('Download DXF for Silhouette')}
        </button>
        <CheckField label={t('Cover page in the PDF (picture, facts, steps)')} checked={state.cover} onChange={(cover) => dispatch({ type: 'SET_COVER', cover })} />
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
