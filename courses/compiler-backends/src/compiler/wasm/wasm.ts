// WebAssembly backend: a very different kind of target.
//
// Wasm is a stack machine with *structured* control flow: there are no gotos,
// only `block`/`loop`/`if` constructs and `br N` to the N-th enclosing label.
// It has unlimited typed locals, so there is no register allocation — the
// engine's JIT does that later. The interesting problems are instead:
//   1. recovering structured control flow from an arbitrary (reducible) CFG:
//      we implement N. Ramsey, "Beyond Relooper: Recursive Translation of
//      Unstructured Control Flow to Structured Control Flow" (ICFP 2022),
//      which works directly from the dominator tree and reverse postorder;
//   2. "stackifying" SSA values back into operand-stack expressions;
//   3. placing phi copies on edges (no critical-edge splitting needed: every
//      edge becomes a distinct branch site in the structured code);
//   4. a shadow stack in linear memory for address-taken locals (arrays).

import { dominators } from '../analysis/dom';
import { irGraph } from '../analysis/graph';
import { Const, Instr, type Block, type Func, type Module, type Value, valueName } from '../ir/ir';
import { sequentialize } from '../codegen/ssadestroy';
import { tok, type Line, type Tok } from '../listing';

export interface WInstr {
  op: string;
  imm?: number | bigint;
  /** for block/loop/if: label comment; for calls/locals: name */
  name?: string;
  body?: WInstr[];
  else?: WInstr[];
  ir?: number;
  line?: number;
  note?: string;
}

export interface WFunc {
  name: string;
  index: number;
  params: number;
  locals: { name: string; type: 'i32' | 'i64' }[];
  body: WInstr[];
  structure: StructStep[];
  frameSize: number;
  line?: number;
}

export interface StructStep {
  kind: 'loop' | 'block' | 'if' | 'inline' | 'br' | 'return';
  node: string;
  target?: string;
  depth: number;
  why: string;
}

export interface WasmResult {
  funcs: WFunc[];
  wat: Line[];
  bytes: Uint8Array<ArrayBuffer>;
  dataBase: number;
  globalsAddr: Record<string, number>;
  imports: string[];
}

const DATA_BASE = 1024;
const PAGES = 4;
const STACK_TOP = PAGES * 65536;

const ARITH: Record<string, string> = {
  add: 'i64.add', sub: 'i64.sub', mul: 'i64.mul', sdiv: 'i64.div_s', srem: 'i64.rem_s', and: 'i64.and', or: 'i64.or',
  xor: 'i64.xor', shl: 'i64.shl', ashr: 'i64.shr_s', lshr: 'i64.shr_u',
};
const CMP: Record<string, string> = { eq: 'i64.eq', ne: 'i64.ne', slt: 'i64.lt_s', sle: 'i64.le_s', sgt: 'i64.gt_s', sge: 'i64.ge_s' };

type Ctx = { kind: 'loop' | 'block' | 'if'; node: Block }[];

