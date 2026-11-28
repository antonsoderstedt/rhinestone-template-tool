#!/usr/bin/env node
// Makes a `wrangler d1 export` file restorable. The export writes the 300 000 character text chunks as one INSERT each, and D1/SQLite
// refuses a statement that long (about 100 KB). This rewrites every INSERT that is too long as a short INSERT followed by UPDATEs
// that append the rest of the long text, and puts a DROP TABLE IF EXISTS for every table first so the file replaces what is there.
//
//   node scripts/d1-restore-sql.mjs backup.sql > restore.sql
//
// Pure text in, text out. See docs/decisions/0066-d1-backup-and-restore.md.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The longest statement we write, in bytes. D1's limit is 100 000. */
export const MAX_STATEMENT_BYTES = 60_000;
/** How much of a long text goes into one piece, in bytes of the unescaped text (quotes at most double it). */
const PIECE_BYTES = 20_000;

const quote = (text) => `'${text.replace(/'/g, "''")}'`;

/** Splits `'a', 12, NULL, 'it''s'` into raw tokens, keeping each token as written. Returns null when the text is not a plain values list. */
function tokenize(values) {
  const tokens = [];
  let i = 0;
  while (i < values.length) {
    while (values[i] === ' ') i++;
    if (i >= values.length) break;
    let end = i;
    if (values[i] === "'") {
      end = i + 1;
      for (;;) {
        if (end >= values.length) return null;
        if (values[end] === "'") {
          if (values[end + 1] === "'") end += 2;
          else break;
        } else end++;
      }
      end++;
    } else {
      while (end < values.length && values[end] !== ',') end++;
    }
    tokens.push(values.slice(i, end).trim());
    i = end;
    while (values[i] === ' ') i++;
    if (values[i] === ',') i++;
    else if (i < values.length) return null;
  }
  return tokens;
}

/** Cuts a text into pieces of at most `bytes` UTF-8 bytes, never in the middle of a character. */
function pieces(text, bytes) {
  const out = [];
  let current = '';
  let size = 0;
  for (const ch of text) {
    const n = Buffer.byteLength(ch);
    if (size + n > bytes) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  if (current) out.push(current);
  return out;
}

/** One statement, as written (a single INSERT that is short enough is returned as it is). */
export function splitStatement(line) {
  if (Buffer.byteLength(line) <= MAX_STATEMENT_BYTES) return [line];
  const match = /^INSERT INTO "([A-Za-z_]+)" \(([^)]*)\) VALUES ?\((.*)\);$/s.exec(line);
  if (!match) throw new Error(`A statement is too long and is not a plain INSERT: ${line.slice(0, 80)}...`);
  const [, table, columnList, valueList] = match;
  const columns = columnList.split(',').map((c) => c.trim());
  const tokens = tokenize(valueList);
  if (!tokens || tokens.length !== columns.length) throw new Error(`Cannot read the values of an INSERT into ${table}.`);

  // The one long text is the column that gets cut; every other column identifies the row for the UPDATEs.
  let longIndex = 0;
  tokens.forEach((t, i) => {
    if (t.length > tokens[longIndex].length) longIndex = i;
  });
  const long = tokens[longIndex];
  if (!long.startsWith("'")) throw new Error(`The long value in ${table} is not text.`);
  const parts = pieces(long.slice(1, -1).replace(/''/g, "'"), PIECE_BYTES);

  const firstTokens = tokens.map((t, i) => (i === longIndex ? quote(parts[0]) : t));
  const out = [`INSERT INTO "${table}" (${columnList}) VALUES(${firstTokens.join(',')});`];
  const where = columns
    .map((c, i) => (i === longIndex ? null : tokens[i] === 'NULL' ? `${c} IS NULL` : `${c} = ${tokens[i]}`))
    .filter(Boolean)
    .join(' AND ');
  const col = columns[longIndex];
  for (const part of parts.slice(1)) out.push(`UPDATE "${table}" SET ${col} = ${col} || ${quote(part)} WHERE ${where};`);
  return out;
}

/** The statements of an SQL text: split at a semicolon outside quotes, so a line break inside a text value does not matter. */
export function statementsOf(sql) {
  const out = [];
  let start = 0;
  let inText = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inText = !inText; // a doubled quote flips twice
    else if (c === ';' && !inText) {
      const statement = sql.slice(start, i + 1).trim();
      if (statement) out.push(statement);
      start = i + 1;
    }
  }
  const rest = sql.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** The whole export: DROP TABLE for every table first, then every statement, long ones split. */
export function restorableSql(exportSql) {
  const statements = statementsOf(exportSql);
  const drops = [];
  for (const statement of statements) {
    const m = /^CREATE TABLE "?([A-Za-z_]+)"? /.exec(statement);
    if (m) drops.push(`DROP TABLE IF EXISTS "${m[1]}";`);
  }
  if (drops.length === 0) throw new Error('The file has no tables: it is not a backup.');
  const body = statements.flatMap(splitStatement);
  return [...drops, ...body, ''].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/d1-restore-sql.mjs backup.sql > restore.sql');
    process.exit(1);
  }
  process.stdout.write(restorableSql(readFileSync(file, 'utf8')));
}
