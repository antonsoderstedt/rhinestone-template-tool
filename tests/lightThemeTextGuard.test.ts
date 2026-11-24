import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Studio components were written against the dark studio and use pale text colours. In the light
 * studio those are unreadable unless globals.css gives them a darker equivalent. This test fails when
 * a pale text utility is used inside the studios without such a rule.
 */
const APP_DIR = path.resolve(__dirname, '../app');
const PALE = /\btext-(violet-(?:100|200|300)|rose-(?:300|400)|amber-(?:100|200|400)|emerald-(?:200|400))\b/g;
// Rendered in a portal on <body>, outside [data-theme], on an always-dark surface.
const ALWAYS_DARK = new Set(['components/ExportDialog.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(name) ? [full] : [];
  });
}

describe('light studio text colours', () => {
  const css = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');
  const lightRules = css.split('\n').filter((line) => line.startsWith("[data-theme='light'] :is("));

  it('maps every pale text utility used in the studios to a darker colour', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(APP_DIR)) {
      const relative = path.relative(APP_DIR, file).split(path.sep).join('/');
      if (ALWAYS_DARK.has(relative)) continue;
      for (const match of readFileSync(file, 'utf8').matchAll(PALE)) used.add(match[1]!);
    }

    const unmapped = [...used].filter((name) => !lightRules.some((rule) => rule.includes(`.text-${name}`)));
    expect(unmapped).toEqual([]);
  });
});
