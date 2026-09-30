/**
 * A bit-accurate simulator for the Yosys JSON netlists the course writes, independent of the DCL RTL
 * simulator: it reads only the JSON, and gives each internal cell the meaning the Yosys manual gives it.
 * Tests run a design on it and on `createRtlSim` and compare, which checks the writer's mapping (widths,
 * signedness, bit order, the `$pmux` select, `$mem_v2` port layout) without Yosys.
 *
 * The hierarchy is instantiated recursively into one flat set of nets; a cell is evaluated once its inputs
 * are, in dependency order; `$dff` and the read data of `$mem_v2` are the state.
 * Power-up: a register starts at its wire's `init` attribute (0 when it has none), a memory at `INIT`.
 *
 * It also runs what Yosys writes back after `synth` (`write_json`): the gate cells `$_AND_`, `$_MUX_`, … and the
 * flip-flop `$_DFF_P_` (run `dfflegalize -cell $_DFF_P_ 01` first to turn enables and resets into gates), so that a
 * test can compare Yosys's own reading of a netlist with the RTL simulator (`yosys-real.test.ts`).
 */
import { paramInt } from './cells';
import type { YosysBit, YosysCell, YosysJson, YosysModule } from './types';
import { yosysTopName } from './yosys';

const mask = (w: number) => (1n << BigInt(w)) - 1n;
const toSigned = (v: bigint, w: number) => (w > 0 && (v >> BigInt(w - 1)) & 1n ? v - (1n << BigInt(w)) : v);

/** `extend(v, from, to, signed)`: a value of `from` bits as `to` bits. */
function extend(v: bigint, from: number, to: number, signed: boolean): bigint {
  if (to <= from) return v & mask(to);
  return (signed ? toSigned(v, from) : v) & mask(to);
}

/** The result of a Yosys internal cell (other than `$dff` and `$mem_v2`) on word values. */
export function evalInternal(type: string, p: (name: string) => number, a: Record<string, bigint>): bigint {
  const n = (name: string) => p(name) || 0;
  const aw = n('A_WIDTH');
  const bw = n('B_WIDTH');
  const yw = n('Y_WIDTH');
  const as = p('A_SIGNED') === 1;
  const bs = p('B_SIGNED') === 1;
  const A = a.A ?? 0n;
  const B = a.B ?? 0n;
  // Arithmetic and bitwise cells extend both operands to the result width, by the signedness of both.
  const both = as && bs;
  const ax = () => extend(A, aw, yw, as);
  const bx = () => extend(B, bw, yw, bs);
  // Comparisons extend to the wider operand.
  const cw = Math.max(aw, bw);
  const ca = () => (both ? toSigned(extend(A, aw, cw, true), cw) : extend(A, aw, cw, false));
  const cb = () => (both ? toSigned(extend(B, bw, cw, true), cw) : extend(B, bw, cw, false));
  const m = mask(yw);
  switch (type) {
    case '$add': return (both ? ax() + bx() : extend(A, aw, yw, false) + extend(B, bw, yw, false)) & m;
    case '$sub': return (extend(A, aw, yw, both) - extend(B, bw, yw, both)) & m;
    case '$mul': return (both ? toSigned(ax(), yw) * toSigned(bx(), yw) : extend(A, aw, yw, false) * extend(B, bw, yw, false)) & m;
    case '$and': return (extend(A, aw, yw, both) & extend(B, bw, yw, both)) & m;
    case '$or': return (extend(A, aw, yw, both) | extend(B, bw, yw, both)) & m;
    case '$xor': return (extend(A, aw, yw, both) ^ extend(B, bw, yw, both)) & m;
    case '$not': return ~extend(A, aw, yw, as) & m;
    case '$neg': return -extend(A, aw, yw, as) & m;
    case '$shl': return B >= BigInt(yw) ? 0n : (extend(A, aw, yw, as) << B) & m;
    case '$shr': return B >= BigInt(yw) ? 0n : extend(A, aw, yw, as) >> B;
    case '$sshr': {
      const x = toSigned(extend(A, aw, yw, as), yw);
      const s = B >= BigInt(yw) ? BigInt(yw) : B;
      return (as ? x >> s : extend(A, aw, yw, false) >> s) & m;
    }
    case '$eq': return ca() === cb() ? 1n : 0n;
    case '$ne': return ca() !== cb() ? 1n : 0n;
    case '$lt': return ca() < cb() ? 1n : 0n;
    case '$le': return ca() <= cb() ? 1n : 0n;
    case '$gt': return ca() > cb() ? 1n : 0n;
    case '$ge': return ca() >= cb() ? 1n : 0n;
    case '$reduce_and': return (A & mask(aw)) === mask(aw) ? 1n : 0n;
    case '$reduce_or': return (A & mask(aw)) !== 0n ? 1n : 0n;
    case '$reduce_xor': {
      let x = A & mask(aw);
      let n = 0n;
      while (x) {
        n ^= x & 1n;
        x >>= 1n;
      }
      return n;
    }
    case '$mux': return a.S ? B : A;
    case '$pmux': {
      const w = p('WIDTH');
      for (let i = 0; i < p('S_WIDTH'); i++) if ((a.S! >> BigInt(i)) & 1n) return (B >> BigInt(i * w)) & mask(w);
      return A;
    }
    default: {
      const gate = evalGate(type, a);
      if (gate === undefined) throw new Error(`the netlist simulator does not know ${type}`);
      return gate;
    }
  }
}

