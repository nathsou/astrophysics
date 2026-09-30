import { test } from 'vitest';
import { generate } from '../gen/index.ts';
import { rng } from '../random/index.ts';
import { particle } from '../particles/index.ts';
test('gen integration', () => {
  let out = '';
  for (const name of ['pp->H->gammagamma', 'pp->Z->mumu']) {
    const ev = generate(name, { sqrtS: 13000, seed: 3 }, rng(5));
    const by = new Map<string, number>();
    for (const p of ev.particles) by.set(p.status + ':' + (p.collision ?? 0), (by.get(p.status + ':' + (p.collision ?? 0)) ?? 0) + 1);
    out += name + ' ' + JSON.stringify([...by]) + ' nPV ' + ev.primaryVertices.length + '\n';
    out += ev.particles.slice(0, 12).map((p) => `${p.id}:${particle(p.pdg).name}/${p.status}/E=${p.p.E.toFixed(1)}/m=${JSON.stringify(p.mothers)}`).join('\n') + '\n';
  }
  process.stdout.write(out);
});
