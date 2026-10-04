/**
 * The transition relation of a Vouch system as propositional formulas: the bridge from Part I's systems to the
 * SAT-based engines (bounded model checking in chapter 10, k-induction in chapter 23, IC3 in chapter 24) and to
 * BDD-based reachability (chapter 11).
 *
 * A state is represented by Boolean variables: one per value of each finite scalar slot (one-hot), one per element
 * of each finite set, one per (argument, value) of each finite function. `init(S)` says S is an initial state, and
 * `step(S, S')` that S' follows from S by one action or one process step, with a selector variable per step instance
 * so that a model says which step was taken.
 *
 * Statements are executed symbolically: every expression evaluates to a *case split* (the values it can take, each
 * with the condition under which it takes it), or to a structured value for functions and sets; branches fork paths
 * with their path conditions; `choose` introduces fresh variables. A step's formula is the disjunction, over its
 * paths, of "the path condition holds and the next state is what the path computed".
 *
 * The semantics is the reference interpreter's (src/lib/fv/vouch/interp/system.ts): processes run from one label to
 * the next, and the instruction lists are the runtime's own. Every trace found with these formulas is replayed by
 * the runtime before it is shown; that, not this file, is what makes a counterexample trustworthy.
 */
import type * as A from '../vouch/syntax/ast';
import type { Checked, FnInfo } from '../vouch/check/checker';
import type { Ty } from '../vouch/check/types';
import { SystemRuntime, compileBlock, type Instr } from '../vouch/interp/system';
import { enumerate, key, show, set as mkSet, funcConst, funcSet, type Value } from '../vouch/interp/values';
import { fand, fnot, forr, evalFormula, type Formula } from '../sat/encode';

export class BmcError extends Error {}

export const T: Formula = { k: 'const', value: true };
export const F: Formula = { k: 'const', value: false };
const isT = (f: Formula) => f.k === 'const' && f.value;
const isF = (f: Formula) => f.k === 'const' && !f.value;
export function and(...xs: Formula[]): Formula {
  const out: Formula[] = [];
  for (const x of xs) {
    if (isF(x)) return F;
    if (isT(x)) continue;
    if (x.k === 'and') out.push(...x.args);
    else out.push(x);
  }
  return out.length === 0 ? T : out.length === 1 ? out[0]! : fand(...out);
}
export function or(...xs: Formula[]): Formula {
  const out: Formula[] = [];
  for (const x of xs) {
    if (isT(x)) return T;
    if (isF(x)) continue;
    if (x.k === 'or') out.push(...x.args);
    else out.push(x);
  }
  return out.length === 0 ? F : out.length === 1 ? out[0]! : forr(...out);
}
export const not = (x: Formula): Formula => (isT(x) ? F : isF(x) ? T : x.k === 'not' ? x.a : fnot(x));
const iff = (a: Formula, b: Formula) => (isT(a) ? b : isT(b) ? a : isF(a) ? not(b) : isF(b) ? not(a) : or(and(a, b), and(not(a), not(b))));
const v = (x: number): Formula => ({ k: 'var', v: x });

// ── Symbolic values ──

export type Cases = { value: Value; cond: Formula }[];
/** A symbolic value: a case split (scalars, structs, tuples), or a function or set over a finite domain. */
export type SV =
  | { k: 'cases'; cs: Cases }
  | { k: 'func'; dom: Value[]; keys: string[]; at: SV[] }
  | { k: 'set'; dom: Value[]; keys: string[]; mem: Formula[] }
  /** A bit-vector as a circuit: one formula per bit, least significant first (hardware, chapter 10). */
  | { k: 'bits'; bits: Formula[] };

const MAX_CASES = 4096;
function merge(cases: Cases): Cases {
  const m = new Map<string, { value: Value; conds: Formula[] }>();
  for (const c of cases) {
    if (isF(c.cond)) continue;
    const k = key(c.value);
    const e = m.get(k);
    if (e) e.conds.push(c.cond);
    else m.set(k, { value: c.value, conds: [c.cond] });
  }
  if (m.size > MAX_CASES) throw new BmcError('An expression has too many possible values for the bounded model checker.');
  return [...m.values()].map((e) => ({ value: e.value, cond: or(...e.conds) }));
}
const cases = (cs: Cases): SV => ({ k: 'cases', cs: merge(cs) });
const constant = (value: Value): SV => ({ k: 'cases', cs: [{ value, cond: T }] });
const fromBool = (f: Formula): SV => ({ k: 'cases', cs: isT(f) ? [{ value: true, cond: T }] : isF(f) ? [{ value: false, cond: T }] : [{ value: true, cond: f }, { value: false, cond: not(f) }] });
function asCases(x: SV): Cases {
  if (x.k === 'bits') return bitsToCases(x.bits);
  if (x.k !== 'cases') throw new BmcError('A function or set is used where a single value is expected.');
  return x.cs;
}

// ── Bit-vector circuits ──

/** Expand a small bit-vector into the case split over its values (for indexing and conversions). */
function bitsToCases(bits: Formula[]): Cases {
  if (bits.length > 10) throw new BmcError('A bit-vector this wide cannot be used as an index or converted to a range here.');
  const out: Cases = [];
  for (let n = 0n; n < 1n << BigInt(bits.length); n++) out.push({ value: n, cond: and(...bits.map((b, i) => ((n >> BigInt(i)) & 1n ? b : not(b)))) });
  return merge(out);
}
/** The bits of a case split, as a width-w vector (values wrap). */
export function casesToBits(cs: Cases, w: number): Formula[] {
  return Array.from({ length: w }, (_, i) => or(...cs.filter((c) => (BigInt.asUintN(w, c.value as bigint) >> BigInt(i)) & 1n).map((c) => c.cond)));
}
const constBits = (n: bigint, w: number): Formula[] => Array.from({ length: w }, (_, i) => ((BigInt.asUintN(w, n) >> BigInt(i)) & 1n ? T : F));
const xor = (a: Formula, b: Formula) => (isF(a) ? b : isF(b) ? a : isT(a) ? not(b) : isT(b) ? not(a) : or(and(a, not(b)), and(not(a), b)));
const maj = (a: Formula, b: Formula, c: Formula) => or(and(a, b), and(a, c), and(b, c));
function addBits(a: Formula[], b: Formula[], carryIn: Formula = F): Formula[] {
  let c = carryIn;
  return a.map((x, i) => {
    const y = b[i]!;
    const s = xor(xor(x, y), c);
    c = maj(x, y, c);
    return s;
  });
}
const negBits = (a: Formula[]) => addBits(a.map(not), constBits(0n, a.length), T);
function mulBits(a: Formula[], b: Formula[]): Formula[] {
  let acc = constBits(0n, a.length);
  for (let i = 0; i < a.length; i++) {
    const partial = a.map((_, j) => (j < i ? F : and(a[j - i]!, b[i]!)));
    acc = addBits(acc, partial);
  }
  return acc;
}
/** Unsigned a < b (or a <= b with `orEqual`). */
function ultBits(a: Formula[], b: Formula[], orEqual = false): Formula {
  // From the least significant bit up: lt holds if the higher bits decide it, else the lower ones did.
  let lt: Formula = orEqual ? T : F;
  for (let i = 0; i < a.length; i++) lt = or(and(not(a[i]!), b[i]!), and(iff(a[i]!, b[i]!), lt));
  return lt;
}
function shiftBits(a: Formula[], amount: Cases, dir: 'left' | 'right' | 'arith'): Formula[] {
  const w = a.length;
  const fill = dir === 'arith' ? a[w - 1]! : F;
  const shifted = (k: number) => a.map((_, i) => (dir === 'left' ? (i - k >= 0 ? a[i - k]! : F) : i + k < w ? a[i + k]! : fill));
  let out = constBits(0n, w);
  for (const c of amount) {
    const k = Number(c.value as bigint);
    const r = k >= w ? Array.from({ length: w }, () => fill) : shifted(k);
    out = out.map((x, i) => or(and(not(c.cond), x), and(c.cond, r[i]!)));
  }
  return out;
}
function toBits(x: SV, w: number): Formula[] {
  if (x.k === 'bits') return x.bits;
  if (x.k === 'cases') return casesToBits(x.cs, w);
  throw new BmcError('Expected a bit-vector.');
}
export function asBool(x: SV): Formula {
  return or(...asCases(x).filter((c) => c.value === true).map((c) => c.cond));
}

