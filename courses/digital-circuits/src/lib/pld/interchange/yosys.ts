/**
 * # The interchange netlist: DCL's word-level RTL as a Yosys JSON netlist
 *
 * `toYosysJson(design)` turns an `RtlDesign` (or one `RtlModule`) into the JSON that Yosys's `write_json`
 * writes and `read_json` reads (see `types.ts`), so a course design can go to the real toolchain:
 *
 * ```
 * yosys -p "read_json counter.json; synth_ice40 -top Counter -json counter.synth.json"
 * nextpnr-ice40 --up5k --package sg48 --json counter.synth.json --pcf counter.pcf --asc counter.asc
 * ```
 *
 * The format is word-level, like the RTL: each RTL cell becomes one Yosys internal cell of the same width
 * (`$add`, `$mux`, `$dff`, …), and Yosys does its own optimisation, technology mapping, carry-chain and
 * block-RAM inference. HDL.md (*Interchange netlist*) has the mapping table; this comment has the details.
 *
 * - **Nets.** Every signal gets net numbers, from 2, one per bit, least significant first. Cells that only
 *   rename or rearrange bits (`const`, `slice`, `concat`, `repeat`, `zext`, `sext`) need no Yosys cell: their
 *   result is a list of the operands' bits, or constants `"0"` and `"1"`.
 * - **Hierarchy.** By default each DCL module specialisation is a module of the JSON file (named like the
 *   RTL key with every run of characters outside `A-Za-z0-9_$` replaced by `_`: `Fifo<8, 4>` is `Fifo_8_4`),
 *   and an instance is a cell whose type is the child's module name. The top module has the `top`
 *   attribute. With `flatten: true` the hierarchy is inlined first (`flattenRtl`) and there is one module.
 * - **Names.** Ports are ports. Every entry of the RTL's `names` (ports, `let`s, registers, register-array
 *   elements, memory read ports) is a public netname; cells get automatic names starting with `$` and
 *   `hide_name` 1, except instances and memories, which keep theirs.
 * - **Provenance.** A cell's source span is its `src` attribute (`file:line.col-line.col`, or `file:line.col`
 *   when the source text is not supplied), and its hierarchical path is the attribute `dcl_path`.
 * - **Registers.** `reg` is `$dff` (rising edge). The power-up value is the `init` attribute of the register's
 *   netname, as Yosys keeps it. The reset and enable multiplexers stay separate `$mux` cells: Yosys's
 *   `opt_dff` folds them into the flip-flop.
 * - **Memories.** `mem` is one `$mem_v2` with a read port per RTL read port (clocked, no enable or reset,
 *   not transparent: a read sees the word from before the same edge's write, as in the RTL) and at most one
 *   write port. The RTL gives 0 for an out-of-range read and ignores an out-of-range write; Yosys leaves
 *   both undefined, which matters only when the depth is not a power of two and the address can exceed it.
 *   Every bit-vector parameter has at least one bit, as in Yosys's own files: the masks of a ROM (no write port)
 *   are "0", because an empty string makes Yosys 0.69 fail an assertion in `opt_reduce`.
 * - **Case selection.** `pmux` becomes `$eq` cells (one per matched value, joined by `$reduce_or`) that feed
 *   the one-hot select of a `$pmux`. The RTL guarantees the cases are disjoint.
 * - **Population count** is a chain of `$add` cells.
 */
import { cellOutputs, flattenRtl, type RtlCell, type RtlDesign, type RtlModule, type SigId } from '../../hdl/rtl';
import type { SourceFile, Span } from '../../hdl/span';
import { bitsParam, directionOf, intParam, INTERNAL_CELLS, textParam } from './cells';
import type { YosysBit, YosysCell, YosysDirection, YosysJson, YosysModule, YosysValue } from './types';

export interface InterchangeOptions {
  /** Inline the hierarchy and write one module (default: one module per DCL module). */
  flatten?: boolean;
  /** The top module's key in the design (default: the design's top). */
  top?: string;
  /** Source texts by file name, to give `src` attributes their end positions. */
  sources?: (file: string) => SourceFile | undefined;
  /** The `creator` string of the file. */
  creator?: string;
}

