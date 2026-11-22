/// <reference lib="webworker" />
/**
 * Makes the stones for an artwork off the main thread, so the page stays responsive while a big or fine artwork is laid out.
 * It receives the artwork settings and answers with the same thing `generateSvgArtwork` returns.
 */

import { generateSvgArtwork } from './artworkGeneration';
import type { SvgToolState } from './EditorState';

export interface ArtworkWorkerRequest {
  id: number;
  svgTool: SvgToolState;
}

export type ArtworkWorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof generateSvgArtwork> }
  | { id: number; ok: false; message: string };

self.onmessage = (event: MessageEvent<ArtworkWorkerRequest>) => {
  const { id, svgTool } = event.data;
  try {
    const response: ArtworkWorkerResponse = { id, ok: true, result: generateSvgArtwork(svgTool) };
    self.postMessage(response);
  } catch (error) {
    const response: ArtworkWorkerResponse = { id, ok: false, message: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};
