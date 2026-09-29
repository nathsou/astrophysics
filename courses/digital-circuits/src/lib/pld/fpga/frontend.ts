/**
 * Front end for gate-level netlists: a `FlatNetlist` of digital catalog types becomes a `Design` (an AIG plus
 * ports, registers and RAMs).
 *
 * Supported element types: sources `toggle`, `button`, `clock`, `const`, `rail`, `ground`; sinks `indicator`,
 * `probe`, `seven-seg`, `hex-display`; gates `and`, `or`, `nand`, `nor`, `xor`, `xnor`, `not`, `buffer`; blocks
 * `mux`, `decoder`, `adder`, `magnitude-comparator`; storage `dff`, `dffe`, `dffr`, `register`, `counter`,
 * `shift-register`; memories `ram` and `rom` (asynchronous read, as in the parts bin).
 *
 * Conventions: sources become input ports named after the element, sinks become output ports (a pin of a display is
 * named `id.pin`); a net nobody drives reads as 0 (control pins EN read as 1), with a warning; clock pins must be
 * driven by an input port (derived clocks are refused: use clock enables). A combinational loop is an error.
 * Every flip-flop powers up at its `init` parameter ('X' counts as 0).
 */
import type { FlatElement, FlatNetlist } from '../../sim/netlist/types';
import { Aig, FALSE, TRUE } from './aig';
import { FlowError, pathOf, type Design, type Port, type Ram, type Reg, type SourceInfo } from './design';

const OUT_PIN: Record<string, RegExp> = {
  toggle: /^Y$/,
  button: /^Y$/,
  clock: /^Y$/,
  const: /^Y$/,
  rail: /^v$/,
  ground: /^g$/,
  and: /^Y$/,
  or: /^Y$/,
  nand: /^Y$/,
  nor: /^Y$/,
  xor: /^Y$/,
  xnor: /^Y$/,
  not: /^Y$/,
  buffer: /^Y$/,
  mux: /^Y$/,
  decoder: /^Y\d+$/,
  adder: /^(S\d+|COUT)$/,
  'magnitude-comparator': /^(EQ|LT|GT)$/,
  dff: /^(Q|Qn)$/,
  dffe: /^(Q|Qn)$/,
  dffr: /^(Q|Qn)$/,
  register: /^Q\d+$/,
  counter: /^(Q\d+|CO)$/,
  'shift-register': /^(Q\d+|SO)$/,
  ram: /^DO\d+$/,
  rom: /^DO\d+$/,
};
const SINKS = new Set(['indicator', 'probe', 'seven-seg', 'hex-display']);
const GATES = new Set(['and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not', 'buffer']);
const SEQ = new Set(['dff', 'dffe', 'dffr', 'register', 'counter', 'shift-register']);

export const SUPPORTED_TYPES = [...Object.keys(OUT_PIN), ...SINKS];

const isOutPin = (type: string, pin: string): boolean => OUT_PIN[type]?.test(pin) ?? false;

const truthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** Bits of a bus: pins `prefix0`, `prefix1`, … */
const busPins = (el: FlatElement, prefix: string): string[] => {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  return el.pinNames.filter((p) => re.test(p)).sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
};

