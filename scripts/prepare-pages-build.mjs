// Run by the Pages workflow before `next build`, in the CI checkout only. A static site cannot answer these routes (they read
// font and alphabet libraries from the machine, and use query strings), and the libraries are not in the repository anyway.
// The app already copes with them missing ("library not available on this deployment").
import { rmSync, existsSync } from 'node:fs';

for (const dir of ['app/api/rhinestone-fonts', 'app/api/svg-alphabets']) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`removed ${dir} for the static build`);
  }
}
