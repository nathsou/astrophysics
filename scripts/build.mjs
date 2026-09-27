import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const courses = ['astrophysics', 'cic', 'compiler-backends'];
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath = (process.env.COURSES_BASE_PATH ?? (repository ? `/${repository}` : '')).replace(/\/$/, '');

if (basePath && (!basePath.startsWith('/') || basePath.includes('..'))) {
  throw new Error('COURSES_BASE_PATH must be an absolute URL path without ".."');
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(root, 'site'), output, { recursive: true });

for (const course of courses) {
  const directory = join(root, 'courses', course);
  console.log(`\nBuilding ${course}...`);
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: directory,
    env: { ...process.env, COURSES_BASE_PATH: basePath },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  cpSync(join(directory, 'dist'), join(output, course), { recursive: true });
}

// Keep existing links to astrophysics chapters working after its homepage becomes the index.
for (const slug of readdirSync(join(output, 'astrophysics', 'ch'))) {
  const destination = join(output, 'ch', slug);
  mkdirSync(destination, { recursive: true });
  const target = `../../astrophysics/ch/${slug}/`;
  writeFileSync(join(destination, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Course chapter moved</title></head>
<body><p>This chapter moved to <a href="${target}">${target}</a>.</p></body></html>\n`);
}

console.log(`\nBuilt the index and ${courses.length} courses in ${output}`);
