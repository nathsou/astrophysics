import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from '../../hdl/check';
import { elaborate } from '../../hdl/elaborate';
import type { RtlCell, RtlDesign, RtlModule, RtlSignal, SigId } from '../../hdl/rtl';
import { createRtlSim, type RtlSim } from '../../hdl/rtlsim';
import { NO_SPAN, SourceFile } from '../../hdl/span';
import { INTERNAL_CELLS, YosysSim, toYosysJson, validateYosysJson, writeYosysJson, yosysModuleName, type YosysJson } from './index';

const DESIGNS = new URL('../../../../content/designs/', import.meta.url);
const GOLDEN = new URL('./testdata/', import.meta.url);

/** The module of each design file that the tests elaborate (`rv32i.dcl` marks its own `top`). */
const TOPS: Record<string, string | undefined> = { 'counter.dcl': 'Counter', 'traffic-light.dcl': 'TrafficLight', 'alu.dcl': 'Alu', 'regfile.dcl': 'RegFile' };

function load(file: string, top = TOPS[file]): { design: RtlDesign; source: SourceFile } {
  const text = readFileSync(new URL(file, DESIGNS), 'utf8');
  const r = check(text, { file });
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  expect(errors).toEqual([]);
  return { design: elaborate(r.program, top), source: new SourceFile(file, text) };
}

function fromSource(text: string, top: string, file = 'test.dcl'): RtlDesign {
  const r = check(text, { file });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return elaborate(r.program, top);
}

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

