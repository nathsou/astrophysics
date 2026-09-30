import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { run } from './util.ts';
import { pp } from '@kernel/core/pretty.ts';
it.skipIf(!process.env.SCRATCH)('steps', () => {
  const src = readFileSync(process.env.SCRATCH!, 'utf8');
  const r = run(src, false);
  console.log(r.msgs.join('\n') || 'OK');
  for (const s of r.tactics) {
    console.log(`--- ${s.kind} [${src.slice(s.span.from, s.span.to).replace(/\n/g, ' ')}]`);
    for (const g of s.after) console.log(`   after: ${g.tag ?? ''} ⊢ ${pp(r.env, g.type, g.lctx)}`);
    console.log(`   term: ${pp(r.env, s.term, s.lctx)}`);
  }
});
