// Instruction selection by optimal tree tiling (BURS-style dynamic programming).
//
// 1. Each IR basic block is carved into expression trees. An instruction is
//    folded into its user when it is pure (or a load with no intervening
//    store/call), has exactly one use, and that use is in the same block.
//    Everything else is a tree root whose result lives in a virtual register.
// 2. Every target provides a tree grammar: rules `nt <- pattern` with a cost
//    and an emitter. Nonterminals are things like `reg`, `addr`, `cc`.
// 3. Labelling: bottom-up, compute for every node and nonterminal the
//    cheapest rule (Aho, Ganapathi & Tjiang 1989; Fraser, Hanson & Proebsting,
//    "Engineering a Simple, Efficient Code Generator Generator" (iburg), 1992).
// 4. Reduction: top-down from the root, apply the chosen rules and emit MIR.

import { Const, Instr, type Block, type Func, type Value, COMMUTATIVE } from '../ir/ir';
import type { Target } from '../target/target';
import { MFunc, R, type MBlock, type MInstr, type MOperand, type RegOp, type MemOp } from './mir';

// ------------------------------------------------------------------ patterns

export type Pat =
  | { k: 'op'; op: string; kids: Pat[] }
  | { k: 'nt'; nt: string }
  | { k: 'imm'; pred: string }
  | { k: 'frame' }
  | { k: 'gaddr' };

export type Thunk = () => any;

export interface Rule {
  nt: string;
  pattern: string;
  pat: Pat;
  cost: number | ((n: INode) => number);
  /** human-readable instruction(s) this tile produces */
  asm: string;
  emit: (c: SelCtx, n: INode, b: Thunk[]) => any;
  id: number;
}

let ruleIds = 0;

export function parsePattern(src: string): Pat {
  const toks = src.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/);
  let i = 0;
  const parse = (): Pat => {
    const t = toks[i++];
    if (t === '(') {
      const op = toks[i++];
      const kids: Pat[] = [];
      while (toks[i] !== ')') kids.push(parse());
      i++;
      return { k: 'op', op, kids };
    }
    if (t.startsWith('#')) return { k: 'imm', pred: t.slice(1) };
    if (t === 'frame') return { k: 'frame' };
    if (t === 'gaddr') return { k: 'gaddr' };
    return { k: 'nt', nt: t };
  };
  return parse();
}

export function printPattern(p: Pat): string {
  switch (p.k) {
    case 'op': return `(${p.op} ${p.kids.map(printPattern).join(' ')})`;
    case 'nt': return p.nt;
    case 'imm': return `#${p.pred}`;
    default: return p.k;
  }
}

/** Build a rule; with commute, also generate the variant with the root's operands swapped. */
export function rule(nt: string, pattern: string, cost: Rule['cost'], asm: string, emit: Rule['emit'], opts: { commute?: boolean } = {}): Rule[] {
  const pat = parsePattern(pattern);
  const out: Rule[] = [{ nt, pattern, pat, cost, asm, emit, id: ruleIds++ }];
  if (opts.commute && pat.k === 'op' && pat.kids.length === 2) {
    const sw: Pat = { k: 'op', op: pat.op, kids: [pat.kids[1], pat.kids[0]] };
    out.push({ nt, pattern: printPattern(sw), pat: sw, cost, asm, emit: (c, n, b) => emit(c, n, swapBindings(pat, b)), id: ruleIds++ });
  }
  return out;
}

/** Bindings are produced in left-to-right leaf order; for a swapped root we must hand the emitter the original order. */
function swapBindings(orig: Pat, b: Thunk[]): Thunk[] {
  if (orig.k !== 'op') return b;
  const nLeft = countLeaves(orig.kids[0]);
  const nRight = countLeaves(orig.kids[1]);
  // in the swapped pattern the right subtree's leaves come first
  return [...b.slice(nRight, nRight + nLeft), ...b.slice(0, nRight)];
}

function countLeaves(p: Pat): number {
  return p.k === 'op' ? p.kids.reduce((s, k) => s + countLeaves(k), 0) : 1;
}

