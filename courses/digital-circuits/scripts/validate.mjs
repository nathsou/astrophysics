#!/usr/bin/env node
/**
 * Entry point of the validation scripts (docs/AUTHORING.md, *Validation*):
 *
 *   node scripts/validate.mjs gal | yosys | rv32i [arguments…]
 *
 * They run outside CI against external tools. Each says `skipped: <tool> not found — …` and exits 0 when its
 * tool is missing, and exits 1 on a real mismatch. The logic is TypeScript in `tools/validate/`, loaded here
 * through Vite (the same transform as the tests, with the `$lib` alias), so no extra packages are needed.
 */
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const [name, ...args] = process.argv.slice(2);
const scripts = { gal: 'gal', yosys: 'yosys', rv32i: 'rv32i' };
if (!name || !(name in scripts)) {
  console.error(`usage: node scripts/validate.mjs ${Object.keys(scripts).join(' | ')} [arguments…]`);
  process.exit(2);
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)), $content: fileURLToPath(new URL('../content', import.meta.url)) } },
  ssr: { noExternal: true },
});
let status = 1;
try {
  const mod = await server.ssrLoadModule(`/tools/validate/${scripts[name]}.ts`);
  status = await mod.main({ args });
} catch (e) {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
} finally {
  await server.close();
}
process.exit(status);