export function lowerFunc(fn: Func, fnIndex: Map<string, number>, globalsAddr: Record<string, number>, opts: { stackify: boolean }): WFunc {
  fn.computePreds();
  const g = irGraph(fn);
  const dom = dominators(g);
  const idx = new Map(fn.blocks.map((b, i) => [b, i]));
  const rpo = dom.rpoIndex;
  const structure: StructStep[] = [];

  // ---- locals: params first, then one per SSA value that needs a home
  const locals: WFunc['locals'] = fn.params.map((p) => ({ name: valueName(p), type: 'i64' }));
  const localOf = new Map<Value, number>();
  fn.params.forEach((p, k) => localOf.set(p, k));
  const uses = fn.uses();
  // frame: allocas live in a shadow stack in linear memory
  let frameSize = 0;
  const frameOff = new Map<Instr, number>();
  for (const i of fn.entry.instrs) if (i.op === 'alloca') { frameOff.set(i, frameSize); frameSize += Math.ceil(i.size! / 8) * 8; }
  frameSize = Math.ceil(frameSize / 16) * 16;
  const spLocal = frameSize ? locals.push({ name: '$fp', type: 'i32' }) - 1 : -1;

  // a value is "stackified" (emitted inline at its single use) when it is pure,
  // used once, in the same block, and nothing with side effects sits between
  const inline = new Set<Instr>();
  if (opts.stackify) {
    for (const b of fn.blocks) {
      const pos = new Map(b.instrs.map((x, k) => [x, k]));
      for (const i of b.instrs) {
        const us = uses.get(i) ?? [];
        if (us.length !== 1 || us[0].block !== b || us[0].op === 'phi' || i.op === 'phi' || i.op === 'alloca') continue;
        if (!(i.isPure || i.op === 'load')) continue;
        if (i.op === 'load') {
          let clobber = false;
          for (let k = pos.get(i)! + 1; k < pos.get(us[0])!; k++) if (b.instrs[k].op === 'store' || b.instrs[k].op === 'call') clobber = true;
          if (clobber) continue;
        }
        inline.add(i);
      }
    }
  }
  for (const b of fn.blocks) {
    for (const i of b.instrs) {
      if (i.type === 'void' || i.op === 'alloca' || inline.has(i)) continue;
      localOf.set(i, locals.length);
      locals.push({ name: valueName(i), type: i.type === 'i1' ? 'i32' : 'i64' });
    }
  }

  const W = (op: string, extra: Partial<WInstr> = {}): WInstr => ({ op, ...extra });

  // ---- expressions
  const expr = (v: Value, out: WInstr[], want: 'i64' | 'i32' = 'i64') => {
    if (v instanceof Const) {
      if (want === 'i32' || v.type === 'i1') out.push(W('i32.const', { imm: Number(v.v) }));
      else out.push(W('i64.const', { imm: v.v }));
      return;
    }
    const i = v as Instr;
    if (i.op === 'alloca') {
      out.push(W('local.get', { imm: spLocal, name: '$fp' }), W('i64.extend_i32_u'), W('i64.const', { imm: BigInt(frameOff.get(i)!) }), W('i64.add', { note: `address of stack slot ${valueName(i)}` }));
      return;
    }
    if (inline.has(i)) { compute(i, out); return; }
    out.push(W('local.get', { imm: localOf.get(i)!, name: valueName(i) }));
  };
  const addr = (v: Value, out: WInstr[]) => {
    expr(v, out);
    out.push(W('i32.wrap_i64', { note: 'linear-memory addresses are 32-bit (memory32)' }));
  };
  const compute = (i: Instr, out: WInstr[]) => {
    const meta = { ir: i.id, line: i.line };
    switch (i.op) {
      case 'icmp': expr(i.args[0], out); expr(i.args[1], out); out.push(W(CMP[i.pred!], meta)); return;
      case 'zext': expr(i.args[0], out, 'i32'); out.push(W('i64.extend_i32_u', meta)); return;
      case 'select': expr(i.args[1], out); expr(i.args[2], out); expr(i.args[0], out, 'i32'); out.push(W('select', meta)); return;
      case 'load': addr(i.args[0], out); out.push(W('i64.load', { ...meta, imm: 3 })); return;
      case 'gaddr': out.push(W('i64.const', { ...meta, imm: BigInt(globalsAddr[i.sym!]), note: `address of @${i.sym} in linear memory` })); return;
      case 'call': for (const a of i.args) expr(a, out); out.push(W('call', { ...meta, imm: fnIndex.get(i.sym!)!, name: i.sym })); return;
      default:
        if (ARITH[i.op]) { expr(i.args[0], out); expr(i.args[1], out); out.push(W(ARITH[i.op], meta)); return; }
        throw new Error(`wasm: cannot lower ${i.op}`);
    }
  };

  // ---- phi copies on an edge (a parallel copy, sequentialised)
  const edgeCopies = (from: Block, to: Block, out: WInstr[]) => {
    const phis = to.phis;
    if (!phis.length) return;
    const tmpLocals: number[] = [];
    // sources may be constants or values; move them all through the operand stack
    const copies = phis.map((p) => ({ dst: localOf.get(p)!, src: p.args[p.blocks.indexOf(from)] }));
    const valued = copies.filter((c) => !(c.src instanceof Const) && localOf.has(c.src));
    const seq = sequentialize(valued.map((c) => ({ dst: c.dst, src: localOf.get(c.src)! })), () => {
      const t = locals.push({ name: '$swap', type: 'i64' }) - 1;
      tmpLocals.push(t);
      return t;
    });
    for (const c of seq) out.push(W('local.get', { imm: c.src, name: locals[c.src].name }), W('local.set', { imm: c.dst, name: locals[c.dst].name, note: `phi copy on edge ${from.name} → ${to.name}` }));
    for (const c of copies) {
      if (valued.includes(c)) continue;
      expr(c.src, out);
      out.push(W('local.set', { imm: c.dst, name: locals[c.dst].name, note: `phi copy on edge ${from.name} → ${to.name}` }));
    }
  };

  // ---- Ramsey's recursive translation
  const isMerge = (b: Block) => b.preds.filter((p) => rpo[idx.get(p)!] < rpo[idx.get(b)!]).length >= 2;
  const isLoopHeader = (b: Block) => b.preds.some((p) => rpo[idx.get(p)!] >= rpo[idx.get(b)!]);
  const children = (b: Block) => dom.children[idx.get(b)!].map((k) => fn.blocks[k]);

  const doTree = (x: Block, ctx: Ctx, out: WInstr[]) => {
    const merges = children(x).filter(isMerge).sort((a, b) => rpo[idx.get(b)!] - rpo[idx.get(a)!]);
    if (isLoopHeader(x)) {
      const body: WInstr[] = [];
      structure.push({ kind: 'loop', node: x.name, depth: ctx.length, why: `${x.name} has a back edge: wrap it in 'loop' so 'br' can jump back to its start` });
      nodeWithin(x, merges, [{ kind: 'loop', node: x }, ...ctx], body);
      out.push(W('loop', { name: x.name, body }));
    } else nodeWithin(x, merges, ctx, out);
  };

  const nodeWithin = (x: Block, ys: Block[], ctx: Ctx, out: WInstr[]) => {
    if (!ys.length) {
      for (const i of x.instrs) {
        if (i.op === 'phi' || i.op === 'alloca' || inline.has(i) || i.isTerminator) continue;
        if (i.op === 'store') {
          addr(i.args[1], out);
          expr(i.args[0], out);
          out.push(W('i64.store', { imm: 3, ir: i.id, line: i.line }));
          continue;
        }
        compute(i, out);
        if (i.type === 'void') continue;
        if (localOf.has(i)) out.push(W('local.set', { imm: localOf.get(i)!, name: valueName(i), ir: i.id, line: i.line }));
        else out.push(W('drop'));
      }
      const t = x.terminator!;
      if (t.op === 'ret') {
        expr(t.args[0], out);
        if (frameSize) out.push(W('local.get', { imm: spLocal, name: '$fp' }), W('i32.const', { imm: frameSize }), W('i32.add'), W('global.set', { imm: 0, name: '$sp', note: 'pop the shadow-stack frame' }));
        out.push(W('return', { ir: t.id, line: t.line }));
        structure.push({ kind: 'return', node: x.name, depth: ctx.length, why: 'return' });
      } else if (t.op === 'br') doBranch(x, t.blocks[0], ctx, out);
      else {
        expr(t.args[0], out, 'i32');
        const th: WInstr[] = [], el: WInstr[] = [];
        const ictx: Ctx = [{ kind: 'if', node: x }, ...ctx];
        structure.push({ kind: 'if', node: x.name, depth: ctx.length, why: `two-way branch at the end of ${x.name}: 'if' with one arm per successor` });
        doBranch(x, t.blocks[0], ictx, th);
        doBranch(x, t.blocks[1], ictx, el);
        out.push(W('if', { name: x.name, body: th, else: el, ir: t.id, line: t.line }));
      }
      return;
    }
    const [y, ...rest] = ys;
    const inner: WInstr[] = [];
    structure.push({ kind: 'block', node: y.name, depth: ctx.length, why: `${y.name} is a merge point dominated by ${x.name}: open a 'block' whose end is ${y.name}, so predecessors can 'br' out to it` });
    nodeWithin(x, rest, [{ kind: 'block', node: y }, ...ctx], inner);
    out.push(W('block', { name: `→ ${y.name}`, body: inner }));
    doTree(y, ctx, out);
  };

  const doBranch = (from: Block, to: Block, ctx: Ctx, out: WInstr[]) => {
    edgeCopies(from, to, out);
    const back = rpo[idx.get(to)!] <= rpo[idx.get(from)!];
    if (back || isMerge(to)) {
      const k = ctx.findIndex((c) => c.node === to && (back ? c.kind === 'loop' : c.kind === 'block'));
      if (k < 0) throw new Error(`wasm: no enclosing label for ${from.name} → ${to.name} (irreducible control flow?)`);
      out.push(W('br', { imm: k, name: to.name }));
      structure.push({ kind: 'br', node: from.name, target: to.name, depth: k, why: back ? `back edge to loop ${to.name}: br ${k} continues the loop` : `forward edge to merge point ${to.name}: br ${k} exits the block that ends there` });
    } else {
      structure.push({ kind: 'inline', node: from.name, target: to.name, depth: ctx.length, why: `${to.name} has a single forward predecessor: its code is placed right here` });
      doTree(to, ctx, out);
    }
  };

  const body: WInstr[] = [];
  if (frameSize) body.push(W('global.get', { imm: 0, name: '$sp' }), W('i32.const', { imm: frameSize }), W('i32.sub'), W('local.tee', { imm: spLocal, name: '$fp' }), W('global.set', { imm: 0, name: '$sp', note: `allocate a ${frameSize}-byte frame on the shadow stack (address-taken locals)` }));
  doTree(fn.entry, [], body);
  body.push(W('unreachable', { note: 'every path returned above; tells the validator the end is never reached' }));
  return { name: fn.name, index: fnIndex.get(fn.name)!, params: fn.params.length, locals, body, structure, frameSize, line: fn.line };
}