/**
 * The gate-level cells Yosys's `simplemap`, `techmap` and `abc` write (`$_AND_`, `$_MUX_`, …): one bit each, ports
 * A, B, C, D, S and Y. `undefined` for a type that is not one of them.
 */
function evalGate(type: string, a: Record<string, bigint>): bigint | undefined {
  const A = a.A ?? 0n;
  const B = a.B ?? 0n;
  const C = a.C ?? 0n;
  const D = a.D ?? 0n;
  const S = a.S ?? 0n;
  const bit = (x: bigint) => (x ? 0n : 1n);
  switch (type) {
    case '$_BUF_': return A;
    case '$_NOT_': return A ^ 1n;
    case '$_AND_': return A & B;
    case '$_NAND_': return (A & B) ^ 1n;
    case '$_OR_': return A | B;
    case '$_NOR_': return (A | B) ^ 1n;
    case '$_XOR_': return A ^ B;
    case '$_XNOR_': return (A ^ B) ^ 1n;
    case '$_ANDNOT_': return A & (B ^ 1n);
    case '$_ORNOT_': return A | (B ^ 1n);
    case '$_MUX_': return S ? B : A;
    case '$_NMUX_': return (S ? B : A) ^ 1n;
    case '$_AOI3_': return bit((A & B) | C);
    case '$_OAI3_': return bit((A | B) & C);
    case '$_AOI4_': return bit((A & B) | (C & D));
    case '$_OAI4_': return bit((A | B) & (C | D));
    default: return undefined;
  }
}

interface Flop {
  clk: number;
  d: number[];
  q: number[];
}

interface MemPort {
  clk: number;
  addr: number[];
  data: number[];
}

interface Memory {
  width: number;
  depth: number;
  words: bigint[];
  initial: bigint[];
  reads: MemPort[];
  writes: (MemPort & { en: number[] })[];
}

interface Comb {
  type: string;
  cell: YosysCell;
  path: string;
  ins: Record<string, number[]>;
  out: number[];
}

/** The simulator; `set` and `get` take names of ports and of wires of the top module. */
export class YosysSim {
  private parent: number[] = [0, 1];
  private nets = new Map<string, number>();
  private comb: Comb[] = [];
  private flops: Flop[] = [];
  private mems: Memory[] = [];
  private order: Comb[] = [];
  private value: Uint8Array = new Uint8Array(0);
  private inputs = new Map<string, number[]>();
  private wires = new Map<string, number[]>();
  private clocks = new Map<string, number>();
  private initial: { q: number[]; value: bigint }[] = [];
  private dirty = true;

  constructor(private json: YosysJson, top: string = yosysTopName(json)) {
    const mod = json.modules[top];
    if (!mod) throw new Error(`no module ${top}`);
    const wires = (name: string, bits: YosysBit[]) => this.bitsOf('', name, bits);
    for (const [name, port] of Object.entries(mod.ports)) {
      const ids = wires(name, port.bits);
      this.wires.set(name, ids);
      if (port.direction === 'input') this.inputs.set(name, ids);
    }
    for (const [name, nn] of Object.entries(mod.netnames)) if (!this.wires.has(name)) this.wires.set(name, wires(name, nn.bits));
    this.instantiate(mod, '');
    this.finish(mod);
    this.reset();
  }

  private id(key: string): number {
    let n = this.nets.get(key);
    if (n === undefined) {
      n = this.parent.length;
      this.parent.push(n);
      this.nets.set(key, n);
    }
    return n;
  }