/** A random flat RTL module using every cell kind, with registers and a memory (as in rtlsim.test.ts). */
function randomModule(seed: number): RtlModule {
  const r = rng(seed);
  const signals: RtlSignal[] = [];
  const cells: RtlCell[] = [];
  const names: Record<string, SigId> = {};
  const byWidth = new Map<number, SigId[]>();
  /** A signal that logic may read once it is `avail`able: a cell's own result must not feed its operands. */
  const sig = (width: number): SigId => {
    signals.push({ id: signals.length, width });
    return signals.length - 1;
  };
  const avail = (id: SigId): SigId => {
    const width = signals[id]!.width;
    let l = byWidth.get(width);
    if (!l) byWidth.set(width, (l = []));
    l.push(id);
    return id;
  };
  const add = (c: Record<string, unknown> & { y: SigId }): SigId => {
    cells.push({ ...c, id: cells.length, src: NO_SPAN, path: 'R' } as unknown as RtlCell);
    return avail(c.y);
  };
  const clk = sig(1);
  const inPorts = Array.from({ length: 4 }, (_, i) => {
    const w = r.pick(WIDTHS);
    return { name: `in${i}`, width: w, sig: avail(sig(w)), type: { k: 'bits', w, signed: false } as const, clock: false };
  });
  const need = (w: number): SigId => {
    const same = byWidth.get(w);
    if (same && r.int(3)) return r.pick(same);
    const src = r.pick(signals.filter((s) => s.id !== clk && (byWidth.get(s.width)?.includes(s.id) ?? false)));
    if (src.width > w) return add({ kind: 'slice', y: sig(w), a: src.id, lo: r.int(src.width - w + 1) });
    if (src.width < w) return add({ kind: r.int(2) ? 'zext' : 'sext', y: sig(w), a: src.id });
    return add({ kind: 'const', y: sig(w), value: r.big(w) });
  };
  const regs = Array.from({ length: 3 }, () => {
    const w = r.pick(WIDTHS);
    return { w, q: avail(sig(w)), init: r.big(w) };
  });
  const memW = r.pick([8, 32, 40]);
  const memReads = [avail(sig(memW)), avail(sig(memW))];
  const kinds = ['const', 'add', 'sub', 'mul', 'and', 'or', 'xor', 'not', 'neg', 'shl', 'shr', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'mux', 'pmux', 'slice', 'concat', 'repeat', 'zext', 'sext', 'reduce_and', 'reduce_or', 'reduce_xor', 'popcount'] as const;
  for (let k = 0; k < 84; k++) {
    const kind = kinds[k % kinds.length]!;
    const w = r.pick(WIDTHS);
    switch (kind) {
      case 'const':
        add({ kind, y: sig(w), value: r.big(w) });
        break;
      case 'add': case 'sub': case 'mul': case 'and': case 'or': case 'xor': {
        const a = need(w);
        add({ kind, y: sig(w), a, b: need(w) });
        break;
      }
      case 'not': case 'neg':
        add({ kind, y: sig(w), a: need(w) });
        break;
      case 'shl': case 'shr': {
        const a = need(w);
        add({ kind, y: sig(w), a, b: need(r.pick([1, 3, 5, 6, 7, 33])), signed: r.int(2) === 1 });
        break;
      }
      case 'eq': case 'ne': case 'lt': case 'le': case 'gt': case 'ge': {
        const a = need(w);
        add({ kind, y: sig(1), a, b: need(w), signed: r.int(2) === 1 });
        break;
      }
      case 'mux': {
        const s = need(1);
        const a = need(w);
        add({ kind, y: sig(w), s, a, b: need(w) });
        break;
      }
      case 'pmux': {
        const sw = r.pick([1, 2, 3, 8, 40]);
        const used = new Set<bigint>();
        const cases = Array.from({ length: r.int(5) }, () => {
          const match = Array.from({ length: 1 + r.int(2) }, () => r.big(sw)).filter((v) => !used.has(v) && used.add(v));
          return { match, data: need(w) };
        });
        const s = need(sw);
        add({ kind, y: sig(w), s, cases, default: need(w) });
        break;
      }
      case 'slice': {
        const a = need(r.pick(WIDTHS.filter((x) => x >= w)));
        add({ kind, y: sig(w), a, lo: r.int(signals[a]!.width - w + 1) });
        break;
      }
      case 'concat': {
        const parts = [need(r.pick(WIDTHS)), need(r.pick(WIDTHS)), need(r.pick([1, 3, 8]))];
        add({ kind, y: sig(parts.reduce((s, p) => s + signals[p]!.width, 0)), parts });
        break;
      }
      case 'repeat': {
        const a = need(r.pick([1, 3, 8, 16, 33]));
        const n = 1 + r.int(4);
        add({ kind, y: sig(signals[a]!.width * n), a, n });
        break;
      }
      case 'zext': case 'sext':
        add({ kind, y: sig(w), a: need(r.pick(WIDTHS.filter((x) => x <= w))) });
        break;
      case 'reduce_and': case 'reduce_or': case 'reduce_xor':
        add({ kind, y: sig(1), a: need(w) });
        break;
      case 'popcount': {
        let pw = 1;
        while (w >> pw > 0) pw++;
        add({ kind, y: sig(pw), a: need(w) });
        break;
      }
    }
  }
  for (const g of regs) add({ kind: 'reg', y: g.q, d: need(g.w), clk, init: g.init });
  const depth = 1 + r.int(12);
  cells.push({
    kind: 'mem', id: cells.length, y: -1, clk, width: memW, depth, init: Array.from({ length: depth }, () => r.big(memW)), name: 'm',
    reads: memReads.map((data) => ({ addr: need(r.pick([2, 4])), data })), writes: [{ addr: need(4), data: need(memW), en: need(1) }],
    src: NO_SPAN, path: 'R',
  });
  signals.forEach((s) => {
    if (s.id !== clk && r.int(2)) names[`s${s.id}`] = s.id;
  });
  const outputs = signals.filter((s) => s.id !== clk).slice(-6).map((s, i) => ({ name: `out${i}`, width: s.width, sig: s.id, type: { k: 'bits', w: s.width, signed: false } as const, clock: false }));
  return {
    name: 'R', signals, cells, instances: [], names,
    inputs: [{ name: 'clk', width: 1, sig: clk, type: { k: 'clock' }, clock: true }, ...inPorts],
    outputs,
  };
}

/** Runs the RTL and its Yosys JSON side by side on random inputs; every output and named wire must agree. */
function compare(design: RtlDesign | RtlModule, json: YosysJson, cycles: number, seed: number, wires?: string[]): void {
  const mod = 'modules' in design ? design.modules[design.top]! : design;
  const rtl: RtlSim = createRtlSim(design);
  const net = new YosysSim(json);
  const r = rng(seed);
  const inputs = mod.inputs.filter((p) => !p.clock);
  const outputs = mod.outputs.map((p) => p.name);
  const seen = wires ?? outputs;
  for (let c = 0; c < cycles; c++) {
    for (const p of inputs) {
      const v = r.int(4) === 0 ? 0n : r.int(5) === 0 ? (1n << BigInt(p.width)) - 1n : r.big(p.width);
      rtl.signal(p.name).set(v);
      net.set(p.name, v);
    }
    for (const n of seen) {
      const want = rtl.signal(n).getBig();
      const got = net.get(n);
      if (want !== got) throw new Error(`cycle ${c}: ${n} is ${got} in the netlist, ${want} in the RTL`);
    }
    rtl.step();
    net.step();
  }
}

