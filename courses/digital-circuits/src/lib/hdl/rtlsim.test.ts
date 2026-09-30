import { describe, expect, it } from 'vitest';
import { check } from './check';
import { elaborate } from './elaborate';
import type { RtlCell, RtlModule, RtlSignal, SigId } from './rtl';
import { createRtlSim, evalCell, WORDS } from './rtlsim';
import { NO_SPAN } from './span';
import { evalTExpr, widthOf } from './tir';

/** A deterministic generator (LCG), so that every run tests the same designs. */
function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
  return {
    int: (n: number) => next() % n,
    big: (w: number) => {
      let v = 0n;
      for (let k = 0; k < w; k += 32) v = (v << 32n) | BigInt(next());
      return v & ((1n << BigInt(w)) - 1n);
    },
    pick<T>(xs: readonly T[]): T {
      return xs[next() % xs.length]!;
    },
  };
}

const WIDTHS = [1, 2, 3, 5, 8, 16, 31, 32, 33, 40, 64, 70];

/** A random flat RTL module using every cell kind, with registers and a memory. */
function randomModule(seed: number): RtlModule {
  const r = rng(seed);
  const signals: RtlSignal[] = [];
  const cells: RtlCell[] = [];
  const names: Record<string, SigId> = {};
  const byWidth = new Map<number, SigId[]>();
  const sig = (width: number): SigId => {
    const id = signals.length;
    signals.push({ id, width });
    let l = byWidth.get(width);
    if (!l) byWidth.set(width, (l = []));
    l.push(id);
    return id;
  };
  const add = (c: Omit<RtlCell, 'id' | 'src' | 'path'>): SigId => {
    cells.push({ ...c, id: cells.length, src: NO_SPAN, path: 'R' } as RtlCell);
    return c.y;
  };
  const clk = sig(1);
  const inputs = Array.from({ length: 4 }, () => ({ w: r.pick(WIDTHS) }));
  const inPorts = inputs.map((p, i) => ({ name: `in${i}`, width: p.w, sig: sig(p.w), type: { k: 'bits', w: p.w, signed: false } as const, clock: false }));
  /** A signal of width w: an existing one, or an adapted one. */
  const need = (w: number): SigId => {
    const same = byWidth.get(w);
    if (same && r.int(3)) return r.pick(same);
    const all = signals.filter((s) => s.id !== clk);
    const src = r.pick(all);
    if (src.width > w) return add({ kind: 'slice', y: sig(w), a: src.id, lo: r.int(src.width - w + 1) } as never);
    if (src.width < w) return add({ kind: r.int(2) ? 'zext' : 'sext', y: sig(w), a: src.id } as never);
    return add({ kind: 'const', y: sig(w), value: r.big(w) } as never);
  };
  // Registers and a memory first, so that logic can read them.
  const regs = Array.from({ length: 3 }, () => {
    const w = r.pick(WIDTHS);
    return { w, q: sig(w), init: r.big(w) };
  });
  const memW = r.pick([8, 32, 40]);
  const memReads = [sig(memW), sig(memW)];
  const kinds = ['const', 'add', 'sub', 'mul', 'and', 'or', 'xor', 'not', 'neg', 'shl', 'shr', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'mux', 'pmux', 'slice', 'concat', 'repeat', 'zext', 'sext', 'reduce_and', 'reduce_or', 'reduce_xor', 'popcount'] as const;
  for (let k = 0; k < 60; k++) {
    const kind = kinds[k % kinds.length]!;
    const w = r.pick(WIDTHS);
    switch (kind) {
      case 'const':
        add({ kind, y: sig(w), value: r.big(w) } as never);
        break;
      case 'add': case 'sub': case 'mul': case 'and': case 'or': case 'xor': {
        const a = need(w);
        const b = need(w);
        add({ kind, y: sig(w), a, b } as never);
        break;
      }
      case 'not': case 'neg': {
        const a = need(w);
        add({ kind, y: sig(w), a } as never);
        break;
      }
      case 'shl': case 'shr': {
        const a = need(w);
        const b = need(r.pick([1, 3, 5, 6, 7, 33]));
        add({ kind, y: sig(w), a, b, signed: r.int(2) === 1 } as never);
        break;
      }
      case 'eq': case 'ne': case 'lt': case 'le': case 'gt': case 'ge': {
        const a = need(w);
        const b = need(w);
        add({ kind, y: sig(1), a, b, signed: r.int(2) === 1 } as never);
        break;
      }
      case 'mux': {
        const sel = need(1);
        const a = need(w);
        const b = need(w);
        add({ kind, y: sig(w), s: sel, a, b } as never);
        break;
      }
      case 'pmux': {
        const sw = r.pick([1, 2, 3, 8, 40]);
        const used = new Set<bigint>();
        const cases = Array.from({ length: 1 + r.int(4) }, () => {
          const match = Array.from({ length: 1 + r.int(2) }, () => r.big(sw)).filter((v) => !used.has(v) && used.add(v));
          return { match, data: need(w) };
        });
        const sel = need(sw);
        const dflt = need(w);
        add({ kind, y: sig(w), s: sel, cases, default: dflt } as never);
        break;
      }
      case 'slice': {
        const a = need(r.pick(WIDTHS.filter((x) => x >= w)));
        add({ kind, y: sig(w), a, lo: r.int(signals[a]!.width - w + 1) } as never);
        break;
      }
      case 'concat': {
        const parts = [need(r.pick(WIDTHS)), need(r.pick(WIDTHS)), need(r.pick([1, 3, 8]))];
        add({ kind, y: sig(parts.reduce((s, p) => s + signals[p]!.width, 0)), parts } as never);
        break;
      }
      case 'repeat': {
        const a = need(r.pick([1, 3, 8, 16, 33]));
        const n = 1 + r.int(4);
        add({ kind, y: sig(signals[a]!.width * n), a, n } as never);
        break;
      }
      case 'zext': case 'sext': {
        const a = need(r.pick(WIDTHS.filter((x) => x <= w)));
        add({ kind, y: sig(w), a } as never);
        break;
      }
      case 'reduce_and': case 'reduce_or': case 'reduce_xor': {
        const a = need(w);
        add({ kind, y: sig(1), a } as never);
        break;
      }
      case 'popcount': {
        let pw = 1;
        while (w >> pw > 0) pw++;
        const a = need(w);
        add({ kind, y: sig(pw), a } as never);
        break;
      }
    }
  }
  for (const g of regs) {
    const d = need(g.w);
    add({ kind: 'reg', y: g.q, d, clk, init: g.init } as never);
  }
  const depth = 1 + r.int(12);
  cells.push({
    kind: 'mem', id: cells.length, y: -1, clk, width: memW, depth, init: Array.from({ length: depth }, () => r.big(memW)), name: 'm',
    reads: memReads.map((data) => ({ addr: need(r.pick([2, 4])), data })), writes: [{ addr: need(4), data: need(memW), en: need(1) }],
    src: NO_SPAN, path: 'R',
  });
  // Name about half of the signals (named signals are stored; the others stay in locals).
  signals.forEach((s) => {
    if (s.id !== clk && r.int(2)) names[`s${s.id}`] = s.id;
  });
  const outputs = signals.filter((s) => s.id !== clk).slice(-5).map((s, i) => ({ name: `out${i}`, width: s.width, sig: s.id, type: { k: 'bits', w: s.width, signed: false } as const, clock: false }));
  return {
    name: 'R', signals, cells, instances: [], names,
    inputs: [{ name: 'clk', width: 1, sig: clk, type: { k: 'clock' }, clock: true }, ...inPorts],
    outputs,
  };
}

