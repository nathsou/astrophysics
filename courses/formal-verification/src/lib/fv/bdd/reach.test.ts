import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime } from '../vouch/interp/system';
import { explore } from '../explore/explorer';
import { Reachability, reachVerdicts } from './reach';

const load = (src: string) => {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('\n'));
  return c;
};
const example = (name: string) => readFileSync(new URL(`../vouch/examples/${name}.vouch`, import.meta.url), 'utf8');

function agree(src: string) {
  const c = load(src);
  for (const d of c.program.decls) {
    if (d.k !== 'system') continue;
    const x = explore(new SystemRuntime(c, d.name), { stopAtFirst: false });
    const reach = new Reachability(new SystemRuntime(c, d.name));
    const r = reach.run({ timeout: 60000 });
    expect(r.done).toBe(true);
    const anyViolation = x.verdicts.some((v) => v.status === 'violated');
    if (!anyViolation) expect(Number(r.states)).toBe(x.exploration.size);
    const vs = reachVerdicts(new SystemRuntime(c, d.name), r);
    for (const v of x.verdicts) {
      if (v.subject === 'no deadlock') continue;
      const w = vs.find((y) => y.subject === v.subject)!;
      expect(w.status, `${d.name} ${v.subject}`).toBe(v.status === 'violated' ? 'violated' : 'verified');
      if (w.status === 'verified') expect(w.certificate.checked).toBe(true);
      if (w.status === 'violated') {
        expect(w.trace?.steps.length).toBe(v.trace?.steps.length);
        expect(w.badge.kind === 'violated' && w.badge.replayed).toBe(true);
      }
    }
  }
}

describe('symbolic reachability', () => {
  it('agrees with the explorer on the examples', () => {
    agree(example('die-hard'));
    agree(example('hyman'));
    agree(example('peterson'));
    agree(example('two-phase-commit'));
  });
  it('counts states far beyond explicit search', () => {
    const c = load(`system Switches {
  type Switch
  instance Switch = 40
  var on: Switch -> bool = false
  action flip(s: Switch) { on[s] = !on[s] }
  invariant fine: true
}`);
    const reach = new Reachability(new SystemRuntime(c, 'Switches'));
    const r = reach.run({ timeout: 60000 });
    expect(r.states).toBe(2n ** 40n);
    expect(r.iterations.at(-1)!.reachNodes).toBeLessThan(10);
  });
});
