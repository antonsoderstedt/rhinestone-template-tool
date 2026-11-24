// The few Cloudflare types the sync Worker uses, declared here so the project does not need the full Workers type package.

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface SyncEnv {
  DB: D1Database;
  /** https://<team>.cloudflareaccess.com */
  TEAM_DOMAIN?: string;
  /** The Access application's audience tag. */
  POLICY_AUD?: string;
  /** Local development only: skip the Access check. */
  ALLOW_UNAUTHENTICATED?: string;
}
