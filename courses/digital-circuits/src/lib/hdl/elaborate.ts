/**
 * Elaboration: checked module specialisations (typed expressions) → word-level RTL (see rtl.ts).
 *
 * Every typed expression node becomes at most one cell (shared nodes are lowered once), tagged with the
 * node's source span. Arrays are kept as lists of element signals, so that register arrays become one
 * register per element and a dynamic index becomes one parallel multiplexer over the elements.
 */
import type { ModuleSpec, TypedProgram } from './check';
import type { RtlCell, RtlDesign, RtlInstance, RtlModule, RtlPort, RtlSignal, SigId } from './rtl';
import type { Span } from './span';
import { bitsNeeded, indexWidth, widthOf, type TExpr, type Type } from './tir';

export class ElaborationError extends Error {}

/** A lowered value: one signal, or (for arrays) one value per element. */
type Value = { sig: SigId } | { elems: Value[] };

class ModuleBuilder {
  readonly signals: RtlSignal[] = [];
  readonly cells: RtlCell[] = [];
  readonly instances: RtlInstance[] = [];
  readonly names: Record<string, SigId> = {};
  private consts = new Map<string, SigId>();
  private memo = new Map<TExpr, Value>();
  private lets = new Map<string, Value>();
  private letBusy = new Set<string>();
  private regs = new Map<string, Value>();
  private instOut = new Map<string, SigId>();
  private memData = new Map<string, SigId[]>();
  private inputs = new Map<string, SigId>();
  private splitCache = new Map<SigId, Value[]>();

  constructor(
    private spec: ModuleSpec,
    private path: string,
    private moduleKey: (spec: ModuleSpec) => string,
  ) {}

  sig(width: number, name?: string): SigId {
    const id = this.signals.length;
    this.signals.push({ id, width, name });
    return id;
  }

  private cell(c: Omit<RtlCell, 'id' | 'path'>, name?: string): SigId {
    const cell = { ...c, id: this.cells.length, path: this.path } as RtlCell;
    this.cells.push(cell);
    if (name && cell.kind !== 'mem') {
      const s = this.signals[cell.y]!;
      if (!s.name) s.name = name;
    }
    return cell.y;
  }

  private op(kind: string, width: number, src: Span, fields: Record<string, unknown>): SigId {
    const y = this.sig(width);
    return this.cell({ kind, y, src, ...fields } as unknown as Omit<RtlCell, 'id' | 'path'>);
  }

  constSig(value: bigint, width: number, src: Span): SigId {
    const key = `${width}:${value}`;
    const hit = this.consts.get(key);
    if (hit !== undefined) return hit;
    const y = this.op('const', width, src, { value });
    this.consts.set(key, y);
    return y;
  }

  width(s: SigId): number {
    return this.signals[s]!.width;
  }

  /** A value as one bit vector (arrays: element 0 in the low bits). */
  flat(v: Value, src: Span): SigId {
    if ('sig' in v) return v.sig;
    const parts = v.elems.map((e) => this.flat(e, src)).reverse();
    if (parts.length === 1) return parts[0]!;
    return this.op('concat', parts.reduce((s, p) => s + this.width(p), 0), src, { parts });
  }

  /** A value of array type t as its elements. */
  elems(v: Value, t: Type, src: Span): Value[] {
    if ('elems' in v) return v.elems;
    if (t.k !== 'array') throw new ElaborationError('not an array');
    const hit = this.splitCache.get(v.sig);
    if (hit) return hit;
    const w = widthOf(t.elem);
    const out: Value[] = [];
    for (let i = 0; i < t.n; i++) {
      const s = this.op('slice', w, src, { a: v.sig, lo: i * w });
      out.push(t.elem.k === 'array' ? { elems: this.elems({ sig: s }, t.elem, src) } : { sig: s });
    }
    this.splitCache.set(v.sig, out);
    return out;
  }

  private slice(a: SigId, lo: number, w: number, src: Span): SigId {
    if (lo === 0 && w === this.width(a)) return a;
    return this.op('slice', w, src, { a, lo });
  }