/** Equality of two symbolic values. */
export function eqSV(a: SV, b: SV): Formula {
  if (a.k === 'bits' || b.k === 'bits') {
    const w = a.k === 'bits' ? a.bits.length : (b as { bits: Formula[] }).bits.length;
    const x = toBits(a, w);
    const y = toBits(b, w);
    return and(...x.map((p, i) => iff(p, y[i]!)));
  }
  if (a.k === 'cases' && b.k === 'cases') {
    const out: Formula[] = [];
    const bm = new Map(b.cs.map((c) => [key(c.value), c.cond]));
    for (const c of a.cs) {
      const d = bm.get(key(c.value));
      if (d) out.push(and(c.cond, d));
    }
    return or(...out);
  }
  if (a.k === 'func' && b.k === 'func') return and(...a.at.map((x, i) => eqSV(x, b.at[i]!)));
  if (a.k === 'set' && b.k === 'set') return and(...a.mem.map((x, i) => iff(x, b.mem[i]!)));
  if (a.k === 'func' && b.k === 'cases') return or(...b.cs.map((c) => and(c.cond, eqSV(a, liftConst(c.value, a)))));
  if (a.k === 'cases' && b.k === 'func') return eqSV(b, a);
  throw new BmcError('These values cannot be compared.');
}
/** A constant function value as a structured SV over the same domain as `like`. */
function liftConst(val: Value, like: SV & { k: 'func' }): SV {
  if (val !== null && typeof val === 'object' && val.t === 'func') {
    const f = val;
    return { k: 'func', dom: like.dom, keys: like.keys, at: like.dom.map((d) => constant(f.entries.find(([k]) => key(k) === key(d))?.[1] ?? f.def)) };
  }
  return { k: 'func', dom: like.dom, keys: like.keys, at: like.dom.map(() => constant(val)) };
}

export function iteSV(c: Formula, a: SV, b: SV): SV {
  if (isT(c)) return a;
  if (isF(c)) return b;
  if (a.k === 'bits' || b.k === 'bits') {
    const w = a.k === 'bits' ? a.bits.length : (b as { bits: Formula[] }).bits.length;
    const x = toBits(a, w);
    const y = toBits(b, w);
    return { k: 'bits', bits: x.map((p, i) => or(and(c, p), and(not(c), y[i]!))) };
  }
  if (a.k === 'cases' && b.k === 'cases') return cases([...a.cs.map((x) => ({ value: x.value, cond: and(c, x.cond) })), ...b.cs.map((x) => ({ value: x.value, cond: and(not(c), x.cond) }))]);
  if (a.k === 'func' && b.k === 'func') return { ...a, at: a.at.map((x, i) => iteSV(c, x, b.at[i]!)) };
  if (a.k === 'set' && b.k === 'set') return { ...a, mem: a.mem.map((x, i) => or(and(c, x), and(not(c), b.mem[i]!))) };
  if (a.k === 'func' && b.k === 'cases') return iteSV(c, a, liftCases(b, a));
  if (a.k === 'cases' && b.k === 'func') return iteSV(c, liftCases(a, b), b);
  throw new BmcError('Cannot merge these values.');
}
function liftCases(x: SV & { k: 'cases' }, like: SV & { k: 'func' }): SV {
  let out: SV | undefined;
  for (const c of x.cs) {
    const f = liftConst(c.value, like);
    out = out ? iteSV(c.cond, f, out) : f;
  }
  return out!;
}

/** Allocates variables and records the side constraints of one-hot encodings. */
export class VarPool {
  next = 1;
  names = new Map<number, string>();
  /** Constraints that must always hold (exactly one value per one-hot group). */
  side: Formula[] = [];
  fresh(name?: string): number {
    const x = this.next++;
    if (name) this.names.set(x, name);
    return x;
  }
}

/** Fresh Boolean variables for a value of type `ty`. */
export function freshSV(pool: VarPool, ty: Ty, name: string): SV {
  if (ty.k === 'bool') return fromBool(v(pool.fresh(name)));
  if (ty.k === 'bv') return { k: 'bits', bits: Array.from({ length: ty.bits }, (_, i) => v(pool.fresh(`${name} bit ${i}`))) };
  if (ty.k === 'func') {
    const dom = domainOf(ty.params);
    if (!dom) throw new BmcError(`The arguments of ${name} must range over finite types.`);
    return { k: 'func', dom, keys: dom.map(key), at: dom.map((d) => freshSV(pool, ty.result, `${name}[${showArg(d)}]`)) };
  }
  if (ty.k === 'set') {
    const dom = enumerate(ty.elem);
    if (!dom) throw new BmcError(`The elements of ${name} must have a finite type.`);
    return { k: 'set', dom, keys: dom.map(key), mem: dom.map((d) => v(pool.fresh(`${showArg(d)} in ${name}`))) };
  }
  const dom = enumerate(ty);
  if (!dom) throw new BmcError(`${name} must have a finite type for bounded model checking (a range such as 0..4, an enum, bool, or a type with an instance size).`);
  if (dom.length > MAX_CASES) throw new BmcError(`${name} has too many values (${dom.length}).`);
  const vars = dom.map((d) => pool.fresh(`${name} = ${showArg(d)}`));
  pool.side.push(or(...vars.map(v)));
  for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) pool.side.push(or(not(v(vars[i]!)), not(v(vars[j]!))));
  return { k: 'cases', cs: dom.map((d, i) => ({ value: d, cond: v(vars[i]!) })) };
}