export const IMM_PREDS: Record<string, (v: bigint) => boolean> = {
  any: () => true,
  zero: (v) => v === 0n,
  one: (v) => v === 1n,
  simm12: (v) => v >= -2048n && v <= 2047n,
  /** value whose negation fits simm12 */
  nsimm12: (v) => -v >= -2048n && -v <= 2047n,
  uimm6: (v) => v >= 0n && v < 64n,
  simm32: (v) => v >= -(1n << 31n) && v < 1n << 31n,
  scale: (v) => v >= 1n && v <= 3n,
  /** AArch64 add/sub immediate: uimm12, optionally shifted left by 12 */
  aimm: (v) => (v >= 0n && v < 4096n) || (v >= 0n && (v & 0xfffn) === 0n && v >> 12n < 4096n),
  naimm: (v) => IMM_PREDS.aimm(-v) && v !== 0n,
  limm: (v) => isLogicalImm(v),
  pow2: (v) => v > 0n && (v & (v - 1n)) === 0n,
  m1: (v) => v === -1n,
  /** AArch64 ldr/str offset: scaled unsigned 12-bit (multiple of 8 up to 32760) or unscaled signed 9-bit (ldur) */
  ldoff: (v) => (v >= 0n && v <= 32760n && v % 8n === 0n) || (v >= -256n && v <= 255n),
};

/** A named predicate, or a literal like #3 that matches exactly that value. */
export function immPred(name: string): (v: bigint) => boolean {
  const p = IMM_PREDS[name];
  if (p) return p;
  if (/^-?\d+$/.test(name)) { const k = BigInt(name); return (v) => v === k; }
  throw new Error(`unknown immediate predicate #${name}`);
}

/** AArch64 logical immediate: a rotated run of ones replicated in 2,4,...,64-bit elements. */
export function isLogicalImm(v: bigint): boolean {
  const u = BigInt.asUintN(64, v);
  if (u === 0n || u === (1n << 64n) - 1n) return false;
  for (let size = 64; size >= 2; size >>= 1) {
    const mask = (1n << BigInt(size)) - 1n;
    const elt = u & mask;
    let rep = 0n;
    for (let k = 0; k < 64; k += size) rep |= elt << BigInt(k);
    if (rep !== u) continue;
    // elt must be a rotation of a contiguous run of ones within `size` bits
    for (let r = 0; r < size; r++) {
      const rot = ((elt >> BigInt(r)) | (elt << BigInt(size - r))) & mask;
      if (rot !== 0n && (rot & (rot + 1n)) === 0n) return true;
    }
    return false;
  }
  return false;
}

// ------------------------------------------------------------------ trees

export interface INode {
  id: number;
  op: string;
  kids: INode[];
  instr?: Instr;
  c?: bigint;
  fi?: number;
  sym?: string;
  vreg?: number;
  targets?: MBlock[];
  best: Record<string, { cost: number; rule: Rule }>;
  /** did this node get its own register (tree root or multi-use)? */
  root?: boolean;
}

export interface Tile {
  rule: Rule;
  /** nodes covered by the tile's pattern (non-leaf part) */
  nodes: number[];
  /** leaves of the tile, i.e. the subtrees that were reduced separately */
  leaves: number[];
  instrs: number[];
  nt: string;
  root: number;
}

export interface SelTree {
  block: string;
  root: INode;
  nodes: INode[];
  tiles: Tile[];
  irId?: number;
  line?: number;
  label: string;
}

// ------------------------------------------------------------------ context

export class SelCtx {
  cur!: MBlock;
  meta: Partial<MInstr> = {};
  tileStack: Tile[] = [];
  tree?: SelTree;
  constructor(
    public f: MFunc,
    public t: Target,
  ) {}

  emit(op: string, ops: MOperand[], extra: Partial<MInstr> = {}): MInstr {
    const mi = this.f.mi(op, ops, { ...this.meta, ...extra });
    this.cur.instrs.push(mi);
    this.tileStack.at(-1)?.instrs.push(mi.id);
    return mi;
  }

  push(mi: MInstr) {
    this.cur.instrs.push(mi);
    this.tileStack.at(-1)?.instrs.push(mi.id);
    return mi;
  }

  fresh(name?: string): RegOp {
    return { k: 'vreg', id: this.f.newVreg(name), def: true };
  }

