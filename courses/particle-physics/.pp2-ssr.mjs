import { createServer } from 'vite';
const server = await createServer({ configFile: './.pp2-vite.config.mjs', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
for (const m of process.argv.slice(2)) {
  try { await server.ssrLoadModule(m); console.log('OK', m); } catch (e) { console.log('FAIL', m, String(e.stack || e).split('\n').slice(0, 8).join('\n')); }
}
await server.close();
