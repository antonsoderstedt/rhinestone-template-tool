'use client';

import { useRef, useState } from 'react';
import { FileUp, FlipHorizontal2, PackageCheck, Undo2, Wand2 } from 'lucide-react';
import type { Solid, SolidReport } from '@/src/lib/papercraft-engine';
import { formatLength, useUnit } from '../lib/units';
import { useT } from '../lib/i18n';
import { LengthField, NumberField, SelectField, Section } from './fields';
import { DEFAULT_SIMPLIFY_FACES, MAX_FACES, MIN_SIMPLIFY_FACES } from './papercraftCompute';
import { MODEL_FILE_ACCEPT } from './papercraftFiles';
import ModelThumb from './ModelThumb';
import ShapeSection from './ShapeSection';
import { BUILT_IN_MODELS, MODEL_GROUPS } from './papercraftModels';
import { describeMeshWarning } from './papercraftWarnings';
import type { PapercraftAction, PapercraftState, SizeBy } from './papercraftState';

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
        {importError && (
          <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-[var(--studio-ink)]">
            {importError}
          </p>
        )}
      </Section>

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
                <NumberField label={t('Simplify to')} suffix={t('faces')} value={target} min={MIN_SIMPLIFY_FACES} max={MAX_FACES} step={50} onChange={setTargetFaces} />
                <button
                  type="button"
                  disabled={simplifying}
                  onClick={() => onSimplify(target)}
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

      <Section title={t('Size')}>
        <SelectField label={t('Set the size by')} value={state.size.by} options={sizeOptions} onChange={(by) => dispatch({ type: 'SET_SIZE', size: { by } })} />
        <LengthField label={t('Size')} valueMm={state.size.mm} minMm={5} maxMm={3000} onChange={(mm) => dispatch({ type: 'SET_SIZE', size: { mm } })} />
        {report && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--studio-ink-secondary)]">
            <dt className="text-[var(--studio-ink-subtle)]">{t('Built size')}</dt>
            <dd>{report.size.map((v) => formatLength(v, unit)).join(' × ')}</dd>
            <dt className="text-[var(--studio-ink-subtle)]">{t('Shortest edge')}</dt>
            <dd>{formatLength(report.minEdgeMm, unit)}</dd>
          </dl>
        )}
      </Section>
    </aside>
  );
}