function domainOf(params: Ty[]): Value[] | undefined {
  if (params.length === 1) return enumerate(params[0]!);
  let out: Value[][] = [[]];
  for (const p of params) {
    const d = enumerate(p);
    if (!d) return undefined;
    out = out.flatMap((t) => d.map((x) => [...t, x]));
  }
  return out.map((items) => ({ t: 'tuple', items }) as Value);
}

function showArg(d: Value): string {
  if (d === null) return 'null';
  if (typeof d === 'boolean' || typeof d === 'bigint') return String(d);
  if (d.t === 'atom') return `${d.type}${d.i}`;
  if (d.t === 'enum' && !d.fields.length) return d.variant;
  if (d.t === 'tuple') return d.items.map(showArg).join(', ');
  return key(d);
}

/** The concrete value of a symbolic value under a model. */
export function decodeSV(x: SV, m: readonly boolean[]): Value {
  if (x.k === 'bits') return x.bits.reduce((n, b, i) => (evalFormula(b, m as boolean[]) ? n | (1n << BigInt(i)) : n), 0n);
  if (x.k === 'cases') {
    const hit = x.cs.find((c) => evalFormula(c.cond, m as boolean[]));
    return hit ? hit.value : x.cs[0]?.value ?? null;
  }
  if (x.k === 'set') return mkSet(x.dom.filter((_, i) => evalFormula(x.mem[i]!, m as boolean[])));
  const vals = x.at.map((a) => decodeSV(a, m));
  let f = funcConst(vals[0] ?? null);
  x.dom.forEach((d, i) => (f = funcSet(f, d, vals[i]!)));
  return f;
}

// ── States ──

export interface SymState {
  /** Per slot of the runtime (state variables, process locals, program counters). */
  slots: SV[];
}

/** A step instance: an action with concrete arguments, or one process instance leaving one label. */
export interface StepInstance {
  kind: 'action' | 'process' | 'stutter';
  name: string;
  /** Label text, as the runtime writes it (for matching during replay). */
  text: string;
  action?: A.ActionDecl;
  args: Value[];
  instance?: number;
  /** For process steps: the instruction index of the label left. */
  fromPc?: number;
  /** The action's parameters are symbolic (fresh variables per step) rather than enumerated. */
  symbolic?: boolean;
}

type Env = Map<number | string, SV>;

interface Path {
  env: Env;
  pc: bigint;
  cond: Formula;
  fail: Formula;
  failMessage?: string;
}

const DONE = -1n;
const pcKey = (i: number) => `pc:${i}`;

export class SystemEncoder {
  readonly checked: Checked;
  readonly steps: StepInstance[] = [];
  /** Instruction indices of each instance's labels (the values its pc can take, besides DONE). */
  readonly pcDomains: bigint[][] = [];
  private stepPaths = new Map<StepInstance, (S: SymState) => { paths: Path[]; params?: SV[] }>();

  constructor(
    readonly rt: SystemRuntime,
    readonly pool: VarPool = new VarPool(),
  ) {
    this.checked = rt.checked;
    rt.instances.forEach((inst) => {
      const code = rt.code.get(inst.proc)!;
      const labels: bigint[] = [];
      code.forEach((ins, i) => ins.op === 'label' && labels.push(BigInt(i)));
      this.pcDomains.push([...labels, DONE]);
    });
    // Action instances: every combination of finite parameter values.
    for (const a of rt.info.actions) {
      const doms = a.params.map((p) => {
        const d = p.ty.k === 'bv' ? undefined : enumerate(p.ty);
        if (!d && p.ty.k !== 'bv') throw new BmcError(`The parameter ${p.name} of ${a.decl.name} must have a finite type.`);
        return d;
      });
      // Wide parameters (inputs such as a 16-bit word) are symbolic: fresh variables at every step.
      if (doms.some((d) => !d || d.length > 16)) {
        const st: StepInstance = { kind: 'action', name: a.decl.name, text: a.decl.name, action: a.decl, args: [], symbolic: true };
        this.steps.push(st);
        this.stepPaths.set(st, (S) => {
          const env = this.envOf(S);
          const params = a.params.map((p) => freshSV(this.pool, p.ty, `${a.decl.name}.${p.name}`));
          a.params.forEach((p, i) => env.set(p.id, params[i]!));
          const g = a.decl.guard ? asBool(this.ev(a.decl.guard, env)) : T;
          if (isF(g)) return { paths: [] };
          return { paths: this.run(rt.actionCode.get(a.decl)!, 0, env, g, undefined), params };
        });
        continue;
      }
      for (const args of cartesian(doms as Value[][])) {
        const text = `${a.decl.name}${args.length ? `(${a.params.map((p, i) => `${p.name} = ${show(args[i]!)}`).join(', ')})` : ''}`;
        const st: StepInstance = { kind: 'action', name: a.decl.name, text, action: a.decl, args };
        this.steps.push(st);
        this.stepPaths.set(st, (S) => {
          const env = this.envOf(S);
          a.params.forEach((p, i) => env.set(p.id, constant(args[i]!)));
          const g = a.decl.guard ? asBool(this.ev(a.decl.guard, env)) : T;
          if (isF(g)) return { paths: [] };
          return { paths: this.run(rt.actionCode.get(a.decl)!, 0, env, g, undefined) };
        });
      }
    }
    // Process steps: each instance, from each label.
    rt.instances.forEach((inst, i) => {
      const code = rt.code.get(inst.proc)!;
      for (const pc of this.pcDomains[i]!) {
        if (pc === DONE) continue;
        const label = (code[Number(pc)] as Instr & { op: 'label' }).name;
        const st: StepInstance = { kind: 'process', name: inst.proc.decl.name, text: `${inst.name}: ${label}`, args: inst.args, instance: i, fromPc: Number(pc) };
        this.steps.push(st);
        this.stepPaths.set(st, (S) => {
          const env = this.envOf(S, i);
          const atPc = eqSV(S.slots[this.pcSlot(i)]!, constant(pc));
          return { paths: this.run(code, Number(pc) + 1, env, atPc, i) };
        });
      }
    });
  }

  pcSlot(i: number): number {
    const inst = this.rt.instances[i]!;
    return inst.base + inst.proc.locals.length;
  }

  /** Fresh variables for a state (named with a step index, e.g. "x@3 = 2"). */
  freshState(tag: string): SymState {
    const slots: SV[] = this.rt.slots.map((slot, i) => {
      if (slot.kind === 'pc') {
        const dom = this.pcDomains[slot.instance!]!.map((p) => p as Value);
        const vars = dom.map((d) => this.pool.fresh(`${slot.name}@${tag} = ${this.pcName(slot.instance!, d as bigint)}`));
        this.pool.side.push(or(...vars.map(v)));
        for (let a = 0; a < vars.length; a++) for (let b = a + 1; b < vars.length; b++) this.pool.side.push(or(not(v(vars[a]!)), not(v(vars[b]!))));
        return { k: 'cases', cs: dom.map((d, j) => ({ value: d, cond: v(vars[j]!) })) } as SV;
      }
      if (!slot.ty) throw new BmcError(`Slot ${slot.name} has no type.`);
      void i;
      return freshSV(this.pool, slot.ty, `${slot.name}@${tag}`);
    });
    return { slots };
  }

