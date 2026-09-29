import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from './util.ts';
import { eraseEquation } from '@kernel/eval/erase.ts';
it.skipIf(!process.env.SCRATCH)('erase', () => {
  const r = run(readFileSync(process.env.SCRATCH!, 'utf8'), false);
  for (const n of (process.env.NAMES ?? '').split(',')) {
    for (const q of r.env.equations.get(n) ?? []) console.log(eraseEquation(r.env, r.env.get(q)!.type));
  }
});
