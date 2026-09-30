import { test } from 'vitest';
import { rng } from '../random/index.ts';
import { fragmentString, defaultLund } from '../hadronise/index.ts';
test('x', () => {
  const r = rng(1);
  let out = '';
  for (const W of [3, 10, 30, 100]) {
    const N = 20000;
    let nh = 0;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) nh += fragmentString(r, W, [2], [-2], defaultLund).hadrons.length;
    const dt = performance.now() - t0;
    out += `W=${W}: ${(dt / N * 1000).toFixed(1)} us per string, ${nh / N} hadrons\n`;
  }
  process.stdout.write(out);
});
