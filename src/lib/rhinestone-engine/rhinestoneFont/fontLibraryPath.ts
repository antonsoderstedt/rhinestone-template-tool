import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RhinestoneFontDefinition } from './rhinestoneFontRegistry';
import type { StoneSizeId } from '../types/index';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const LOCAL_PUBLIC_RHINESTONE_LIBRARY_DIR = join(
  dirname(CURRENT_FILE_PATH),
  '../../../../public/fonts/rhinestone-library',
);

function getLibraryRoots(): string[] {
  const roots = [
    process.env.RHINESTONE_FONT_LIBRARY_DIR,
    join(homedir(), 'Desktop', 'LETTER UTVALDA'),
    LOCAL_PUBLIC_RHINESTONE_LIBRARY_DIR,
  ];
  return roots.filter((root): root is string => typeof root === 'string' && root.length > 0);
}

export function resolveRhinestoneFontFilePath(
  definition: RhinestoneFontDefinition,
  targetStoneSizeId?: StoneSizeId,
): string | null {
  if (definition.nodeFilePath && existsSync(definition.nodeFilePath)) {
    return definition.nodeFilePath;
  }

  const sizedPath = targetStoneSizeId ? definition.libraryRelativePathBySize?.[targetStoneSizeId] : undefined;
  const relativePath = sizedPath ?? definition.libraryRelativePath;

  if (relativePath) {
    for (const root of getLibraryRoots()) {
      const candidate = join(root, relativePath);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function getRhinestoneFontContentType(resolvedPath: string): string {
  const extension = extname(resolvedPath).toLowerCase();
  if (extension === '.ttf') return 'font/ttf';
  if (extension === '.woff') return 'font/woff';
  if (extension === '.woff2') return 'font/woff2';
  return 'font/otf';
}