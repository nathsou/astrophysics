import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from './util.ts';
it.skipIf(!process.env.SCRATCH)('scratch', () => {
  const src = readFileSync(process.env.SCRATCH!, 'utf8');
  const t0 = performance.now();
  const r = run(src, false);
  console.log(r.msgs.join('\n') || 'OK', `\n(${(performance.now() - t0).toFixed(0)} ms)`);
});
