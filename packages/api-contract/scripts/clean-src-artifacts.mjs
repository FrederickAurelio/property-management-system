#!/usr/bin/env node
/** Remove accidental tsc emit next to package source (IDE / wrong cwd). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const artifact = /\.(js|js\.map|d\.ts)$/;

for (const name of fs.readdirSync(srcDir)) {
  if (artifact.test(name)) {
    fs.unlinkSync(path.join(srcDir, name));
  }
}
