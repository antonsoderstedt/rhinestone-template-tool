/** What the statistics panel shows, worked out from what the server answers: pure, so it can be tested. */

import type { Stats } from '../lib/tracking/trackingClient';

export type DayCount = Stats['perDay'][number];

const DAY_MS = 86_400_000;

/** One entry for every day from the day `since` falls on, for `days` + 1 days, with zeros where nothing happened. */
export function fillDays(perDay: DayCount[], since: string, days: number): DayCount[] {
  const start = Date.parse(`${since.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start)) return perDay;
  const byDay = new Map(perDay.map((d) => [d.day, d]));
  const out: DayCount[] = [];
  for (let i = 0; i <= days; i++) {
    const day = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, events: 0, sessions: 0 });
  }
  return out;
}

/** Groups the days into at most `max` bars (a year of days does not fit): each bar adds up its days. */
export function groupDays(days: DayCount[], max: number): DayCount[] {
  if (days.length <= max) return days;
  const size = Math.ceil(days.length / max);
  const out: DayCount[] = [];
  for (let i = 0; i < days.length; i += size) {
    const slice = days.slice(i, i + size);
    out.push({ day: slice[0]!.day, events: slice.reduce((s, d) => s + d.events, 0), sessions: slice.reduce((s, d) => s + d.sessions, 0) });
  }
  return out;
}

/** The share of `part` in `whole`, 0–100, for the width of a bar. */
export function percent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}