  /** destination register for a node's value: the value's own vreg for roots, else a fresh one */
  dst(n: INode): RegOp {
    if (n.root && n.instr) return R.vd(n.instr.id);
    return this.fresh();
  }

  li(dst: RegOp, v: bigint) {
    for (const mi of this.t.loadImm(this.f, dst, v, this.meta)) this.push(mi);
    return R.use(dst);
  }
}

// ------------------------------------------------------------------ labelling

function matchPat(p: Pat, n: INode, leaves: INode[], leafNts: (string | null)[]): number | undefined {
  switch (p.k) {
    case 'nt': {
      const b = n.best[p.nt];
      if (!b) return undefined;
      leaves.push(n);
      leafNts.push(p.nt);
      return b.cost;
    }
    case 'imm':
      if (n.op !== 'const' || !immPred(p.pred)(n.c!)) return undefined;
      leaves.push(n);
      leafNts.push(null);
      return 0;
    case 'frame':
      if (n.op !== 'frame') return undefined;
      leaves.push(n);
      leafNts.push(null);
      return 0;
    case 'gaddr':
      if (n.op !== 'gaddr') return undefined;
      leaves.push(n);
      leafNts.push(null);
      return 0;
    case 'op': {
      if (n.op !== p.op || n.kids.length !== p.kids.length) return undefined;
      let c = 0;
      for (let k = 0; k < p.kids.length; k++) {
        const r = matchPat(p.kids[k], n.kids[k], leaves, leafNts);
        if (r === undefined) return undefined;
        c += r;
      }
      return c;
    }
  }
}

function coveredNodes(p: Pat, n: INode, out: number[]) {
  if (p.k !== 'op') return;
  out.push(n.id);
  p.kids.forEach((k, i) => coveredNodes(k, n.kids[i], out));
}

export function label(n: INode, rules: Rule[]) {
  for (const k of n.kids) label(k, rules);
  n.best = {};
  if (n.op === 'reg') n.best.reg = { cost: 0, rule: LEAF_RULE };
  const ruleCost = (r: Rule) => (typeof r.cost === 'function' ? r.cost(n) : r.cost);
  for (const r of rules) {
    if (r.pat.k === 'nt') continue; // chain rules below
    const c = matchPat(r.pat, n, [], []);
    if (c === undefined) continue;
    const total = c + ruleCost(r);
    if (!n.best[r.nt] || total < n.best[r.nt].cost) n.best[r.nt] = { cost: total, rule: r };
  }
  // chain rules: nt <- nt', iterate to a fixpoint
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of rules) {
      if (r.pat.k !== 'nt') continue;
      const from = n.best[r.pat.nt];
      if (!from) continue;
      const total = from.cost + ruleCost(r);
      if (!n.best[r.nt] || total < n.best[r.nt].cost) {
        n.best[r.nt] = { cost: total, rule: r };
        changed = true;
      }
    }
  }
}

const LEAF_RULE: Rule = {
  nt: 'reg', pattern: 'reg', pat: { k: 'nt', nt: 'reg' }, cost: 0, asm: '(value already in a register)', id: -1,
  emit: (_c, n) => R.v(n.vreg!),
};

export function reduce(c: SelCtx, n: INode, nt: string): any {
  const b = n.best[nt];
  if (!b) throw new Error(`isel: no rule covers ${n.op} as '${nt}' (target ${c.t.name})`);
  const r = b.rule;
  if (r === LEAF_RULE) return R.v(n.vreg!);
  const leaves: INode[] = [], leafNts: (string | null)[] = [];
  if (r.pat.k === 'nt') {
    leaves.push(n);
    leafNts.push(r.pat.nt);
  } else matchPat(r.pat, n, leaves, leafNts);
  const tile: Tile = { rule: r, nodes: [], leaves: [], instrs: [], nt, root: n.id };
  coveredNodes(r.pat, n, tile.nodes);
  if (r.pat.k !== 'op') tile.nodes.push(n.id);
  const thunks: Thunk[] = leaves.map((leaf, k) => {
    const lnt = leafNts[k];
    if (lnt === null) {
      if (leaf.op === 'const') return () => leaf.c!;
      if (leaf.op === 'frame') return () => R.frame(leaf.fi!);
      return () => leaf.sym!;
    }
    if (leaf !== n) tile.leaves.push(leaf.id);
    let memo: any, done = false;
    return () => {
      if (!done) { memo = reduce(c, leaf, lnt); done = true; }
      return memo;
    };
  });
  c.tree?.tiles.push(tile);
  // Emitters force thunks in the order they need. Each reduce() pushes its own
  // tile while its emitter runs, so emitted instructions are attributed to the
  // innermost active tile.
  c.tileStack.push(tile);
  const res = r.emit(c, n, thunks);
  c.tileStack.pop();
  return res;
}

