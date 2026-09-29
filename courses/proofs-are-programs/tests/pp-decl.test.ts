import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from './util.ts';
import { pp } from '@kernel/core/pretty.ts';
it.skipIf(!process.env.F)('pp', () => {
  const r = run(readFileSync(process.env.F!, 'utf8'), false);
  for (const n of process.env.N!.split(',')) { const d = r.env.get(n) as any; console.log(n, ':=', pp(r.env, d.value)); }
});
