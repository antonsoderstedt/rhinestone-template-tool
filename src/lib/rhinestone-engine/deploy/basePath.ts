/**
 * Puts the site's base path (`/repo-name` on GitHub Pages, nothing elsewhere) in front of an absolute path.
 *
 * Next adds the base path to its own links and assets, but not to addresses the app builds itself (`fetch('/api/...')`,
 * `<img src="/...">`, `location.assign`). Those go through here. The base path is a build-time constant
 * (`NEXT_PUBLIC_BASE_PATH`), so the result is the same every time.
 */
export function withBasePath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
  return base && path.startsWith('/') && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
}
