import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
/**
 * Each course builds into its own output directory. Most are npm projects built with
 * `npm run build` into `dist/`; language-models is a pnpm workspace (site + library + Python
 * training) whose SvelteKit site builds into `course/build/` and takes its base path from BASE_PATH,
 * and proofs is a SvelteKit site that builds into `dist/` and also takes BASE_PATH.
 */
const courses = [
  { name: 'astrophysics' },
  { name: 'cic' },
  { name: 'proofs-are-programs' },
  { name: 'compiler-backends' },
  { name: 'incompleteness' },
  { name: 'elements' },
  {
    name: 'language-models',
    command: ['pnpm', ['--filter', 'course', 'build']],
    output: 'course/build',
    env: (base) => ({
      BASE_PATH: `${base}/language-models`,
      // Its SvelteKit config imports TypeScript directly; Node 22 needs type stripping switched on.
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --experimental-strip-types`.trim(),
    }),
  },
  {
    // Proofcraft is a single-package SvelteKit site that builds into dist/ with BASE_PATH.
    name: 'proofs',
    env: (base) => ({
      BASE_PATH: `${base}/proofs`,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --experimental-strip-types`.trim(),
    }),
  },
];
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath = (process.env.COURSES_BASE_PATH ?? (repository ? `/${repository}` : '')).replace(/\/$/, '');

if (basePath && (!basePath.startsWith('/') || basePath.includes('..'))) {
  throw new Error('COURSES_BASE_PATH must be an absolute URL path without ".."');
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(root, 'site'), output, { recursive: true });

for (const course of courses) {
  const directory = join(root, 'courses', course.name);
  const [command, args] = course.command ?? ['npm', ['run', 'build']];
  console.log(`\nBuilding ${course.name}...`);
  const result = spawnSync(command, args, {
    cwd: directory,
    env: { ...process.env, COURSES_BASE_PATH: basePath, ...course.env?.(basePath) },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  cpSync(join(directory, course.output ?? 'dist'), join(output, course.name), { recursive: true });
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
