/**
 * SVG Alphabet Library Status API Route
 *
 * Lightweight check the browser-side glyph loader uses to tell "this
 * character isn't part of the alphabet" apart from "the whole asset library
 * is missing on this machine/deployment" — see isSvgAlphabetLibraryAvailable.
 */

import { NextResponse } from 'next/server';
import { isSvgAlphabetLibraryAvailable } from '../../../../src/lib/rhinestone-engine/svgAlphabet/svgAlphabetPath';

export async function GET() {
  return NextResponse.json({ available: isSvgAlphabetLibraryAvailable() });
}