describe('module names', () => {
  it('turns generic keys into identifiers', () => {
    expect(yosysModuleName('Counter')).toBe('Counter');
    expect(yosysModuleName('Fifo<8, 4>')).toBe('Fifo_8_4');
    expect(yosysModuleName('A<1>')).toBe('A_1');
    expect(yosysModuleName('<>')).toBe('module');
  });
});

describe('the Counter, written out', () => {
  const { design, source } = load('counter.dcl');
  const text = writeYosysJson(design, { sources: (f) => (f === source.name ? source : undefined) });

  it('matches the golden file (UPDATE_GOLDEN=1 rewrites it)', () => {
    const file = new URL('counter.json', GOLDEN);
    if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
      mkdirSync(GOLDEN, { recursive: true });
      writeFileSync(file, text);
    }
    expect(text).toBe(readFileSync(file, 'utf8'));
  });

  it('is valid JSON in the Yosys layout, and is deterministic', () => {
    const json = JSON.parse(text) as YosysJson;
    expect(validateYosysJson(json)).toEqual([]);
    expect(json).toEqual(toYosysJson(design, { sources: (f) => (f === source.name ? source : undefined) }));
    expect(writeYosysJson(design, { sources: (f) => (f === source.name ? source : undefined) })).toBe(text);
    expect(text).toContain('"bits": [ 2 ]');
  });

  it('has the ports, cells and netnames of the design', () => {
    const json = JSON.parse(text) as YosysJson;
    expect(Object.keys(json.modules)).toEqual(['Counter']);
    const m = json.modules.Counter!;
    expect(m.attributes.top).toBe('00000000000000000000000000000001');
    expect(Object.keys(m.ports)).toEqual(['clk', 'enable', 'clear', 'count', 'wrapped']);
    expect(m.ports.clk).toEqual({ direction: 'input', bits: [2] });
    expect(m.ports.count!.direction).toBe('output');
    expect(m.ports.count!.bits).toHaveLength(4);
    const types = Object.values(m.cells).map((c) => c.type).sort();
    expect(types.filter((t) => t === '$dff')).toHaveLength(1);
    expect(types).toContain('$add');
    expect(types).toContain('$mux');
    expect(types).toContain('$eq');
    const dff = Object.values(m.cells).find((c) => c.type === '$dff')!;
    expect(dff.parameters).toEqual({ WIDTH: '00000000000000000000000000000100', CLK_POLARITY: '00000000000000000000000000000001' });
    expect(dff.port_directions).toEqual({ CLK: 'input', D: 'input', Q: 'output' });
    expect(dff.connections.CLK).toEqual(m.ports.clk!.bits);
    expect(dff.connections.Q).toEqual(m.ports.count!.bits);
    expect(m.netnames.value!.attributes.init).toBe('0000');
    expect(m.netnames.value!.bits).toEqual(dff.connections.Q);
    expect(dff.attributes.src).toMatch(/^counter\.dcl:\d+\.\d+-\d+\.\d+$/);
  });
});

describe('every course design', () => {
  const files = readdirSync(DESIGNS).filter((f) => f.endsWith('.dcl')).sort();
  for (const file of files) {
    for (const flatten of [false, true]) {
      it(`${file}${flatten ? ', flattened' : ''}: valid, and the JSON round-trips`, () => {
        const { design } = load(file);
        const json = toYosysJson(design, { flatten });
        expect(validateYosysJson(json)).toEqual([]);
        expect(JSON.parse(writeYosysJson(design, { flatten }))).toEqual(json);
        expect(Object.keys(json.modules)).toHaveLength(flatten ? 1 : Object.keys(design.modules).length);
        const top = Object.values(json.modules).filter((m) => 'top' in m.attributes);
        expect(top).toHaveLength(1);
      });
    }
  }

  it('the top module’s ports are those of the DCL module', () => {
    const { design } = load('traffic-light.dcl');
    const json = toYosysJson(design);
    const ports = Object.entries(json.modules.TrafficLight!.ports).map(([n, p]) => `${p.direction} ${n}[${p.bits.length}]`);
    expect(ports).toEqual(['input clk[1]', 'input tick[1]', 'output red[1]', 'output amber[1]', 'output green[1]']);
  });

  it('the hierarchy is kept (one module per DCL module) or inlined', () => {
    const { design } = load('rv32i.dcl');
    const hier = toYosysJson(design);
    expect(Object.keys(hier.modules).sort()).toEqual(Object.keys(design.modules).map(yosysModuleName).sort());
    const instances = Object.values(hier.modules.riscv32!.cells).filter((c) => !c.type.startsWith('$')).map((c) => c.type);
    expect(instances.length).toBeGreaterThan(0);
    for (const t of instances) expect(hier.modules[t]).toBeDefined();
    const flat = toYosysJson(design, { flatten: true });
    expect(Object.values(flat.modules.riscv32!.cells).every((c) => c.type.startsWith('$'))).toBe(true);
    const count = (j: YosysJson) => Object.values(j.modules).reduce((n, m) => n + Object.values(m.cells).filter((c) => c.type.startsWith('$')).length, 0);
    expect(count(flat)).toBeGreaterThanOrEqual(count(hier) - 1);
  });
});

