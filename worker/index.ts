import { handleCatalog } from './catalog';
import { handleSync } from './sync';
import { handleTrack } from './track';
import type { SyncEnv } from './types';

/** The admin paths that belong to statistics and tracking; the rest of /api/admin/* is the template catalog. */
const TRACK_ADMIN_PATHS: ReadonlySet<string> = new Set(['/api/admin/tracking', '/api/admin/stats', '/api/admin/events']);

/**
 * Only /api/sync/*, /api/catalog/*, /api/track/* and /api/admin/* reach this Worker (see run_worker_first in the Wrangler config); every other
 * path is a static file served by Cloudflare directly.
 */
const worker = {
  async fetch(request: Request, env: SyncEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith('/api/track/') || TRACK_ADMIN_PATHS.has(pathname)) return await handleTrack(request, env);
      if (pathname.startsWith('/api/catalog/') || pathname.startsWith('/api/admin/')) return await handleCatalog(request, env);
      return await handleSync(request, env);
    } catch {
      return new Response(JSON.stringify({ error: 'The request failed.' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

export default worker;
