// Refreshes the vendored upstream LaTeX sources in upstream/ from local checkouts.
//
//   npm run upstream:sync -- --openlogic ../OpenLogic --ic ../incompleteness-computability
//
// Every path pattern listed in upstream/UPSTREAM.json is copied from the checkout, files that
// disappeared upstream are removed, and the pinned commit is updated. Afterwards run
// `npm run convert` and review the diff of src/content/source/: the converter reports any new
// macros or environments it does not understand.

import { cpSync, existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'upstream', 'UPSTREAM.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  repositories: Record<string, { url: string; commit: string; paths: string[] }>;
};

const flags: Record<string, string> = { openlogic: 'OpenLogic', ic: 'incompleteness-computability' };
const args = process.argv.slice(2);
const checkouts = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  const name = flags[args[i].replace(/^--/, '')];
  if (!name || !args[i + 1]) throw new Error(`usage: sync-upstream --openlogic <dir> --ic <dir>`);
  checkouts.set(name, resolve(args[i + 1]));
}
if (checkouts.size === 0) throw new Error('usage: sync-upstream --openlogic <dir> --ic <dir>');

for (const [name, source] of checkouts) {
  const repo = manifest.repositories[name];
  const target = join(root, 'upstream', name);
  const before = new Set(repo.paths.flatMap((p) => globSync(p, { cwd: target })));
  const after = new Set<string>();
  for (const pattern of repo.paths) {
    for (const file of globSync(pattern, { cwd: source })) {
      mkdirSync(dirname(join(target, file)), { recursive: true });
      cpSync(join(source, file), join(target, file));
      after.add(file);
    }
  }
  for (const file of before) if (!after.has(file) && existsSync(join(target, file))) rmSync(join(target, file));
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  console.log(`${name}: ${after.size} files, ${repo.commit.slice(0, 10)} → ${commit.slice(0, 10)}`);
  repo.commit = commit;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
