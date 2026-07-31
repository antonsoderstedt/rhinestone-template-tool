/**
 * Rhinestone Font Asset API Route
 *
 * Serves rhinestone font files to the browser.
 * Only serves fonts explicitly registered in the rhinestone font registry.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { RHINESTONE_FONT_REGISTRY } from '../../../../src/lib/rhinestone-engine/rhinestoneFont/rhinestoneFontRegistry';
import { getRhinestoneFontContentType, resolveRhinestoneFontFilePath } from '../../../../src/lib/rhinestone-engine/rhinestoneFont/fontLibraryPath';
import type { StoneSizeId } from '../../../../src/lib/rhinestone-engine/types/index';

const KNOWN_STONE_SIZES: readonly StoneSizeId[] = ['SS6', 'SS10', 'SS16', 'SS20'];

function parseStoneSize(raw: string | null): StoneSizeId | undefined {
  if (!raw) return undefined;
  return KNOWN_STONE_SIZES.find((size) => size === raw);
}

export async function GET(request: Request, { params }: { params: Promise<{ fontId: string }> }) {
  const { fontId } = await params;

  const fontDef = Object.values(RHINESTONE_FONT_REGISTRY).find((f) => f.fontId === fontId);

  if (!fontDef) {
    return new NextResponse('Font not found', { status: 404 });
  }

  const url = new URL(request.url);
  const requestedSize = parseStoneSize(url.searchParams.get('size'));

  const resolvedPath = resolveRhinestoneFontFilePath(fontDef, requestedSize);
  if (!resolvedPath) {
    return new NextResponse(`Font file not found for: ${fontDef.displayName}`, { status: 404 });
  }

  const fileBuffer = await readFile(resolvedPath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': getRhinestoneFontContentType(resolvedPath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
