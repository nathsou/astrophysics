import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' });
for (const c of ['26-the-higgs-mechanism','27-a-needle-in-a-haystack','28-the-statistics-of-discovery','30-measuring-the-higgs']) {
  try { await server.ssrLoadModule(`/content/chapters/${c}/index.md`); console.log(c,'loaded'); } catch (e) { console.log(c, 'ERR', e.message.split('\n')[0].slice(0,300)); }
}
await server.close(); process.exit(0);