describe('the netlist computes what the RTL computes', () => {
  const runs: [string, number][] = [['counter.dcl', 80], ['traffic-light.dcl', 60], ['alu.dcl', 200], ['regfile.dcl', 200], ['rv32i.dcl', 120]];
  for (const [file, cycles] of runs) {
    for (const flatten of [false, true]) {
      it(`${file}${flatten ? ', flattened' : ''}, ${cycles} cycles of random inputs`, () => {
        const { design } = load(file);
        compare(design, toYosysJson(design, { flatten }), cycles, 7);
      });
    }
  }

  it('a design with instances, generics and memories (Fifo<8, 4>, a debouncer, and a ram)', () => {
    const design = fromSource(
      `module Top(clk: clock, push: bit, pop: bit, data_in: bits<8>, noisy: bit) -> (data_out: bits<8>, count: bits<3>, clean: bit) {
  inst f: Fifo<8, 4>(clk: clk, push: push, data_in: data_in, pop: pop)
  inst d: Debouncer<3>(clk: clk, raw: noisy)
  data_out = f.data_out
  count = f.count
  clean = d.clean
}`,
      'Top',
    );
    const json = toYosysJson(design);
    expect(validateYosysJson(json)).toEqual([]);
    expect(Object.keys(json.modules)).toContain('Fifo_8_4');
    expect(json.modules.Fifo_8_4!.attributes.dcl_module).toBe('Fifo<8, 4>');
    compare(design, json, 300, 3, ['data_out', 'count', 'clean']);
    compare(design, toYosysJson(design, { flatten: true }), 300, 3, ['data_out', 'count', 'clean']);
  });

  for (let seed = 1; seed <= 24; seed++) {
    it(`random module ${seed}, with every cell kind, registers and a memory`, () => {
      const mod = randomModule(seed);
      const json = toYosysJson(mod);
      expect(validateYosysJson(json)).toEqual([]);
      compare(mod, json, 25, seed, [...mod.outputs.map((p) => p.name), ...Object.keys(mod.names)]);
    });
  }

  it('the random modules exercise every Yosys cell type the writer knows', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) for (const m of Object.values(toYosysJson(randomModule(seed)).modules)) for (const c of Object.values(m.cells)) seen.add(c.type);
    const missing = Object.keys(INTERNAL_CELLS).filter((t) => !seen.has(t));
    expect(missing).toEqual([]);
  });
});

describe('memories', () => {
  const design = fromSource(
    `module Ram(clk: clock, we: bit, addr: bits<3>, data: bits<8>) -> (q: bits<8>) {
  mem m: [bits<8>; 6] = [1, 2, 3, 4, 5, 6]
  q = m.read(addr)
  m.write(addr, data, we)
}`,
    'Ram',
  );
  it('become one $mem_v2 with the documented parameters', () => {
    const json = toYosysJson(design);
    expect(validateYosysJson(json)).toEqual([]);
    const cell = Object.values(json.modules.Ram!.cells).find((c) => c.type === '$mem_v2')!;
    const p = cell.parameters;
    expect(p.SIZE).toBe('00000000000000000000000000000110');
    expect(p.ABITS).toBe('00000000000000000000000000000011');
    expect(p.WIDTH).toBe('00000000000000000000000000001000');
    expect(p.RD_PORTS).toBe('00000000000000000000000000000001');
    expect(p.WR_PORTS).toBe('00000000000000000000000000000001');
    expect(p.RD_TRANSPARENCY_MASK).toBe('0');
    expect(p.INIT).toBe('000001100000010100000100000000110000001000000001');
    expect(cell.connections.WR_EN).toHaveLength(8);
    expect(new Set(cell.connections.WR_EN).size).toBe(1);
    expect(cell.connections.RD_DATA).toHaveLength(8);
    compare(design, json, 200, 11);
  });
});