export const DEFAULT_CREATOR = 'DCL interchange writer (Digital Circuits course)';

/** The name of an RTL module key in the JSON file: `Fifo<8, 4>` becomes `Fifo_8_4`. */
export function yosysModuleName(key: string): string {
  const s = key.replace(/[^A-Za-z0-9_$]+/g, '_').replace(/^_+|_+$/g, '');
  return s === '' ? 'module' : /^[0-9]/.test(s) ? `m_${s}` : s;
}

const ZERO: YosysBit = '0';
const ONE: YosysBit = '1';
const clog2 = (n: number) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));
const repeatBit = (b: YosysBit, n: number): YosysBit[] => new Array<YosysBit>(n).fill(b);

function constBits(value: bigint, width: number): YosysBit[] {
  const out: YosysBit[] = [];
  for (let i = 0; i < width; i++) out.push((value >> BigInt(i)) & 1n ? ONE : ZERO);
  return out;
}

/** The RTL cells that need no Yosys cell: they only rearrange bits. */
function isWiring(c: RtlCell, widthOf: (s: SigId) => number): boolean {
  switch (c.kind) {
    case 'const':
    case 'slice':
    case 'concat':
    case 'repeat':
    case 'zext':
    case 'sext':
      return true;
    case 'pmux':
      return c.cases.length === 0;
    case 'popcount':
      return widthOf(c.a) === 1;
    default:
      return false;
  }
}

/** `file:line.col-line.col` (or `file:line.col` without the source text). */
function srcAttribute(span: Span, sources: InterchangeOptions['sources']): string {
  const text = sources?.(span.file);
  if (text) {
    const end = text.position(Math.max(span.start, span.end - 1));
    return `${span.file}:${span.line}.${span.col}-${end.line}.${end.col + 1}`;
  }
  return `${span.file}:${span.line}.${span.col}`;
}

interface ModuleContext {
  typeName: (key: string) => string;
  design: RtlDesign;
  sources: InterchangeOptions['sources'];
}

