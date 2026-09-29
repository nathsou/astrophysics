// Install every course's dependencies, build the index and all courses, then serve dist/ locally.
//
//   npm run preview                 install + build + serve on http://localhost:8000
//   npm run preview -- --skip-install   reuse existing node_modules
//   npm run preview -- --skip-build     only serve an existing dist/
//   npm run preview -- --port 3000
import { createReadStream, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT ?? 8000);

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${[command, ...commandArgs].join(' ')}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!flag('skip-build')) {
  if (!flag('skip-install')) {
    for (const course of ['astrophysics', 'cic', 'compiler-backends', 'incompleteness', 'proofs']) {
      run('npm', ['ci', '--prefix', `courses/${course}`]);
    }
    run('pnpm', ['--dir', 'courses/language-models', 'install', '--frozen-lockfile']);
  }
  run('npm', ['run', 'build']);
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found; run without --skip-build first.');
  process.exit(1);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (file !== dist && !file.startsWith(dist + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) file = join(dist, '404.html');
  const found = existsSync(file);
  response.writeHead(found && !file.endsWith('404.html') ? 200 : 404, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
  });
  if (found) createReadStream(file).pipe(response);
  else response.end('Not found');
}).listen(port, () => console.log(`\nServing dist/ at http://localhost:${port}/  (Ctrl+C to stop)`));
