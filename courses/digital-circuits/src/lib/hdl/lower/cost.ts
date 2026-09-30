/**
 * What each construct costs in hardware: a name for every RTL cell ("4-bit adder"), the elements that were
 * built for it, and a one-line summary ("3 XOR, 2 AND gates"). The editor's hover and the inference viewer's
 * readout are built from this.
 */
import type { RtlCell, RtlModule } from '../rtl';
import type { Lowered } from './types';

export interface Construct {
  cell: number;
  kind: string;
  /** "4-bit adder", "2-way multiplexer × 4", "4 flip-flops". */
  title: string;
  /** The elements built for this cell, by catalog type (elements shared with an earlier cell are not counted). */
  counts: Record<string, number>;
  /** Elements built for this cell. */
  total: number;
  /** Elements that another cell built and this one reuses. */
  reused: number;
  /** `title`, then the elements: "4-bit adder: 3 XOR gates, 2 AND gates". */
  text: string;
  from: number;
  to: number;
  line: number;
  path: string;
}

const NAMES: Record<string, [string, string]> = {
  not: ['inverter', 'inverters'],
  and: ['AND gate', 'AND gates'],
  or: ['OR gate', 'OR gates'],
  xor: ['XOR gate', 'XOR gates'],
  xnor: ['XNOR gate', 'XNOR gates'],
  nand: ['NAND gate', 'NAND gates'],
  nor: ['NOR gate', 'NOR gates'],
  mux: ['multiplexer', 'multiplexers'],
  dff: ['flip-flop', 'flip-flops'],
  ram: ['RAM block', 'RAM blocks'],
  adder: ['adder block', 'adder blocks'],
  const: ['constant', 'constants'],
};

/** "3 XOR gates, 2 AND gates". */
export function formatCounts(counts: Record<string, number>): string {
  const order = ['dff', 'ram', 'adder', 'mux', 'and', 'or', 'xor', 'xnor', 'nand', 'nor', 'not', 'const'];
  const parts: string[] = [];
  for (const t of [...order, ...Object.keys(counts).filter((k) => !order.includes(k))]) {
    const n = counts[t];
    if (!n) continue;
    const [one, many] = NAMES[t] ?? [t, t];
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts.join(', ');
}

const bitsText = (w: number) => (w === 1 ? '1-bit' : `${w}-bit`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A name for an RTL cell, for what it is in the source ("4-bit adder"). */
export function cellTitle(c: RtlCell, mod: RtlModule): string {
  const w = (s: number) => mod.signals[s]?.width ?? 0;
  const isConst = (s: number) => mod.cells.some((x) => x.kind === 'const' && x.y === s);
  if (c.kind === 'mem') return `${c.depth} × ${c.width}-bit memory`;
  const y = w(c.y);
  switch (c.kind) {
    case 'const':
      return `${bitsText(y)} constant`;
    case 'and':
    case 'or':
    case 'xor':
      return `${bitsText(y)} bitwise ${c.kind.toUpperCase()}`;
    case 'not':
      return `${bitsText(y)} bitwise NOT`;
    case 'add':
      return isConst(c.a) || isConst(c.b) ? `${bitsText(y)} incrementer (adds a constant)` : `${bitsText(y)} adder`;
    case 'sub':
      return `${bitsText(y)} subtractor`;
    case 'neg':
      return `${bitsText(y)} negation`;
    case 'mul':
      return `${bitsText(y)} multiplier`;
    case 'shl':
      return `${bitsText(y)} left shifter`;
    case 'shr':
      return `${bitsText(y)} ${c.signed ? 'arithmetic' : 'logical'} right shifter`;
    case 'eq':
    case 'ne':
      return isConst(c.a) || isConst(c.b) ? `${bitsText(w(c.a))} comparison with a constant (${c.kind === 'eq' ? '==' : '!='})` : `${bitsText(w(c.a))} equality comparator (${c.kind === 'eq' ? '==' : '!='})`;
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
      return `${bitsText(w(c.a))} ${c.signed ? 'signed ' : ''}magnitude comparator (${{ lt: '<', le: '<=', gt: '>', ge: '>=' }[c.kind]})`;
    case 'mux':
      return y === 1 ? '2-way multiplexer' : `${bitsText(y)} 2-way multiplexer`;
    case 'pmux':
      return `${c.cases.length + 1}-way ${bitsText(y)} multiplexer (match)`;
    case 'slice':
      return `${bitsText(y)} slice (wiring only)`;
    case 'concat':
      return `concatenation (wiring only)`;
    case 'repeat':
    case 'zext':
    case 'sext':
      return `${c.kind === 'repeat' ? 'repeat' : c.kind === 'zext' ? 'zero extension' : 'sign extension'} (wiring only)`;
    case 'reduce_and':
      return `${bitsText(w(c.a))} all-ones detector (AND tree)`;
    case 'reduce_or':
      return `${bitsText(w(c.a))} any-one detector (OR tree)`;
    case 'reduce_xor':
      return `${bitsText(w(c.a))} parity (XOR tree)`;
    case 'popcount':
      return `${bitsText(w(c.a))} ones counter`;
    case 'reg':
      return y === 1 ? 'flip-flop' : `${plural(y, 'flip-flop')} (${bitsText(y)} register)`;
  }
}

/** The constructs of a lowered design, in source order, with what each one cost. */
export function constructs(l: Lowered): Construct[] {
  const out: Construct[] = [];
  for (const c of l.rtl.cells) {
    if (!c.src || c.src.end <= c.src.start) continue;
    const ids = l.cells[c.id] ?? [];
    const counts: Record<string, number> = {};
    let total = 0;
    let reused = 0;
    for (const id of ids) {
      const info = l.elements[id];
      if (!info) continue;
      if (info.cell !== c.id) {
        reused++;
        continue;
      }
      const t = l.netlist.elements.find((e) => e.id === id)?.type;
      if (!t) continue;
      counts[t] = (counts[t] ?? 0) + 1;
      total++;
    }
    const title = cellTitle(c, l.rtl);
    const cost = formatCounts(counts);
    const text = c.kind === 'const' ? title : total ? `${title}: ${cost}${reused ? ` (+${reused} shared)` : ''}` : reused ? `${title}: reuses ${plural(reused, 'element')} built elsewhere` : `${title}: no gates`;
    out.push({ cell: c.id, kind: c.kind, title, counts, total, reused, text, from: c.src.start, to: c.src.end, line: c.src.line, path: c.path });
  }
  return out.sort((a, b) => a.from - b.from || b.to - a.to);
}

export interface KindTotal {
  kind: string;
  count: number;
  counts: Record<string, number>;
  total: number;
}

/** Elements grouped by kind of construct (adders, multiplexers, registers…), most expensive first. */
export function totalsByKind(cs: Construct[]): KindTotal[] {
  const m = new Map<string, KindTotal>();
  for (const c of cs) {
    if (c.kind === 'const' || c.total === 0) continue;
    const t = m.get(c.kind) ?? { kind: c.kind, count: 0, counts: {}, total: 0 };
    t.count++;
    t.total += c.total;
    for (const [k, n] of Object.entries(c.counts)) t.counts[k] = (t.counts[k] ?? 0) + n;
    m.set(c.kind, t);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