// ---------------------------------------------------------------- binary encoding

const OPC: Record<string, number[]> = {
  unreachable: [0x00], block: [0x02], loop: [0x03], if: [0x04], else: [0x05], end: [0x0b], br: [0x0c], br_if: [0x0d], return: [0x0f], call: [0x10],
  drop: [0x1a], select: [0x1b], 'local.get': [0x20], 'local.set': [0x21], 'local.tee': [0x22], 'global.get': [0x23], 'global.set': [0x24],
  'i64.load': [0x29], 'i64.store': [0x37], 'i32.const': [0x41], 'i64.const': [0x42], 'i32.eqz': [0x45], 'i64.eqz': [0x50],
  'i64.eq': [0x51], 'i64.ne': [0x52], 'i64.lt_s': [0x53], 'i64.gt_s': [0x55], 'i64.le_s': [0x57], 'i64.ge_s': [0x59],
  'i32.add': [0x6a], 'i32.sub': [0x6b], 'i64.add': [0x7c], 'i64.sub': [0x7d], 'i64.mul': [0x7e], 'i64.div_s': [0x7f], 'i64.rem_s': [0x81],
  'i64.and': [0x83], 'i64.or': [0x84], 'i64.xor': [0x85], 'i64.shl': [0x86], 'i64.shr_s': [0x87], 'i64.shr_u': [0x88],
  'i32.wrap_i64': [0xa7], 'i64.extend_i32_u': [0xad],
};

