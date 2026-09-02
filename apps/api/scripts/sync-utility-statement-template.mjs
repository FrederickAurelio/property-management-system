/** Repair source template, then copy into dist/assets (nest watch can leave a 0-byte stub). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const patchScript = path.join(root, 'scripts', 'patch-utility-statement-template.mjs');
const patch = spawnSync(process.execPath, [patchScript], { stdio: 'inherit' });
if (patch.status !== 0) {
  process.exit(patch.status ?? 1);
}

const src = path.join(root, 'assets', 'utility-statement.xlsx');
const dest = path.join(root, 'dist', 'assets', 'utility-statement.xlsx');

if (!fs.existsSync(src)) {
  console.warn(`skip sync: missing ${src}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`synced ${dest} (${fs.statSync(dest).size} bytes)`);