  build(): RtlModule {
    const spec = this.spec;
    const port = (p: { name: string; type: Type }): RtlPort => {
      const width = Math.max(1, widthOf(p.type));
      const sig = this.sig(width, p.name);
      this.names[p.name] = sig;
      return { name: p.name, width, sig, type: p.type, clock: p.type.k === 'clock' };
    };
    const inputs = spec.inputs.map(port);
    for (const p of inputs) this.inputs.set(p.name, p.sig);

    // State elements first, so that expressions can refer to their outputs.
    const regCells: { q: SigId; name: string; clock: string; init: bigint; src: Span; d: () => SigId }[] = [];
    for (const r of spec.regs.values()) {
      if (r.type.k === 'array') {
        const ew = widthOf(r.type.elem);
        const elems: Value[] = [];
        const whole = r.next;
        let wholeElems: Value[] | undefined;
        for (let i = 0; i < r.type.n; i++) {
          const name = `${r.name}[${i}]`;
          const q = this.sig(ew, name);
          this.names[name] = q;
          elems.push({ sig: q });
          const init = (r.init >> BigInt(i * ew)) & ((1n << BigInt(ew)) - 1n);
          const t = r.type;
          regCells.push({
            q, name, clock: r.clock, init, src: r.span,
            d: () => {
              if (r.elemNext) return this.flat(this.lower(r.elemNext[i]!), r.span);
              wholeElems ??= this.elems(this.lower(whole!), t, r.span);
              return this.flat(wholeElems[i]!, r.span);
            },
          });
        }
        this.regs.set(r.name, { elems });
      } else {
        const q = this.sig(Math.max(1, widthOf(r.type)), r.name);
        this.names[r.name] = q;
        this.regs.set(r.name, { sig: q });
        regCells.push({ q, name: r.name, clock: r.clock, init: r.init, src: r.span, d: () => this.flat(this.lower(r.next!), r.span) });
      }
    }
    for (const m of spec.mems.values()) {
      this.memData.set(m.name, m.reads.map((_, i) => {
        const s = this.sig(widthOf(m.elem), `${m.name}.read${i}`);
        this.names[`${m.name}.read${i}`] = s;
        return s;
      }));
    }
    for (const inst of spec.insts.values()) {
      for (const o of inst.spec.outputs) {
        const s = this.sig(Math.max(1, widthOf(o.type)), `${inst.name}.${o.name}`);
        this.instOut.set(`${inst.name}.${o.name}`, s);
      }
    }

    // Named wires, outputs, register inputs, memories and instances.
    for (const name of spec.lets.keys()) this.let(name);
    const outputs: RtlPort[] = spec.outputs.map((p) => {
      const width = Math.max(1, widthOf(p.type));
      const e = spec.assigns.get(p.name);
      const sig = e ? this.flat(this.lower(e), e.span) : this.constSig(0n, width, p.span);
      this.names[p.name] ??= sig;
      return { name: p.name, width, sig, type: p.type, clock: false };
    });
    for (const r of regCells) {
      const d = r.d();
      const clk = this.inputs.get(r.clock);
      if (clk === undefined) throw new ElaborationError(`register ${r.name} has no clock`);
      this.cells.push({ kind: 'reg', d, clk, init: r.init, y: r.q, src: r.src, path: this.path, id: this.cells.length });
    }
    for (const m of spec.mems.values()) {
      const clk = this.inputs.get(m.clock);
      if (clk === undefined) throw new ElaborationError(`memory ${m.name} has no clock`);
      const data = this.memData.get(m.name)!;
      this.cells.push({
        kind: 'mem', y: -1, clk, width: widthOf(m.elem), depth: m.depth, init: m.init, name: m.name,
        reads: m.reads.map((r, i) => ({ addr: this.flat(this.lower(r.addr), r.span), data: data[i]! })),
        writes: m.write ? [{ addr: this.flat(this.lower(m.write.addr), m.span), data: this.flat(this.lower(m.write.data), m.span), en: this.flat(this.lower(m.write.en), m.span) }] : [],
        src: m.span, path: this.path, id: this.cells.length,
      });
    }
    for (const inst of spec.insts.values()) {
      const ins: Record<string, SigId> = {};
      for (const [p, e] of inst.conns) ins[p] = this.flat(this.lower(e), e.span);
      for (const [p, clk] of inst.clocks) ins[p] = this.inputs.get(clk)!;
      const outs: Record<string, SigId> = {};
      for (const o of inst.spec.outputs) outs[o.name] = this.instOut.get(`${inst.name}.${o.name}`)!;
      this.instances.push({ name: inst.name, module: this.moduleKey(inst.spec), inputs: ins, outputs: outs, src: inst.span, path: `${this.path}.${inst.name}` });
    }
    return { name: spec.key, inputs, outputs, signals: this.signals, cells: this.cells, instances: this.instances, names: this.names };
  }