  pcName(i: number, pc: bigint): string {
    if (pc === DONE) return 'done';
    const ins = this.rt.code.get(this.rt.instances[i]!.proc)![Number(pc)];
    return ins?.op === 'label' ? ins.name : `@${pc}`;
  }

  /** The environment of a state: state variables, and for a process step, that instance's parameters and locals. */
  private envOf(S: SymState, instance?: number): Env {
    const env: Env = new Map();
    this.rt.info.vars.forEach((s, i) => env.set(s.id, S.slots[i]!));
    this.rt.instances.forEach((_, i) => env.set(pcKey(i), S.slots[this.pcSlot(i)]!));
    if (instance !== undefined) {
      const inst = this.rt.instances[instance]!;
      inst.proc.params.forEach((p, k) => env.set(p.id, constant(inst.args[k]!)));
      inst.proc.locals.forEach((l, k) => env.set(l.id, S.slots[inst.base + k]!));
    }
    return env;
  }

  /** The slots after a path, in runtime order. */
  private slotsAfter(S: SymState, p: Path, instance?: number): SV[] {
    const out = [...S.slots];
    this.rt.info.vars.forEach((s, i) => (out[i] = p.env.get(s.id)!));
    if (instance !== undefined) {
      const inst = this.rt.instances[instance]!;
      inst.proc.locals.forEach((l, k) => (out[inst.base + k] = p.env.get(l.id) ?? out[inst.base + k]!));
      out[this.pcSlot(instance)] = constant(p.pc);
    }
    return out;
  }

  /** S is an initial state. */
  init(S: SymState): Formula {
    const rt = this.rt;
    let partial: { env: Env; cond: Formula }[] = [{ env: new Map(), cond: T }];
    // State variables: their initial value, or anything.
    for (const s of rt.info.vars) {
      const decl = s.decl?.k === 'var' ? s.decl : undefined;
      partial = partial.map((p) => {
        const env = new Map(p.env);
        if (decl?.init) {
          let x = this.ev(decl.init, env);
          if (s.ty.k === 'func' && x.k === 'cases') x = liftCases(x, freshShape(s.ty, this.pool) as SV & { k: 'func' });
          env.set(s.id, x);
        } else env.set(s.id, freshSV(this.pool, s.ty, `${s.name}@init`));
        return { env, cond: p.cond };
      });
    }
    if (rt.info.init) {
      const code = compileBlock(rt.info.init.body);
      partial = partial.flatMap((p) => this.run(code, 0, p.env, p.cond, undefined).filter((x) => x.pc === DONE).map((x) => ({ env: x.env, cond: and(x.cond, not(x.fail)) })));
    }
    // Processes run up to their first label.
    const finals: { slots: SV[]; cond: Formula }[] = [];
    const go = (i: number, env: Env, cond: Formula, slots: SV[]) => {
      if (i === rt.instances.length) {
        rt.info.vars.forEach((s, k) => (slots[k] = env.get(s.id)!));
        finals.push({ slots: [...slots], cond });
        return;
      }
      const inst = rt.instances[i]!;
      const penv: Env = new Map(env);
      inst.proc.params.forEach((p, k) => penv.set(p.id, constant(inst.args[k]!)));
      for (const r of this.run(rt.code.get(inst.proc)!, 0, penv, cond, i)) {
        const s2 = [...slots];
        inst.proc.locals.forEach((l, k) => (s2[inst.base + k] = r.env.get(l.id) ?? constant(null)));
        s2[this.pcSlot(i)] = constant(r.pc);
        // Locals are per instance: drop them from the shared environment.
        const next: Env = new Map(r.env);
        inst.proc.locals.forEach((l) => next.delete(l.id));
        go(i + 1, next, and(r.cond, not(r.fail)), s2);
      }
    };
    for (const p of partial) go(0, p.env, p.cond, [...S.slots]);
    return or(...finals.map((f) => and(f.cond, ...f.slots.map((x, k) => eqSV(S.slots[k]!, x)))));
  }

  /**
   * One step from S to S2. Returns the transition formula, the selector variable of each step instance (true when
   * that step is taken; a stutter step keeps the state), and the condition under which the step taken fails.
   */
  step(S: SymState, S2: SymState, opts: { stutter?: boolean } = {}): { formula: Formula; selectors: { step: StepInstance; sel: number; params?: SV[] }[]; failure: Formula; failures: { step: StepInstance; cond: Formula; message: string }[] } {
    const parts: Formula[] = [];
    const selectors: { step: StepInstance; sel: number; params?: SV[] }[] = [];
    const failures: { step: StepInstance; cond: Formula; message: string }[] = [];
    const sels: Formula[] = [];
    for (const st of this.steps) {
      const { paths, params } = this.stepPaths.get(st)!(S);
      if (!paths.length) continue;
      const sel = this.pool.fresh(`step ${st.text}`);
      selectors.push({ step: st, sel, params });
      sels.push(v(sel));
      const alts: Formula[] = [];
      for (const p of paths) {
        const after = this.slotsAfter(S, p, st.instance);
        alts.push(and(p.cond, or(p.fail, and(...after.map((x, k) => eqSV(S2.slots[k]!, x))))));
        if (!isF(p.fail)) failures.push({ step: st, cond: and(v(sel), p.cond, p.fail), message: p.failMessage ?? 'a run-time check fails' });
      }
      parts.push(or(not(v(sel)), or(...alts)));
    }
    if (opts.stutter) {
      const sel = this.pool.fresh('stutter');
      const st: StepInstance = { kind: 'stutter', name: 'stutter', text: 'stutter', args: [] };
      selectors.push({ step: st, sel });
      sels.push(v(sel));
      parts.push(or(not(v(sel)), and(...S.slots.map((x, k) => eqSV(S2.slots[k]!, x)))));
    }
    parts.push(or(...sels));
    return { formula: and(...parts), selectors, failure: or(...failures.map((f) => f.cond)), failures };
  }

  /** A condition of the system (an invariant) in state S. */
  holds(e: A.Expr, S: SymState): Formula {
    return asBool(this.ev(e, this.envOf(S)));
  }

  /** Decode a state of a model into the runtime's slot values. */
  decode(S: SymState, m: readonly boolean[]): Value[] {
    return S.slots.map((x) => decodeSV(x, m));
  }

  // ── Symbolic execution of instructions ──

