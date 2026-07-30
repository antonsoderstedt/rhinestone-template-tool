import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { getOutlineFontDefinition, isKnownOutlineFontId } from '@/src/lib/rhinestone-engine/index';

export async function GET(
  _request: Request,
  context: { params: Promise<{ fontId: string }> },
) {
  const { fontId } = await context.params;

  if (!isKnownOutlineFontId(fontId) || fontId === 'legacy-original') {
    return NextResponse.json({ error: 'Unknown fontId' }, { status: 404 });
  }

  const definition = getOutlineFontDefinition(fontId);
  if (!definition.nodeFilePath) {
    return NextResponse.json({ error: 'Font asset unavailable' }, { status: 404 });
  }

  const fileBuffer = await readFile(definition.nodeFilePath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'font/woff',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
