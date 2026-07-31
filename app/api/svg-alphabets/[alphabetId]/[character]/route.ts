/**
 * SVG Alphabet Glyph Asset API Route
 *
 * Serves per-letter SVG glyph files to the browser.
 * Only serves alphabets explicitly registered in the SVG alphabet registry.
 * Only serves single-character glyph filenames like 'A.svg' or '9.svg'.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { SVG_ALPHABET_REGISTRY } from '../../../../../src/lib/rhinestone-engine/svgAlphabet/svgAlphabetRegistry';
import { resolveSvgAlphabetGlyphPath } from '../../../../../src/lib/rhinestone-engine/svgAlphabet/svgAlphabetPath';
import type { StoneSizeId } from '../../../../../src/lib/rhinestone-engine/types/index';

const KNOWN_STONE_SIZES: readonly StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'];

function parseStoneSize(raw: string | null): StoneSizeId | undefined {
  if (!raw) return undefined;
  return KNOWN_STONE_SIZES.find((size) => size === raw);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ alphabetId: string; character: string }> },
) {
  const { alphabetId, character } = await params;

  const definition = SVG_ALPHABET_REGISTRY.find((entry) => entry.alphabetId === alphabetId);
  if (!definition) {
    return new NextResponse('Alphabet not found', { status: 404 });
  }

  // Guard against directory traversal — the character segment must be a single
  // alphanumeric or safely encoded character.
  const decoded = decodeURIComponent(character);
  if (decoded.length !== 1 || !/^[A-Za-z0-9]$/.test(decoded)) {
    return new NextResponse('Unsupported character path', { status: 400 });
  }

  const url = new URL(request.url);
  const requestedSize = parseStoneSize(url.searchParams.get('size'));

  const resolvedPath = resolveSvgAlphabetGlyphPath(definition, decoded, requestedSize);
  if (!resolvedPath) {
    return new NextResponse(`Glyph "${decoded}" not found for ${definition.displayName}`, { status: 404 });
  }

  const svgText = await readFile(resolvedPath, 'utf-8');

  return new NextResponse(svgText, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