export function designFromNetlist(nl: FlatNetlist, name = 'design'): Design {
  const aig = new Aig(Math.max(1024, nl.elements.length * 8));
  const sources: SourceInfo[] = nl.elements.map((e) => ({ id: e.id, path: pathOf(e.id), type: e.type }));
  const ports: Port[] = [];
  const regs: Reg[] = [];
  const rams: Ram[] = [];
  const warnings: string[] = [];

  const unsupported = nl.elements.filter((e) => !(e.type in OUT_PIN) && !SINKS.has(e.type));
  if (unsupported.length) {
    const types = [...new Set(unsupported.map((e) => e.type))];
    throw new FlowError(
      `Element type${types.length > 1 ? 's' : ''} ${types.join(', ')} cannot be synthesised for an FPGA (supported: ${SUPPORTED_TYPES.join(', ')}).`,
      'synthesis',
      unsupported.map((e) => e.id),
    );
  }

  // Drivers of nets.
  const driven = new Uint8Array(nl.netCount);
  if (nl.ground !== undefined) driven[nl.ground] = 1;
  for (const e of nl.elements) e.pins.forEach((n, i) => (isOutPin(e.type, e.pinNames[i]!) ? (driven[n] = 1) : undefined));

  const netLit = new Int32Array(nl.netCount).fill(-1);
  if (nl.ground !== undefined) netLit[nl.ground] = FALSE;
  const warned = new Set<number>();
  const defaultOf = (pin: string): number => (pin === 'EN' ? TRUE : FALSE);
  /** Literal of an input pin. */
  const pinLit = (el: FlatElement, pin: string): number => {
    const i = el.pinNames.indexOf(pin);
    if (i < 0) return defaultOf(pin);
    const n = el.pins[i]!;
    if (!driven[n]) {
      if (!warned.has(n)) {
        warned.add(n);
        warnings.push(`Net ${nl.netNames[n] ?? n} (pin ${pin} of ${el.id}) has no driver; it is read as ${defaultOf(pin) === TRUE ? 1 : 0}.`);
      }
      return defaultOf(pin);
    }
    return netLit[n]!;
  };
  const setOut = (el: FlatElement, pin: string, l: number) => {
    const i = el.pinNames.indexOf(pin);
    if (i >= 0) netLit[el.pins[i]!] = l;
  };
  const inputNets = (el: FlatElement): number[] => {
    const out: number[] = [];
    el.pins.forEach((n, i) => {
      if (!isOutPin(el.type, el.pinNames[i]!) && driven[n]) out.push(n);
    });
    return out;
  };

  const portIndexByLit = new Map<number, number>();
  const addPort = (p: Port) => {
    ports.push(p);
    if (p.dir === 'in') portIndexByLit.set(p.lit, ports.length - 1);
  };
  const clockPort = (el: FlatElement, pin: string): number => {
    const l = pinLit(el, pin);
    const pi = portIndexByLit.get(l);
    if (pi === undefined) {
      throw new FlowError(`The clock of ${el.id} (pin ${pin}) is not an input of the device. The FPGA has global clock networks fed from pads only: derive slower rates with clock enables instead.`, 'synthesis', [el.id]);
    }
    ports[pi]!.clock = true;
    return pi;
  };

  const seqState = new Map<number, { q: number[]; dout?: number[] }>();

  // 1. Sources and the outputs of storage elements are inputs of the AIG.
  nl.elements.forEach((el, ei) => {
    aig.cur = [ei];
    switch (el.type) {
      case 'toggle':
      case 'button':
      case 'clock': {
        const l = aig.addPi();
        setOut(el, 'Y', l);
        addPort({ name: el.id, dir: 'in', clock: el.type === 'clock', lit: l, src: ei });
        break;
      }
      case 'const':
        setOut(el, 'Y', truthy(el.params.value ?? 1) || Number(el.params.value ?? 1) === 1 ? TRUE : FALSE);
        break;
      case 'rail':
        setOut(el, 'v', Number(el.params.voltage ?? 5) > 0 ? TRUE : FALSE);
        break;
      case 'ground':
        setOut(el, 'g', FALSE);
        break;
      case 'dff':
      case 'dffe':
      case 'dffr': {
        const q = aig.addPi();
        setOut(el, 'Q', q);
        setOut(el, 'Qn', q ^ 1);
        seqState.set(ei, { q: [q] });
        break;
      }
      case 'register':
      case 'counter':
      case 'shift-register': {
        const qs = busPins(el, 'Q').map((p) => {
          const q = aig.addPi();
          setOut(el, p, q);
          return q;
        });
        if (el.type === 'shift-register') setOut(el, 'SO', qs[qs.length - 1]!);
        seqState.set(ei, { q: qs });
        break;
      }
      case 'ram':
      case 'rom': {
        const dout = busPins(el, 'DO').map((p) => {
          const q = aig.addPi();
          setOut(el, p, q);
          return q;
        });
        seqState.set(ei, { q: [], dout });
        break;
      }
    }
  });

  // 2. Combinational elements in dependency order (Kahn's algorithm).
  const comb: number[] = [];
  nl.elements.forEach((el, ei) => {
    if (GATES.has(el.type) || ['mux', 'decoder', 'adder', 'magnitude-comparator'].includes(el.type)) comb.push(ei);
    else if (el.type === 'counter') comb.push(ei); // its carry-out CO
  });
  const waiting = new Map<number, number>();
  const waiters: number[][] = Array.from({ length: nl.netCount }, () => []);
  const ready: number[] = [];
  for (const ei of comb) {
    const el = nl.elements[ei]!;
    let deps = el.type === 'counter' ? [el.pins[el.pinNames.indexOf('EN')]!].filter((n) => n !== undefined && driven[n]) : inputNets(el);
    deps = [...new Set(deps)].filter((n) => netLit[n] === -1);
    if (deps.length === 0) ready.push(ei);
    else {
      waiting.set(ei, deps.length);
      for (const n of deps) waiters[n]!.push(ei);
    }
  }
  const done = new Set<number>();
  const release = (net: number) => {
    for (const w of waiters[net]!) {
      const c = waiting.get(w)! - 1;
      waiting.set(w, c);
      if (c === 0) ready.push(w);
    }
    waiters[net] = [];
  };
  // Nets already known (sources, register outputs) release their waiters first.
  for (let n = 0; n < nl.netCount; n++) if (netLit[n] !== -1) release(n);
  while (ready.length) {
    const ei = ready.pop()!;
    if (done.has(ei)) continue;
    done.add(ei);
    const el = nl.elements[ei]!;
    aig.cur = [ei];
    const outs = lowerComb(el, aig, (p) => pinLit(el, p), seqState.get(ei));
    for (const [pin, l] of Object.entries(outs)) {
      const i = el.pinNames.indexOf(pin);
      if (i < 0) continue;
      netLit[el.pins[i]!] = l;
      release(el.pins[i]!);
    }
  }
  if (done.size < comb.length) {
    const stuck = comb.filter((ei) => !done.has(ei)).map((ei) => nl.elements[ei]!.id);
    throw new FlowError(`Combinational loop through ${stuck.slice(0, 8).join(', ')}${stuck.length > 8 ? ` and ${stuck.length - 8} more` : ''}: a loop with no register cannot be built from LUTs and flip-flops (use \`reg\`).`, 'synthesis', stuck);
  }

  // 3. Endpoints: outputs, registers, memories.
  nl.elements.forEach((el, ei) => {
    aig.cur = [ei];
    if (SINKS.has(el.type)) {
      if (el.type === 'indicator' || el.type === 'probe') addPort({ name: el.id, dir: 'out', clock: false, lit: pinLit(el, 'A'), src: ei });
      else for (const p of el.pinNames) addPort({ name: `${el.id}.${p}`, dir: 'out', clock: false, lit: pinLit(el, p), src: ei });
      return;
    }
    if (!SEQ.has(el.type) && el.type !== 'ram' && el.type !== 'rom') return;
    const st = seqState.get(ei)!;
    const initBit = (i: number): 0 | 1 => {
      const v = el.params.init;
      if (typeof v === 'number') return (Math.floor(v / 2 ** i) % 2) as 0 | 1;
      return v === '1' || v === true ? 1 : 0;
    };
    const mk = (i: number, r: Omit<Reg, 'name' | 'q' | 'src' | 'init'> & { init?: 0 | 1 }) => {
      let { d, ce } = r;
      // A constant enable: 1 is "always", 0 holds the value.
      if (ce === TRUE) ce = -1;
      else if (ce === FALSE) {
        d = st.q[i]!;
        ce = -1;
      }
      let sr = r.sr;
      if (sr === FALSE) sr = -1;
      regs.push({ name: st.q.length > 1 ? `${el.id}[${i}]` : el.id, q: st.q[i]!, d, clk: r.clk, ce, sr, srAsync: r.srAsync, srVal: r.srVal, init: r.init ?? 0, src: ei });
    };
    switch (el.type) {
      case 'dff':
        mk(0, { d: pinLit(el, 'D'), clk: clockPort(el, 'CLK'), ce: -1, sr: -1, srAsync: false, srVal: 0, init: initBit(0) });
        break;
      case 'dffe':
        mk(0, { d: pinLit(el, 'D'), clk: clockPort(el, 'CLK'), ce: pinLit(el, 'EN'), sr: -1, srAsync: false, srVal: 0, init: initBit(0) });
        break;
      case 'dffr':
        mk(0, { d: pinLit(el, 'D'), clk: clockPort(el, 'CLK'), ce: -1, sr: pinLit(el, 'CLR'), srAsync: true, srVal: 0, init: initBit(0) });
        break;
      case 'register': {
        const clk = clockPort(el, 'CLK');
        const en = pinLit(el, 'EN');
        const clr = pinLit(el, 'CLR');
        busPins(el, 'D').forEach((p, i) => mk(i, { d: pinLit(el, p), clk, ce: en, sr: clr, srAsync: true, srVal: 0, init: initBit(i) }));
        break;
      }
      case 'counter': {
        const clk = clockPort(el, 'CLK');
        const en = pinLit(el, 'EN');
        const load = pinLit(el, 'LOAD');
        const clr = pinLit(el, 'CLR');
        const ce = aig.or(en, load);
        let carry = TRUE;
        const ds = busPins(el, 'D');
        st.q.forEach((q, i) => {
          const inc = aig.xor(q, carry);
          carry = aig.and(q, carry);
          mk(i, { d: aig.mux(load, inc, pinLit(el, ds[i] ?? 'D?')), clk, ce, sr: clr, srAsync: true, srVal: 0, init: initBit(i) });
        });
        break;
      }
      case 'shift-register': {
        const clk = clockPort(el, 'CLK');
        const en = pinLit(el, 'EN');
        const clr = pinLit(el, 'CLR');
        st.q.forEach((_, i) => mk(i, { d: i === 0 ? pinLit(el, 'SI') : st.q[i - 1]!, clk, ce: en, sr: clr, srAsync: true, srVal: 0, init: initBit(i) }));
        break;
      }
      case 'ram':
      case 'rom': {
        const addr = busPins(el, 'A').map((p) => pinLit(el, p));
        const dout = st.dout!;
        let contents: number[] = [];
        if (el.type === 'rom') {
          contents = String(el.params.contents ?? '')
            .split(/[,\s]+/)
            .filter((s) => s.length)
            .map((s) => parseInt(s, 16) || 0);
        }
        rams.push({
          name: el.id,
          async: true,
          addrBits: addr.length,
          dataBits: dout.length,
          raddr: addr,
          waddr: el.type === 'ram' ? addr : [],
          wdata: el.type === 'ram' ? busPins(el, 'DI').map((p) => pinLit(el, p)) : [],
          we: el.type === 'ram' ? pinLit(el, 'WE') : FALSE,
          re: -1,
          clk: el.type === 'ram' ? clockPort(el, 'CLK') : -1,
          dout,
          contents,
          src: ei,
        });
        break;
      }
    }
  });
  aig.cur = undefined;
  return { aig, ports, regs, rams, sources, warnings, name };
}

