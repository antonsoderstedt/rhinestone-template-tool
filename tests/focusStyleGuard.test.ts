import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keyboard users need to see where focus is. `outline-none` removes the browser's
 * focus ring, so every class string that uses it must draw a clear replacement
 * (a 2px+ ring or outline) in the same string. Otherwise drop `outline-none` and
 * let the global `:focus-visible` ring in app/globals.css apply.
 */

const APP_DIR = path.resolve(__dirname, '../app');

/** Elements focused only by code (never by Tab) and so never need a visible ring. */
const ALLOWED = [
  { file: 'app/editor/ui/Modal.tsx', reason: 'dialog container, focused programmatically (tabIndex -1)' },
];

const REPLACEMENT = /(focus|focus-visible|focus-within):(ring-[2-9]\b|outline-[2-9]\b)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(name) ? [full] : [];
  });
}

/** For every `outline-none` token, the class string around it (up to the nearest quote or backtick on each side). */
function stringsWithOutlineNone(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?<![\w-])outline-none(?![\w-])/g)) {
    const at = match.index!;
    const start = Math.max(source.lastIndexOf('"', at), source.lastIndexOf("'", at), source.lastIndexOf('`', at));
    const ends = ['"', "'", '`'].map((quote) => source.indexOf(quote, at)).filter((index) => index !== -1);
    found.push(source.slice(start + 1, Math.min(...ends)));
  }
  return found;
}

describe('focus styles', () => {
  it('never removes the focus outline without drawing a replacement', () => {
    const problems: string[] = [];
    for (const file of sourceFiles(APP_DIR)) {
      const rel = path.relative(path.resolve(__dirname, '..'), file);
      if (ALLOWED.some((entry) => entry.file === rel)) continue;
      for (const text of stringsWithOutlineNone(readFileSync(file, 'utf8'))) {
        if (!REPLACEMENT.test(text)) problems.push(`${rel}: ${text.slice(0, 90)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
