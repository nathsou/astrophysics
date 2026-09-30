import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { NETS, build } from './widgets/gen';
import { allTransitions, bitsOf, pulses, runTransition, withNotDelay, type Hunt } from './widgets/hazards';
import { LEVELS, hunt as huntOf, initialState, verdict } from './widgets/hunt';

/**
 * Every live circuit of Chapter 15 must do what the text says: the race really glitches, the hazards are where
 * the glitch hunt says they are, the consensus terms remove them, and the drawn circuits are exactly the ones
 * generated from their gate networks (set GEN_CIRCUITS=1 to rewrite the files).
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

describe('the circuit files are what the networks generate', () => {
  for (const net of NETS) {
    test(net.file, () => {
      const made = build(net);
      const text = JSON.stringify(made, null, 1) + '\n';
      if (process.env.GEN_CIRCUITS) writeFileSync(dir + net.file + '.json', text);
      expect(JSON.parse(readFileSync(dir + net.file + '.json', 'utf8'))).toEqual(made);
    });
  }
});

describe('every circuit loads and runs without messages', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    test(f, () => {
      const flat = flatten(JSON.parse(readFileSync(dir + f, 'utf8')) as Circuit);
      const e = createDigitalEngine(flat);
      e.advance(200e-9);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('A AND NOT A', () => {
  test('is 0 in both steady states and pulses to 1 for 2 ns when A rises', () => {
    const c = load('race');
    const flat = flatten(c);
    const e = createDigitalEngine(flat);
    const y = flat.elements.find((x) => x.id === 'Y')!.pins[2]!;
    e.advance(100e-9);
    expect(e.logic(y)).toBe(0);
    const rec = e.watch([y]);
    const t0 = e.time;
    e.setParam('A', 'on', true);
    e.advance(100e-9);
    expect(e.logic(y)).toBe(0);
    const t = rec.times();
    const v = rec.values()[0]!;
    const edges = [...t].map((x, i) => ({ at: Math.round((x - t0) * 1e12) / 1e3, v: v[i]! })).filter((x) => x.at > 0);
    // Rising at 3 ns (2 ns inverter is not involved: the AND sees A at 1 ns), falling at 3 ns: A′ falls at 2 ns, the AND follows at 3 ns.
    expect(edges).toEqual([
      { at: 1, v: 1 },
      { at: 3, v: 0 },
    ]);
    rec.close();
  });
  test('falling A does not glitch: A′ rises after A has already fallen', () => {
    const t = runTransition(load('race'), { inputs: ['A'], output: 'lamp' }, 1, 0);
    expect(t.kind).toBe('steady');
  });
});

const key = (t: { state: number; input: number }, n: number) => `${bitsOf(t.state, n).join('')}/${t.input}`;

describe('the hazards are where the text says', () => {
  const hunts = new Map<string, { hunt: Hunt; plain: Circuit; fixed: Circuit }>(
    LEVELS.map((l) => [l.id, { hunt: huntOf(l), plain: l.plain, fixed: l.fixed }]),
  );

  test('the sum of products has a single static-1 hazard: B = C = 1 and A falling, 2 ns wide, 2 to 4 ns after the flip', () => {
    const { hunt, plain } = hunts.get('sop')!;
    const all = allTransitions(plain, hunt);
    expect(all).toHaveLength(24);
    const bad = all.filter((t) => t.kind === 'glitch');
    expect(bad.map((t) => key(t, 3))).toEqual(['111/0']);
    expect(bad[0]!.hazard).toBe('static-1');
    expect(bad[0]!.edges).toEqual([2, 4]);
    expect(pulses(bad[0]!)).toEqual([{ at: 2, width: 2 }]);
  });

  test('rising A does not glitch, for the reason in the text: the overlap', () => {
    const { hunt, plain } = hunts.get('sop')!;
    expect(runTransition(plain, hunt, 0b011, 0).kind).toBe('steady');
  });

  test('the product of sums has a single static-0 hazard: B = C = 0 and A rising', () => {
    const { hunt, plain } = hunts.get('pos')!;
    const bad = allTransitions(plain, hunt).filter((t) => t.kind === 'glitch');
    expect(bad.map((t) => key(t, 3))).toEqual(['000/0']);
    expect(bad[0]!.hazard).toBe('static-0');
  });

  test('the NAND multiplexer glitches when S falls with A = B = 1', () => {
    const { hunt, plain } = hunts.get('mux')!;
    const bad = allTransitions(plain, hunt).filter((t) => t.kind === 'glitch');
    expect(bad.map((t) => key(t, 3))).toEqual(['111/0']);
    expect(bad[0]!.hazard).toBe('static-1');
  });

  test('the four-input function has 64 transitions and four of them glitch', () => {
    const { hunt, plain } = hunts.get('four')!;
    const all = allTransitions(plain, hunt);
    expect(all).toHaveLength(64);
    const bad = all.filter((t) => t.kind === 'glitch');
    expect(bad.map((t) => key(t, 4)).sort()).toEqual(['1101/1', '1110/0', '1111/0', '1111/1']);
    expect(bad.every((t) => t.hazard === 'static-1')).toBe(true);
  });

  test('with the consensus terms no transition of any circuit glitches, under either delay model', () => {
    for (const [id, { hunt, fixed }] of hunts) {
      for (const delayModel of ['inertial', 'transport'] as const) {
        expect(allTransitions(fixed, hunt, { delayModel }).filter((t) => t.kind === 'glitch'), `${id} ${delayModel}`).toEqual([]);
      }
    }
  });

  test('a circuit and its fixed twin compute the same function', () => {
    for (const [id, { hunt, plain, fixed }] of hunts) {
      const a = allTransitions(plain, hunt);
      const b = allTransitions(fixed, hunt);
      expect(a.map((t) => [t.before, t.after]), id).toEqual(b.map((t) => [t.before, t.after]));
    }
  });

  test('the functions are the ones on the labels', () => {
    const f: Record<string, (v: number[]) => number> = {
      sop: ([a, b, c]) => ((a! && b!) || (!a && c!) ? 1 : 0),
      pos: ([a, b, c]) => ((a! || b!) && (!a || c!) ? 1 : 0),
      mux: ([s, a, b]) => (s ? b! : a!),
      four: ([a, b, c, d]) => ((a! && b!) || (!a && c!) || (!b && d!) ? 1 : 0),
    };
    for (const [id, { hunt, plain }] of hunts) {
      for (const t of allTransitions(plain, hunt)) {
        const n = hunt.inputs.length;
        const before = bitsOf(t.state, n);
        const after = before.slice();
        after[t.input] = 1 - after[t.input]!;
        expect(t.before, `${id} ${before}`).toBe(f[id]!(before));
        expect(t.after, `${id} ${after}`).toBe(f[id]!(after));
      }
    }
  });
});

describe('the sliders of the glitch hunt do what the text says', () => {
  const { hunt, plain } = { hunt: huntOf(LEVELS[0]!), plain: LEVELS[0]!.plain };
  const at111 = (o: Parameters<typeof runTransition>[4]) => runTransition(plain, hunt, 0b111, 0, o);

  test('inverter delay 0: both paths change at once and there is nothing to race', () => {
    expect(at111({ notDelay: 0 }).kind).toBe('steady');
    expect(at111({ notDelay: 0, delayModel: 'transport' }).kind).toBe('steady');
  });

  test('inverter delay 0.5 ns: the inertial OR gate (1 ns) swallows the glitch, the transport one passes it', () => {
    expect(at111({ notDelay: 0.5, delayModel: 'inertial' }).kind).toBe('steady');
    const t = at111({ notDelay: 0.5, delayModel: 'transport' });
    expect(t.kind).toBe('glitch');
    expect(pulses(t)[0]!.width).toBeCloseTo(0.5, 3);
  });

  test('a glitch as wide as the gate’s delay gets through', () => {
    expect(at111({ notDelay: 1 }).kind).toBe('glitch');
  });

  test('a longer inverter delay makes a wider glitch', () => {
    expect(pulses(at111({ notDelay: 4 }))[0]!.width).toBeCloseTo(4, 3);
  });

  test('the circuit is untouched by withNotDelay(undefined)', () => {
    expect(withNotDelay(plain, undefined)).toBe(plain);
  });
});

describe('the messages of the glitch hunt', () => {
  const l = LEVELS[0]!;
  const h = huntOf(l);
  test('a glitch, a step and a steady output are described', () => {
    expect(verdict(runTransition(l.plain, h, 0b111, 0), l)).toBe('A flipped (111 → 011). F should have stayed at 1, but dropped to 0 for 2 ns and came back: a static-1 hazard.');
    expect(verdict(runTransition(l.plain, h, 0b011, 0), l)).toMatch(/F stayed at 1, as the function says it should/);
    expect(verdict(runTransition(l.plain, h, 0b000, 2), l)).toMatch(/F changed from 0 to 1, once, as it should/);
  });
  test('each level starts in the state its file says', () => {
    expect(LEVELS.map((x) => initialState(x.plain, x.inputs))).toEqual([0b111, 0b111, 0b000, 0b0000]);
  });
});

// ── Eichelberger's ternary test, as described in the “deeper” box ─────────────────

type T = 0 | 1 | 2;
const not3 = (a: T): T => (a === 2 ? 2 : ((1 - a) as T));
const and3 = (v: T[]): T => (v.includes(0) ? 0 : v.includes(2) ? 2 : 1);
const or3 = (v: T[]): T => (v.includes(1) ? 1 : v.includes(2) ? 2 : 0);
const nand3 = (v: T[]) => not3(and3(v));

function ternary(net: (typeof NETS)[number], values: T[]): T {
  const env = new Map<string, T>(net.inputs.map((n, i) => [n, values[i]!]));
  const val = (s: string): T => {
    const hit = env.get(s);
    if (hit !== undefined) return hit;
    const g = net.gates.find((x) => x.id === s)!;
    const ins = g.inputs.map(val);
    const r = g.kind === 'not' ? not3(ins[0]!) : g.kind === 'and' ? and3(ins) : g.kind === 'or' ? or3(ins) : g.kind === 'nand' ? nand3(ins) : (() => { throw new Error(g.kind); })();
    env.set(s, r);
    return r;
  };
  return val(net.out);
}

describe('ternary simulation finds the same hazards without any delays', () => {
  test('F = A·B + A′·C with A unknown and B = C = 1 is unknown; with the consensus term it is 1', () => {
    expect(ternary(NETS.find((n) => n.file === 'sop-hazard')!, [2, 1, 1])).toBe(2);
    expect(ternary(NETS.find((n) => n.file === 'sop-fixed')!, [2, 1, 1])).toBe(1);
  });
  test('every glitch the engine finds is flagged, and no fixed circuit is flagged anywhere', () => {
    for (const l of LEVELS) {
      const net = NETS.find((n) => n.file === `${l.id}-hazard`)!;
      const fixedNet = NETS.find((n) => n.file === `${l.id}-fixed`)!;
      const n = l.inputs.length;
      for (const t of allTransitions(l.plain, huntOf(l))) {
        if (t.before !== t.after) continue;
        const v = bitsOf(t.state, n).map((b, i) => (i === t.input ? 2 : b)) as T[];
        const flagged = ternary(net, v) === 2;
        if (t.kind === 'glitch') expect(flagged, `${l.id} ${key(t, n)}`).toBe(true);
        expect(ternary(fixedNet, v), `${l.id} fixed ${key(t, n)}`).not.toBe(2);
      }
    }
  });
});
