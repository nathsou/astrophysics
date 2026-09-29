/**
 * From mapped LUTs to a netlist of logic cells: the input of packing, placement and routing.
 *
 * - every LUT becomes a cell; a flip-flop absorbs the LUT that feeds only its D input (or gets a copy of it),
 *   and otherwise gets a pass-through LUT;
 * - carry chains become runs of cells linked by the dedicated carry wire (see `carry.ts`);
 * - literals that need the opposite polarity of a node's signal get an inverter cell;
 * - constants that must be real signals get a constant cell;
 * - RAMs become block RAM slices.
 *
 * Signals are numbered **nets**. Each net has one driver: a cell output, an input port or a block RAM output.
 * A cell's LUT input list `inputs` holds nets; for ordinary cells the LUT pins are assigned by the router
 * (a LUT's inputs are interchangeable, the truth table is permuted to match), for chain cells the pins are fixed:
 * I1 and I2 carry the operands.
 */
import type { Aig } from './aig';
import type { CarryPlan } from './carry';
import { dependsOn, flipVar, notTt, replicate } from './cuts';
import { FlowError, sinkLiterals, type Design } from './design';
import type { MapResult } from './map';
import { BRAM_WIDTHS } from '../devices/vfpga-arch';

export interface LcNet {
  id: number;
  name: string;
  /** AIG node the net carries (−1 if none). */
  node: number;
  driver: { kind: 'lc'; lc: number } | { kind: 'port'; port: number } | { kind: 'ram'; ram: number; bit: number };
}

export interface LcFf {
  clk: number;
  /** Net of the clock enable and of the set/reset, −1 if unused. */
  ce: number;
  sr: number;
  srAsync: boolean;
  srVal: 0 | 1;
  init: 0 | 1;
}

export type LcKind = 'lut' | 'ff' | 'const' | 'invert' | 'chain-sum' | 'chain-inject' | 'chain-readout';

export interface LcSpec {
  id: number;
  kind: LcKind;
  /**
   * LUT input nets. Ordinary cells: the distinct nets the truth table depends on, in table order (fewer than
   * four; the router picks the pins). Chain cells: positions I0…I3, −1 where unused.
   */
  inputs: number[];
  fixedPins: boolean;
  /** 16-bit truth table over the input positions. */
  tt: number;
  ff?: LcFf;
  /** Net of the cell's output (the flip-flop's Q if `ff`), −1 if unused. */
  out: number;
  /** Carry configuration. */
  i3Carry: boolean;
  carryChain: boolean;
  carryConst: 0 | 1;
  /** Chain this cell belongs to and its position, −1 if none. */
  chain: number;
  chainPos: number;
  /** Source elements this cell implements (indices into the design's sources). */
  origins: number[];
  label: string;
}

export interface RamBlock {
  id: number;
  name: string;
  /** Width mode of the block RAM (index into BRAM_WIDTHS) and its asynchronous read flag. */
  mode: number;
  asyncRead: boolean;
  /** Data bits of the design's RAM held by this block: [bitLo, bitHi). */
  bitLo: number;
  bitHi: number;
  /** Nets per RAM pin (−1 unconnected): RADDR0…10, WADDR0…10, WDATA0…15. */
  raddr: number[];
  waddr: number[];
  wdata: number[];
  re: number;
  we: number;
  clk: number;
  /** Net of each data output bit (−1 unused). */
  dout: number[];
  /** Initial words of this slice. */
  contents: number[];
  origins: number[];
}

export interface PortSpec {
  name: string;
  dir: 'in' | 'out';
  clock: boolean;
  /** In: the net it drives. Out: the net it reads. */
  net: number;
  src: number;
}

export interface LcNetlist {
  nets: LcNet[];
  lcs: LcSpec[];
  /** Cell ids of each carry chain in carry order. */
  chains: number[][];
  ports: PortSpec[];
  rams: RamBlock[];
  sources: Design['sources'];
  warnings: string[];
}

