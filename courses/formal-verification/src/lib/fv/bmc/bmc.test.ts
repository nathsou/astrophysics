import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime } from '../vouch/interp/system';
import { explore } from '../explore/explorer';
import { bmc, bmcVerdicts } from './bmc';

const load = (src: string) => {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('\n'));
  return c;
};
const example = (name: string) => readFileSync(new URL(`../vouch/examples/${name}.vouch`, import.meta.url), 'utf8');

/** Compare BMC with breadth-first exploration: same verdicts, same shortest counterexample lengths. */
function agree(src: string, maxK: number) {
  const c = load(src);
  for (const d of c.program.decls) {
    if (d.k !== 'system') continue;
    const rt = new SystemRuntime(c, d.name);
    if (!rt.info.invariants.length) continue;
    const x = explore(rt, { stopAtFirst: false });
    const run = bmc(new SystemRuntime(c, d.name), { maxK, timeout: 60000 });
    for (const v of x.verdicts) {
      const p = run.properties.find((q) => q.subject === v.subject);
      expect(p, `${d.name}: ${v.subject}`).toBeDefined();
      if (v.status === 'violated') {
        const len = (v.trace?.steps.length ?? 1) - 1;
        if (len <= maxK) {
          expect(p!.foundAt, `${d.name}: ${v.subject}`).toBe(len);
          expect(p!.replayed, `${d.name}: ${v.subject} replayed`).toBe(true);
        }
      } else {
        expect(p!.foundAt, `${d.name}: ${v.subject}`).toBeUndefined();
      }
    }
    const verdicts = bmcVerdicts(rt, run);
    expect(verdicts.length).toBe(run.properties.length);
  }
}

describe('bounded model checking', () => {
  it('agrees with the explorer on the Die Hard jugs', () => agree(example('die-hard'), 8));
  it('agrees with the explorer on Hyman and Peterson', () => {
    agree(example('hyman'), 10);
    agree(example('peterson'), 12);
  });
  it('agrees with the explorer on two-phase commit', () => agree(example('two-phase-commit'), 6));

  it('agrees on small hand-written systems', () => {
    agree(`system Counter {
  var x: 0..8 = 0
  var y: 0..8 = 0
  action inc_x when x < 7 { x = x + 1 }
  action inc_y when y < x { y = y + 1 }
  action reset when x == y && x > 2 { x = 0
    y = 0 }
  invariant small: x + y < 9
  invariant ordered: y <= x
}`, 12);
    agree(`enum Light { red, green, yellow }
system Lights {
  var ns: Light = red
  var ew: Light = green
  var t: 0..3 = 0
  action tick when t < 2 { t = t + 1 }
  action switch_ew when ew == green && t == 2 { ew = yellow
    t = 0 }
  action switch_ns when ew == yellow { ew = red
    ns = green }
  action back when ns == green && t == 2 { ns = red }
  invariant never_both_green: !(ns == green && ew == green)
  invariant one_red: ns == red || ew == red
}`, 10);
    agree(`system Bag {
  type Item
  instance Item = 3
  var bag: set<Item> = {}
  var taken: Item -> bool = false
  action put(i: Item) when !(i in bag) && !taken[i] { bag = bag + {i} }
  action take(i: Item) when i in bag { bag = bag - {i}
    taken[i] = true }
  invariant not_all: #bag < 3
  invariant consistent: forall i: Item :: !(i in bag && taken[i])
}`, 8);
  });

  it('finds run-time failures', () => {
    const c = load(`system Overflow {
  var x: 0..4 = 0
  action inc { x = x + 1 }
}`);
    const run = bmc(new SystemRuntime(c, 'Overflow'), { maxK: 8 });
    const f = run.properties.find((p) => p.name === 'failure')!;
    expect(f.foundAt).toBe(4);
    expect(f.replayed).toBe(true);
  });
});

describe('bit-vector systems', () => {
  it('finds inputs that make a 16-bit checksum zero, with symbolic inputs', () => {
    const c = load(`system Checksum {
  var acc: bv16 = 0x1d0f
  var n: 0..4 = 0
  action feed(word: bv16) when n < 3 {
    acc = (acc << 5) ^ (acc >> 11) ^ word
    n = n + 1
  }
  invariant never_zero: n < 2 || acc != 0
}`);
    const run = bmc(new SystemRuntime(c, 'Checksum'), { maxK: 4 });
    const p = run.properties.find((q) => q.name === 'never_zero')!;
    expect(p.foundAt).toBe(2);
    expect(p.replayed).toBe(true);
  });
  it('agrees with the explorer on an 8-bit counter with wrap-around', () => {
    agree(`system Wrap {
  var x: bv8 = 250
  var y: bv8 = 3
  action add { x = x + y }
  action double when y < 64 { y = y * 2 }
  action sub when x > y { x = x - y }
  invariant no_wrap: x >= 3
  invariant signed: !slt(x, 0)
}`, 10);
  });
});
