import { describe, expect, it } from 'vitest';
import { MAX_SHARE_LINK_CHARS, buildShareLink, decodeSharePayload, encodeSharePayload, readSharePayload } from '../app/lib/shareLink';

const project = JSON.stringify({ schemaVersion: 1, projectName: 'Åsa ✨ design', note: 'x'.repeat(2000) });

describe('share link (plan F4)', () => {
  it('round-trips a design, including non-ASCII text', async () => {
    const payload = await encodeSharePayload(project);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeSharePayload(payload)).toBe(project);
  });

  it('compresses, so a design is much shorter in the link than in the file', async () => {
    expect((await encodeSharePayload(project)).length).toBeLessThan(project.length / 4);
  });

  it('puts the design after the # so it is never sent to a server', async () => {
    const result = await buildShareLink(project, 'https://example.test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const url = new URL(result.url);
      expect(url.search).toBe('');
      expect(url.pathname).toBe('/rhinestone');
      expect(readSharePayload(url.hash)).not.toBeNull();
    }
  });

  it('says when the design is too big for a link', async () => {
    // Random-looking text does not compress.
    let x = 123456789;
    const next = () => {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return x;
    };
    const noise = Array.from({ length: 120_000 }, () => String.fromCharCode(33 + (next() % 94))).join('');
    const result = await buildShareLink(JSON.stringify({ noise }), 'https://example.test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.chars).toBeGreaterThan(MAX_SHARE_LINK_CHARS);
  });

  it('refuses a payload that is not one of ours with a message to show', async () => {
    await expect(decodeSharePayload('not-a-valid-payload!!')).rejects.toThrow(/damaged/);
    await expect(decodeSharePayload('AAAA')).rejects.toThrow(/damaged/);
  });

  it('reads only a well-formed hash', () => {
    expect(readSharePayload('#share=abc_DEF-123')).toBe('abc_DEF-123');
    expect(readSharePayload('#other=abc')).toBeNull();
    expect(readSharePayload('#share=a b')).toBeNull();
    expect(readSharePayload('')).toBeNull();
  });
});