export function uleb(v: number | bigint): number[] {
  let x = BigInt(v);
  const out: number[] = [];
  do {
    let b = Number(x & 0x7fn);
    x >>= 7n;
    if (x !== 0n) b |= 0x80;
    out.push(b);
  } while (x !== 0n);
  return out;
}

export function sleb(v: number | bigint): number[] {
  let x = BigInt(v);
  const out: number[] = [];
  for (;;) {
    const b = Number(x & 0x7fn);
    x >>= 7n;
    const done = (x === 0n && (b & 0x40) === 0) || (x === -1n && (b & 0x40) !== 0);
    out.push(done ? b : b | 0x80);
    if (done) return out;
  }
}

function encodeBody(ws: WInstr[], out: number[]) {
  for (const w of ws) {
    out.push(...OPC[w.op]);
    switch (w.op) {
      case 'block': case 'loop': out.push(0x40); encodeBody(w.body!, out); out.push(0x0b); break;
      case 'if': out.push(0x40); encodeBody(w.body!, out); if (w.else?.length) { out.push(0x05); encodeBody(w.else, out); } out.push(0x0b); break;
      case 'br': case 'br_if': case 'call': case 'local.get': case 'local.set': case 'local.tee': case 'global.get': case 'global.set':
        out.push(...uleb(w.imm!)); break;
      case 'i32.const': case 'i64.const': out.push(...sleb(w.imm!)); break;
      case 'i64.load': case 'i64.store': out.push(3, 0); break; // align=2^3, offset=0
    }
  }
}

