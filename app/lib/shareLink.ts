/**
 * Share a design as a link. The whole design is packed into the part of the address after `#`, which the browser never sends
 * to a server, so nothing is uploaded and nobody stores the design: whoever opens the link gets their own copy.
 *
 * The design is the project file (the same thing "Save project file" writes), compressed and made URL-safe.
 */

export const SHARE_HASH_KEY = 'share';
/** Links much longer than this are not reliably shared (chat apps cut them). */
export const MAX_SHARE_LINK_CHARS = 60_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A broken stream rejects these as well as the read below; the read reports it, so these are ignored.
  writer.write(bytes as unknown as BufferSource).catch(() => undefined);
  writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** The text that goes after `#share=`. */
export async function encodeSharePayload(projectJson: string): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(projectJson), new CompressionStream('deflate-raw')));
}

/** The project JSON in a payload. Throws an Error fit to show the user when it is not one of ours. */
export async function decodeSharePayload(payload: string): Promise<string> {
  try {
    const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('This link is damaged or not a design link, so it could not be opened.');
  }
}

export type ShareLinkResult = { ok: true; url: string } | { ok: false; reason: 'too-long'; chars: number };

export async function buildShareLink(projectJson: string, origin: string, path = '/rhinestone'): Promise<ShareLinkResult> {
  const url = `${origin}${path}#${SHARE_HASH_KEY}=${await encodeSharePayload(projectJson)}`;
  return url.length > MAX_SHARE_LINK_CHARS ? { ok: false, reason: 'too-long', chars: url.length } : { ok: true, url };
}

/** The payload in an address hash (`#share=…`), or null. */
export function readSharePayload(hash: string): string | null {
  const match = new RegExp(`^#${SHARE_HASH_KEY}=([A-Za-z0-9_-]+)$`).exec(hash);
  return match ? match[1]! : null;
}