  run(code: Instr[], pc: number, env: Env, cond: Formula, instance: number | undefined): Path[] {
    const out: Path[] = [];
    const work: { pc: number; env: Env; cond: Formula; fail: Formula; msg?: string; fuel: number }[] = [{ pc, env: new Map(env), cond, fail: F, fuel: 4000 }];
    while (work.length) {
      const w = work.pop()!;
      let { pc: p, env: e, cond: c, fail } = w;
      let msg = w.msg;
      let fuel = w.fuel;
      for (;;) {
        if (isF(c)) break;
        if (fuel-- <= 0) throw new BmcError('A step runs for too long (a loop inside one step is unrolled too many times).');
        const ins = code[p];
        if (!ins || ins.op === 'halt') {
          out.push({ env: e, pc: DONE, cond: c, fail, failMessage: msg });
          break;
        }
        if (ins.op === 'label') {
          out.push({ env: e, pc: BigInt(p), cond: c, fail, failMessage: msg });
          break;
        }
        if (ins.op === 'jmp') {
          p = ins.to;
          continue;
        }
        if (ins.op === 'br') {
          const b = asBool(this.ev(ins.cond, e));
          if (!isF(b)) work.push({ pc: ins.then, env: new Map(e), cond: and(c, b), fail, msg, fuel });
          c = and(c, not(b));
          p = ins.else;
          continue;
        }
        if (ins.op === 'await') {
          c = and(c, asBool(this.ev(ins.cond, e)));
          p++;
          continue;
        }
        // A statement.
        const s = ins.stmt;
        if (s.k === 'choose') {
          const sym = this.checked.refs.get(s)!;
          const x = freshSV(this.pool, sym.ty, `choose ${s.name}`);
          e.set(sym.id, x);
          if (s.where) c = and(c, asBool(this.ev(s.where, e)));
          p++;
          continue;
        }
        if (s.k === 'for') {
          // Unroll a counted loop with known bounds; its body may branch.
          const sym = this.checked.refs.get(s)!;
          const lo = asCases(this.ev(s.lo, e));
          const hi = asCases(this.ev(s.hi, e));
          if (lo.length !== 1 || hi.length !== 1) throw new BmcError('The bounds of a `for` loop inside a step must not depend on the state.');
          const body = compileBlock(s.body);
          let states: { env: Env; cond: Formula; fail: Formula; msg?: string }[] = [{ env: e, cond: c, fail, msg }];
          const end = (hi[0]!.value as bigint) + (s.inclusive ? 1n : 0n);
          for (let i = lo[0]!.value as bigint; i < end; i++) {
            states = states.flatMap((st) => {
              const en = new Map(st.env);
              en.set(sym.id, constant(i));
              return this.run(body, 0, en, st.cond, instance).map((r) => ({ env: r.env, cond: r.cond, fail: or(st.fail, r.fail), msg: r.failMessage ?? st.msg }));
            });
          }
          for (const st of states.slice(1)) work.push({ pc: p + 1, env: st.env, cond: st.cond, fail: st.fail, msg: st.msg, fuel });
          if (!states.length) break;
          ({ env: e, cond: c, fail } = states[0]!);
          msg = states[0]!.msg;
          p++;
          continue;
        }
        const r = this.stmt(s, e, c);
        c = r.cond;
        if (!isF(r.fail)) {
          fail = or(fail, r.fail);
          msg ??= r.message;
        }
        p++;
      }
    }
    return out;
  }

  private stmt(s: A.Stmt, env: Env, cond: Formula): { cond: Formula; fail: Formula; message?: string } {
    switch (s.k) {
      case 'skip':
      case 'expr':
        return { cond, fail: F };
      case 'assume':
        return { cond: and(cond, asBool(this.ev(s.cond, env))), fail: F };
      case 'assert': {
        const ok = asBool(this.ev(s.cond, env));
        return { cond, fail: and(cond, not(ok)), message: `The assertion${s.label ? ` ${s.label}` : ''} fails.` };
      }
      case 'let': {
        const sym = this.checked.refs.get(s);
        if (!sym) throw new BmcError(`Unknown variable ${s.name}.`);
        if (!s.init) {
          env.set(sym.id, freshSV(this.pool, sym.ty, s.name));
          return { cond, fail: F };
        }
        env.set(sym.id, this.ev(s.init, env));
        return this.rangeCheck(sym.ty, env.get(sym.id)!, cond, s.name);
      }
      case 'assign': {
        let value = this.ev(s.value, env);
        if (s.op !== '=') value = this.arith(s.op[0]!, this.ev(s.target, env), value);
        return this.assign(s.target, value, env, cond);
      }
      case 'multi': {
        const vals = s.values.map((x) => this.ev(x, env));
        let fail = F;
        let message: string | undefined;
        s.targets.forEach((t, i) => {
          if (s.declare) {
            const sym = this.checked.refs.get(t);
            if (sym) env.set(sym.id, vals[i]!);
          } else {
            const r = this.assign(t, vals[i]!, env, cond);
            fail = or(fail, r.fail);
            message ??= r.message;
          }
        });
        return { cond, fail, message };
      }
      default:
        throw new BmcError(`The statement ${s.k} is not supported by the bounded model checker.`);
    }
  }

  private rangeCheck(ty: Ty, x: SV, cond: Formula, name: string): { cond: Formula; fail: Formula; message?: string } {
    if (x.k !== 'cases' || (ty.k !== 'range' && ty.k !== 'mach')) return { cond, fail: F };
    const dom = enumerate(ty);
    if (!dom) return { cond, fail: F };
    const ok = new Set(dom.map(key));
    const bad = or(...x.cs.filter((c) => !ok.has(key(c.value))).map((c) => c.cond));
    return { cond, fail: and(cond, bad), message: `A value outside the type of ${name} is assigned.` };
  }

  private assign(target: A.Expr, value: SV, env: Env, cond: Formula): { cond: Formula; fail: Formula; message?: string } {
    if (target.k === 'var') {
      const sym = this.checked.refs.get(target);
      if (!sym) throw new BmcError(`Unknown variable ${target.name}.`);
      const old = env.get(sym.id);
      let val = value;
      if (sym.ty.k === 'func' && val.k === 'cases' && old?.k === 'func') val = liftCases(val, old);
      env.set(sym.id, val);
      return this.rangeCheck(sym.ty, val, cond, target.name);
    }
    if (target.k === 'index') {
      const base = target.target;
      if (base.k !== 'var') throw new BmcError('Only `f[x] = …` with f a variable can be assigned in a bounded model.');
      const sym = this.checked.refs.get(base);
      const f = sym ? env.get(sym.id) : undefined;
      if (!sym || !f || f.k !== 'func') throw new BmcError(`${base.name} is not a function variable.`);
      const idx = this.indexCases(target.indices, env);
      const at = f.at.map((old, i) => {
        const hit = or(...idx.filter((c) => key(c.value) === f.keys[i]).map((c) => c.cond));
        return iteSV(hit, value, old);
      });
      env.set(sym.id, { ...f, at });
      const resTy = sym.ty.k === 'func' ? sym.ty.result : sym.ty;
      return this.rangeCheck(resTy, value, cond, `${base.name}[…]`);
    }
    if (target.k === 'field') {
      const base = target.target;
      if (base.k !== 'var') throw new BmcError('Only `x.f = …` with x a variable can be assigned in a bounded model.');
      const sym = this.checked.refs.get(base)!;
      const old = asCases(env.get(sym.id)!);
      const ty = sym.ty;
      if (ty.k !== 'struct') throw new BmcError(`${base.name} is not a struct.`);
      const fi = ty.fields.findIndex((f) => f.name === target.name);
      const nv = asCases(value);
      const out: Cases = [];
      for (const o of old) for (const n of nv) {
        const sv = o.value as { t: 'struct'; name: string; fields: readonly Value[] };
        out.push({ value: { t: 'struct', name: sv.name, fields: sv.fields.map((x, i) => (i === fi ? n.value : x)) } as Value, cond: and(o.cond, n.cond) });
      }
      env.set(sym.id, cases(out));
      return { cond, fail: F };
    }
    throw new BmcError('This assignment target is not supported by the bounded model checker.');
  }

