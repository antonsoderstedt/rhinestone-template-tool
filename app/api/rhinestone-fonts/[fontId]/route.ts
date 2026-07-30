/**
 * Rhinestone Font Asset API Route
 *
 * Serves rhinestone font files to the browser.
 * Only serves fonts explicitly registered in the rhinestone font registry.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { RHINESTONE_FONT_REGISTRY } from '../../../../src/lib/rhinestone-engine/rhinestoneFont/rhinestoneFontRegistry';

export async function GET(_request: Request, { params }: { params: Promise<{ fontId: string }> }) {
  const { fontId } = await params;

  const fontDef = Object.values(RHINESTONE_FONT_REGISTRY).find((f) => f.fontId === fontId);

  if (!fontDef) {
    return new NextResponse('Font not found', { status: 404 });
  }

  if (!fontDef.nodeFilePath) {
    return new NextResponse('Font has no file path', { status: 404 });
  }

  if (!existsSync(fontDef.nodeFilePath)) {
    return new NextResponse(`Font file not found: ${fontDef.nodeFilePath}`, { status: 404 });
  }

  const fileBuffer = await readFile(fontDef.nodeFilePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'font/otf',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
