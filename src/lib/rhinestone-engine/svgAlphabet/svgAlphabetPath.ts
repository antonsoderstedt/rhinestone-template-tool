/**
 * SVG Alphabet Glyph Path Resolver
 *
 * Server-side resolver that finds a specific glyph SVG file inside a user's
 * LETTER UTVALDA library directory. Same fallback chain as fontLibraryPath so
 * the two systems can share library roots.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ImportedStone } from '../templateImport/templateImport';
import { importRhinestoneTemplate } from '../templateImport/templateImport';
import type { SvgAlphabetCharacterClass, SvgAlphabetCombinedSource, SvgAlphabetDefinition } from './svgAlphabetRegistry';
import type { StoneSizeId } from '../types/index';

function getLibraryRoots(): string[] {
  const roots = [
    process.env.RHINESTONE_FONT_LIBRARY_DIR,
    join(homedir(), 'Desktop', 'LETTER UTVALDA'),
    join(/* turbopackIgnore: true */ process.cwd(), 'public', 'fonts', 'rhinestone-library'),
  ];
  return roots.filter((root): root is string => typeof root === 'string' && root.length > 0);
}

function classifyCharacter(character: string): SvgAlphabetCharacterClass | null {
  if (/^[A-Z]$/.test(character)) return 'uppercase';
  if (/^[a-z]$/.test(character)) return 'lowercase';
  if (/^[0-9]$/.test(character)) return 'digits';
  return null;
}

function splitZipRelativePath(relativePath: string): { archiveRelativePath: string; entryRelativePath: string } | null {
  const match = relativePath.match(/^(.*\.zip)\/(.+)$/u);
  if (!match) return null;
  return {
    archiveRelativePath: match[1]!,
    entryRelativePath: match[2]!,
  };
}

