import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from './util.ts';
it.skipIf(!process.env.SCRATCH)('scratch', () => {
  const src = readFileSync(process.env.SCRATCH!, 'utf8');
  const t0 = performance.now();
  const r = run(src, false);
  for (const c of r.results) {
    const o = c.output;
    const line = src.slice(0, c.span.from).split('\n').length;
    if (o?.k === 'eval') console.log(`#eval (line ${line}): ${o.value}   [${o.steps} steps, ${o.ms.toFixed(1)} ms]`);
    if (o && o.k !== 'eval' && o.k !== 'test') console.log(`${o.k} (line ${line}): ${JSON.stringify(o).slice(0, 300)}`);
    if (o?.k === 'test') console.log(`#test (line ${line}): ${o.counterexample ? 'FAILED ' + JSON.stringify(o.counterexample) : `passed ${o.passed}/${o.samples}`}`);
  }
  console.log(r.msgs.join('\n') || 'OK', `\n(${(performance.now() - t0).toFixed(0)} ms)`);
});
