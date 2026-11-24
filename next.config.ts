import type { NextConfig } from "next";

/**
 * GitHub Pages serves static files only, under /<repo-name>. `GITHUB_PAGES=true` (set by .github/workflows/pages.yml) builds
 * a static export with that base path; everything else (dev, a normal server) is unchanged.
 */
const isPagesBuild = process.env.GITHUB_PAGES === 'true';
const basePath = isPagesBuild ? (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '') : '';

const nextConfig: NextConfig = {
  ...(isPagesBuild ? { output: 'export' as const, trailingSlash: true, images: { unoptimized: true } } : {}),
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