export function buildLcNetlist(d: Design, map: MapResult, plan: CarryPlan): LcNetlist {
  const aig: Aig = d.aig;
  const nets: LcNet[] = [];
  const lcs: LcSpec[] = [];
  const chains: number[][] = [];
  const nodeNet = new Int32Array(aig.n).fill(-1);
  const warnings = [...d.warnings];

  const newNet = (name: string, node: number, driver: LcNet['driver']): number => {
    nets.push({ id: nets.length, name, node, driver });
    return nets.length - 1;
  };
  const newLc = (kind: LcKind, label: string, origins: number[] = []): LcSpec => {
    const lc: LcSpec = { id: lcs.length, kind, inputs: [], fixedPins: false, tt: 0, out: -1, i3Carry: false, carryChain: false, carryConst: 0, chain: -1, chainPos: -1, origins, label };
    lcs.push(lc);
    return lc;
  };

  // Reference counting for merging decisions and polarity: every use of a node as a leaf of a LUT or as a sink.
  const isLutRoot = (v: number) => map.lutOf[v]! >= 0;
  const refTotal = new Int32Array(aig.n);
  const posRef = new Uint8Array(aig.n);
  const negRef = new Uint8Array(aig.n);
  const sink = (l: number) => {
    const v = l >> 1;
    refTotal[v]!++;
    if (l & 1) negRef[v] = 1;
    else posRef[v] = 1;
  };
  for (const l of sinkLiterals(d)) sink(l);
  for (const l of plan.extraRoots) sink(l);
  for (const lut of map.luts) for (const leaf of lut.leaves) refTotal[leaf]!++;

  // Registers first: which LUTs merge into a flip-flop cell.
  const merged = new Int32Array(aig.n).fill(-1); // node → register index
  d.regs.forEach((r, i) => {
    const v = r.d >> 1;
    if (isLutRoot(v) && refTotal[v] === 1 && !plan.leaf[v]) merged[v] = i;
  });

  // Nets of ports, RAM outputs, register outputs, chain outputs, LUT roots.
  const portNet: number[] = [];
  d.ports.forEach((p, i) => {
    if (p.dir === 'in') {
      const net = newNet(p.name, p.lit >> 1, { kind: 'port', port: i });
      nodeNet[p.lit >> 1] = net;
      portNet[i] = net;
    }
  });
  const regLc: LcSpec[] = d.regs.map((r) => {
    const lc = newLc('ff', r.name, []);
    lc.out = newNet(r.name, r.q >> 1, { kind: 'lc', lc: lc.id });
    nodeNet[r.q >> 1] = lc.out;
    return lc;
  });
  // Block RAMs: shells with their data-output nets (wide or deep RAMs need several blocks); pins are filled in below.
  const rams: RamBlock[] = [];
  const ramOfDesign: RamBlock[][] = d.rams.map((m) => {
    const need = 1 << m.addrBits;
    const mode = BRAM_WIDTHS.findIndex((w) => need <= 4096 / w);
    if (mode < 0) throw new FlowError(`RAM ${m.name} has ${need} words; a block RAM holds at most 2048.`, 'ram-mapping', [m.name]);
    const w = BRAM_WIDTHS[mode]!;
    const blocks: RamBlock[] = [];
    for (let lo = 0; lo < m.dataBits; lo += w) {
      const hi = Math.min(m.dataBits, lo + w);
      const id = rams.length;
      const dout = Array.from({ length: 16 }, (_, i) => {
        if (lo + i >= hi) return -1;
        const q = m.dout[lo + i]! >> 1;
        return (nodeNet[q] = newNet(`${m.name}.DO${lo + i}`, q, { kind: 'ram', ram: id, bit: i }));
      });
      const mask = 2 ** (hi - lo);
      const blk: RamBlock = {
        id,
        name: m.dataBits > w ? `${m.name}[${hi - 1}:${lo}]` : m.name,
        mode,
        asyncRead: m.async,
        bitLo: lo,
        bitHi: hi,
        raddr: [],
        waddr: [],
        wdata: [],
        re: -1,
        we: -1,
        clk: m.clk,
        dout,
        contents: m.contents.map((word) => Math.floor(word / 2 ** lo) % mask),
        origins: [m.src],
      };
      rams.push(blk);
      blocks.push(blk);
    }
    return blocks;
  });
  const chainLcs: LcSpec[][] = plan.chains.map((c, ci) => {
    const cells: LcSpec[] = [];
    if (c.cin.kind === 'lit') cells.push(newLc('chain-inject', `chain${ci}.cin`));
    c.stages.forEach((s, si) => {
      const lc = newLc('chain-sum', `chain${ci}.${si}`);
      lc.out = newNet(`chain${ci}.s${si}`, s.sum, { kind: 'lc', lc: lc.id });
      nodeNet[s.sum] = lc.out;
      cells.push(lc);
    });
    if (c.readout) {
      const lc = newLc('chain-readout', `chain${ci}.cout`);
      const last = c.stages[c.stages.length - 1]!;
      lc.out = newNet(`chain${ci}.cout`, last.carry, { kind: 'lc', lc: lc.id });
      nodeNet[last.carry] = lc.out;
      cells.push(lc);
    }
    chains.push(cells.map((x) => x.id));
    cells.forEach((lc, pos) => {
      lc.chain = ci;
      lc.chainPos = pos;
    });
    return cells;
  });

  // Polarity of LUT roots that stay separate cells: stored inverted when only inverted uses exist. The same
  // holds for the outputs of chain cells, whose LUT tables can produce either polarity.
  const phase = new Uint8Array(aig.n);
  for (let v = 1; v < aig.n; v++) if (plan.leaf[v] && !posRef[v] && negRef[v]) phase[v] = 1;
  const lutLc = new Map<number, LcSpec>();
  map.luts.forEach((lut) => {
    const v = lut.node;
    if (merged[v]! >= 0 || plan.leaf[v]) return;
    if (!posRef[v] && negRef[v]) phase[v] = 1;
    const lc = newLc('lut', `n${v}`);
    lc.out = newNet(`n${v}`, v, { kind: 'lc', lc: lc.id });
    nodeNet[v] = lc.out;
    lutLc.set(v, lc);
  });

  const consts: (number | undefined)[] = [undefined, undefined];
  const constNet = (value: 0 | 1): number => {
    let n = consts[value];
    if (n === undefined) {
      const lc = newLc('const', `const${value}`);
      lc.tt = value ? 0xffff : 0;
      lc.out = n = newNet(`const${value}`, -1, { kind: 'lc', lc: lc.id });
      consts[value] = n;
    }
    return n;
  };
  const invNets = new Map<number, number>();
  /** A net carrying the literal's value (a constant cell, the node's net, or an inverter). */
  const sinkNet = (l: number): number => {
    const v = l >> 1;
    if (v === 0) return constNet((l & 1) as 0 | 1);
    const base = nodeNet[v]!;
    if (base < 0) throw new FlowError(`internal error: node ${v} has no signal`, 'lut-mapping');
    if (((phase[v] ?? 0) ^ (l & 1)) === 0) return base;
    let inv = invNets.get(v);
    if (inv === undefined) {
      const lc = newLc('invert', `~${nets[base]!.name}`, aig.origins[v] ?? []);
      lc.inputs = [base];
      lc.tt = replicate(0b01, 1);
      lc.out = inv = newNet(`~${nets[base]!.name}`, v, { kind: 'lc', lc: lc.id });
      invNets.set(v, inv);
    }
    return inv;
  };

  /** Origins of the AIG cone of `root` down to `leaves`. */
  const coneOrigins = (root: number, leaves: number[]): number[] => {
    const out: number[] = [];
    const seen = new Set<number>(leaves);
    const stack = [root];
    while (stack.length) {
      const v = stack.pop()!;
      if (seen.has(v) || !aig.isAnd(v)) continue;
      seen.add(v);
      for (const o of aig.origins[v] ?? []) if (!out.includes(o)) out.push(o);
      stack.push(aig.fan0[v]! >> 1, aig.fan1[v]! >> 1);
    }
    return out;
  };

  /** The LUT of node v as (input nets, table), compacted to the inputs it depends on, optionally complemented. */
  const lutOf = (v: number, complement: boolean): { inputs: number[]; tt: number; origins: number[] } => {
    const lut = map.luts[map.lutOf[v]!]!;
    let tt = lut.tt;
    let m = lut.leaves.length;
    let inputs = lut.leaves.map((leaf) => nodeNet[leaf]!);
    lut.leaves.forEach((leaf, i) => {
      if (phase[leaf]) tt = flipVar(tt, i, m);
    });
    if (complement) tt = notTt(tt, m);
    // Drop inputs the function does not depend on, and merge duplicates.
    for (let i = m - 1; i >= 0; i--) {
      if (!dependsOn(tt, i, m)) {
        tt = dropVar(tt, i, m);
        inputs = inputs.filter((_, j) => j !== i);
        m--;
      }
    }
    return { inputs, tt: replicate(tt, m), origins: coneOrigins(v, lut.leaves) };
  };

  // Ordinary LUT cells.
  for (const [v, lc] of lutLc) {
    const r = lutOf(v, phase[v] === 1);
    lc.inputs = r.inputs;
    lc.tt = r.tt;
    lc.origins = r.origins;
    if (r.inputs.length === 0) lc.kind = 'const';
  }

  // Registers.
  d.regs.forEach((r, i) => {
    const lc = regLc[i]!;
    const v = r.d >> 1;
    const c = r.d & 1;
    let ce = r.ce;
    let dl = r.d;
    if (ce === 0) {
      dl = r.q;
      ce = -1;
    } else if (ce === 1) ce = -1;
    const src = d.sources[r.src];
    lc.origins = src ? [r.src] : [];
    if (dl !== r.d) {
      lc.inputs = [nodeNet[r.q >> 1]!];
      lc.tt = replicate(0b10, 1);
    } else if (v === 0) {
      lc.tt = c ? 0xffff : 0;
    } else if (isLutRoot(v) && !plan.leaf[v]) {
      const x = lutOf(v, c === 1);
      lc.inputs = x.inputs;
      lc.tt = x.tt;
      lc.origins = [...new Set([...lc.origins, ...x.origins])];
      if (x.inputs.length === 0) lc.tt = replicate(x.tt, 0);
    } else {
      // A pass-through of a primary input, a register output or a chain output.
      const net = nodeNet[v]!;
      lc.inputs = [net];
      lc.tt = replicate(c ? 0b01 : 0b10, 1);
    }
    const sr = r.sr === 0 ? -1 : r.sr;
    lc.ff = {
      clk: r.clk,
      ce: ce >= 0 ? sinkNet(ce) : -1,
      sr: sr >= 0 ? sinkNet(sr) : -1,
      srAsync: r.srAsync,
      srVal: r.srVal,
      init: r.init,
    };
  });

  // Chains.
  plan.chains.forEach((c, ci) => {
    const cells = chainLcs[ci]!;
    let k = 0;
    const withInject = c.cin.kind === 'lit';
    if (withInject) {
      const lc = cells[k++]!;
      const x = sinkNet((c.cin as { lit: number }).lit);
      lc.fixedPins = true;
      lc.inputs = [-1, x, x, -1];
      lc.tt = 0;
      lc.carryChain = false;
      lc.carryConst = 0;
    }
    c.stages.forEach((s, si) => {
      const lc = cells[k++]!;
      lc.fixedPins = true;
      lc.inputs = [-1, sinkNet(s.a), sinkNet(s.b), -1];
      lc.i3Carry = true;
      lc.carryChain = withInject || si > 0;
      lc.carryConst = !withInject && si === 0 && c.cin.kind === 'const' ? c.cin.value : 0;
      let tt = 0;
      for (let r = 0; r < 16; r++) tt |= ((((r >> 1) ^ (r >> 2) ^ (r >> 3)) & 1) ^ s.sumPol) << r;
      lc.tt = phase[s.sum] ? notTt(tt, 4) : tt;
      lc.origins = [...new Set([...(aig.origins[s.sum] ?? []), ...(s.carry >= 0 ? (aig.origins[s.carry] ?? []) : [])])];
    });
    if (c.readout) {
      const lc = cells[k++]!;
      const last = c.stages[c.stages.length - 1]!;
      lc.fixedPins = true;
      lc.inputs = [-1, -1, -1, -1];
      lc.i3Carry = true;
      lc.carryChain = true;
      lc.tt = (last.carryPol ^ (phase[last.carry] ?? 0)) ? 0x00ff : 0xff00;
      lc.origins = aig.origins[last.carry] ?? [];
    }
    if (withInject) cells[0]!.origins = aig.origins[(c.cin as { lit: number }).lit >> 1] ?? [];
  });

  // Ports.
  const ports: PortSpec[] = d.ports.map((p, i) => ({
    name: p.name,
    dir: p.dir,
    clock: p.clock,
    net: p.dir === 'in' ? portNet[i]! : sinkNet(p.lit),
    src: p.src,
  }));

  // RAM pins.
  d.rams.forEach((m, mi) => {
    const pinNet = (l: number, dflt: 0 | 1): number => {
      if (l >> 1 === 0) return (l & 1) === dflt ? -1 : constNet((l & 1) as 0 | 1);
      return sinkNet(l);
    };
    for (const blk of ramOfDesign[mi]!) {
      const lo = blk.bitLo;
      const hi = blk.bitHi;
      blk.raddr = Array.from({ length: 11 }, (_, i) => (i < m.addrBits ? pinNet(m.raddr[i]!, 0) : -1));
      blk.waddr = Array.from({ length: 11 }, (_, i) => (i < m.waddr.length ? pinNet(m.waddr[i]!, 0) : -1));
      blk.wdata = Array.from({ length: 16 }, (_, i) => (lo + i < hi && lo + i < m.wdata.length ? pinNet(m.wdata[lo + i]!, 0) : -1));
      blk.re = m.re >= 0 ? pinNet(m.re, 1) : -1;
      blk.we = pinNet(m.we, 0);
    }
  });

  return { nets, lcs, chains, ports, rams, sources: d.sources, warnings };
}

/** Remove variable i from a table over m variables (the function must not depend on it). */
function dropVar(tt: number, i: number, m: number): number {
  let out = 0;
  let w = 0;
  for (let r = 0; r < 1 << m; r++) {
    if ((r >> i) & 1) continue;
    out |= ((tt >> r) & 1) << w++;
  }
  return out;
}