  private indexCases(indices: A.Expr[], env: Env): Cases {
    const parts = indices.map((i) => asCases(this.ev(i, env)));
    if (parts.length === 1) return parts[0]!;
    let combos: { vals: Value[]; cond: Formula }[] = [{ vals: [], cond: T }];
    for (const p of parts) combos = combos.flatMap((x) => p.map((y) => ({ vals: [...x.vals, y.value], cond: and(x.cond, y.cond) })));
    return merge(combos.map((c) => ({ value: { t: 'tuple', items: c.vals } as Value, cond: c.cond })));
  }

  // ── Expressions ──

  private isBv(e: A.Expr): boolean {
    return this.checked.types.get(e)?.k === 'bv';
  }
  private width(e: A.Expr): number {
    const t = this.checked.types.get(e);
    if (t?.k !== 'bv') throw new BmcError('Expected a bit-vector.');
    return t.bits;
  }

  ev(e: A.Expr, env: Env): SV {
    switch (e.k) {
      case 'int': {
        const t = this.checked.types.get(e);
        return t?.k === 'bv' ? { k: 'bits', bits: constBits(e.value, t.bits) } : constant(e.value);
      }
      case 'bool':
        return constant(e.value);
      case 'cast': {
        const to = this.checked.types.get(e);
        const x = this.ev(e.arg, env);
        if (to?.k === 'bv') {
          if (x.k === 'bits') return { k: 'bits', bits: Array.from({ length: to.bits }, (_, i) => x.bits[i] ?? F) };
          return { k: 'bits', bits: casesToBits(asCases(x), to.bits) };
        }
        return { k: 'cases', cs: asCases(x) };
      }
      case 'null':
        return constant(null);
      case 'var': {
        const s = this.checked.refs.get(e);
        if (!s) throw new BmcError(`Unknown name ${e.name}.`);
        const x = env.get(s.id);
        if (x) return x;
        if (s.kind === 'variant' && s.ty.k === 'enum') return constant({ t: 'enum', name: s.ty.name, tag: s.index!, variant: s.name, fields: [] });
        if (s.kind === 'const' && s.value !== undefined) return constant(s.value);
        if (s.kind === 'const' && s.decl?.k === 'const') return this.ev(s.decl.value, env);
        throw new BmcError(`${e.name} cannot be used here.`);
      }
      case 'unary': {
        if (e.op === '!') return fromBool(not(asBool(this.ev(e.arg, env))));
        if (this.isBv(e)) {
          const w = this.width(e);
          const x = toBits(this.ev(e.arg, env), w);
          if (e.op === '~') return { k: 'bits', bits: x.map(not) };
          if (e.op === '-') return { k: 'bits', bits: negBits(x) };
        }
        if (e.op === '-') return cases(asCases(this.ev(e.arg, env)).map((c) => ({ value: -(c.value as bigint), cond: c.cond })));
        if (e.op === '#') {
          const x = this.ev(e.arg, env);
          if (x.k !== 'set') throw new BmcError('`#` counts the elements of a set.');
          let dp: Formula[] = [T];
          for (const m of x.mem) {
            const next: Formula[] = [];
            for (let k = 0; k <= dp.length; k++) next.push(or(and(dp[k] ?? F, not(m)), and(dp[k - 1] ?? F, m)));
            dp = next;
          }
          return cases(dp.map((f, k) => ({ value: BigInt(k), cond: f })));
        }
        throw new BmcError(`The operator ${e.op} is not supported by the bounded model checker.`);
      }
      case 'binary':
        return this.binary(e, env);
      case 'chain': {
        if (e.args.some((a) => this.isBv(a))) {
          const parts = e.ops.map((op, i) => asBool(this.binary({ k: 'binary', op, left: e.args[i]!, right: e.args[i + 1]!, span: e.span } as A.Expr & { k: 'binary' }, env)));
          return fromBool(and(...parts));
        }
        const args = e.args.map((a) => asCases(this.ev(a, env)));
        return fromBool(and(...e.ops.map((op, i) => this.relate(op, args[i]!, args[i + 1]!))));
      }
      case 'index': {
        const f = this.ev(e.target, env);
        if (f.k !== 'func') throw new BmcError('Only functions can be indexed in a bounded model.');
        const idx = this.indexCases(e.indices, env);
        let out: SV | undefined;
        for (const c of idx) {
          const i = f.keys.indexOf(key(c.value));
          if (i < 0) continue;
          out = out ? iteSV(c.cond, f.at[i]!, out) : f.at[i]!;
        }
        if (!out) throw new BmcError('An index is outside the domain of the function.');
        return out;
      }
      case 'field': {
        const x = asCases(this.ev(e.target, env));
        const ty = this.checked.types.get(e.target);
        if (ty?.k !== 'struct') throw new BmcError('Field access needs a struct.');
        const fi = ty.fields.findIndex((f) => f.name === e.name);
        return cases(x.map((c) => ({ value: (c.value as Value & { fields: readonly Value[] }).fields[fi]!, cond: c.cond })));
      }
      case 'struct': {
        const ty = this.checked.types.get(e);
        if (ty?.k !== 'struct') throw new BmcError('Unknown struct.');
        let combos: { vals: Value[]; cond: Formula }[] = [{ vals: [], cond: T }];
        for (const f of ty.fields) {
          const init = e.fields.find((x) => x.name === f.name);
          if (!init) throw new BmcError(`Field ${f.name} has no value.`);
          const cs = asCases(this.ev(init.value, env));
          combos = combos.flatMap((x) => cs.map((y) => ({ vals: [...x.vals, y.value], cond: and(x.cond, y.cond) })));
        }
        return cases(combos.map((c) => ({ value: { t: 'struct', name: ty.name, fields: c.vals } as Value, cond: c.cond })));
      }
      case 'tuple': {
        let combos: { vals: Value[]; cond: Formula }[] = [{ vals: [], cond: T }];
        for (const x of e.elems) {
          const cs = asCases(this.ev(x, env));
          combos = combos.flatMap((a) => cs.map((y) => ({ vals: [...a.vals, y.value], cond: and(a.cond, y.cond) })));
        }
        return cases(combos.map((c) => ({ value: { t: 'tuple', items: c.vals } as Value, cond: c.cond })));
      }
      case 'setlit': {
        const ty = this.checked.types.get(e);
        const dom = ty?.k === 'set' ? enumerate(ty.elem) : undefined;
        if (!dom) throw new BmcError('A set in a bounded model needs a finite element type.');
        const keys = dom.map(key);
        const mem: Formula[] = dom.map(() => F);
        for (const x of e.elems) for (const c of asCases(this.ev(x, env))) {
          const i = keys.indexOf(key(c.value));
          if (i >= 0) mem[i] = or(mem[i]!, c.cond);
        }
        return { k: 'set', dom, keys, mem };
      }
      case 'comprehension': {
        if (e.value || e.seq || e.binders.length !== 1) throw new BmcError('Only { x: T | condition } sets are supported in bounded models.');
        const sym = this.checked.refs.get(e.binders[0]!)!;
        const dom = enumerate(sym.ty);
        if (!dom) throw new BmcError('The variable of a set comprehension must range over a finite type.');
        return { k: 'set', dom, keys: dom.map(key), mem: dom.map((d) => asBool(this.ev(e.body, new Map(env).set(sym.id, constant(d))))) };
      }
      case 'quant': {
        const parts: Formula[] = [];
        const go = (i: number, en: Env) => {
          if (i === e.binders.length) {
            parts.push(asBool(this.ev(e.body, en)));
            return;
          }
          const b = e.binders[i]!;
          const sym = this.checked.refs.get(b)!;
          let dom: Value[] | undefined;
          if (b.range && !('set' in b.range)) {
            const lo = asCases(this.ev(b.range.lo, en));
            const hi = asCases(this.ev(b.range.hi, en));
            if (lo.length !== 1 || hi.length !== 1) throw new BmcError('Quantifier ranges must not depend on the state.');
            dom = [];
            for (let x = lo[0]!.value as bigint; b.range.inclusive ? x <= (hi[0]!.value as bigint) : x < (hi[0]!.value as bigint); x++) dom.push(x);
          } else dom = enumerate(sym.ty);
          if (!dom) throw new BmcError(`The quantifier over ${b.name} must range over a finite type.`);
          for (const d of dom) go(i + 1, new Map(en).set(sym.id, constant(d)));
        };
        go(0, env);
        return fromBool(e.q === 'forall' ? and(...parts) : or(...parts));
      }
      case 'if': {
        const c = asBool(this.ev(e.cond, env));
        return iteSV(c, this.ev(e.then, env), this.ev(e.else, env));
      }
      case 'block': {
        let en = env;
        for (const l of e.lets) {
          const s = this.checked.refs.get(l);
          if (!s) throw new BmcError('Unknown let binding.');
          en = new Map(en).set(s.id, this.ev(l.value, en));
        }
        return this.ev(e.body, en);
      }
      case 'call':
        return this.call(e, env);
      case 'at': {
        const proc = e.proc.k === 'call' ? this.checked.refs.get(e.proc) : undefined;
        if (!proc || e.proc.k !== 'call') throw new BmcError('`at` needs a process instance such as P(0).');
        const args = e.proc.args.map((a) => asCases(this.ev(a, env)));
        const out: Formula[] = [];
        this.rt.instances.forEach((inst, i) => {
          if (inst.proc.sym !== proc) return;
          const argsMatch = and(...inst.args.map((a, k) => or(...args[k]!.filter((c) => key(c.value) === key(a)).map((c) => c.cond))));
          const code = this.rt.code.get(inst.proc)!;
          const li = code.findIndex((ins) => ins.op === 'label' && ins.name === e.label);
          if (li < 0) return;
          out.push(and(argsMatch, eqSV(env.get(pcKey(i))!, constant(BigInt(li)))));
        });
        return fromBool(or(...out));
      }
      case 'mult': {
        const x = this.ev(e.arg, env);
        if (x.k !== 'set') throw new BmcError(`\`${e.m}\` needs a set.`);
        const some = or(...x.mem);
        const lone = and(...x.mem.flatMap((a, i) => x.mem.slice(i + 1).map((b) => not(and(a, b)))));
        return fromBool(e.m === 'some' ? some : e.m === 'no' ? not(some) : e.m === 'lone' ? lone : and(some, lone));
      }
      default:
        throw new BmcError(`This kind of expression (${e.k}) is not supported by the bounded model checker.`);
    }
  }

