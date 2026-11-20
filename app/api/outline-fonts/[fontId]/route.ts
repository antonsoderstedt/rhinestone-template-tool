import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getOutlineFontDefinition, isKnownOutlineFontId, repairFontBytes } from '@/src/lib/rhinestone-engine/index';

function contentTypeForFontFile(filePath: string): string {
  return path.extname(filePath).toLowerCase() === '.woff2' ? 'font/woff2' : 'font/woff';
}

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

  // Some packaged WOFF files carry trailing bytes that make browsers reject them
  // (fredoka-one); serve them trimmed to the length the header declares.
  const fileBuffer = repairFontBytes(await readFile(definition.nodeFilePath));
  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': contentTypeForFontFile(definition.nodeFilePath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
