#!/usr/bin/env node
/**
 * Fetch the trained models' weights into course/static/weights/, where the site serves them.
 *
 * Weights are too large for git, so they live as assets of a GitHub release and are listed, with their
 * SHA-256 hashes, in course/content/weights.json. The course build runs this script first; files that
 * are already present with the right hash are kept. On CI a failed download fails the build; locally
 * it only warns, and the widgets that need the weights say they are unavailable.
 *
 *   node scripts/weights.mjs            # fetch what is missing
 *   node scripts/weights.mjs --hash     # print the hashes and sizes of the local files (for the manifest)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadBytes } from './download.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'course', 'static', 'weights');
const manifest = JSON.parse(readFileSync(join(root, 'course', 'content', 'weights.json'), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

if (process.argv.includes('--hash')) {
  for (const file of manifest.files) {
    const path = join(dest, file.name);
    if (!existsSync(path)) continue;
    const bytes = readFileSync(path);
    console.log(`${file.name}: { "bytes": ${bytes.length}, "sha256": "${sha256(bytes)}" }`);
  }
  process.exit(0);
}

let failed = false;
mkdirSync(dest, { recursive: true });
for (const file of manifest.files) {
  const path = join(dest, file.name);
  if (existsSync(path) && sha256(readFileSync(path)) === file.sha256) continue;
  const url = `${manifest.release}/${file.name}`;
  try {
    console.log(`weights: downloading ${file.name} (${(file.bytes / 1e6).toFixed(0)} MB)`);
    const bytes = await downloadBytes(url);
    if (sha256(bytes) !== file.sha256) throw new Error('SHA-256 mismatch');
    writeFileSync(`${path}.part`, bytes);
    renameSync(`${path}.part`, path);
  } catch (e) {
    failed = true;
    console.warn(`weights: could not fetch ${url}: ${e instanceof Error ? e.message : e}`);
  }
}
if (failed && process.env.CI) process.exit(1);
