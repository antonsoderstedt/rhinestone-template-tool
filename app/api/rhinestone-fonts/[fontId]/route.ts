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

export async function GET(_request: Request, { params }: { params: Promise<{ fontId: string }> }) {
  const { fontId } = await params;

  const fontDef = Object.values(RHINESTONE_FONT_REGISTRY).find((f) => f.fontId === fontId);

  if (!fontDef) {
    return new NextResponse('Font not found', { status: 404 });
  }

  const resolvedPath = resolveRhinestoneFontFilePath(fontDef);
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