describe('word library', () => {
  it('matches BigInt arithmetic on wide values', () => {
    const r = rng(1);
    for (let k = 0; k < 300; k++) {
      const w = r.pick([33, 40, 64, 65, 96, 100]);
      const n = Math.ceil(w / 32);
      const a = r.big(w);
      const b = r.big(w);
      const m = (1n << BigInt(w)) - 1n;
      const A = new Uint32Array(n);
      const B = new Uint32Array(n);
      const D = new Uint32Array(n);
      WORDS.fromBig(A, a);
      WORDS.fromBig(B, b);
      WORDS.add(D, A, B, w);
      expect(WORDS.toBig(D)).toBe((a + b) & m);
      WORDS.sub(D, A, B, w);
      expect(WORDS.toBig(D)).toBe((a - b) & m);
      WORDS.mul(D, A, B, w);
      expect(WORDS.toBig(D)).toBe((a * b) & m);
      WORDS.neg(D, A, w);
      expect(WORDS.toBig(D)).toBe(-a & m);
      const sh = r.int(w + 3);
      WORDS.shl(D, A, sh, w);
      expect(WORDS.toBig(D)).toBe(sh >= w ? 0n : (a << BigInt(sh)) & m);
      WORDS.shr(D, A, sh, w, true);
      const sa = a >> BigInt(w - 1) ? a - (1n << BigInt(w)) : a;
      expect(WORDS.toBig(D)).toBe((sa >> BigInt(Math.min(sh, w))) & m);
      expect(WORDS.cmp(A, B, w, false)).toBe(a < b ? -1 : a > b ? 1 : 0);
      const lo = r.int(w - 20);
      expect(WORDS.get(A, lo, 20)).toBe(Number((a >> BigInt(lo)) & 0xfffffn));
    }
  });
});