describe('a ROM (a memory with no write port)', () => {
  const design = fromSource(
    `module Rom(clk: clock, addr: bits<2>) -> (a: bits<8>, b: bits<8>) {
  mem rom: [bits<8>; 4] = [0x11, 0x22, 0x33, 0x44]
  a = rom.read(addr)
  b = rom.read(addr)
}`,
    'Rom',
  );
  it('has parameters of at least one bit, as Yosys writes them (an empty one fails an assertion in Yosys 0.69)', () => {
    const json = toYosysJson(design);
    expect(validateYosysJson(json)).toEqual([]);
    const p = Object.values(json.modules.Rom!.cells).find((c) => c.type === '$mem_v2')!.parameters;
    for (const k of ['RD_TRANSPARENCY_MASK', 'RD_COLLISION_X_MASK', 'WR_CLK_ENABLE', 'WR_CLK_POLARITY', 'WR_PRIORITY_MASK', 'WR_WIDE_CONTINUATION']) expect(p[k], k).toBe('0');
    expect(p.RD_CLK_ENABLE).toBe('11');
    compare(design, json, 40, 2);
  });

  it('is refused by the validator when such a parameter is empty', () => {
    const json = toYosysJson(design);
    Object.values(json.modules.Rom!.cells).find((c) => c.type === '$mem_v2')!.parameters.WR_PRIORITY_MASK = '';
    expect(validateYosysJson(json).join('\n')).toMatch(/WR_PRIORITY_MASK.*0 bits.*needs 1/);
  });
});

describe('gate-level netlists (what Yosys writes after synthesis)', () => {
  it('run in YosysSim: $_ gates, $_DFF_P_ with an init attribute (x bits are 0), and $scopeinfo is ignored', () => {
    const json: YosysJson = {
      creator: 'test',
      modules: {
        T: {
          attributes: { top: '00000000000000000000000000000001' },
          ports: { clk: { direction: 'input', bits: [2] }, d: { direction: 'input', bits: [3, 4] }, q: { direction: 'output', bits: [5, 6] }, m: { direction: 'output', bits: [7] } },
          cells: {
            scope: { hide_name: 1, type: '$scopeinfo', parameters: { TYPE: 'module' }, attributes: {}, port_directions: {}, connections: {} },
            a: { hide_name: 1, type: '$_XOR_', parameters: {}, attributes: {}, port_directions: { A: 'input', B: 'input', Y: 'output' }, connections: { A: [3], B: [5], Y: [8] } },
            f0: { hide_name: 1, type: '$_DFF_P_', parameters: {}, attributes: {}, port_directions: { C: 'input', D: 'input', Q: 'output' }, connections: { C: [2], D: [8], Q: [5] } },
            f1: { hide_name: 1, type: '$_DFF_P_', parameters: {}, attributes: {}, port_directions: { C: 'input', D: 'input', Q: 'output' }, connections: { C: [2], D: [4], Q: [6] } },
            mux: { hide_name: 1, type: '$_MUX_', parameters: {}, attributes: {}, port_directions: { A: 'input', B: 'input', S: 'input', Y: 'output' }, connections: { A: [5], B: [6], S: [3], Y: [7] } },
          },
          netnames: { q: { hide_name: 0, bits: [5, 6], attributes: { init: '1x' } } },
        },
      },
    };
    const sim = new YosysSim(json, 'T');
    expect(sim.get('q')).toBe(2n); // bit 1 is 1, bit 0 is x: 0
    sim.set('d', 0b01);
    sim.tick();
    expect(sim.get('q')).toBe(1n); // q0 <= d0 ^ q0 = 1, q1 <= d1 = 0
    expect(sim.get('m')).toBe(0n); // the select d0 is 1, so the multiplexer passes q1, which is 0
  });
});

describe('unsupported input', () => {
  it('refuses a memory with two write ports', () => {
    const mod = randomModule(1);
    const mem = mod.cells.find((c) => c.kind === 'mem')!;
    if (mem.kind !== 'mem') throw new Error();
    mem.writes.push(mem.writes[0]!);
    expect(() => toYosysJson(mod)).toThrow(/one write port/);
  });

  it('refuses an unknown module', () => {
    expect(() => toYosysJson({ top: 'X', modules: {} })).toThrow(/unknown module/);
  });
});
