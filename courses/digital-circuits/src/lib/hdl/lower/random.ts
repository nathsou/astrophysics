/**
 * Random word-level RTL modules for property tests: every cell kind, registers and a memory. Deterministic
 * for a given seed. (The RTL simulator's tests have a similar generator; this one uses narrower widths so
 * that the gate-level netlists stay small.)
 */
import type { RtlCell, RtlModule, RtlSignal, SigId } from '../rtl';
import { NO_SPAN } from '../span';

export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
  return {
    int: (n: number) => (next() >>> 8) % n,
    big: (w: number) => {
      let v = 0n;
      for (let k = 0; k < w; k += 32) v = (v << 32n) | BigInt(next());
      return v & ((1n << BigInt(w)) - 1n);
    },
    pick<T>(xs: readonly T[]): T {
      return xs[(next() >>> 8) % xs.length]!;
    },
  };
}

const WIDTHS = [1, 2, 3, 4, 5, 6, 8, 9, 12];

export interface RandomOptions {
  cells?: number;
  widths?: number[];
}

export function randomModule(seed: number, options: RandomOptions = {}): RtlModule {
  const r = rng(seed);
  const widths = options.widths ?? WIDTHS;
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
  const inPorts = Array.from({ length: 4 }, (_, i) => {
    const w = r.pick(widths);
    return { name: `in${i}`, width: w, sig: sig(w), type: { k: 'bits', w, signed: false } as const, clock: false };
  });
  const need = (w: number): SigId => {
    const same = byWidth.get(w);
    if (same && r.int(3)) return r.pick(same);
    const all = signals.filter((s) => s.id !== clk);
    const src = r.pick(all);
    if (src.width > w) return add({ kind: 'slice', y: sig(w), a: src.id, lo: r.int(src.width - w + 1) } as never);
    if (src.width < w) return add({ kind: r.int(2) ? 'zext' : 'sext', y: sig(w), a: src.id } as never);
    return add({ kind: 'const', y: sig(w), value: r.big(w) } as never);
  };
  const regs = Array.from({ length: 3 }, () => {
    const w = r.pick(widths);
    return { w, q: sig(w), init: r.big(w) };
  });
  const memW = r.pick([1, 4, 8, 36]);
  const memReads = [sig(memW), sig(memW)];
  const kinds = ['const', 'add', 'sub', 'mul', 'and', 'or', 'xor', 'not', 'neg', 'shl', 'shr', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'mux', 'pmux', 'slice', 'concat', 'repeat', 'zext', 'sext', 'reduce_and', 'reduce_or', 'reduce_xor', 'popcount'] as const;
  const count = options.cells ?? 56;
  for (let k = 0; k < count; k++) {
    const kind = kinds[k % kinds.length]!;
    const w = r.pick(widths);
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
        const b = need(r.pick([1, 2, 3, 4, 5, 6, 12]));
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
        const sw = r.pick([1, 2, 3, 4, 9]);
        const used = new Set<bigint>();
        const cases = Array.from({ length: 1 + r.int(5) }, () => {
          const match = Array.from({ length: 1 + r.int(2) }, () => r.big(sw)).filter((v) => !used.has(v) && used.add(v));
          return { match, data: need(w) };
        });
        const sel = need(sw);
        const dflt = need(w);
        add({ kind, y: sig(w), s: sel, cases, default: dflt } as never);
        break;
      }
      case 'slice': {
        const a = need(r.pick(widths.filter((x) => x >= w)));
        add({ kind, y: sig(w), a, lo: r.int(signals[a]!.width - w + 1) } as never);
        break;
      }
      case 'concat': {
        const parts = [need(r.pick(widths)), need(r.pick(widths)), need(r.pick([1, 3, 8]))];
        add({ kind, y: sig(parts.reduce((s, p) => s + signals[p]!.width, 0)), parts } as never);
        break;
      }
      case 'repeat': {
        const a = need(r.pick([1, 3, 8]));
        const n = 1 + r.int(4);
        add({ kind, y: sig(signals[a]!.width * n), a, n } as never);
        break;
      }
      case 'zext': case 'sext': {
        const a = need(r.pick(widths.filter((x) => x <= w)));
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
  // Odd seeds: one address for every port (a RAM block); even seeds: different addresses (flip-flops).
  const shared = seed % 2 === 1;
  const aw = r.pick([2, 4]);
  const addr = need(aw);
  cells.push({
    kind: 'mem', id: cells.length, y: -1, clk, width: memW, depth, init: Array.from({ length: depth }, () => r.big(memW)), name: 'm',
    reads: memReads.map((data) => ({ addr: shared ? addr : need(r.pick([2, 4])), data })),
    writes: [{ addr: shared ? addr : need(4), data: need(memW), en: need(1) }],
    src: NO_SPAN, path: 'R',
  });
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
