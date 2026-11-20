import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Text smaller than 12px is hard to read. Use `text-xs` (12px) or larger. */
const MIN_PX = 12;
const APP_DIR = path.resolve(__dirname, '../app');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts|css)$/.test(name) ? [full] : [];
  });
}

describe('minimum text size', () => {
  it(`has no arbitrary text size under ${MIN_PX}px`, () => {
    const problems: string[] = [];
    for (const file of sourceFiles(APP_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(match[1]) < MIN_PX) problems.push(`${path.relative(APP_DIR, file)}: ${match[0]}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
