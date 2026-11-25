import { assessBuild, type CoverContent, type PapercraftResult } from '@/src/lib/papercraft-engine';
import { MM_PER_INCH } from '../lib/units';
import type { TranslateVars } from '../lib/i18n';
import type { PaperPreset } from './papercraftState';

type T = (text: string, vars?: TranslateVars) => string;

/** The cover is printed on A4, or on Letter when the pages are Letter. (A cutting mat is not a printer page.) */
export function coverPageSize(preset: PaperPreset): { widthMm: number; heightMm: number } {
  return preset === 'letter' ? { widthMm: 215.9, heightMm: 279.4 } : { widthMm: 210, heightMm: 297 };
}

export function paperPresetLabel(t: T, preset: PaperPreset): string {
  switch (preset) {
    case 'a4':
      return t('A4 sheet');
    case 'letter':
      return t('US Letter sheet');
    case 'cricut12x12':
      return t('Cricut mat 12 × 12 in');
    case 'cricut12x24':
      return t('Cricut mat 12 × 24 in');
  }
}

export function difficultyLabel(t: T, difficulty: 'easy' | 'medium' | 'hard' | 'expert'): string {
  switch (difficulty) {
    case 'easy':
      return t('Easy');
    case 'medium':
      return t('Medium');
    case 'hard':
      return t('Hard');
    case 'expert':
      return t('Expert');
  }
}

/** "25 minutes", "1 h 30 min", "2 h". */
export function formatMinutes(t: T, minutes: number): string {
  if (minutes < 60) return t('{n} minutes', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t('{h} h', { h }) : t('{h} h {m} min', { h, m });
}

const mm1 = (v: number) => v.toFixed(1);

/** What the cover page says, in the reader's language. */
export function buildCoverContent(run: PapercraftResult, projectName: string, preset: PaperPreset, t: T): CoverContent {
  const { solid, pattern, layout } = run;
  const size = solid.vertices.length
    ? [0, 1, 2].map((i) => Math.max(...solid.vertices.map((v) => v[i])) - Math.min(...solid.vertices.map((v) => v[i])))
    : [0, 0, 0];
  const assessment = assessBuild(pattern, solid);
  const finished = t('{mm} mm ({inch} in)', {
    mm: size.map(mm1).join(' × '),
    inch: size.map((v) => mm1(v / MM_PER_INCH)).join(' × '),
  });
  return {
    title: projectName.trim() || t('Untitled model'),
    subtitle: t('A paper model to print, cut and fold'),
    facts: [
      { label: t('Finished size'), value: finished },
      { label: t('Parts'), value: String(pattern.stats.partCount) },
      { label: t('Faces'), value: String(pattern.stats.faceCount) },
      { label: t('Edges to glue'), value: String(pattern.edgePairCount) },
      { label: t('Pages'), value: String(layout.pages.length) },
      { label: t('Paper'), value: t('{page}, 160-250 g/m² cardstock', { page: paperPresetLabel(t, preset) }) },
      { label: t('Difficulty'), value: difficultyLabel(t, assessment.difficulty) },
      { label: t('Time'), value: t('about {time}', { time: formatMinutes(t, assessment.minutes) }) },
    ],
    legendTitle: t('How to read the pattern'),
    legend: [
      { kind: 'cut', label: t('Cut along this line') },
      { kind: 'mountain', label: t('Mountain fold: the crease points toward you') },
      { kind: 'valley', label: t('Valley fold: the crease points away from you') },
      { kind: 'tab', label: t('Fold the glue tab back along this line') },
      { kind: 'number', label: t('Glue the tab with a number to the edge with the same number') },
    ],
    pageMapTitle: t('What is on each page'),
    pageMapMore: (hidden) => t('+{count} more pages', { count: hidden }),
    stepsTitle: t('How to build it'),
    steps: [
      t('Print the pages at 100 % scale (not "fit to page"). Paper of 160 g/m² or light cardstock works best.'),
      t('Cut out each part along the solid lines. With a Cricut, use the Cricut SVG instead: black is Cut and red is Score.'),
      t('Crease along the dashed lines with a ruler and a blunt tool such as an empty ballpoint pen.'),
      t('Fold every crease the way it is marked, looking at the printed side.'),
      t('Start with part 1. Put glue on a tab and press it to the edge with the same number. Hold it for a few seconds.'),
      t('Continue in number order, and close the last edges last. Tweezers help with small parts.'),
      t('Let it dry before you handle it.'),
    ],
    footer: t('Made with Papercraft Studio'),
  };
}
