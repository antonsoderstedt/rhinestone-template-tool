'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { FileUp, FlipHorizontal2, PackageCheck, Undo2, Wand2 } from 'lucide-react';
import type { Solid, SolidReport } from '@/src/lib/papercraft-engine';
import { formatLength, useUnit } from '../lib/units';
import { useT } from '../lib/i18n';
import { LengthField, NumberField, RangeField, SelectField, Section } from './fields';
import { DEFAULT_SIMPLIFY_FACES, MAX_FACES, MIN_SIMPLIFY_FACES } from './papercraftCompute';
import { MODEL_FILE_ACCEPT } from './papercraftFiles';
import CatalogModels from './CatalogModels';
import ModelThumb from './ModelThumb';
import ShapeSection from './ShapeSection';
import { BUILT_IN_MODELS, MODEL_GROUPS } from './papercraftModels';
import { describeMeshWarning } from './papercraftWarnings';
import { MIN_DETAIL_PCT, type PapercraftAction, type PapercraftState, type SizeBy } from './papercraftState';

interface ModelPanelProps {
  state: PapercraftState;
  dispatch: React.Dispatch<PapercraftAction>;
  report: SolidReport | null;
  /** The cleaned model, for the check of an imported file. */
  solid: Solid | null;
  importError: string | null;
  onImportFile: (file: File) => void;
  onFillHoles: () => void;
  onFlipFaces: () => void;
  /** True while a model is being simplified (a heavy one takes a few seconds). */
  simplifying: boolean;
  onSimplify: (targetFaces: number) => void;
  onRestoreOriginal: () => void;
}