/** One RTL module as a Yosys module. */
function writeModule(mod: RtlModule, ctx: ModuleContext, isTop: boolean): YosysModule {
  const stripPath = mod.name;
  const widthOf = (s: SigId) => mod.signals[s]!.width;
  const bitsOfSig: (YosysBit[] | undefined)[] = new Array(mod.signals.length);
  let nextNet = 2;
  const fresh = (n: number): YosysBit[] => Array.from({ length: n }, () => nextNet++);

  const cells: Record<string, YosysCell> = {};
  const netnames: YosysModule['netnames'] = {};
  const usedCellNames = new Set<string>();
  const uniqueCell = (base: string): string => {
    let name = base;
    for (let i = 1; usedCellNames.has(name); i++) name = `${base}$${i}`;
    usedCellNames.add(name);
    return name;
  };

  // Drivers, and net numbers for everything a Yosys cell (or a port) drives.
  const driver = new Map<SigId, RtlCell>();
  for (const c of mod.cells) for (const y of cellOutputs(c)) driver.set(y, c);
  for (const p of mod.inputs) bitsOfSig[p.sig] = fresh(p.width);
  for (const c of mod.cells) if (!isWiring(c, widthOf)) for (const y of cellOutputs(c)) bitsOfSig[y] = fresh(widthOf(y));
  for (const inst of mod.instances) for (const s of Object.values(inst.outputs)) bitsOfSig[s] ??= fresh(widthOf(s));

  const bits = (s: SigId): YosysBit[] => {
    const known = bitsOfSig[s];
    if (known) return known;
    const c = driver.get(s);
    if (!c) throw new Error(`signal %${s}${mod.signals[s]?.name ? ` (${mod.signals[s]!.name})` : ''} of ${mod.name} has no driver`);
    const out = wiringBits(c);
    bitsOfSig[s] = out;
    return out;
  };

  function wiringBits(c: RtlCell): YosysBit[] {
    const w = widthOf(c.y);
    switch (c.kind) {
      case 'const':
        return constBits(c.value, w);
      case 'slice':
        return bits(c.a).slice(c.lo, c.lo + w);
      case 'concat':
        return c.parts.slice().reverse().flatMap((p) => bits(p));
      case 'repeat': {
        const a = bits(c.a);
        return Array.from({ length: c.n }, () => a).flat();
      }
      case 'zext': {
        const a = bits(c.a);
        return [...a, ...repeatBit(ZERO, w - a.length)];
      }
      case 'sext': {
        const a = bits(c.a);
        return [...a, ...repeatBit(a[a.length - 1]!, w - a.length)];
      }
      case 'pmux':
        return bits(c.default);
      case 'popcount':
        return bits(c.a);
      default:
        throw new Error(`internal error: ${c.kind} is not a wiring cell`);
    }
  }

  // --- Yosys cells
  const cellSpan = (c: { src: Span; path: string }): Record<string, YosysValue> => {
    const a: Record<string, YosysValue> = { src: srcAttribute(c.src, ctx.sources) };
    const path = c.path.startsWith(`${stripPath}.`) ? c.path.slice(stripPath.length + 1) : c.path === stripPath ? '' : c.path;
    if (path !== '') a.dcl_path = path;
    return a;
  };
  const autoName = (type: string, c: { src: Span; id?: number }, extra = '') => uniqueCell(`$${type.slice(1)}$${c.src.file}:${c.src.line}$${c.id ?? 0}${extra}`);

  const addCell = (
    name: string,
    hide: 0 | 1,
    type: string,
    parameters: Record<string, YosysValue>,
    connections: Record<string, YosysBit[]>,
    from: { src: Span; path: string },
  ): void => {
    const spec = INTERNAL_CELLS[type]!;
    const port_directions: Record<string, YosysDirection> = {};
    for (const port of Object.keys(connections)) port_directions[port] = directionOf(spec, port);
    cells[name] = { hide_name: hide, type, parameters, attributes: cellSpan(from), port_directions, connections };
  };
  const auto = (type: string, c: RtlCell, parameters: Record<string, YosysValue>, connections: Record<string, YosysBit[]>, extra = '') =>
    addCell(autoName(type, c, extra), 1, type, parameters, connections, c);

  const int = intParam;
  const binaryParams = (aw: number, bw: number, yw: number, aSigned = 0, bSigned = 0) => ({
    A_SIGNED: int(aSigned), B_SIGNED: int(bSigned), A_WIDTH: int(aw), B_WIDTH: int(bw), Y_WIDTH: int(yw),
  });
  const unaryParams = (aw: number, yw: number) => ({ A_SIGNED: int(0), A_WIDTH: int(aw), Y_WIDTH: int(yw) });
  const regInit = new Map<SigId, bigint>();
  const memoryOrdinal = new Map<string, number>();

  for (const c of mod.cells) {
    if (isWiring(c, widthOf)) continue;
    const y = c.kind === 'mem' ? [] : bits(c.y);
    switch (c.kind) {
      case 'add':
      case 'sub':
      case 'mul':
      case 'and':
      case 'or':
      case 'xor': {
        const w = widthOf(c.y);
        auto(`$${c.kind}`, c, binaryParams(w, w, w), { A: bits(c.a), B: bits(c.b), Y: y });
        break;
      }
      case 'not':
      case 'neg': {
        const w = widthOf(c.y);
        auto(`$${c.kind}`, c, unaryParams(w, w), { A: bits(c.a), Y: y });
        break;
      }
      case 'shl':
      case 'shr': {
        const w = widthOf(c.y);
        const type = c.kind === 'shl' ? '$shl' : c.signed ? '$sshr' : '$shr';
        auto(type, c, binaryParams(w, widthOf(c.b), w, c.kind === 'shr' && c.signed ? 1 : 0), { A: bits(c.a), B: bits(c.b), Y: y });
        break;
      }
      case 'eq':
      case 'ne':
        auto(`$${c.kind}`, c, binaryParams(widthOf(c.a), widthOf(c.b), 1), { A: bits(c.a), B: bits(c.b), Y: y });
        break;
      case 'lt':
      case 'le':
      case 'gt':
      case 'ge':
        auto(`$${c.kind}`, c, binaryParams(widthOf(c.a), widthOf(c.b), 1, c.signed ? 1 : 0, c.signed ? 1 : 0), { A: bits(c.a), B: bits(c.b), Y: y });
        break;
      case 'mux':
        auto('$mux', c, { WIDTH: int(widthOf(c.y)) }, { A: bits(c.a), B: bits(c.b), S: bits(c.s), Y: y });
        break;
      case 'pmux': {
        const sel = bits(c.s);
        const ws = sel.length;
        const hits: YosysBit[] = [];
        c.cases.forEach((k, i) => {
          const tests: YosysBit[] = [];
          k.match.forEach((v, j) => {
            if (v >> BigInt(ws) !== 0n) return; // the value does not fit the selector: it never matches
            const t = fresh(1);
            auto('$eq', c, binaryParams(ws, ws, 1), { A: sel, B: constBits(v, ws), Y: t }, `$case${i}.${j}`);
            tests.push(t[0]!);
          });
          if (tests.length === 0) hits.push(ZERO);
          else if (tests.length === 1) hits.push(tests[0]!);
          else {
            const h = fresh(1);
            auto('$reduce_or', c, unaryParams(tests.length, 1), { A: tests, Y: h }, `$case${i}`);
            hits.push(h[0]!);
          }
        });
        auto(
          '$pmux',
          c,
          { WIDTH: int(widthOf(c.y)), S_WIDTH: int(c.cases.length) },
          { A: bits(c.default), B: c.cases.flatMap((k) => bits(k.data)), S: hits, Y: y },
        );
        break;
      }
      case 'reduce_and':
      case 'reduce_or':
      case 'reduce_xor':
        auto(`$${c.kind}`, c, unaryParams(widthOf(c.a), 1), { A: bits(c.a), Y: y });
        break;
      case 'popcount': {
        const src = bits(c.a);
        const w = widthOf(c.y);
        const ext = (b: YosysBit): YosysBit[] => [b, ...repeatBit(ZERO, w - 1)];
        let acc = ext(src[0]!);
        for (let i = 1; i < src.length; i++) {
          const out = i === src.length - 1 ? y : fresh(w);
          auto('$add', c, binaryParams(w, w, w), { A: acc, B: ext(src[i]!), Y: out }, `$bit${i}`);
          acc = out;
        }
        break;
      }
      case 'reg':
        auto('$dff', c, { WIDTH: int(widthOf(c.y)), CLK_POLARITY: int(1) }, { CLK: bits(c.clk), D: bits(c.d), Q: y });
        regInit.set(c.y, c.init);
        break;
      case 'mem': {
        if (c.writes.length > 1) throw new Error(`memory ${c.name}: the interchange netlist supports one write port, not ${c.writes.length}`);
        const R = c.reads.length;
        const W = c.writes.length;
        if (R + W === 0) break;
        const abits = Math.max(1, clog2(c.depth), ...c.reads.map((r) => widthOf(r.addr)), ...c.writes.map((x) => widthOf(x.addr)));
        const padAddr = (s: SigId): YosysBit[] => {
          const a = bits(s);
          return [...a, ...repeatBit(ZERO, abits - a.length)];
        };
        const initBits: (0 | 1)[] = [];
        for (let a = 0; a < c.depth; a++) for (let i = 0; i < c.width; i++) initBits.push(Number(((c.init[a] ?? 0n) >> BigInt(i)) & 1n) as 0 | 1);
        // A parameter that describes no ports (the write masks of a ROM) still has one bit, as Yosys writes it: with an
        // empty string Yosys 0.69 fails an assertion in `opt_reduce`.
        const zeros = (n: number) => bitsParam(new Array<0 | 1>(Math.max(1, n)).fill(0));
        const ones = (n: number) => bitsParam(new Array<0 | 1>(Math.max(1, n)).fill(n === 0 ? 0 : 1));
        const clk = bits(c.clk);
        const n = (memoryOrdinal.get(c.name) ?? 0) + 1;
        memoryOrdinal.set(c.name, n);
        const local = c.path.startsWith(`${stripPath}.`) ? `${c.path.slice(stripPath.length + 1)}.${c.name}` : c.name;
        const memid = n === 1 ? local : `${local}$${n}`;
        addCell(
          uniqueCell(memid),
          0,
          '$mem_v2',
          {
            MEMID: `\\${memid}`,
            SIZE: int(c.depth),
            OFFSET: int(0),
            ABITS: int(abits),
            WIDTH: int(c.width),
            INIT: bitsParam(initBits),
            RD_PORTS: int(R),
            RD_CLK_ENABLE: ones(R),
            RD_CLK_POLARITY: ones(R),
            RD_TRANSPARENCY_MASK: zeros(R * W),
            RD_COLLISION_X_MASK: zeros(R * W),
            RD_WIDE_CONTINUATION: zeros(R),
            RD_CE_OVER_SRST: zeros(R),
            RD_ARST_VALUE: zeros(R * c.width),
            RD_SRST_VALUE: zeros(R * c.width),
            RD_INIT_VALUE: zeros(R * c.width),
            WR_PORTS: int(W),
            WR_CLK_ENABLE: ones(W),
            WR_CLK_POLARITY: ones(W),
            WR_PRIORITY_MASK: zeros(W * W),
            WR_WIDE_CONTINUATION: zeros(W),
          },
          {
            RD_CLK: c.reads.flatMap(() => clk),
            RD_EN: repeatBit(ONE, R),
            RD_ARST: repeatBit(ZERO, R),
            RD_SRST: repeatBit(ZERO, R),
            RD_ADDR: c.reads.flatMap((r) => padAddr(r.addr)),
            RD_DATA: c.reads.flatMap((r) => bits(r.data)),
            WR_CLK: c.writes.flatMap(() => clk),
            WR_EN: c.writes.flatMap((x) => repeatBit(bits(x.en)[0]!, c.width)),
            WR_ADDR: c.writes.flatMap((x) => padAddr(x.addr)),
            WR_DATA: c.writes.flatMap((x) => bits(x.data)),
          },
          c,
        );
        break;
      }
      default:
        throw new Error(`internal error: no Yosys cell for ${c.kind}`);
    }
  }

  // Instances of child modules.
  for (const inst of mod.instances) {
    const child = ctx.design.modules[inst.module];
    if (!child) throw new Error(`unknown module ${inst.module}`);
    const connections: Record<string, YosysBit[]> = {};
    const port_directions: Record<string, YosysDirection> = {};
    for (const p of child.inputs) {
      const s = inst.inputs[p.name];
      if (s === undefined) continue;
      connections[p.name] = bits(s);
      port_directions[p.name] = 'input';
    }
    for (const p of child.outputs) {
      const s = inst.outputs[p.name];
      if (s === undefined) continue;
      connections[p.name] = bits(s);
      port_directions[p.name] = 'output';
    }
    const name = uniqueCell(inst.name);
    cells[name] = {
      hide_name: 0,
      type: ctx.typeName(inst.module),
      parameters: {},
      attributes: cellSpan(inst),
      port_directions,
      connections,
    };
  }

  // Ports and net names.
  const ports: YosysModule['ports'] = {};
  for (const p of mod.inputs) ports[p.name] = { direction: 'input', bits: bits(p.sig) };
  for (const p of mod.outputs) ports[p.name] = { direction: 'output', bits: bits(p.sig) };
  const initWire = new Set<SigId>();
  const addNetname = (name: string, s: SigId) => {
    const attributes: Record<string, YosysValue> = {};
    const init = regInit.get(s);
    if (init !== undefined) {
      initWire.add(s);
      attributes.init = bitsParam(constBits(init, widthOf(s)).map((b) => (b === ONE ? 1 : 0)));
    }
    netnames[name] = { hide_name: 0, bits: bits(s), attributes };
  };
  for (const p of [...mod.inputs, ...mod.outputs]) addNetname(p.name, p.sig);
  for (const [name, s] of Object.entries(mod.names)) if (!(name in netnames)) addNetname(name, s);
  // A register nobody named still carries its power-up value.
  for (const [s] of regInit) {
    if (initWire.has(s)) continue;
    const cellName = `$reg$${s}`;
    initWire.add(s);
    netnames[cellName] = {
      hide_name: 1,
      bits: bits(s),
      attributes: { init: bitsParam(constBits(regInit.get(s)!, widthOf(s)).map((b) => (b === ONE ? 1 : 0))) },
    };
  }

  return { attributes: isTop ? { top: int(1) } : {}, ports, cells, netnames };
}

