import type { Pattern, Solid } from '../types';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface BuildAssessment {
  difficulty: Difficulty;
  /** A rough guide for cutting, folding and gluing by hand, in minutes, rounded to 5. */
  minutes: number;
}

const ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * A rule of thumb, not a measurement: the number of edges to glue decides the difficulty (up to 15 easy, up to 45 medium, up to 120
 * hard, then expert), and a shortest edge under 15 mm (fiddly to glue) makes it one step harder. The time is 10 minutes plus 1 for
 * each part, 0.4 for each fold and 1.5 for each glued edge.
 */
export function assessBuild(pattern: Pattern, solid: Solid): BuildAssessment {
  const pairs = pattern.edgePairCount;
  let level = pairs <= 15 ? 0 : pairs <= 45 ? 1 : pairs <= 120 ? 2 : 3;
  const shortest = solid.edges.reduce((m, e) => Math.min(m, e.length), Infinity);
  if (shortest < 15 && level < ORDER.length - 1) level += 1;
  const raw = 10 + pattern.stats.partCount + 0.4 * pattern.stats.foldCount + 1.5 * pairs;
  return { difficulty: ORDER[level], minutes: Math.max(5, Math.round(raw / 5) * 5) };
}
