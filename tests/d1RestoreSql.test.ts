import { describe, expect, it } from 'vitest';
import { MAX_STATEMENT_BYTES, restorableSql, splitStatement, statementsOf } from '../scripts/d1-restore-sql.mjs';

const longInsert = (text: string, key = "'k'") => `INSERT INTO "chunks" ("id","n","data") VALUES(${key},0,'${text.replace(/'/g, "''")}');`;

/** Runs the statements the way a database would for these two shapes only, so the test can check that the text comes back whole. */
function rebuild(statements: string[]): string {
  let data = '';
  for (const s of statements) {
    const insert = /^INSERT INTO "chunks" \("id","n","data"\) VALUES\('k',0,'([\s\S]*)'\);$/.exec(s);
    if (insert) data = insert[1].replace(/''/g, "'");
    const update = /^UPDATE "chunks" SET "data" = "data" \|\| '([\s\S]*)' WHERE "id" = 'k' AND "n" = 0;$/.exec(s);
    if (update) data += update[1].replace(/''/g, "'");
  }
  return data;
}

describe('splitting an export for restore (ADR 0066)', () => {
  it('leaves a short statement as it is', () => {
    const s = longInsert('short');
    expect(splitStatement(s)).toEqual([s]);
  });

  it('splits a statement that is too long and the text comes back whole', () => {
    const text = 'abc"{}[]\n,;'.repeat(30000);
    const parts = splitStatement(longInsert(text));
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(Buffer.byteLength(p)).toBeLessThanOrEqual(MAX_STATEMENT_BYTES);
    expect(rebuild(parts)).toBe(text);
  });

  it('keeps quotes and characters of several bytes intact across the cuts', () => {
    const text = "it's å ä ö 𝄞 ".repeat(20000);
    expect(rebuild(splitStatement(longInsert(text)))).toBe(text);
  });

  it('refuses a long statement it does not understand', () => {
    expect(() => splitStatement(`DELETE FROM x WHERE a = '${'x'.repeat(70000)}';`)).toThrow();
  });

  it('splits at a semicolon outside quotes only', () => {
    expect(statementsOf("INSERT INTO t VALUES('a;\nb');\nINSERT INTO t VALUES('it''s;');\n")).toEqual([
      "INSERT INTO t VALUES('a;\nb');",
      "INSERT INTO t VALUES('it''s;');",
    ]);
  });

  it('puts a DROP for every table first and keeps every statement', () => {
    const sql = `CREATE TABLE a (x TEXT);\nCREATE TABLE "b" (y TEXT);\nINSERT INTO "a" ("x") VALUES('1');\n`;
    const out = restorableSql(sql).split('\n');
    expect(out.slice(0, 2)).toEqual(['DROP TABLE IF EXISTS "a";', 'DROP TABLE IF EXISTS "b";']);
    expect(out).toContain('CREATE TABLE a (x TEXT);');
    expect(out).toContain(`INSERT INTO "a" ("x") VALUES('1');`);
  });

  it('refuses a file with no tables', () => {
    expect(() => restorableSql('SELECT 1;')).toThrow(/no tables/);
  });
});