const vec = (items: number[][]) => [...uleb(items.length), ...items.flat()];
const str = (s: string) => { const b = [...new TextEncoder().encode(s)]; return [...uleb(b.length), ...b]; };
const section = (id: number, body: number[]) => [id, ...uleb(body.length), ...body];

export function lowerModule(m: Module, opts: { stackify?: boolean } = {}): WasmResult {
  const imports = ['print_int', 'putchar'];
  const fnIndex = new Map<string, number>();
  imports.forEach((n, k) => fnIndex.set(n, k));
  m.funcs.forEach((f, k) => fnIndex.set(f.name, imports.length + k));
  const globalsAddr: Record<string, number> = {};
  let a = DATA_BASE;
  const data: number[] = [];
  for (const gl of m.globals) {
    globalsAddr[gl.name] = a;
    for (let w = 0; w < gl.words; w++) { let v = BigInt.asUintN(64, gl.init[w] ?? 0n); for (let k = 0; k < 8; k++) { data.push(Number(v & 0xffn)); v >>= 8n; } }
    a += gl.words * 8;
  }
  const funcs = m.funcs.map((f) => lowerFunc(f, fnIndex, globalsAddr, { stackify: opts.stackify !== false }));

  // types: one per distinct arity, all i64 -> i64
  const arities = [...new Set([1, ...funcs.map((f) => f.params)])];
  const typeOf = (n: number) => arities.indexOf(n);
  const bytes: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  bytes.push(...section(1, vec(arities.map((n) => [0x60, ...uleb(n), ...Array(n).fill(0x7e), 1, 0x7e]))));
  bytes.push(...section(2, vec(imports.map((n) => [...str('env'), ...str(n), 0x00, ...uleb(typeOf(1))]))));
  bytes.push(...section(3, vec(funcs.map((f) => uleb(typeOf(f.params))))));
  bytes.push(...section(5, vec([[0x00, ...uleb(PAGES)]])));
  bytes.push(...section(6, vec([[0x7f, 0x01, 0x41, ...sleb(STACK_TOP), 0x0b]])));
  bytes.push(...section(7, vec([[...str('main'), 0x00, ...uleb(fnIndex.get('main')!)], [...str('memory'), 0x02, 0x00]])));
  bytes.push(...section(10, vec(funcs.map((f) => {
    const extra = f.locals.slice(f.params);
    const groups: number[][] = [];
    for (let k = 0; k < extra.length; ) {
      let n = 1;
      while (k + n < extra.length && extra[k + n].type === extra[k].type) n++;
      groups.push([...uleb(n), extra[k].type === 'i64' ? 0x7e : 0x7f]);
      k += n;
    }
    const code: number[] = [...vec(groups)];
    encodeBody(f.body, code);
    code.push(0x0b);
    return [...uleb(code.length), ...code];
  }))));
  if (data.length) bytes.push(...section(11, vec([[0x00, 0x41, ...sleb(DATA_BASE), 0x0b, ...uleb(data.length), ...data]])));
  return { funcs, wat: printWat(m, funcs, imports, globalsAddr), bytes: new Uint8Array(bytes), dataBase: DATA_BASE, globalsAddr, imports };
}

// ---------------------------------------------------------------- WAT printing