describe('RTL simulator: compiled code agrees with the interpreter', () => {
  for (let seed = 1; seed <= 25; seed++) {
    it(`random design ${seed}`, () => {
      const mod = randomModule(seed);
      const a = createRtlSim(mod, undefined, { mode: 'compiled' });
      const b = createRtlSim(mod, undefined, { mode: 'interpreted' });
      expect(a.mode).toBe('compiled');
      expect(b.mode).toBe('interpreted');
      const r = rng(seed * 7919);
      const names = a.names();
      for (let cycle = 0; cycle < 12; cycle++) {
        for (const p of mod.inputs) {
          if (p.clock) continue;
          const v = r.big(p.width);
          a.set(p.name, v);
          b.set(p.name, v);
        }
        for (const n of names) expect([n, a.peek(n)]).toEqual([n, b.peek(n)]);
        for (const p of mod.outputs) expect(a.getBig(p.name)).toBe(b.getBig(p.name));
        a.step();
        b.step();
      }
      for (let i = 0; i < 4; i++) expect(a.readMem('m', i)).toBe(b.readMem('m', i));
    });
  }

  it('a design large enough to be split into several generated functions', () => {
    const r = check('module Top(clk: clock, push: bit, data_in: bits<12>, pop: bit) -> (data_out: bits<12>, count: bits<9>) {\n  inst f: Fifo<12, 300>(clk: clk, push: push, data_in: data_in, pop: pop)\n  data_out = f.data_out\n  count = f.count\n}');
    const design = elaborate(r.program, 'Top');
    const a = createRtlSim(design, undefined, { mode: 'compiled' });
    const b = createRtlSim(design, undefined, { mode: 'interpreted' });
    expect(a.module.cells.length).toBeGreaterThan(1200);
    const g = rng(5);
    for (let c = 0; c < 400; c++) {
      const push = g.int(3) ? 1 : 0;
      const pop = g.int(3) ? 0 : 1;
      const data = g.int(4096);
      for (const sim of [a, b]) {
        sim.set('push', push);
        sim.set('pop', pop);
        sim.set('data_in', data);
      }
      expect([a.get('data_out'), a.get('count')]).toEqual([b.get('data_out'), b.get('count')]);
      a.step();
      b.step();
    }
    expect(a.get('count')).toBeGreaterThan(50);
  });

  it('the interpreter follows the cell semantics', () => {
    // Spot checks of evalCell on narrow values.
    const width = (s: SigId) => [8, 8, 1, 8][s]!;
    const val = (s: SigId) => [0x90n, 3n, 1n, 0n][s]!;
    const cell = (c: object) => ({ id: 0, y: 3, src: NO_SPAN, path: '', ...c }) as RtlCell;
    expect(evalCell(cell({ kind: 'shr', a: 0, b: 1, signed: true }), val, width)).toBe(0xf2n);
    expect(evalCell(cell({ kind: 'shr', a: 0, b: 1, signed: false }), val, width)).toBe(0x12n);
    expect(evalCell(cell({ kind: 'lt', a: 0, b: 1, signed: true }), val, width)).toBe(1n);
    expect(evalCell(cell({ kind: 'lt', a: 0, b: 1, signed: false }), val, width)).toBe(0n);
    expect(evalCell(cell({ kind: 'sub', a: 1, b: 0 }), val, width)).toBe(0x73n);
  });
});