function readZipEntry(archivePath: string, entryPath: string): string | null {
  try {
    return execFileSync('unzip', ['-p', archivePath, entryPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function sanitizeCurationSvg(svgText: string): string {
  return svgText
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function buildGlyphSvg(stones: readonly ImportedStone[]): string | null {
  if (stones.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stone of stones) {
    const radius = stone.diameterMm / 2;
    minX = Math.min(minX, stone.center.x - radius);
    minY = Math.min(minY, stone.center.y - radius);
    maxX = Math.max(maxX, stone.center.x + radius);
    maxY = Math.max(maxY, stone.center.y + radius);
  }

  const width = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const circles = stones.map((stone, index) => {
    const radius = stone.diameterMm / 2;
    const cx = stone.center.x - minX;
    const cy = stone.center.y - minY;
    return `<circle id="glyph-${index}" cx="${cx}" cy="${cy}" r="${radius}"/>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">\n${circles}\n</svg>`;
}

function splitCombinedGlyphGroups(stones: readonly ImportedStone[], margin: number): ImportedStone[][] {
  const expanded = stones.map((stone) => {
    const radius = stone.diameterMm / 2;
    return {
      left: stone.center.x - radius - margin,
      right: stone.center.x + radius + margin,
      top: stone.center.y - radius - margin,
      bottom: stone.center.y + radius + margin,
    };
  });

  const seen = new Set<number>();
  const groups: ImportedStone[][] = [];

  for (let index = 0; index < expanded.length; index += 1) {
    if (seen.has(index)) continue;
    const queue = [index];
    const group: ImportedStone[] = [];
    seen.add(index);

    while (queue.length > 0) {
      const currentIndex = queue.pop()!;
      const currentBox = expanded[currentIndex]!;
      group.push(stones[currentIndex]!);

      for (let otherIndex = 0; otherIndex < expanded.length; otherIndex += 1) {
        if (seen.has(otherIndex)) continue;
        const otherBox = expanded[otherIndex]!;
        const overlaps = !(
          currentBox.right < otherBox.left ||
          currentBox.left > otherBox.right ||
          currentBox.bottom < otherBox.top ||
          currentBox.top > otherBox.bottom
        );
        if (overlaps) {
          seen.add(otherIndex);
          queue.push(otherIndex);
        }
      }
    }

    groups.push(group);
  }

  return groups.sort((left, right) => {
    const leftMinX = Math.min(...left.map((stone) => stone.center.x - stone.diameterMm / 2));
    const rightMinX = Math.min(...right.map((stone) => stone.center.x - stone.diameterMm / 2));
    return leftMinX - rightMinX;
  });
}

function findCombinedSource(
  definition: SvgAlphabetDefinition,
  character: string,
  targetStoneSizeId?: StoneSizeId,
): SvgAlphabetCombinedSource | null {
  for (const source of definition.combinedSources ?? []) {
    if (source.targetStoneSizeId && targetStoneSizeId && source.targetStoneSizeId !== targetStoneSizeId) {
      continue;
    }
    if (source.characters.includes(character)) {
      return source;
    }
  }
  return null;
}

/**
 * Resolves which glyph directory to use for a character, in priority order:
 * 1. Per-size + per-character-class directory (packages split by both, e.g. SS06-UPPERCASE)
 * 2. Per-character-class directory (uppercase/lowercase/digits in separate folders)
 * 3. Per-size directory (SS6/SS10 in separate folders)
 * 4. The alphabet's default directory
 */
function resolveGlyphDir(
  definition: SvgAlphabetDefinition,
  characterClass: SvgAlphabetCharacterClass | null,
  targetStoneSizeId?: StoneSizeId,
): string {
  const sizeClassDir =
    targetStoneSizeId && characterClass
      ? definition.libraryRelativeDirBySizeAndCharacterClass?.[targetStoneSizeId]?.[characterClass]
      : undefined;
  const classDir = characterClass ? definition.libraryRelativeDirByCharacterClass?.[characterClass] : undefined;
  const sizedDir = targetStoneSizeId ? definition.libraryRelativeDirBySize?.[targetStoneSizeId] : undefined;
  return sizeClassDir ?? classDir ?? sizedDir ?? definition.libraryRelativeDir;
}

/**
 * Resolve the absolute filesystem path of a single glyph SVG in an alphabet.
 * The character is used as the file basename (e.g. 'A' → 'A.svg'). When the
 * alphabet ships size-specific glyph folders, the requested targetStoneSizeId
 * picks the matching subfolder; otherwise the default libraryRelativeDir is
 * used.
 */
function glyphFileBasenames(definition: SvgAlphabetDefinition, character: string): string[] {
  const basenames = [character];
  const fallback = definition.glyphFileFallbackByChar?.[character];
  if (fallback) basenames.push(fallback);
  return basenames;
}

export function resolveSvgAlphabetGlyphPath(
  definition: SvgAlphabetDefinition,
  character: string,
  targetStoneSizeId?: StoneSizeId,
): string | null {
  if (!character || character.length !== 1) return null;
  const characterClass = classifyCharacter(character);
  const dir = resolveGlyphDir(definition, characterClass, targetStoneSizeId);

  for (const basename of glyphFileBasenames(definition, character)) {
    const filename = `${basename}${definition.glyphExtension}`;
    for (const root of getLibraryRoots()) {
      const candidate = join(/* turbopackIgnore: true */ root, dir, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export async function loadSvgAlphabetGlyphText(
  definition: SvgAlphabetDefinition,
  character: string,
  targetStoneSizeId?: StoneSizeId,
): Promise<string | null> {
  const characterClass = classifyCharacter(character);
  const dir = resolveGlyphDir(definition, characterClass, targetStoneSizeId);

  for (const basename of glyphFileBasenames(definition, character)) {
    const relativeGlyphPath = `${dir}/${basename}${definition.glyphExtension}`;
    const zippedGlyphPath = splitZipRelativePath(relativeGlyphPath);
    if (!zippedGlyphPath) continue;
    for (const root of getLibraryRoots()) {
      const archivePath = join(/* turbopackIgnore: true */ root, zippedGlyphPath.archiveRelativePath);
      if (!existsSync(archivePath)) continue;
      const svgText = readZipEntry(archivePath, zippedGlyphPath.entryRelativePath);
      if (svgText) {
        return svgText;
      }
    }
  }

  const directPath = resolveSvgAlphabetGlyphPath(definition, character, targetStoneSizeId);
  if (directPath) {
    return await readFile(directPath, 'utf-8');
  }

  const combinedSource = findCombinedSource(definition, character, targetStoneSizeId);
  if (!combinedSource) return null;

  for (const root of getLibraryRoots()) {
    const combinedPath = join(/* turbopackIgnore: true */ root, combinedSource.libraryRelativeFile);
    if (!existsSync(combinedPath)) continue;

    const svgText = sanitizeCurationSvg(await readFile(combinedPath, 'utf-8'));
    const imported = importRhinestoneTemplate({ svgText });
    const groups = splitCombinedGlyphGroups(imported.stones, combinedSource.groupMergeMargin);
    if (groups.length !== combinedSource.characters.length) {
      return null;
    }

    const characterIndex = combinedSource.characters.indexOf(character);
    if (characterIndex === -1) return null;
    return buildGlyphSvg(groups[characterIndex] ?? []);
  }

  return null;
}