  private find(n: number): number {
    while (this.parent[n] !== n) {
      this.parent[n] = this.parent[this.parent[n]!]!;
      n = this.parent[n]!;
    }
    return n;
  }

  private union(a: number, b: number): void {
    const x = this.find(a);
    const y = this.find(b);
    if (x === y) return;
    // Constants stay representatives.
    if (y < 2) this.parent[x] = y;
    else this.parent[y] = x;
  }

  private bitsOf(path: string, _name: string, bits: YosysBit[]): number[] {
    return bits.map((b) => (b === '0' || b === 'x' || b === 'z' ? 0 : b === '1' ? 1 : this.id(`${path}/${b}`)));
  }

  private instantiate(mod: YosysModule, path: string): void {
    for (const [name, cell] of Object.entries(mod.cells)) {
      const conns: Record<string, number[]> = {};
      for (const [port, bits] of Object.entries(cell.connections)) conns[port] = this.bitsOf(path, name, bits);
      const p = (k: string) => paramInt(cell.parameters[k]);
      if (!cell.type.startsWith('$')) {
        const child = this.json.modules[cell.type];
        if (!child) throw new Error(`no module ${cell.type}`);
        const sub = `${path}${name}.`;
        for (const [port, def] of Object.entries(child.ports)) {
          const inner = this.bitsOf(sub, port, def.bits);
          const outer = conns[port];
          if (outer) inner.forEach((b, i) => this.union(b, outer[i]!));
        }
        this.instantiate(child, sub);
        continue;
      }
      if (cell.type === '$scopeinfo') continue; // Yosys's record of a flattened module: no logic
      if (cell.type === '$dff' || cell.type === '$_DFF_P_') {
        // `$_DFF_P_` is the gate-level flip-flop that Yosys's `dfflegalize` leaves (clock C).
        this.flops.push({ clk: (conns.CLK ?? conns.C)![0]!, d: conns.D!, q: conns.Q! });
        // An init attribute on a wire of this module names the power-up value of these bits.
        continue;
      }
      if (cell.type === '$mem_v2') {
        const R = p('RD_PORTS');
        const W = p('WR_PORTS');
        const ab = p('ABITS');
        const w = p('WIDTH');
        const depth = p('SIZE');
        const init = String(cell.parameters.INIT);
        const words = Array.from({ length: depth }, (_, i) => {
          const s = init.slice(init.length - (i + 1) * w, init.length - i * w);
          return /^[01]+$/.test(s) ? BigInt(`0b${s}`) : 0n;
        });
        const slice = (a: number[], i: number, n: number) => a.slice(i * n, (i + 1) * n);
        this.mems.push({
          width: w,
          depth,
          words: words.slice(),
          initial: words,
          reads: Array.from({ length: R }, (_, i) => ({ clk: conns.RD_CLK![i]!, addr: slice(conns.RD_ADDR!, i, ab), data: slice(conns.RD_DATA!, i, w) })),
          writes: Array.from({ length: W }, (_, i) => ({ clk: conns.WR_CLK![i]!, addr: slice(conns.WR_ADDR!, i, ab), data: slice(conns.WR_DATA!, i, w), en: slice(conns.WR_EN!, i, w) })),
        });
        continue;
      }
      const spec = { out: conns.Y! };
      const ins: Record<string, number[]> = {};
      for (const port of ['A', 'B', 'C', 'D', 'S']) if (conns[port]) ins[port] = conns[port]!;
      this.comb.push({ type: cell.type, cell, path, ins, out: spec.out });
    }
    // The power-up values are the init attributes of this module's wires.
    for (const nn of Object.values(mod.netnames)) {
      const init = nn.attributes.init;
      // Yosys writes `init` most significant bit first, with `x` for a bit that has no power-up value.
      if (typeof init === 'string' && /^[01x]+$/.test(init.trim()) && /[01]/.test(init)) this.initial.push({ q: this.bitsOf(path, '', nn.bits), value: BigInt(`0b${init.trim().replace(/x/g, '0')}`) });
    }
  }