export function printWat(m: Module, funcs: WFunc[], imports: string[], globalsAddr: Record<string, number>): Line[] {
  const L: Line[] = [];
  const P = (indent: number, toks: Tok[], extra: Partial<Line> = {}) => L.push({ kind: 'instr', indent, toks, ...extra });
  P(0, [tok('(module', 'kw')]);
  for (const n of imports) P(2, [tok('(import ', 'kw'), tok('"env" ', 'sym'), tok(`"${n}" `, 'sym'), tok(`(func $${n} (param i64) (result i64)))`, 'plain')]);
  P(2, [tok('(memory ', 'kw'), tok(`${PAGES}`, 'imm'), tok(')', 'kw'), tok(`  ;; ${PAGES} × 64 KiB pages of linear memory`, 'comment')]);
  P(2, [tok('(global $sp ', 'kw'), tok('(mut i32) ', 'plain'), tok(`(i32.const ${STACK_TOP})`, 'imm'), tok(')', 'kw'), tok('  ;; shadow-stack pointer', 'comment')]);
  for (const g of m.globals) P(2, [tok(`;; @${g.name} lives at ${globalsAddr[g.name]} (${g.words * 8} bytes, data segment)`, 'comment')]);
  for (const f of funcs) {
    const params = f.locals.slice(0, f.params).map((l) => `(param ${l.name.replace('%', '$')} i64)`).join(' ');
    P(2, [tok('(func ', 'kw'), tok(`$${f.name}`, 'sym', `s:${f.name}`, { kind: 'sym', name: f.name, what: 'function' }), tok(` ${params} (result i64)`, 'plain')], { links: f.line ? [`src:${f.line}`] : [] });
    const extra = f.locals.slice(f.params);
    if (extra.length) P(4, [tok(`(local ${extra.map((l) => `${l.name.replace('%', '$')} ${l.type}`).join(') (local ')})`, 'plain')]);
    const walk = (ws: WInstr[], ind: number) => {
      for (const w of ws) {
        const toks: Tok[] = [tok(w.op, 'kw', undefined, { kind: 'mop', target: 'wasm', op: w.op, note: w.note })];
        if (w.op === 'block' || w.op === 'loop' || w.op === 'if') {
          P(ind, [...toks, tok(`  ;; ${w.op === 'loop' ? 'loop header ' : w.op === 'if' ? 'end of ' : ''}${w.name}`, 'comment')], { key: w.ir !== undefined ? `w:${f.name}:${w.ir}` : undefined, links: w.ir !== undefined ? [`i:${f.name}:${w.ir}`] : [] });
          walk(w.body!, ind + 2);
          if (w.op === 'if' && w.else?.length) { P(ind, [tok('else', 'kw')]); walk(w.else, ind + 2); }
          P(ind, [tok('end', 'kw')]);
          continue;
        }
        if (w.imm !== undefined) {
          if (w.op === 'i64.load' || w.op === 'i64.store') toks.push(tok(' align=8', 'comment'));
          else toks.push(tok(' '), tok(w.name && (w.op.startsWith('local') || w.op.startsWith('global')) ? w.name.replace('%', '$') : w.op === 'call' ? `$${w.name}` : String(w.imm), w.op.startsWith('local') ? 'vreg' : w.op === 'call' ? 'sym' : 'imm', w.op.startsWith('local') && w.name ? `wl:${f.name}:${w.name}` : undefined));
          if (w.op === 'br') toks.push(tok(`  ;; → ${w.name}`, 'comment'));
        }
        P(ind, toks, { note: w.note, links: w.ir !== undefined ? [`i:${f.name}:${w.ir}`, ...(w.line ? [`src:${w.line}`] : [])] : [] });
      }
    };
    walk(f.body, 4);
    P(2, [tok(')', 'kw')]);
  }
  P(2, [tok('(export "main" (func $main))', 'kw')]);
  P(0, [tok(')', 'kw')]);
  return L;
}

// ---------------------------------------------------------------- execution

export async function runWasm(bytes: Uint8Array<ArrayBuffer>, maxOutput = 1 << 20): Promise<{ output: string; exitCode: bigint; error?: string }> {
  let output = '';
  const env = {
    print_int: (x: bigint) => { if (output.length < maxOutput) output += `${x}\n`; return 0n; },
    putchar: (c: bigint) => { if (output.length < maxOutput) output += String.fromCharCode(Number(BigInt.asUintN(8, c))); return 0n; },
  };
  try {
    const { instance } = await WebAssembly.instantiate(bytes, { env });
    const exitCode = (instance.exports.main as () => bigint)();
    return { output, exitCode };
  } catch (e) {
    return { output, exitCode: -1n, error: (e as Error).message };
  }
}
