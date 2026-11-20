/**
 * Human-friendly relative dates for lists ("2 hours ago"). Pure: the caller
 * passes `now`, so the result is deterministic and testable.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function formatRelativeTime(isoTimestamp: string, now: Date): string {
  const then = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(then)) return 'Unknown date';

  const elapsed = now.getTime() - then;
  // Clock skew or a future timestamp: treat as "just now" rather than negative.
  if (elapsed < MINUTE_MS) return 'Just now';
  if (elapsed < HOUR_MS) return plural(Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), 'hour');
  if (elapsed < 2 * DAY_MS) return 'Yesterday';
  if (elapsed < 30 * DAY_MS) return plural(Math.floor(elapsed / DAY_MS), 'day');

  return new Date(then).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
