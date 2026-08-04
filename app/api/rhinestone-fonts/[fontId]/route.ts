/**
 * Rhinestone Font Asset API Route
 *
 * Serves rhinestone font files to the browser.
 * Only serves fonts explicitly registered in the rhinestone font registry.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  getRhinestoneFontDefinition,
  isKnownRhinestoneFontId,
} from '../../../../src/lib/rhinestone-engine/rhinestoneFont/rhinestoneFontRegistry';
import {
  getRhinestoneFontContentType,
  resolveRhinestoneFontFilePath,
} from '../../../../src/lib/rhinestone-engine/rhinestoneFont/fontLibraryPath';
import type { StoneSizeId } from '../../../../src/lib/rhinestone-engine/types/index';

export async function GET(request: Request, { params }: { params: Promise<{ fontId: string }> }) {
  const { fontId } = await params;
  const url = new URL(request.url);
  const size = url.searchParams.get('size');
  const targetStoneSizeId: StoneSizeId | undefined = size === 'SS6' || size === 'SS10' ? size : undefined;

  if (!isKnownRhinestoneFontId(fontId)) {
    return new NextResponse('Font not found', { status: 404 });
  }

  const fontDef = getRhinestoneFontDefinition(fontId);
  const resolvedPath = resolveRhinestoneFontFilePath(fontDef, targetStoneSizeId);

  if (!resolvedPath || !existsSync(resolvedPath)) {
    return new NextResponse(`Font file not found: ${resolvedPath ?? 'unresolved'}`, { status: 404 });
  }

  const fileBuffer = await readFile(resolvedPath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': getRhinestoneFontContentType(resolvedPath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