/** The Yosys JSON netlist for a design (hierarchical by default) or for one module. */
export function toYosysJson(design: RtlDesign | RtlModule, opts: InterchangeOptions = {}): YosysJson {
  const full: RtlDesign = 'modules' in design ? design : { top: design.name, modules: { [design.name]: design } };
  const topKey = opts.top ?? full.top;
  if (!full.modules[topKey]) throw new Error(`unknown module ${topKey}`);
  const creator = opts.creator ?? DEFAULT_CREATOR;
  if (opts.flatten) {
    const flat = flattenRtl(full, topKey);
    const name = yosysModuleName(topKey);
    return { creator, modules: { [name]: writeModule(flat, { typeName: yosysModuleName, design: full, sources: opts.sources }, true) } };
  }
  // The modules reachable from the top, with unique names.
  const names = new Map<string, string>();
  const taken = new Set<string>();
  const nameOf = (key: string): string => {
    const known = names.get(key);
    if (known) return known;
    const base = yosysModuleName(key);
    let n = base;
    for (let i = 2; taken.has(n); i++) n = `${base}_${i}`;
    taken.add(n);
    names.set(key, n);
    return n;
  };
  const order: string[] = [];
  const visit = (key: string) => {
    if (order.includes(key)) return;
    const m = full.modules[key];
    if (!m) throw new Error(`unknown module ${key}`);
    order.push(key);
    nameOf(key);
    for (const i of m.instances) visit(i.module);
  };
  visit(topKey);
  const ctx: ModuleContext = { typeName: nameOf, design: full, sources: opts.sources };
  const modules: Record<string, YosysModule> = {};
  for (const key of order.slice().sort((a, b) => (nameOf(a) < nameOf(b) ? -1 : 1))) {
    const m = writeModule(full.modules[key]!, ctx, key === topKey);
    if (nameOf(key) !== key) m.attributes.dcl_module = textParam(key);
    modules[nameOf(key)] = m;
  }
  return { creator, modules };
}

