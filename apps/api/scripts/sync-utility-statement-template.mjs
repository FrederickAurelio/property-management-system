/** Copy the virgin xlsx into dist/assets (nest watch can leave a 0-byte stub). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets', 'utility-statement.xlsx');
const dest = path.join(root, 'dist', 'assets', 'utility-statement.xlsx');

if (!fs.existsSync(src)) {
  console.warn(`skip sync: missing ${src}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`synced ${dest} (${fs.statSync(src).size} bytes)`);
