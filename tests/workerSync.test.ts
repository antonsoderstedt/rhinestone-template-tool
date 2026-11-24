import { beforeEach, describe, expect, it } from 'vitest';
import { handleSync, resetSchemaFlag } from '../worker/sync';
import type { D1Database, D1PreparedStatement } from '../worker/types';

/** Just enough of a database for the routes under test: it records what is written and finds nothing. */
function fakeDb() {
  const written: string[] = [];
  const statement = (query: string): D1PreparedStatement => {
    const self: D1PreparedStatement = {
      bind: () => self,
      run: async () => undefined,
      all: async () => ({ results: [] }),
      first: async () => null,
    };
    (self as unknown as { query: string }).query = query;
    return self;
  };
  const db: D1Database = {
    prepare: (query) => statement(query),
    batch: async (statements) => { written.push(...statements.map((s) => (s as unknown as { query: string }).query.split(' ').slice(0, 3).join(' '))); return []; },
  };
  return { db, written };
}

const env = (db: D1Database) => ({ DB: db, ALLOW_UNAUTHENTICATED: 'true' });
const put = (qs: string, body = '') => new Request(`https://x/api/sync/item?${qs}`, { method: 'PUT', body });
const T = 'updatedAt=2026-11-24T10:00:00.000Z';

describe('sync API rules', () => {
  beforeEach(() => resetSchemaFlag());

  it('refuses to delete the settings, the language or the unit, and writes nothing', async () => {
    for (const id of ['workspace', 'language', 'unit']) {
      const { db, written } = fakeDb();
      const response = await handleSync(put(`kind=settings&id=${id}&${T}&deleted=1`), env(db));
      expect(response.status, id).toBe(400);
      expect(written.some((q) => q.startsWith('INSERT') || q.startsWith('DELETE')), id).toBe(false);
    }
  });

  it('still lets a calibration choice, or anything else, be deleted', async () => {
    const { db, written } = fakeDb();
    expect((await handleSync(put(`kind=settings&id=active-calibration&${T}&deleted=1`), env(db))).status).toBe(200);
    expect((await handleSync(put(`kind=template&id=t1&${T}&deleted=1`), env(db))).status).toBe(200);
    expect(written.some((q) => q.startsWith('INSERT INTO items'))).toBe(true);
  });

  it('refuses unknown kinds, bad ids and bad times', async () => {
    const { db } = fakeDb();
    expect((await handleSync(put(`kind=evil&id=x&${T}`, 'x'), env(db))).status).toBe(400);
    expect((await handleSync(put(`kind=template&id=a%20b&${T}`, 'x'), env(db))).status).toBe(400);
    expect((await handleSync(put('kind=template&id=t1&updatedAt=yesterday', 'x'), env(db))).status).toBe(400);
  });

  it('refuses everything without an Access token unless it is the local test setup', async () => {
    const { db } = fakeDb();
    const response = await handleSync(new Request('https://x/api/sync/manifest'), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'a' });
    expect(response.status).toBe(403);
  });
});