/** The name of the top module in a file written by `toYosysJson`. */
export function yosysTopName(json: YosysJson): string {
  for (const [name, m] of Object.entries(json.modules)) if ('top' in m.attributes) return name;
  return Object.keys(json.modules)[0]!;
}

/**
 * The JSON text, laid out like Yosys's own: two-space indentation, and arrays of numbers and bit strings
 * on one line.
 */
export function formatYosysJson(json: YosysJson): string {
  const scalar = (v: unknown): boolean => v === null || typeof v !== 'object';
  const out = (v: unknown, indent: string): string => {
    if (Array.isArray(v)) return v.length === 0 ? '[]' : v.every(scalar) ? `[ ${v.map((x) => JSON.stringify(x)).join(', ')} ]` : `[\n${v.map((x) => `${indent}  ${out(x, indent + '  ')}`).join(',\n')}\n${indent}]`;
    if (v && typeof v === 'object') {
      const e = Object.entries(v);
      return e.length === 0 ? '{}' : `{\n${e.map(([k, x]) => `${indent}  ${JSON.stringify(k)}: ${out(x, indent + '  ')}`).join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(v);
  };
  return `${out(json, '')}\n`;
}

/** `toYosysJson` and `formatYosysJson`: the text of the interchange netlist. */
export function writeYosysJson(design: RtlDesign | RtlModule, opts: InterchangeOptions = {}): string {
  return formatYosysJson(toYosysJson(design, opts));
}