  private finish(top: YosysModule): void {
    // Representatives.
    const rep = (a: number[]) => a.map((n) => this.find(n));
    for (const c of this.comb) {
      c.out = rep(c.out);
      for (const k of Object.keys(c.ins)) c.ins[k] = rep(c.ins[k]!);
    }
    for (const f of this.flops) {
      f.clk = this.find(f.clk);
      f.d = rep(f.d);
      f.q = rep(f.q);
    }
    for (const m of this.mems) {
      for (const r of m.reads) {
        r.clk = this.find(r.clk);
        r.addr = rep(r.addr);
        r.data = rep(r.data);
      }
      for (const x of m.writes) {
        x.clk = this.find(x.clk);
        x.addr = rep(x.addr);
        x.data = rep(x.data);
        x.en = rep(x.en);
      }
    }
    for (const i of this.initial) i.q = rep(i.q);
    for (const [k, v] of this.inputs) this.inputs.set(k, rep(v));
    for (const [k, v] of this.wires) this.wires.set(k, rep(v));
    for (const [name, port] of Object.entries(top.ports)) if (port.direction === 'input') this.clocks.set(name, this.find(this.wires.get(name)![0]!));
    this.value = new Uint8Array(this.parent.length);
    this.value[1] = 1;
    // Dependency order: a cell after the cells that drive its inputs.
    const producer = new Map<number, Comb>();
    for (const c of this.comb) for (const n of c.out) producer.set(n, c);
    const done = new Set<Comb>();
    const visiting = new Set<Comb>();
    const visit = (c: Comb): void => {
      if (done.has(c)) return;
      if (visiting.has(c)) throw new Error(`combinational loop through ${c.cell.type} in ${c.path || 'the top module'}`);
      visiting.add(c);
      for (const ins of Object.values(c.ins)) for (const n of ins) { const p = producer.get(n); if (p) visit(p); }
      visiting.delete(c);
      done.add(c);
      this.order.push(c);
    };
    for (const c of this.comb) visit(c);
  }

  private read(bits: number[]): bigint {
    let v = 0n;
    for (let i = bits.length - 1; i >= 0; i--) v = (v << 1n) | BigInt(this.value[bits[i]!]!);
    return v;
  }

  private write(bits: number[], v: bigint): void {
    bits.forEach((b, i) => {
      if (b >= 2) this.value[b] = Number((v >> BigInt(i)) & 1n);
    });
  }

  /** Registers, memories and read data back to their power-up values; the inputs keep theirs. */
  reset(): void {
    for (const f of this.flops) this.write(f.q, 0n);
    for (const i of this.initial) this.write(i.q, i.value);
    for (const m of this.mems) for (const r of m.reads) this.write(r.data, 0n);
    for (const m of this.mems) m.words = m.initial.slice();
    this.dirty = true;
  }

  set(name: string, v: bigint | number): void {
    const bits = this.inputs.get(name);
    if (!bits) throw new Error(`no input port ${name}`);
    this.write(bits, BigInt(v));
    this.dirty = true;
  }

  private settle(): void {
    if (!this.dirty) return;
    for (const c of this.order) {
      const a: Record<string, bigint> = {};
      for (const [k, bits] of Object.entries(c.ins)) a[k] = this.read(bits);
      this.write(c.out, evalInternal(c.type, (k) => paramInt(c.cell.parameters[k]), a));
    }
    this.dirty = false;
  }

  get(name: string): bigint {
    const bits = this.wires.get(name);
    if (!bits) throw new Error(`no port or wire ${name}`);
    this.settle();
    return this.read(bits);
  }

  names(): string[] {
    return [...this.wires.keys()];
  }

  /** A rising edge of the named top-level clock input, or of every clock when omitted. */
  tick(clock?: string): void {
    this.settle();
    const edge = clock === undefined ? undefined : this.clocks.get(clock);
    if (clock !== undefined && edge === undefined) throw new Error(`no input port ${clock}`);
    const hit = (n: number) => edge === undefined || n === edge;
    const commits: (() => void)[] = [];
    for (const f of this.flops) {
      if (!hit(f.clk)) continue;
      const d = this.read(f.d);
      commits.push(() => this.write(f.q, d));
    }
    for (const m of this.mems) {
      for (const r of m.reads) {
        if (!hit(r.clk)) continue;
        const a = this.read(r.addr);
        const d = a < BigInt(m.depth) ? m.words[Number(a)]! : 0n;
        commits.push(() => this.write(r.data, d));
      }
      for (const w of m.writes) {
        if (!hit(w.clk)) continue;
        const a = this.read(w.addr);
        const en = this.read(w.en);
        const d = this.read(w.data);
        if (a >= BigInt(m.depth)) continue;
        const old = m.words[Number(a)]!;
        const next = (old & ~en) | (d & en);
        commits.push(() => (m.words[Number(a)] = next));
      }
    }
    for (const f of commits) f();
    this.dirty = true;
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) this.tick();
  }
}
