import { buildShareLink, decodeSharePayload, readSharePayload, type ShareLinkResult } from '../lib/shareLink';
import { deserializePapercraft, snapshotText } from './papercraftSnapshot';
import type { PapercraftState } from './papercraftState';

/** A link to a design: the design itself, packed into the part after `#`, which is never sent to a server (same as the Rhinestone studio). */
export function buildPapercraftShareLink(state: PapercraftState, origin: string): Promise<ShareLinkResult> {
  return buildShareLink(snapshotText(state), origin, '/papercraft');
}

/** The design in an address hash, or null when the hash is not a share link. Throws an Error fit to show when it is damaged or not ours. */
export async function readSharedPapercraft(hash: string): Promise<PapercraftState | null> {
  const payload = readSharePayload(hash);
  if (!payload) return null;
  const text = await decodeSharePayload(payload);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This link is damaged or not a design link, so it could not be opened.');
  }
  const state = deserializePapercraft(data);
  if (!state) throw new Error('This link is not a Papercraft model link, or it was made by a version that cannot be read here.');
  return state;
}