  private call(e: A.Expr & { k: 'call' }, env: Env): SV {
    const s = this.checked.refs.get(e);
    if (!s) {
      if (['slt', 'sle', 'sgt', 'sge', 'ashr'].includes(e.callee)) {
        const w = this.width(e.args[0]!);
        const x = toBits(this.ev(e.args[0]!, env), w);
        if (e.callee === 'ashr') return { k: 'bits', bits: shiftBits(x, asCases(this.ev(e.args[1]!, env)), 'arith') };
        const y = toBits(this.ev(e.args[1]!, env), w);
        // Signed comparison: flip the sign bits and compare unsigned.
        const fx = [...x.slice(0, -1), not(x[w - 1]!)];
        const fy = [...y.slice(0, -1), not(y[w - 1]!)];
        const r = e.callee === 'slt' ? ultBits(fx, fy) : e.callee === 'sle' ? ultBits(fx, fy, true) : e.callee === 'sgt' ? ultBits(fy, fx) : ultBits(fy, fx, true);
        return fromBool(r);
      }
      const args = e.args.map((a) => asCases(this.ev(a, env)));
      if (e.callee === 'abs') return cases(args[0]!.map((c) => ({ value: (c.value as bigint) < 0n ? -(c.value as bigint) : c.value, cond: c.cond })));
      if (e.callee === 'min' || e.callee === 'max') {
        let acc = args[0]!;
        for (const b of args.slice(1)) {
          const out: Cases = [];
          for (const x of acc) for (const y of b) out.push({ value: (e.callee === 'min') === (x.value as bigint) <= (y.value as bigint) ? x.value : y.value, cond: and(x.cond, y.cond) });
          acc = merge(out);
        }
        return { k: 'cases', cs: acc };
      }
      throw new BmcError(`${e.callee}(…) is not supported by the bounded model checker.`);
    }
    if (s.kind === 'variant' && s.ty.k === 'enum') {
      const ty = s.ty;
      const parts = e.args.map((a) => asCases(this.ev(a, env)));
      let combos: { vals: Value[]; cond: Formula }[] = [{ vals: [], cond: T }];
      for (const p of parts) combos = combos.flatMap((x) => p.map((y) => ({ vals: [...x.vals, y.value], cond: and(x.cond, y.cond) })));
      return cases(combos.map((c) => ({ value: { t: 'enum', name: ty.name, tag: s.index!, variant: s.name, fields: c.vals } as Value, cond: c.cond })));
    }
    const info = [...this.checked.fns.values(), ...this.rt.info.fns].find((f) => f.sym === s) as FnInfo | undefined;
    if (!info || !info.decl.body || 'stmts' in info.decl.body) throw new BmcError(`${e.callee} must be a predicate or pure function with an expression body.`);
    const en: Env = new Map(env);
    e.args.forEach((a, i) => en.set(info.params[i]!.id, this.ev(a, env)));
    return this.ev(info.decl.body as A.Expr, en);
  }

