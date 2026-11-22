/**
 * Runs artwork generation in a Web Worker when the browser has one, and on the main thread when it does not (or when the
 * worker could not be started). The result is the same either way: both run `generateSvgArtwork`.
 */

import type { SvgToolState } from './EditorState';
import { generateSvgArtwork, type ArtworkGeneration } from './artworkCore';
import type { ArtworkWorkerRequest, ArtworkWorkerResponse } from './artworkWorker';

interface Pending {
  resolve: (value: ArtworkGeneration) => void;
  reject: (error: Error) => void;
  svgTool: SvgToolState;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: string) {
  const waiting = [...pending.values()];
  pending.clear();
  // The worker is gone: do the waiting work here instead of losing it.
  for (const item of waiting) {
    try {
      item.resolve(generateSvgArtwork(item.svgTool));
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(reason));
    }
  }
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    const created = new Worker(new URL('./artworkWorker.ts', import.meta.url), { type: 'module' });
    created.onmessage = (event: MessageEvent<ArtworkWorkerResponse>) => {
      const message = event.data;
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      if (message.ok) item.resolve(message.result);
      else item.reject(new Error(message.message));
    };
    created.onerror = () => {
      workerBroken = true;
      worker = null;
      created.terminate();
      failAll('The artwork worker stopped.');
    };
    worker = created;
    return created;
  } catch {
    workerBroken = true;
    return null;
  }
}

export function generateSvgArtworkAsync(svgTool: SvgToolState): Promise<ArtworkGeneration> {
  const active = getWorker();
  if (!active) {
    try {
      return Promise.resolve(generateSvgArtwork(svgTool));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
  return new Promise<ArtworkGeneration>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, svgTool });
    const request: ArtworkWorkerRequest = { id, svgTool };
    active.postMessage(request);
  });
}
