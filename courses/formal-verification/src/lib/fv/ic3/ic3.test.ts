import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime } from '../vouch/interp/system';
import { kInduction } from './kind';
import { ic3 } from './ic3';

function rt(src: string, name: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return new SystemRuntime(c, name);
}

const PETERSON = (extra: string) => `system Peterson {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0

  process P(me: Proc) {
    loop {
      want: flag[me] = true
      yield: turn = 1 - me
      wait: await !flag[1 - me] || turn == me
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
${extra}
}`;

const HYMAN = `system Hyman {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0
  process P(me: Proc) {
    loop {
      want: flag[me] = true
      check: if turn != me {
        spin: await !flag[1 - me]
        take: turn = me
      }
      critical: flag[me] = false
    }
  }
  invariant mutex: !(P(0) at critical && P(1) at critical)
}`;

describe('k-induction', () => {
  it('finds a CTI for the plain mutex invariant, and proves it once strengthened', () => {
    const plain = kInduction(rt(PETERSON(''), 'Peterson'), { maxK: 1 });
    expect(plain.status).toBe('unknown');
    expect(plain.rounds[0]!.cti?.failing).toEqual(['mutex']);
    const strong = kInduction(
      rt(
        PETERSON(`  invariant flag0: flag[0] == !(P(0) at want)
  invariant flag1: flag[1] == !(P(1) at want)
  invariant turn0: !(P(0) at critical && P(1) at wait) || turn == 0
  invariant turn1: !(P(1) at critical && P(0) at wait) || turn == 1`),
        'Peterson',
      ),
      { maxK: 1 },
    );
    expect(strong.status).toBe('proved');
    expect(strong.certificate?.step.checked).toBe(true);
    expect(strong.certificate?.base.checked).toBe(true);
  });
  it('proves the plain mutex invariant with a larger k (17)', () => {
    const r = kInduction(rt(PETERSON(''), 'Peterson'), { maxK: 20, timeout: 30000 });
    expect(r.status).toBe('proved');
    expect(r.k).toBe(17);
  });
  it('reports the base-case violation of Hyman', () => {
    const r = kInduction(rt(HYMAN, 'Hyman'), { maxK: 12 });
    expect(r.status).toBe('violated');
    expect(r.violations[0]!.replayed).toBe(true);
  });
});

describe('IC3', () => {
  it('proves Peterson and certifies the invariant', () => {
    const r = ic3(rt(PETERSON(''), 'Peterson'), { record: true });
    expect(r.status).toBe('proved');
    expect(r.certificate!.init.checked && r.certificate!.step.checked && r.certificate!.implies.checked).toBe(true);
    expect(r.invariant!.text.length).toBeGreaterThan(0);
    writeFileSync(process.env.IC3_DUMP ?? '/dev/null', [...r.invariant!.text, JSON.stringify(r.stats), String(r.frames), String(r.log.length)].join('\n'));
  });
  it('finds and replays Hyman’s bug', () => {
    const r = ic3(rt(HYMAN, 'Hyman'));
    expect(r.status).toBe('violated');
    expect(r.trace!.replayed).toBe(true);
  });
});
