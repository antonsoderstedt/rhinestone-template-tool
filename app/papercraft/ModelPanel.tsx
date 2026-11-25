'use client';

import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import type { SolidReport } from '@/src/lib/papercraft-engine';
import { formatLength, useUnit } from '../lib/units';
import { useT } from '../lib/i18n';
import { LengthField, SelectField, Section } from './fields';
import { MODEL_FILE_ACCEPT } from './papercraftFiles';
import { BUILT_IN_MODELS } from './papercraftModels';
import type { PapercraftAction, PapercraftState, SizeBy } from './papercraftState';

interface ModelPanelProps {
  state: PapercraftState;
  dispatch: React.Dispatch<PapercraftAction>;
  report: SolidReport | null;
  importError: string | null;
  onImportFile: (file: File) => void;
}

export default function ModelPanel({ state, dispatch, report, importError, onImportFile }: ModelPanelProps) {
  const t = useT();
  const unit = useUnit();
  const fileRef = useRef<HTMLInputElement>(null);
  const sizeOptions: { value: SizeBy; label: string }[] = [
    { value: 'largest', label: t('Longest side') },
    { value: 'height', label: t('Height') },
    { value: 'width', label: t('Width') },
    { value: 'depth', label: t('Depth') },
  ];
  return (
    <aside aria-label={t('Model')} className="htv-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto border-r border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
      <Section title={t('Choose a model')}>
        <div className="grid grid-cols-2 gap-2">
          {BUILT_IN_MODELS.map((model) => {
            const active = state.source.kind === 'builtin' && state.source.id === model.id;
            return (
              <button
                key={model.id}
                type="button"
                aria-pressed={active}
                onClick={() => dispatch({ type: 'USE_BUILT_IN', id: model.id })}
                title={t(model.description)}
                className={`min-w-0 break-words rounded-lg border px-2.5 py-2 text-left text-sm font-medium transition ${active ? 'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]'}`}
              >
                {t(model.name)}
              </button>
            );
          })}
        </div>
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
