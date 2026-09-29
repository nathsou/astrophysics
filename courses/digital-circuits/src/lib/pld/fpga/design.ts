/**
 * The design between front end and mapper: an AIG of the combinational logic plus the things the AIG cannot hold
 * (ports, registers, RAMs). Literals refer to `aig`. Front ends (`frontend.ts` for gate-level netlists,
 * `fromrtl.ts` for DCL's RTL) produce it; `synth.ts` optimises it; `map.ts` turns it into LUTs.
 */
import type { Aig } from './aig';

export class FlowError extends Error {
  constructor(
    message: string,
    readonly stage: string,
    readonly elements: string[] = [],
  ) {
    super(message);
    this.name = 'FlowError';
  }
}

/** A source element (of the netlist or of the RTL), for cross-probing. */
export interface SourceInfo {
  id: string;
  /** Hierarchical path: the instance path without the element's own name ("" at the top). */
  path: string;
  type: string;
  /** Source position in DCL, when known. */
  line?: number;
  col?: number;
}

export interface Port {
  name: string;
  dir: 'in' | 'out';
  /** Used as a clock (drives flip-flop or RAM clock pins): must sit on a dedicated global-clock pad. */
  clock: boolean;
  /** For inputs: the PI literal. For outputs: the literal that drives the pad. */
  lit: number;
  /** Index into `sources`. */
  src: number;
}

export interface Reg {
  name: string;
  /** PI literal of the register output. */
  q: number;
  d: number;
  /** Index of the clock port. */
  clk: number;
  /** Clock enable literal, −1 for always enabled. */
  ce: number;
  /** Set/reset literal, −1 for none. */
  sr: number;
  srAsync: boolean;
  srVal: 0 | 1;
  init: 0 | 1;
  src: number;
}

export interface Ram {
  name: string;
  /** Asynchronous read (like the parts bin's RAM and ROM). */
  async: boolean;
  addrBits: number;
  dataBits: number;
  raddr: number[];
  waddr: number[];
  wdata: number[];
  /** Write enable literal (0 for a ROM). */
  we: number;
  /** Read enable literal; −1 for always. */
  re: number;
  /** Index of the clock port, −1 for a ROM. */
  clk: number;
  /** Data-out PI literals. */
  dout: number[];
  contents: number[];
  src: number;
}

export interface Design {
  aig: Aig;
  ports: Port[];
  regs: Reg[];
  rams: Ram[];
  sources: SourceInfo[];
  warnings: string[];
  name: string;
}

export const pathOf = (id: string): string => {
  const i = id.lastIndexOf('/');
  return i < 0 ? '' : id.slice(0, i);
};

/** Every literal the mapper has to produce a signal for. */
export function sinkLiterals(d: Design): number[] {
  const out: number[] = [];
  for (const p of d.ports) if (p.dir === 'out') out.push(p.lit);
  for (const r of d.regs) {
    out.push(r.d);
    if (r.ce >= 0) out.push(r.ce);
    if (r.sr >= 0) out.push(r.sr);
  }
  for (const m of d.rams) {
    out.push(...m.raddr, ...m.waddr, ...m.wdata, m.we);
    if (m.re >= 0) out.push(m.re);
  }
  return out;
}

/** Apply `f` to every literal in the design (after the AIG was rebuilt). */
export function mapLiterals(d: Design, aig: Aig, f: (l: number) => number): Design {
  return {
    ...d,
    aig,
    ports: d.ports.map((p) => ({ ...p, lit: f(p.lit) })),
    regs: d.regs.map((r) => ({ ...r, q: f(r.q), d: f(r.d), ce: r.ce >= 0 ? f(r.ce) : -1, sr: r.sr >= 0 ? f(r.sr) : -1 })),
    rams: d.rams.map((m) => ({
      ...m,
      raddr: m.raddr.map(f),
      waddr: m.waddr.map(f),
      wdata: m.wdata.map(f),
      we: f(m.we),
      re: m.re >= 0 ? f(m.re) : -1,
      dout: m.dout.map(f),
    })),
  };
}
