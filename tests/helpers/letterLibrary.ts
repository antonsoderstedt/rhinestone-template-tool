import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The vendor letter/font library (`LETTER UTVALDA`, `FONT GENERATED CHATGPT`) is large, licensed material that is
 * not in the repository. It lives on the developer's machine, in the same places the loaders search
 * (`src/lib/rhinestone-engine/rhinestoneFont/fontLibraryPath.ts`, `svgAlphabet/svgAlphabetPath.ts`).
 * Tests that read real library files use `it.skipIf(!HAS_LETTER_LIBRARY)` so CI, which has no library, skips them
 * instead of failing; on a machine that has the library they run as before.
 */
const LIBRARY_ROOTS = [
  process.env.RHINESTONE_FONT_LIBRARY_DIR,
  join(homedir(), 'Desktop', 'LETTER UTVALDA'),
  join(process.cwd(), 'public', 'fonts', 'rhinestone-library'),
];

export const HAS_LETTER_LIBRARY = LIBRARY_ROOTS.some((root) => typeof root === 'string' && root.length > 0 && existsSync(root));
