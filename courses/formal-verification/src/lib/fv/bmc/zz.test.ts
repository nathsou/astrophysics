import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime } from '../vouch/interp/system';
import { bmc } from './bmc';
it('x', () => {
  for (const n of ['die-hard', 'hyman', 'peterson', 'two-phase-commit']) {
    const c = check(parse(readFileSync(`src/lib/fv/vouch/examples/${n}.vouch`, 'utf8')).program);
    for (const d of c.program.decls) if (d.k === 'system') {
      const r = bmc(new SystemRuntime(c, d.name), { maxK: 10, timeout: 30000 });
      console.log(n, d.name, JSON.stringify(r.properties.map((p) => [p.name, p.foundAt, p.replayed, p.labels?.map((l) => l.text).join('; ')])), 'reached', r.reached, JSON.stringify(r.bounds.at(-1)), r.bounds.reduce((a, b) => a + b.ms, 0), 'ms');
    }
  }
}, 120000);
