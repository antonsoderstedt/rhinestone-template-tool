import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const LOCAL_PUBLIC_RHINESTONE_LIBRARY_DIR = join(
  dirname(CURRENT_FILE_PATH),
  '../../../../public/fonts/rhinestone-library',
);

export function getSvgAlphabetLibraryRoots(): string[] {
  const roots = [
    process.env.RHINESTONE_FONT_LIBRARY_DIR,
    join(/* turbopackIgnore: true */ homedir(), 'Desktop', 'LETTER UTVALDA'),
    LOCAL_PUBLIC_RHINESTONE_LIBRARY_DIR,
  ];
  return roots.filter((root): root is string => typeof root === 'string' && root.length > 0);
}

export function isSvgAlphabetLibraryAvailable(): boolean {
  return getSvgAlphabetLibraryRoots().some((root) => existsSync(root));
}