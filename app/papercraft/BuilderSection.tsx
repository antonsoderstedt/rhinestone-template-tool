'use client';

import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  defaultPart,
  findTemplate,
  longestSide,
  meshOfRecipe,
  partsOfRecipe,
  PARAMETRIC_TEMPLATES,
  PART_KINDS,
  PART_LIMITS,
  PART_OPENS,
  recipeOfTemplate,
  templateValues,
  type BuildPart,
  type ModelRecipe,
  type PartKind,
  type PartOpen,
} from '@/src/lib/papercraft-engine';
import { useT } from '../lib/i18n';
import { LengthField, NumberField, Section, SelectField } from './fields';
import type { PapercraftAction, PapercraftState } from './papercraftState';

const KIND_LABELS: Record<PartKind, string> = { box: 'Box', cylinder: 'Cylinder', cone: 'Cone', pyramid: 'Pyramid', frustum: 'Tapering block' };
const OPEN_LABELS: Record<PartOpen, string> = { none: 'Closed', top: 'Open at the top', bottom: 'Open at the bottom', both: 'Open at both ends' };

const smallButton =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]';

/**
 * Make your own model: start from a template whose sizes follow a few numbers (a box with a lid, a house, a tower), or put one together from
 * simple parts (boxes, cylinders, cones, pyramids) that each have a size, a place and a turn. The recipe is kept with the model, so it can be
 * changed again after it was saved.
 */