  private relate(op: string, a: Cases, b: Cases): Formula {
    const out: Formula[] = [];
    for (const x of a) {
      for (const y of b) {
        let holds: boolean;
        switch (op) {
          case '==':
            holds = key(x.value) === key(y.value);
            break;
          case '!=':
            holds = key(x.value) !== key(y.value);
            break;
          case '<':
            holds = (x.value as bigint) < (y.value as bigint);
            break;
          case '<=':
            holds = (x.value as bigint) <= (y.value as bigint);
            break;
          case '>':
            holds = (x.value as bigint) > (y.value as bigint);
            break;
          case '>=':
            holds = (x.value as bigint) >= (y.value as bigint);
            break;
          default:
            throw new BmcError(`Cannot compare with ${op}.`);
        }
        if (holds) out.push(and(x.cond, y.cond));
      }
    }
    return or(...out);
  }

  private arith(op: string, a: SV, b: SV): SV {
    const out: Cases = [];
    for (const x of asCases(a)) {
      for (const y of asCases(b)) {
        const p = x.value as bigint;
        const q = y.value as bigint;
        let r: bigint;
        switch (op) {
          case '+':
            r = p + q;
            break;
          case '-':
            r = p - q;
            break;
          case '*':
            r = p * q;
            break;
          case '/':
            if (q === 0n) continue;
            r = p / q;
            break;
          case '%':
            if (q === 0n) continue;
            r = p % q;
            break;
          default:
            throw new BmcError(`The operator ${op} is not supported by the bounded model checker.`);
        }
        out.push({ value: r, cond: and(x.cond, y.cond) });
      }
    }
    return cases(out);
  }

  private binary(e: A.Expr & { k: 'binary' }, env: Env): SV {
    const op = e.op;
    if (op === '&&' || op === '||' || op === '==>' || op === '<==' || op === '<==>') {
      const l = asBool(this.ev(e.left, env));
      if (op === '&&' && isF(l)) return constant(false);
      if (op === '||' && isT(l)) return constant(true);
      if (op === '==>' && isF(l)) return constant(true);
      const r = asBool(this.ev(e.right, env));
      return fromBool(op === '&&' ? and(l, r) : op === '||' ? or(l, r) : op === '==>' ? or(not(l), r) : op === '<==' ? or(l, not(r)) : iff(l, r));
    }
    if (op === 'in' || op === '!in') {
      const s = this.ev(e.right, env);
      const x = asCases(this.ev(e.left, env));
      let f: Formula;
      if (s.k === 'set') f = or(...x.map((c) => { const i = s.keys.indexOf(key(c.value)); return i < 0 ? F : and(c.cond, s.mem[i]!); }));
      else throw new BmcError('`in` needs a set in a bounded model.');
      return fromBool(op === 'in' ? f : not(f));
    }
    if (this.isBv(e.left) || this.isBv(e.right)) {
      const w = this.width(this.isBv(e.left) ? e.left : e.right);
      const x = toBits(this.ev(e.left, env), w);
      const yv = this.ev(e.right, env);
      if (op === '<<' || op === '>>') {
        const amount = yv.k === 'bits' ? bitsToCases(yv.bits.slice(0, Math.min(yv.bits.length, 7))) : asCases(yv);
        return { k: 'bits', bits: shiftBits(x, amount, op === '<<' ? 'left' : 'right') };
      }
      const y = toBits(yv, w);
      switch (op) {
        case '==':
        case '!=': {
          const eq = and(...x.map((p, i) => iff(p, y[i]!)));
          return fromBool(op === '==' ? eq : not(eq));
        }
        case '<':
          return fromBool(ultBits(x, y));
        case '<=':
          return fromBool(ultBits(x, y, true));
        case '>':
          return fromBool(ultBits(y, x));
        case '>=':
          return fromBool(ultBits(y, x, true));
        case '+':
          return { k: 'bits', bits: addBits(x, y) };
        case '-':
          return { k: 'bits', bits: addBits(x, y.map(not), T) };
        case '*':
          return { k: 'bits', bits: mulBits(x, y) };
        case '&':
          return { k: 'bits', bits: x.map((p, i) => and(p, y[i]!)) };
        case '|':
          return { k: 'bits', bits: x.map((p, i) => or(p, y[i]!)) };
        case '^':
          return { k: 'bits', bits: x.map((p, i) => xor(p, y[i]!)) };
        default:
          throw new BmcError(`The bit-vector operator ${op} is not supported by the bounded model checker.`);
      }
    }
    const a = this.ev(e.left, env);
    const b = this.ev(e.right, env);
    if (op === '==' || op === '!=') {
      const eq = eqSV(a, b);
      return fromBool(op === '==' ? eq : not(eq));
    }
    if (['<', '<=', '>', '>='].includes(op)) return fromBool(this.relate(op, asCases(a), asCases(b)));
    if (a.k === 'set' && b.k === 'set' && (op === '+' || op === '-' || op === '&')) {
      return { ...a, mem: a.mem.map((x, i) => (op === '+' ? or(x, b.mem[i]!) : op === '&' ? and(x, b.mem[i]!) : and(x, not(b.mem[i]!)))) };
    }
    if (a.k === 'set' && b.k === 'cases' && (op === '+' || op === '-')) {
      // set + element (written as a one-element set literal normally; tolerate a bare element).
      return this.binary({ ...e, right: { k: 'setlit', elems: [e.right], multi: false, span: e.right.span } } as A.Expr & { k: 'binary' }, env);
    }
    return this.arith(op, a, b);
  }
}

function freshShape(ty: Ty, pool: VarPool): SV {
  // Only the domain matters (for lifting constants); allocate no variables.
  if (ty.k === 'func') {
    const dom = domainOf(ty.params) ?? [];
    void pool;
    return { k: 'func', dom, keys: dom.map(key), at: dom.map(() => constant(null)) };
  }
  throw new BmcError('Expected a function type.');
}

function* cartesian(domains: Value[][]): Generator<Value[]> {
  if (!domains.length) {
    yield [];
    return;
  }
  const [first, ...rest] = domains;
  for (const x of first!) for (const tail of cartesian(rest)) yield [x, ...tail];
}