describe('RTL simulator: DCL expressions agree with the checker’s evaluator', () => {
  // Random, well-typed DCL expressions; each is simulated (compiled and interpreted) and compared with
  // evalTExpr on the typed expression, which is the language's reference semantics.
  const TYPES = ['bits<8>', 'bits<40>', 'bit', 'signed<8>', 'bits<3>'] as const;
  type T = (typeof TYPES)[number];
  const inputsOf: Record<T, string[]> = { 'bits<8>': ['a', 'b'], 'bits<40>': ['w', 'v'], bit: ['c'], 'signed<8>': ['s'], 'bits<3>': ['k'] };
  function gen(r: ReturnType<typeof rng>, t: T, d: number): string {
    const leaf = () => (r.int(4) ? r.pick(inputsOf[t]) : t === 'signed<8>' ? String(r.int(200) - 100) : String(r.big(t === 'bit' ? 1 : t === 'bits<3>' ? 3 : 8)));
    if (d > 3) return leaf();
    const x = () => gen(r, t, d + 1);
    switch (r.int(10)) {
      case 0:
        return leaf();
      case 1:
        return t === 'bit' ? `(${x()} && ${x()})` : `(${x()} ${r.pick(['+', '-', '&', '|', '^', '*'])} ${x()})`;
      case 2:
        return `if ${gen(r, 'bit', d + 1)} { ${x()} } else { ${x()} }`;
      case 3: {
        if (t !== 'bit') return `(${x()} ${r.pick(['<<', '>>'])} ${gen(r, 'bits<3>', d + 1)})`;
        const ct = r.pick(['bits<8>', 'bits<40>', 'signed<8>'] as const);
        return `(${gen(r, ct, d + 1)} ${r.pick(['==', '!=', '<', '<=', '>', '>='])} ${gen(r, ct, d + 1)})`;
      }
      case 4:
        return t === 'bit' ? `!${x()}` : `~${x()}`;
      case 5:
        return `match ${gen(r, 'bits<3>', d + 1)} { 0 | 7 => ${x()}, 3 => ${x()}, _ => ${x()} }`;
      case 6:
        if (t === 'bits<8>') {
          const hi = r.int(33) + 7;
          return `${gen(r, 'bits<40>', d + 1)}[${hi}:${hi - 7}]`;
        }
        if (t === 'bit') return `${gen(r, 'bits<8>', d + 1)}[${gen(r, 'bits<3>', d + 1)}]`;
        if (t === 'bits<40>') return `concat(${gen(r, 'bits<8>', d + 1)}, ${x()}[31:0])`;
        return x();
      case 7:
        if (t === 'bits<40>') return `sext(${gen(r, 'bits<8>', d + 1)}, 40)`;
        if (t === 'bits<8>') return `zext(${gen(r, 'bits<3>', d + 1)}, 8)`;
        if (t === 'bit') return `any(${gen(r, 'bits<40>', d + 1)})`;
        if (t === 'signed<8>') return `signed(${gen(r, 'bits<8>', d + 1)})`;
        return `trunc(${gen(r, 'bits<8>', d + 1)}, 3)`;
      case 8:
        if (t === 'bits<8>') return `reverse(${x()})`;
        if (t === 'bits<40>') return `repeat(${gen(r, 'bits<8>', d + 1)}, 5)`;
        if (t === 'bits<3>') return `count_ones(${gen(r, 'bits<8>', d + 1)})[2:0]`;
        return x();
      default:
        return t === 'signed<8>' ? `-${x()}` : `(${x()} ${t === 'bit' ? '||' : '|'} ${x()})`;
    }
  }

  it('on 150 random expressions', () => {
    const r = rng(2024);
    let checked = 0;
    const skippedCodes: string[] = [];
    for (let k = 0; k < 150; k++) {
      const t = r.pick(TYPES);
      const expr = gen(r, t, 0);
      const src = `module E(a: bits<8>, b: bits<8>, w: bits<40>, v: bits<40>, c: bit, s: signed<8>, k: bits<3>) -> (y: ${t}) {\n  y = ${expr}\n}`;
      const res = check(src, { lint: false });
      const errors = res.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length) {
        // Some random literals do not fit or lack context; skip those.
        skippedCodes.push(errors[0]!.code);
        continue;
      }
      checked++;
      const spec = res.program.specs.get('E')!;
      const design = elaborate(res.program, 'E');
      const sims = [createRtlSim(design, undefined, { mode: 'compiled' }), createRtlSim(design, undefined, { mode: 'interpreted' })];
      for (let trial = 0; trial < 6; trial++) {
        const values = new Map<string, bigint>();
        for (const p of spec.inputs) values.set(p.name, r.big(widthOf(p.type)));
        for (const sim of sims) for (const [n, v] of values) sim.set(n, v);
        const expected = evalTExpr(spec.assigns.get('y')!, { ref: (x) => values.get(x.name)! });
        for (const sim of sims) expect([expr, [...values], sim.getBig('y')]).toEqual([expr, [...values], expected]);
      }
    }
    for (const code of skippedCodes) expect(['literal-no-context', 'literal-too-wide']).toContain(code);
    expect(checked).toBeGreaterThan(75);
  });
});

