import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../app/lib/relativeTime';

const NOW = new Date('2026-11-19T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe('formatRelativeTime', () => {
  it('says "Just now" under a minute and for future timestamps', () => {
    expect(formatRelativeTime(ago(10_000), NOW)).toBe('Just now');
    expect(formatRelativeTime(ago(-5 * 60_000), NOW)).toBe('Just now');
  });

  it('uses minutes, hours and days with correct plurals', () => {
    expect(formatRelativeTime(ago(60_000), NOW)).toBe('1 minute ago');
    expect(formatRelativeTime(ago(5 * 60_000), NOW)).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(60 * 60_000), NOW)).toBe('1 hour ago');
    expect(formatRelativeTime(ago(2 * 60 * 60_000), NOW)).toBe('2 hours ago');
    expect(formatRelativeTime(ago(30 * 60 * 60_000), NOW)).toBe('Yesterday');
    expect(formatRelativeTime(ago(5 * 24 * 60 * 60_000), NOW)).toBe('5 days ago');
  });

  it('falls back to a calendar date after 30 days', () => {
    const result = formatRelativeTime('2026-08-03T10:00:00.000Z', NOW);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Aug/);
  });

  it('handles invalid timestamps', () => {
    expect(formatRelativeTime('not a date', NOW)).toBe('Unknown date');
  });
});