export default function BuilderSection({ source, dispatch, selectedPart, onSelectPart }: { source: PapercraftState['source']; dispatch: React.Dispatch<PapercraftAction>; selectedPart: number | null; onSelectPart: (index: number | null) => void }) {
  const t = useT();
  const recipe = source.kind === 'file' ? source.recipe : undefined;

  const start = (next: ModelRecipe, name: string) => {
    const mesh = meshOfRecipe(next);
    if (mesh) dispatch({ type: 'USE_RECIPE', name, recipe: next, mesh, sizeMm: longestSide(mesh) });
  };
  const change = (next: ModelRecipe) => {
    const mesh = meshOfRecipe(next);
    if (mesh) dispatch({ type: 'SET_RECIPE', recipe: next, mesh, sizeMm: longestSide(mesh) });
  };

  const template = recipe?.kind === 'parametric' ? findTemplate(recipe.templateId) : undefined;
  const parts = recipe?.kind === 'parts' ? recipe.parts : null;
  const setParts = (next: BuildPart[]) => change({ kind: 'parts', parts: next });
  const setPart = (index: number, patch: Partial<BuildPart>) => setParts((parts ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)));

  return (
    <Section title={t('Build your own model')} defaultOpen={false}>
      <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Start from a template and change its sizes, or put a model together from simple parts.')}</p>
      <div className="grid grid-cols-2 gap-2">
        {PARAMETRIC_TEMPLATES.map((tpl) => {
          const active = template?.id === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-pressed={active}
              title={t(tpl.description)}
              onClick={() => { const r = recipeOfTemplate(tpl.id); if (r) start(r, t(tpl.name)); }}
              className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${active ? 'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)]'}`}
            >
              {t(tpl.name)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={parts !== null}
          title={t('An empty start: add boxes, cylinders and cones yourself.')}
          onClick={() => start({ kind: 'parts', parts: [defaultPart('box')] }, t('My model'))}
          className={`rounded-lg border border-dashed px-2 py-2 text-center text-xs font-medium transition ${parts ? 'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)]' : 'border-[var(--studio-border-strong)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]'}`}
        >
          {t('From parts')}
        </button>
      </div>

      {recipe?.kind === 'parametric' && template && (
        <div className="space-y-3 border-t border-[var(--studio-border)] pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-ink-subtle)]">{t(template.name)}</h3>
          {template.params.map((p) => {
            const value = templateValues(template, recipe.values)[p.key]!;
            const set = (v: number) => change({ kind: 'parametric', templateId: template.id, values: { ...recipe.values, [p.key]: v } });
            return p.unit === 'mm' ? (
              <LengthField key={p.key} label={t(p.label)} tip={t(p.tip)} valueMm={value} minMm={p.min} maxMm={p.max} onChange={set} />
            ) : (
              <NumberField key={p.key} label={t(p.label)} tip={t(p.tip)} value={value} min={p.min} max={p.max} step={p.step} onChange={set} />
            );
          })}
          <button type="button" className={smallButton} title={t('Turn the template into separate parts you can change one by one. You cannot go back to the numbers.')} onClick={() => { const list = partsOfRecipe(recipe); if (list) change({ kind: 'parts', parts: list }); }}>
            {t('Change it part by part')}
          </button>
        </div>
      )}

      {parts && (
        <div className="space-y-2 border-t border-[var(--studio-border)] pt-3">
          {parts.map((part, index) => (
            <details key={index} open={parts.length <= 2 || index === parts.length - 1 || selectedPart === index} className={`rounded-md border bg-[var(--studio-well)] ${selectedPart === index ? 'border-violet-400/70' : 'border-[var(--studio-border)]'}`}>
              <summary onClick={() => onSelectPart(index)} className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-[var(--studio-ink)]">{index + 1}. {t(KIND_LABELS[part.kind])}</summary>
              <div className="space-y-2.5 border-t border-[var(--studio-border)] px-2.5 py-2.5">
                <SelectField<PartKind>
                  label={t('Kind')}
                  value={part.kind}
                  options={PART_KINDS.map((k) => ({ value: k, label: t(KIND_LABELS[k]) }))}
                  onChange={(kind) => setPart(index, { kind, sides: kind === 'box' ? 4 : kind === 'pyramid' ? Math.min(part.sides, PART_LIMITS.pyramidSides.max) : part.sides === 4 ? 12 : part.sides })}
                />
                <LengthField label={part.kind === 'box' || part.kind === 'pyramid' ? t('Width') : t('Width (across)')} tip={t('Size along the x direction before the part is turned.')} valueMm={part.width} minMm={PART_LIMITS.size.min} maxMm={PART_LIMITS.size.max} onChange={(width) => setPart(index, { width })} />
                <LengthField label={part.kind === 'box' || part.kind === 'pyramid' ? t('Depth') : t('Depth (across)')} tip={t('Size along the y direction before the part is turned. For a round part, the same as the width makes it round.')} valueMm={part.depth} minMm={PART_LIMITS.size.min} maxMm={PART_LIMITS.size.max} onChange={(depth) => setPart(index, { depth })} />
                <LengthField label={t('Height')} valueMm={part.height} minMm={PART_LIMITS.size.min} maxMm={PART_LIMITS.size.max} onChange={(height) => setPart(index, { height })} />
                {part.kind !== 'box' && (
                  <NumberField label={t('Sides')} tip={t('How many sides the part has round. More sides are rounder but need more folds.')} value={part.sides} min={part.kind === 'pyramid' ? PART_LIMITS.pyramidSides.min : PART_LIMITS.sides.min} max={part.kind === 'pyramid' ? PART_LIMITS.pyramidSides.max : PART_LIMITS.sides.max} onChange={(sides) => setPart(index, { sides })} />
                )}
                {part.kind === 'frustum' && (
                  <NumberField label={t('Top width')} tip={t('How wide the top is compared with the bottom.')} suffix="%" value={Math.round(part.topPct)} min={PART_LIMITS.topPct.min} max={PART_LIMITS.topPct.max} onChange={(topPct) => setPart(index, { topPct })} />
                )}
                <SelectField<PartOpen>
                  label={t('Ends')}
                  tip={t('An open end has no lid: leave it open to make a tube, or where another part is glued on.')}
                  value={part.open}
                  options={PART_OPENS.map((o) => ({ value: o, label: t(OPEN_LABELS[o]) }))}
                  onChange={(open) => setPart(index, { open })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <LengthField label="x" tip={t('Where the middle of the bottom is, from side to side.')} valueMm={part.x} minMm={PART_LIMITS.position.min} maxMm={PART_LIMITS.position.max} onChange={(x) => setPart(index, { x })} />
                  <LengthField label="y" tip={t('Where the middle of the bottom is, from front to back.')} valueMm={part.y} minMm={PART_LIMITS.position.min} maxMm={PART_LIMITS.position.max} onChange={(y) => setPart(index, { y })} />
                  <LengthField label="z" tip={t('How high the bottom is above the ground.')} valueMm={part.z} minMm={PART_LIMITS.position.min} maxMm={PART_LIMITS.position.max} onChange={(z) => setPart(index, { z })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label={t('Turn x')} tip={t('Turns the part about its bottom middle, in degrees: first about x, then y, then z.')} suffix="°" value={part.rotX} min={PART_LIMITS.angle.min} max={PART_LIMITS.angle.max} step={5} onChange={(rotX) => setPart(index, { rotX })} />
                  <NumberField label={t('Turn y')} suffix="°" value={part.rotY} min={PART_LIMITS.angle.min} max={PART_LIMITS.angle.max} step={5} onChange={(rotY) => setPart(index, { rotY })} />
                  <NumberField label={t('Turn z')} suffix="°" value={part.rotZ} min={PART_LIMITS.angle.min} max={PART_LIMITS.angle.max} step={5} onChange={(rotZ) => setPart(index, { rotZ })} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className={smallButton} disabled={parts.length >= PART_LIMITS.parts} onClick={() => setParts([...parts.slice(0, index + 1), { ...part }, ...parts.slice(index + 1)])}>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {t('Copy')}
                  </button>
                  <button type="button" className={smallButton} disabled={parts.length <= 1} onClick={() => setParts(parts.filter((_, i) => i !== index))}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('Remove')}
                  </button>
                </div>
              </div>
            </details>
          ))}
          <div className="flex flex-wrap gap-2">
            {PART_KINDS.map((kind) => (
              <button key={kind} type="button" className={smallButton} disabled={parts.length >= PART_LIMITS.parts} onClick={() => setParts([...parts, { ...defaultPart(kind), z: Math.max(0, ...parts.map((p) => p.z + p.height)) }])}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t(KIND_LABELS[kind])}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--studio-ink-subtle)]">{t('To move the parts with the mouse, open the Build view above the model.')}</p>
          <p className="text-xs text-[var(--studio-ink-subtle)]">{t('A new part is put on top of the others. Parts are separate pieces: leave the ends open where two parts are glued together.')}</p>
        </div>
      )}

      {recipe && <p className="text-xs text-[var(--studio-ink-subtle)]">{t('The sizes here are the finished size. Changing Size above scales the whole model; change a number here to set the size again.')}</p>}
    </Section>
  );
}
