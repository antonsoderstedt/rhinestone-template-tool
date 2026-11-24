/**
 * Checks the Cloudflare Access token on a request. Access already stops visitors at the edge; checking the token here as well
 * means the API still refuses a request that somehow reaches the Worker without passing Access.
 *
 * Fails closed: without TEAM_DOMAIN and POLICY_AUD the answer is "not configured", never "allowed".
 */

import type { SyncEnv } from './types';

export type AccessResult = { ok: true; owner: string } | { ok: false; status: number; message: string };

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
}

let keyCache: { domain: string; at: number; keys: Jwk[] } | null = null;
const KEY_TTL_MS = 60 * 60 * 1000;

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part))) as T;
  } catch {
    return null;
  }
}

async function loadKeys(domain: string, fetcher: typeof fetch): Promise<Jwk[]> {
  if (keyCache && keyCache.domain === domain && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.keys;
  const response = await fetcher(`${domain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Could not load Access keys (${response.status})`);
  const body = (await response.json()) as { keys?: Jwk[] };
  keyCache = { domain, at: Date.now(), keys: body.keys ?? [] };
  return keyCache.keys;
}

/** For tests: forget the cached keys. */
export function resetAccessKeyCache(): void {
  keyCache = null;
}

export async function checkAccess(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch, nowSeconds = Math.floor(Date.now() / 1000)): Promise<AccessResult> {
  if (env.ALLOW_UNAUTHENTICATED === 'true') return { ok: true, owner: 'local-development' };
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return { ok: false, status: 500, message: 'Sync is not configured (TEAM_DOMAIN and POLICY_AUD are missing).' };

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, status: 403, message: 'Missing Access token.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 403, message: 'Malformed Access token.' };

  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]!);
  const payload = decodeJson<{ aud?: string | string[]; iss?: string; exp?: number; nbf?: number; sub?: string; email?: string }>(parts[1]!);
  if (!header || !payload || header.alg !== 'RS256') return { ok: false, status: 403, message: 'Unsupported Access token.' };

  try {
    const keys = await loadKeys(env.TEAM_DOMAIN, fetcher);
    const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return { ok: false, status: 403, message: 'Unknown Access key.' };
    const key = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]!) as BufferSource, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return { ok: false, status: 403, message: 'Invalid Access token.' };
  } catch {
    return { ok: false, status: 403, message: 'Could not verify the Access token.' };
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audiences.includes(env.POLICY_AUD)) return { ok: false, status: 403, message: 'Wrong audience.' };
  if (payload.iss !== env.TEAM_DOMAIN) return { ok: false, status: 403, message: 'Wrong issuer.' };
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) return { ok: false, status: 403, message: 'Access token expired.' };
  if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds + 60) return { ok: false, status: 403, message: 'Access token not valid yet.' };

  const owner = payload.sub || payload.email;
  if (!owner) return { ok: false, status: 403, message: 'Access token has no subject.' };
  return { ok: true, owner };
}
