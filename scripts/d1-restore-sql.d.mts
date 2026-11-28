export const MAX_STATEMENT_BYTES: number;
export function statementsOf(sql: string): string[];
export function splitStatement(statement: string): string[];
export function restorableSql(exportSql: string): string;
