import { handleCatalog } from './catalog';
import { handleSync } from './sync';
import type { SyncEnv } from './types';

/**
 * Only /api/sync/*, /api/catalog/* and /api/admin/* reach this Worker (see run_worker_first in the Wrangler config); every other
 * path is a static file served by Cloudflare directly.
 */
const worker = {
  async fetch(request: Request, env: SyncEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith('/api/catalog/') || pathname.startsWith('/api/admin/')) return await handleCatalog(request, env);
      return await handleSync(request, env);
    } catch {
      return new Response(JSON.stringify({ error: 'The request failed.' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

export default worker;