describe('RTL simulator: API', () => {
  const src = `module Counter(clk: clock, enable: bit) -> (count: bits<4>) {
  reg value: bits<4> = 3
  next value = if enable { value + 1 } else { value }
  count = value
}
module Two(a: clock, b: clock) -> (x: bits<4>, y: bits<4>) {
  reg p: bits<4> = 0 on a
  reg q: bits<4> = 0 on b
  next p = p + 1
  next q = q + 1
  x = p
  y = q
}`;
  const program = check(src).program;

  it('sets inputs, steps, reads outputs and named signals, and resets', () => {
    const sim = createRtlSim(elaborate(program, 'Counter'));
    expect(sim.get('count')).toBe(3);
    sim.set('enable', 1);
    sim.step(5);
    expect(sim.get('count')).toBe(8);
    expect(sim.peek('value')).toBe(8n);
    expect(sim.cycle).toBe(5);
    sim.step(8);
    expect(sim.get('count')).toBe(0);
    sim.reset();
    expect(sim.get('count')).toBe(3);
    expect(sim.cycle).toBe(0);
    expect(sim.names()).toContain('value');
    expect(() => sim.set('count', 1)).toThrow(/output/);
    expect(() => sim.set('clk', 1)).toThrow(/clock/);
    expect(() => sim.get('nothing')).toThrow(/no signal/);
  });

  it('ticks one clock at a time in a design with two clocks', () => {
    for (const mode of ['compiled', 'interpreted'] as const) {
      const sim = createRtlSim(elaborate(program, 'Two'), undefined, { mode });
      sim.tick('a');
      sim.tick('a');
      sim.tick('b');
      expect([sim.get('x'), sim.get('y')]).toEqual([2, 1]);
      sim.step(3);
      expect([sim.get('x'), sim.get('y')]).toEqual([5, 4]);
      expect(() => sim.tick('x')).toThrow(/clock/);
    }
  });

  it('gives fast handles on signals', () => {
    const sim = createRtlSim(elaborate(program, 'Counter'));
    const en = sim.signal('enable');
    const count = sim.signal('count');
    en.set(1);
    sim.step(2);
    expect(count.get()).toBe(5);
    expect(count.width).toBe(4);
    expect(() => count.set(1)).toThrow();
  });

  it('reads and writes memories', () => {
    const r = check(`module Ram(clk: clock, addr: bits<3>) -> (q: bits<8>) {\n  mem m: [bits<8>; 8] = [1, 2, 3, 4, 5, 6, 7, 8]\n  q = m.read(addr)\n}`).program;
    const sim = createRtlSim(elaborate(r, 'Ram'));
    expect(sim.readMem('m', 2)).toBe(3n);
    sim.writeMem('m', 2, 99);
    sim.set('addr', 2);
    sim.step();
    expect(sim.get('q')).toBe(99);
  });
});