export default function ModelPanel({ state, dispatch, report, solid, importError, onImportFile, onFillHoles, onFlipFaces, simplifying, onSimplify, onRestoreOriginal }: ModelPanelProps) {
  const t = useT();
  const unit = useUnit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetFaces, setTargetFaces] = useState(DEFAULT_SIMPLIFY_FACES);
  const sizeOptions: { value: SizeBy; label: string }[] = [
    { value: 'largest', label: t('Longest side') },
    { value: 'height', label: t('Height') },
    { value: 'width', label: t('Width') },
    { value: 'depth', label: t('Depth') },
  ];
  return (
    <aside aria-label={t('Model')} className="htv-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
      <Section title={t('Size and detail')}>
        <SelectField
          label={t('Set the size by')}
          tip={t('Which measurement you type in. The model keeps its shape: the other measurements follow.')}
          value={state.size.by}
          options={sizeOptions}
          onChange={(by) => dispatch({ type: 'SET_SIZE', size: { by } })}
        />
        <LengthField
          label={t('Size')}
          tip={t('How big the finished model is. A bigger model has bigger parts that are easier to cut and glue, and needs more pages.')}
          valueMm={state.size.mm}
          minMm={5}
          maxMm={3000}
          onChange={(mm) => dispatch({ type: 'SET_SIZE', size: { mm } })}
        />
        {report && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--studio-ink-secondary)]">
            <dt className="text-[var(--studio-ink-subtle)]" title={t('Width, depth and height of the finished model.')}>{t('Built size')}</dt>
            <dd>{report.size.map((v) => formatLength(v, unit)).join(' × ')}</dd>
            <dt className="text-[var(--studio-ink-subtle)]" title={t('The shortest edge of the model. Under 8 mm it is hard to fold and glue.')}>{t('Shortest edge')}</dt>
            <dd>{formatLength(report.minEdgeMm, unit)}</dd>
            {solid && (
              <>
                <dt className="text-[var(--studio-ink-subtle)]" title={t('The number of flat faces the model is made of.')}>{t('Faces')}</dt>
                <dd>{solid.faces.length}</dd>
              </>
            )}
          </dl>
        )}
        {state.source.kind === 'builtin' && (
          <>
            <RangeField
              label={t('Detail')}
              tip={t('How much of the model\'s detail is kept. Less detail gives fewer, bigger parts that are quicker to build, but the shape gets coarser. 100 % is the model as it is made.')}
              value={state.detailPct}
              min={MIN_DETAIL_PCT}
              max={100}
              step={5}
              suffix=" %"
              onChange={(pct) => dispatch({ type: 'SET_DETAIL', pct })}
            />
            <p className="text-xs text-[var(--studio-ink-subtle)]">{t('The built-in models are already as simple as they can be while staying recognisable. Lower the detail to get fewer parts; for more detail, import your own model.')}</p>
          </>
        )}
      </Section>

      <Section title={t('Choose a model')}>
        {MODEL_GROUPS.map((group) => (
          <div key={group.id}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-ink-subtle)]">{t(group.label)}</h3>
            <div className="grid grid-cols-2 gap-2">
              {BUILT_IN_MODELS.filter((m) => m.group === group.id).map((model) => {
                const active = state.source.kind === 'builtin' && state.source.id === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => dispatch({ type: 'USE_BUILT_IN', id: model.id })}
                    title={t(model.description)}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center text-xs font-medium transition ${active ? 'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]'}`}
                  >
                    <ModelThumb model={model} index={BUILT_IN_MODELS.indexOf(model)} />
                    <span className="min-w-0 max-w-full break-words leading-tight">{t(model.name)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept={MODEL_FILE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title={t('Open an OBJ, STL or GLB file with your own 3D model.')}
          className={`flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-left text-sm transition hover:bg-[var(--studio-surface-hover)] ${state.source.kind === 'file' ? 'border-violet-400/70 bg-violet-500/20' : 'border-[var(--studio-border-strong)] bg-[var(--studio-well)]'}`}
        >
          <FileUp className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium text-[var(--studio-ink)]">{t('Import your own model')}</span>
            <span className="block truncate text-xs text-[var(--studio-ink-subtle)]">
              {state.source.kind === 'file' ? state.source.fileName : t('OBJ, STL or GLB. You can also drop a file here.')}
            </span>
          </span>
        </button>
        <Link href="/papercraft/pdf" className="block text-xs font-medium text-violet-300 underline-offset-2 hover:underline">
          {t('Have a finished PDF pattern? Make a cutting file from it')}
        </Link>
        {importError && (
          <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-[var(--studio-ink)]">
            {importError}
          </p>
        )}
      </Section>

      <CatalogModels onImportFile={onImportFile} activeFileName={state.source.kind === 'file' ? state.source.fileName : null} />

      <ShapeSection source={state.source} dispatch={dispatch} />

      {state.source.kind === 'file' && solid && (
        <Section title={t('Check your model')}>
          {(() => {
            const problems = solid.warnings.filter((w) => w.code === 'open-edges' || w.code === 'non-orientable' || w.code === 'multiple-shells' || w.code === 'non-manifold-edges');
            return problems.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
                <PackageCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                {t('No problems found: the model is closed and in one piece.')}
              </p>
            ) : (
              <ul className="space-y-2">
                {problems.map((w) => (
                  <li key={w.code} className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-[var(--studio-ink)]">
                    {describeMeshWarning(t, w).text}
                    {w.code === 'open-edges' && (
                      <button
                        type="button"
                        onClick={onFillHoles}
          title={t('Close the open edges with flat faces so the model is solid.')}
                        className="mt-2 flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1.5 font-medium text-white hover:bg-violet-500"
                      >
                        {t('Close the holes')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            );
          })()}
          <button
            type="button"
            onClick={onFlipFaces}
          title={t('Turn every face over. Use it if the model looks dark inside out or folds go the wrong way.')}
            className="flex w-full items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-2 text-left text-xs font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"
          >
            <FlipHorizontal2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t('Turn the model inside out')}
              <span className="block font-normal text-[var(--studio-ink-subtle)]">{t('Use this if mountain and valley folds come out the wrong way round.')}</span>
            </span>
          </button>
        </Section>
      )}

      {state.source.kind === 'file' && (
        <Section title={t('Detail')}>
          {(() => {
            const source = state.source;
            if (source.kind !== 'file') return null;
            const faceCount = source.mesh.faces.length;
            const originalCount = source.original?.faces.length ?? null;
            const target = Math.min(MAX_FACES, Math.max(MIN_SIMPLIFY_FACES, targetFaces));
            const heavy = faceCount > MAX_FACES;
            const canRestore = originalCount !== null && originalCount <= MAX_FACES;
            const averageEdge = solid && solid.edges.length > 0 ? solid.edges.reduce((sum, e) => sum + e.length, 0) / solid.edges.length : null;
            return (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--studio-ink-secondary)]">
                  <dt className="text-[var(--studio-ink-subtle)]">{t('Faces')}</dt>
                  <dd>
                    {faceCount.toLocaleString()}
                    {originalCount !== null && <span className="text-[var(--studio-ink-subtle)]"> {t('(was {count})', { count: originalCount.toLocaleString() })}</span>}
                  </dd>
                  {averageEdge !== null && (
                    <>
                      <dt className="text-[var(--studio-ink-subtle)]">{t('Average edge')}</dt>
                      <dd>{formatLength(averageEdge, unit)}</dd>
                    </>
                  )}
                </dl>
                <p className="text-xs text-[var(--studio-ink-subtle)]">
                  {heavy
                    ? t('This model has too many faces to unfold. Simplify it: fewer faces make fewer, bigger parts that are easier to cut and glue.')
                    : t('Fewer faces make fewer, bigger parts that are easier to cut and glue. More faces keep more of the shape.')}
                </p>
                <NumberField label={t('Simplify to')} tip={t('The number of faces the model is reduced to. Fewer faces make fewer, bigger parts.')} suffix={t('faces')} value={target} min={MIN_SIMPLIFY_FACES} max={MAX_FACES} step={50} onChange={setTargetFaces} />
                <button
                  type="button"
                  disabled={simplifying}
                  onClick={() => onSimplify(target)}
          title={t('Make a version of the imported model with this number of faces.')}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-60"
                >
                  <Wand2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {simplifying ? t('Simplifying…') : t('Simplify')}
                </button>
                {canRestore && (
                  <button
                    type="button"
                    disabled={simplifying}
                    onClick={onRestoreOriginal}
          title={t('Go back to the imported model as it was before it was simplified.')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-2 text-xs font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)] disabled:opacity-60"
                  >
                    <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('Use the original')}
                  </button>
                )}
              </>
            );
          })()}
        </Section>
      )}

    </aside>
  );
}
