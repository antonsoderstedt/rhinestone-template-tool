import { handleSync } from './sync';
import type { SyncEnv } from './types';

/**
 * Only /api/sync/* reaches this Worker (see run_worker_first in the Wrangler config); every other path is a static file served
 * by Cloudflare directly.
 */
const worker = {
  async fetch(request: Request, env: SyncEnv): Promise<Response> {
    try {
      return await handleSync(request, env);
    } catch {
      return new Response(JSON.stringify({ error: 'Sync failed.' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

export default worker;