  private let(name: string): Value {
    const hit = this.lets.get(name);
    if (hit) return hit;
    if (this.letBusy.has(name)) throw new ElaborationError(`combinational loop through ${name}`);
    this.letBusy.add(name);
    const l = this.spec.lets.get(name)!;
    const v = this.lower(l.expr);
    if ('sig' in v) {
      const s = this.signals[v.sig]!;
      if (!s.name) s.name = name;
      this.names[name] = v.sig;
    } else this.names[name] = this.flat(v, l.span);
    this.letBusy.delete(name);
    this.lets.set(name, v);
    return v;
  }

  lower(e: TExpr): Value {
    const hit = this.memo.get(e);
    if (hit) return hit;
    const v = this.lowerNode(e);
    this.memo.set(e, v);
    return v;
  }

  private s(e: TExpr): SigId {
    return this.flat(this.lower(e), e.span);
  }

  private lowerNode(e: TExpr): Value {
    const w = Math.max(1, widthOf(e.t));
    const src = e.span;
    switch (e.k) {
      case 'const': {
        if (e.t.k === 'array') {
          const ew = widthOf(e.t.elem);
          const et = e.t.elem;
          return {
            elems: Array.from({ length: e.t.n }, (_, i) =>
              this.lower({ k: 'const', v: (e.v >> BigInt(i * ew)) & ((1n << BigInt(ew)) - 1n), t: et, span: src }),
            ),
          };
        }
        return { sig: this.constSig(e.v, w, src) };
      }
      case 'ref':
        switch (e.ref) {
          case 'input': {
            const s = this.inputs.get(e.name);
            if (s === undefined) throw new ElaborationError(`unknown input ${e.name}`);
            return { sig: s };
          }
          case 'let':
            return this.let(e.name);
          case 'reg': {
            const r = this.regs.get(e.name);
            if (!r) throw new ElaborationError(`unknown register ${e.name}`);
            return r;
          }
          case 'instout': {
            const s = this.instOut.get(e.name);
            if (s === undefined) throw new ElaborationError(`unknown instance output ${e.name}`);
            return { sig: s };
          }
          default:
            throw new ElaborationError(`${e.ref} values exist only in tests`);
        }
      case 'un':
        return { sig: this.op(e.op, w, src, { a: this.s(e.a) }) };
      case 'bin': {
        const a = this.s(e.a);
        const b = this.s(e.b);
        const signed = e.a.t.k === 'bits' && e.a.t.signed;
        switch (e.op) {
          case 'shl':
            return { sig: this.op('shl', w, src, { a, b }) };
          case 'shr':
            return { sig: this.op('shr', w, src, { a, b, signed }) };
          case 'eq':
          case 'ne':
            return { sig: this.op(e.op, 1, src, { a, b }) };
          case 'lt':
          case 'le':
          case 'gt':
          case 'ge':
            return { sig: this.op(e.op, 1, src, { a, b, signed }) };
          default:
            return { sig: this.op(e.op, w, src, { a, b }) };
        }
      }
      case 'mux': {
        const s = this.s(e.c);
        return { sig: this.op('mux', w, src, { s, a: this.s(e.b), b: this.s(e.a) }) };
      }
      case 'match': {
        const s = this.s(e.sel);
        const cases = e.arms.map((a) => ({ match: a.values, data: this.s(a.body) }));
        let dflt: SigId;
        if (e.dflt) dflt = this.s(e.dflt);
        else if (cases.length) dflt = cases[cases.length - 1]!.data;
        else dflt = this.constSig(0n, w, src);
        return { sig: this.op('pmux', w, src, { s, cases, default: dflt }) };
      }
      case 'slice':
        return this.unflat(this.slice(this.s(e.a), e.lo, w, src), e.t, src);
      case 'elem': {
        const v = this.lower(e.a);
        return this.elems(v, e.a.t, src)[e.i]!;
      }
      case 'index': {
        const t = e.a.t;
        if (t.k !== 'array') throw new ElaborationError('index of a non-array');
        const elems = this.elems(this.lower(e.a), t, src).map((x) => this.flat(x, src));
        const i = this.s(e.i);
        const full = 2 ** indexWidth(t.n) === t.n;
        const cases = elems.map((data, k) => ({ match: [BigInt(k)], data }));
        const dflt = full ? elems[elems.length - 1]! : this.constSig(0n, w, src);
        return this.unflat(this.op('pmux', w, src, { s: i, cases: full ? cases.slice(0, -1) : cases, default: dflt }), e.t, src);
      }
      case 'bitidx': {
        const a = this.s(e.a);
        const shifted = this.op('shr', this.width(a), src, { a, b: this.s(e.i), signed: false });
        return { sig: this.slice(shifted, 0, 1, src) };
      }
      case 'concat':
        return { sig: e.parts.length === 1 ? this.s(e.parts[0]!) : this.op('concat', w, src, { parts: e.parts.map((p) => this.s(p)) }) };
      case 'repeat':
        return { sig: e.n === 1 ? this.s(e.a) : this.op('repeat', w, src, { a: this.s(e.a), n: e.n }) };
      case 'ext': {
        const a = this.s(e.a);
        if (this.width(a) === w) return { sig: a };
        return { sig: this.op(e.signed ? 'sext' : 'zext', w, src, { a }) };
      }
      case 'reduce':
        return { sig: this.op(`reduce_${e.op}`, 1, src, { a: this.s(e.a) }) };
      case 'popcount':
        return { sig: this.op('popcount', bitsNeeded(BigInt(widthOf(e.a.t))), src, { a: this.s(e.a) }) };
      case 'reverse': {
        const a = this.s(e.a);
        if (w === 1) return { sig: a };
        const parts: SigId[] = [];
        for (let i = 0; i < w; i++) parts.push(this.slice(a, i, 1, src));
        return { sig: this.op('concat', w, src, { parts }) };
      }
      case 'array':
        return { elems: e.elems.map((x) => this.lower(x)) };
      case 'struct': {
        const parts = e.fields.map((f) => this.s(f));
        return { sig: parts.length === 1 ? parts[0]! : this.op('concat', w, src, { parts }) };
      }
      case 'cast':
        return this.lower(e.a);
      case 'memread': {
        const d = this.memData.get(e.mem)?.[e.port];
        if (d === undefined) throw new ElaborationError(`unknown memory read ${e.mem}`);
        return this.unflat(d, e.t, src);
      }
      case 'random':
      case 'intcast':
        throw new ElaborationError('test-only expression in hardware');
    }
  }

