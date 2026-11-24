import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { checkAccess, resetAccessKeyCache } from '../worker/access';
import { chunkText } from '../worker/sync';

const TEAM = 'https://team.cloudflareaccess.com';
const AUD = 'aud-123';
const NOW = 1_800_000_000;

const b64url = (bytes: ArrayBuffer | Uint8Array | string) => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let pair: CryptoKeyPair;
let jwk: JsonWebKey;
const fetcher = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256' }] }))) as unknown as typeof fetch;

async function token(payload: Record<string, unknown>, kid = 'k1', key: CryptoKey = pair.privateKey) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
const request = (jwt?: string) => new Request('https://x/api/sync/manifest', { headers: jwt ? { 'cf-access-jwt-assertion': jwt } : {} });
const env = { DB: undefined as never, TEAM_DOMAIN: TEAM, POLICY_AUD: AUD };
const good = { aud: [AUD], iss: TEAM, exp: NOW + 600, sub: 'user-1' };

beforeAll(async () => {
  pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});
beforeEach(() => resetAccessKeyCache());

describe('Access token check', () => {
  it('accepts a valid token and names the owner', async () => {
    expect(await checkAccess(request(await token(good)), env, fetcher, NOW)).toEqual({ ok: true, owner: 'user-1' });
  });

  it('refuses a request with no token, or a malformed one', async () => {
    expect((await checkAccess(request(), env, fetcher, NOW)).ok).toBe(false);
    expect((await checkAccess(request('not.a.jwt'), env, fetcher, NOW)).ok).toBe(false);
  });

  it('refuses the wrong audience, issuer, an expired token and an unknown key', async () => {
    expect((await checkAccess(request(await token({ ...good, aud: ['other'] })), env, fetcher, NOW)).ok).toBe(false);
    expect((await checkAccess(request(await token({ ...good, iss: 'https://evil.example' })), env, fetcher, NOW)).ok).toBe(false);
    expect((await checkAccess(request(await token({ ...good, exp: NOW - 1 })), env, fetcher, NOW)).ok).toBe(false);
    expect((await checkAccess(request(await token(good, 'unknown-kid')), env, fetcher, NOW)).ok).toBe(false);
  });

  it('refuses a token signed with a different key', async () => {
    const other = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    expect((await checkAccess(request(await token(good, 'k1', other.privateKey)), env, fetcher, NOW)).ok).toBe(false);
  });

  it('refuses a token whose payload was changed after signing', async () => {
    const jwt = await token(good);
    const [head, , sig] = jwt.split('.');
    const forged = `${head}.${b64url(JSON.stringify({ ...good, sub: 'someone-else' }))}.${sig}`;
    expect((await checkAccess(request(forged), env, fetcher, NOW)).ok).toBe(false);
  });

  it('fails closed when it is not configured, and only skips the check when told to (development)', async () => {
    const unconfigured = await checkAccess(request(await token(good)), { DB: undefined as never }, fetcher, NOW);
    expect(unconfigured).toMatchObject({ ok: false, status: 500 });
    expect(await checkAccess(request(), { DB: undefined as never, ALLOW_UNAUTHENTICATED: 'true' }, fetcher, NOW)).toEqual({ ok: true, owner: 'local-development' });
    expect((await checkAccess(request(), { DB: undefined as never, ALLOW_UNAUTHENTICATED: 'yes' }, fetcher, NOW)).ok).toBe(false);
  });
});

describe('chunking', () => {
  it('cuts text into pieces that join back to the same text', () => {
    const text = 'å'.repeat(1000);
    const parts = chunkText(text, 300);
    expect(parts).toHaveLength(4);
    expect(parts.join('')).toBe(text);
    expect(chunkText('')).toEqual(['']);
  });
});
