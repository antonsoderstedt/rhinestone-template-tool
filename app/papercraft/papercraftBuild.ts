import type { BuildStep } from '@/src/lib/papercraft-engine';
import type { TranslateVars } from '../lib/i18n';

type T = (text: string, vars?: TranslateVars) => string;

/** Edge numbers as a list: 3, 5, 8. */
const list = (numbers: readonly number[]) => numbers.join(', ');

/** One step of the build order as sentences, in the reader's language. `partName` is how a part is called (its number). */
export function describeBuildStep(t: T, step: BuildStep, partName: (partId: number) => string = (id) => String(id)): string {
  const sentences: string[] = [];
  const part = partName(step.partId);
  if (step.step === 1) sentences.push(t('Start with part {part}. Fold it along the dashed lines.', { part }));
  else sentences.push(t('Take part {part}. Fold it along the dashed lines.', { part }));
  if (step.seams.length === 1) sentences.push(t('Glue the edge {edges} to the edge with the same number on the same part.', { edges: list(step.seams) }));
  else if (step.seams.length > 1) sentences.push(t('Glue the edges {edges} to the edges with the same numbers on the same part.', { edges: list(step.seams) }));
  for (const join of step.joins) {
    sentences.push(
      join.edges.length === 1
        ? t('Glue edge {edges} to part {other}.', { edges: list(join.edges), other: partName(join.partId) })
        : t('Glue edges {edges} to part {other}.', { edges: list(join.edges), other: partName(join.partId) }),
    );
  }
  return sentences.join(' ');
}

/** The steps as text for the PDF: the numbers on the parts are the steps, so a part is called by its step. */
export function buildOrderText(t: T, order: readonly BuildStep[], numberedByStep: boolean): { title: string; steps: string[] } {
  const stepOf = new Map(order.map((s) => [s.partId, s.step]));
  const partName = (id: number) => String(numberedByStep ? stepOf.get(id) ?? id : id);
  return { title: t('Build order'), steps: order.map((s) => describeBuildStep(t, s, partName)) };
}