  private unflat(s: SigId, t: Type, src: Span): Value {
    return t.k === 'array' ? { elems: this.elems({ sig: s }, t, src) } : { sig: s };
  }
}

/** Elaborates the specialisation `top` (a module name, with generic arguments if it has any) to RTL. */
export function elaborate(program: TypedProgram, top?: string, generics: (number | bigint)[] = []): RtlDesign {
  const name = top ?? program.top;
  if (!name) throw new ElaborationError('no top module: pass its name or mark one module `top`');
  const { spec, diagnostics } = program.specialize(name, generics);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (!spec) throw new ElaborationError(errors[0]?.message ?? `cannot elaborate ${name}`);
  return elaborateSpec(spec);
}

/** Elaborates a checked specialisation and everything it instantiates. */
export function elaborateSpec(spec: ModuleSpec): RtlDesign {
  if (hasErrorsDeep(spec, new Set())) throw new ElaborationError(`module ${spec.key} has errors`);
  const modules: Record<string, RtlModule> = {};
  const visit = (s: ModuleSpec) => {
    if (modules[s.key]) return;
    const m = new ModuleBuilder(s, s.key, (c) => c.key).build();
    modules[s.key] = m;
    for (const i of s.insts.values()) visit(i.spec);
  };
  visit(spec);
  return { top: spec.key, modules };
}

function hasErrorsDeep(spec: ModuleSpec, seen: Set<string>): boolean {
  if (seen.has(spec.key)) return false;
  seen.add(spec.key);
  if (spec.hasErrors) return true;
  for (const i of spec.insts.values()) if (hasErrorsDeep(i.spec, seen)) return true;
  return false;
}