/** Force every binding in order (the common case). */
export const force = (b: Thunk[]) => b.map((t) => t());

// ------------------------------------------------------------------ driver

export interface ISelResult {
  mf: MFunc;
  trees: SelTree[];
}

export function selectFunction(fn: Func, t: Target, ctxOpts: { recordTrees?: boolean } = {}): ISelResult {
  fn.computePreds();
  const mf = new MFunc(fn.name, t, fn.nextId);
  mf.line = fn.line;
  for (const p of fn.params) mf.vregNames.set(p.id, p.name ?? '');
  for (const i of fn.instructions()) if (i.name) mf.vregNames.set(i.id, i.name);
  const bmap = new Map<Block, MBlock>();
  for (const b of fn.blocks) bmap.set(b, mf.newBlock(b.name, b.id));
  const c = new SelCtx(mf, t);
  const trees: SelTree[] = [];
  const uses = fn.uses();
  const frameOf = new Map<Instr, number>();
  for (const i of fn.entry.instrs) {
    if (i.op === 'alloca') {
      frameOf.set(i, mf.addFrameObject({ size: i.size!, align: 8, kind: 'local', name: i.name?.replace(/\.addr$/, '') ?? `slot${i.id}` }));
    }
  }
  let nodeId = 0;
  const pendingPhi: { pred: MBlock; dst: RegOp; v: Value; meta: Partial<MInstr>; block: Block }[] = [];

  for (const b of fn.blocks) {
    const mb = bmap.get(b)!;
    c.cur = mb;
    const instrs = b.instrs;
    const pos = new Map(instrs.map((x, k) => [x, k]));
    const folded = new Set<Instr>();

    const memBetween = (from: Instr, to: Instr) => {
      for (let k = pos.get(from)! + 1; k < pos.get(to)!; k++) {
        const x = instrs[k];
        if (x.op === 'store' || x.op === 'call') return true;
      }
      return false;
    };
    const foldable = (v: Instr, user: Instr) => {
      if (v.block !== b || user.op === 'phi') return false;
      const us = uses.get(v) ?? [];
      if (us.length !== 1) return false;
      if (v.op === 'load') return !memBetween(v, user);
      return v.isPure;
    };
    // decide folding first (a use-def property, independent of order)
    for (const i of instrs) {
      for (const a of i.args) if (a instanceof Instr && a.op !== 'alloca' && foldable(a, i)) folded.add(a);
    }

    const build = (v: Value, user?: Instr): INode => {
      const id = nodeId++;
      if (v instanceof Const) return { id, op: 'const', kids: [], c: v.v, best: {} };
      const i = v as Instr;
      if (i.op === 'alloca') return { id, op: 'frame', kids: [], fi: frameOf.get(i), best: {}, instr: i };
      if (user && !folded.has(i)) return { id, op: 'reg', kids: [], vreg: i.id, best: {}, instr: i };
      if (i.op === 'gaddr') return { id, op: 'gaddr', kids: [], sym: i.sym, best: {}, instr: i };
      const op = i.op === 'icmp' ? `icmp.${i.pred}` : i.op;
      return { id, op, kids: i.args.map((a) => build(a, i)), instr: i, best: {} };
    };
    const collect = (n: INode, out: INode[]) => { out.push(n); n.kids.forEach((k) => collect(k, out)); return out; };

    const selectTree = (root: INode, nt: string, i: Instr, label: string) => {
      label0(root, t);
      const tree: SelTree = { block: b.name, root, nodes: collect(root, []), tiles: [], irId: i.id, line: i.line, label };
      if (ctxOpts.recordTrees !== false) trees.push(tree);
      c.tree = tree;
      const r = reduce(c, root, nt);
      c.tree = undefined;
      return r;
    };

    if (b === fn.entry && fn.params.length) {
      c.meta = { line: fn.line, tag: 'abi' };
      t.lowerParams(mf, mb, fn.params.map((p) => p.id), (mi) => c.push(mi));
    }
    for (const i of instrs) {
      if (folded.has(i) || i.op === 'alloca') continue;
      c.meta = { ir: i.id, line: i.line };
      switch (i.op) {
        case 'phi': {
          const ops: MOperand[] = [R.vd(i.id)];
          i.args.forEach((a, k) => {
            const pred = bmap.get(i.blocks[k])!;
            if (a instanceof Const || (a as Instr).op === 'alloca') {
              const tmp = c.fresh();
              pendingPhi.push({ pred, dst: tmp, v: a, block: i.blocks[k], meta: { ir: i.id, line: i.line, note: `materialise ${a instanceof Const ? `constant ${a.v}` : 'stack address'} for phi ${mf.vregName(i.id)} at the end of the predecessor`, tag: 'phi-const' } });
              ops.push(R.use(tmp), R.blk(pred));
            } else ops.push(R.v((a as Instr).id), R.blk(pred));
          });
          c.emit('PHI', ops, { note: 'SSA phi: its value depends on which predecessor we came from' });
          break;
        }
        case 'call': {
          const args = i.args.map((a) => {
            const n = build(a, i);
            if (n.op === 'reg') return R.v(n.vreg!);
            return selectTree(n, 'reg', i, `argument of call @${i.sym}`) as RegOp;
          });
          const used = (uses.get(i) ?? []).length > 0;
          mf.frame.hasCalls = true;
          mf.isLeaf = false;
          t.lowerCall(mf, i.sym!, args, used ? i.id : undefined, (mi) => c.push(mi), c.meta);
          break;
        }
        case 'ret': {
          let v: RegOp | undefined;
          if (i.args.length) {
            const n = build(i.args[0], i);
            v = n.op === 'reg' ? R.v(n.vreg!) : (selectTree(n, 'reg', i, 'return value') as RegOp);
          }
          t.lowerReturn(mf, v, (mi) => c.push(mi), c.meta);
          break;
        }
        case 'br':
          c.push(t.jump(mf, bmap.get(i.blocks[0])!));
          break;
        default: {
          const node: INode = i.op === 'store' || i.op === 'condbr'
            ? { id: nodeId++, op: i.op, kids: i.args.map((a) => build(a, i)), instr: i, best: {}, targets: i.blocks.map((x) => bmap.get(x)!) }
            : build(i);
          if (i.op === 'store' || i.op === 'condbr') {
            selectTree(node, 'stmt', i, i.op);
          } else {
            node.root = true;
            const r = selectTree(node, 'reg', i, `${mf.vregName(i.id)} = ${i.op}`) as RegOp;
            if (!(r.k === 'vreg' && r.id === i.id)) c.push(t.copy(mf, R.vd(i.id), r, { ...c.meta, note: 'move the tile result into the value\'s register' }));
          }
        }
      }
    }
  }
  for (const p of pendingPhi) {
    const tk = firstTermIdx(t, p.pred);
    const scratch: MBlock = { ...p.pred, instrs: [] };
    c.cur = scratch;
    c.meta = p.meta;
    if (p.v instanceof Const) c.li(p.dst, p.v.v);
    else {
      const node: INode = { id: nodeId++, op: 'frame', kids: [], fi: frameOf.get(p.v as Instr), best: {} };
      label0(node, t);
      const r = reduce(c, node, 'reg') as RegOp;
      c.push(t.copy(mf, R.def(p.dst), r, p.meta));
    }
    p.pred.instrs.splice(tk, 0, ...scratch.instrs);
  }
  mf.computeCFG();
  return { mf, trees };
}

function label0(n: INode, t: Target) {
  label(n, t.rules);
}

function firstTermIdx(t: Target, b: MBlock) {
  let k = b.instrs.length;
  while (k > 0) {
    const cls = t.opInfo(b.instrs[k - 1].op)?.cls;
    if (cls === 'branch' || cls === 'jump' || cls === 'ret') k--;
    else break;
  }
  return k;
}

export type Addr = MemOp;
export { COMMUTATIVE };