/** Lower one combinational element to AIG literals; returns literals by output pin name. */
function lowerComb(el: FlatElement, aig: Aig, L: (pin: string) => number, st?: { q: number[] }): Record<string, number> {
  const out: Record<string, number> = {};
  const ins = (prefix: string) => busPins(el, prefix).map((p) => L(p));
  switch (el.type) {
    case 'and':
    case 'or':
    case 'nand':
    case 'nor':
    case 'xor':
    case 'xnor': {
      const xs = el.pinNames.filter((p) => !isOutPin(el.type, p)).map((p) => L(p));
      const base = el.type === 'and' || el.type === 'nand' ? aig.andN(xs) : el.type === 'or' || el.type === 'nor' ? aig.orN(xs) : aig.xorN(xs);
      out.Y = el.type === 'nand' || el.type === 'nor' || el.type === 'xnor' ? base ^ 1 : base;
      break;
    }
    case 'not':
      out.Y = L('A') ^ 1;
      break;
    case 'buffer':
      out.Y = L('A');
      break;
    case 'mux': {
      let level = ins('D');
      const sel = ins('S');
      for (const s of sel) {
        const next: number[] = [];
        for (let j = 0; j + 1 < level.length; j += 2) next.push(aig.mux(s, level[j]!, level[j + 1]!));
        level = next;
      }
      out.Y = level[0] ?? FALSE;
      break;
    }
    case 'decoder': {
      const a = ins('A');
      const en = L('EN');
      const n = 1 << a.length;
      for (let i = 0; i < n; i++) out[`Y${i}`] = aig.and(en, aig.andN(a.map((x, j) => ((i >> j) & 1 ? x : x ^ 1))));
      break;
    }
    case 'adder': {
      const a = ins('A');
      const b = ins('B');
      let c = L('CIN');
      a.forEach((x, i) => {
        const p = aig.xor(x, b[i]!);
        out[`S${i}`] = aig.xor(p, c);
        c = aig.or(aig.and(x, b[i]!), aig.and(c, p));
      });
      out.COUT = c;
      break;
    }
    case 'magnitude-comparator': {
      const a = ins('A');
      const b = ins('B');
      let lt = FALSE;
      const eq: number[] = [];
      a.forEach((x, i) => {
        const d = aig.xor(x, b[i]!);
        eq.push(d ^ 1);
        lt = aig.or(aig.and(x ^ 1, b[i]!), aig.and(d ^ 1, lt));
      });
      const e = aig.andN(eq);
      out.EQ = e;
      out.LT = lt;
      out.GT = aig.and(e ^ 1, lt ^ 1);
      break;
    }
    case 'counter': {
      // CO: all ones while enabled.
      out.CO = aig.and(L('EN'), aig.andN(st?.q ?? []));
      break;
    }
  }
  return out;
}
