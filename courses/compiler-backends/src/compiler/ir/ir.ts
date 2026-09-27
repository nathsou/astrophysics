// KIR: the Kiln intermediate representation.
// A small, LLVM-flavoured, SSA-based IR. Values are either constants, function
// parameters, or instructions. Every instruction belongs to a basic block, and
// every block ends in exactly one terminator (br, condbr, ret).

export type Type = 'i64' | 'i1' | 'void';

export type BinaryOp = 'add' | 'sub' | 'mul' | 'sdiv' | 'srem' | 'and' | 'or' | 'xor' | 'shl' | 'ashr' | 'lshr';
export type CmpPred = 'eq' | 'ne' | 'slt' | 'sle' | 'sgt' | 'sge';

export type Opcode =
  | BinaryOp
  | 'icmp' | 'zext' | 'select'
  | 'alloca' | 'load' | 'store' | 'gaddr'
  | 'call' | 'phi' | 'param'
  | 'br' | 'condbr' | 'ret';

export const BINARY_OPS: BinaryOp[] = ['add', 'sub', 'mul', 'sdiv', 'srem', 'and', 'or', 'xor', 'shl', 'ashr', 'lshr'];
export const COMMUTATIVE = new Set<Opcode>(['add', 'mul', 'and', 'or', 'xor']);
export const TERMINATORS = new Set<Opcode>(['br', 'condbr', 'ret']);

export abstract class Value {
  abstract readonly type: Type;
}

export class Const extends Value {
  constructor(
    public readonly v: bigint,
    public readonly type: Type = 'i64',
  ) {
    super();
  }
}

export class Instr extends Value {
  /** Stable id, unique within the function. Printed as %<name><id>. */
  id: number;
  name?: string;
  type: Type;
  args: Value[];
  block!: Block;
  /** icmp predicate */
  pred?: CmpPred;
  /** br/condbr successors; for phi: incoming blocks (parallel to args) */
  blocks: Block[] = [];
  /** call target / gaddr symbol */
  sym?: string;
  /** alloca size in bytes */
  size?: number;
  /** param index */
  index?: number;
  /** source line this instruction came from (for cross-highlighting) */
  line?: number;
  /** why this instruction exists / what produced it */
  note?: string;

  constructor(
    public op: Opcode,
    type: Type,
    args: Value[],
    id: number,
  ) {
    super();
    this.type = type;
    this.args = args;
    this.id = id;
  }

  get isTerminator() { return TERMINATORS.has(this.op); }
  get hasSideEffects() { return this.op === 'store' || this.op === 'call' || this.isTerminator; }
  get isPure() {
    return !this.hasSideEffects && this.op !== 'load' && this.op !== 'alloca' && this.op !== 'phi' && this.op !== 'param';
  }
}

export class Block {
  instrs: Instr[] = [];
  preds: Block[] = [];
  constructor(
    public id: number,
    public name: string,
    public fn: Func,
  ) {}
  get terminator(): Instr | undefined {
    const t = this.instrs[this.instrs.length - 1];
    return t?.isTerminator ? t : undefined;
  }
  get succs(): Block[] {
    return this.terminator?.blocks ?? [];
  }
  get phis(): Instr[] {
    const out: Instr[] = [];
    for (const i of this.instrs) {
      if (i.op !== 'phi') break;
      out.push(i);
    }
    return out;
  }
  insertBefore(instr: Instr, before: Instr) {
    const idx = this.instrs.indexOf(before);
    instr.block = this;
    this.instrs.splice(idx, 0, instr);
  }
  remove(instr: Instr) {
    const idx = this.instrs.indexOf(instr);
    if (idx >= 0) this.instrs.splice(idx, 1);
  }
}

export class Func {
  blocks: Block[] = [];
  params: Instr[] = [];
  nextId = 0;
  nextBlockId = 0;
  blockNames = new Map<string, number>();
  line?: number;
  endLine?: number;
  constructor(public name: string) {}

  get entry() { return this.blocks[0]; }

  newBlock(name: string): Block {
    const n = this.blockNames.get(name) ?? 0;
    this.blockNames.set(name, n + 1);
    const b = new Block(this.nextBlockId++, n ? `${name}${n}` : name, this);
    this.blocks.push(b);
    return b;
  }

  newInstr(op: Opcode, type: Type, args: Value[], extra: Partial<Instr> = {}): Instr {
    const i = new Instr(op, type, args, this.nextId++);
    Object.assign(i, extra);
    return i;
  }

  /** Recompute predecessor lists from terminators. Preds are ordered by block order, then successor order. */
  computePreds() {
    for (const b of this.blocks) b.preds = [];
    for (const b of this.blocks) for (const s of b.succs) if (!s.preds.includes(b)) s.preds.push(b);
  }

  *instructions(): Iterable<Instr> {
    for (const b of this.blocks) yield* b.instrs;
  }

  /** Users of every value, computed on demand. */
  uses(): Map<Value, Instr[]> {
    const m = new Map<Value, Instr[]>();
    for (const i of this.instructions()) {
      for (const a of i.args) {
        let l = m.get(a);
        if (!l) m.set(a, (l = []));
        l.push(i);
      }
    }
    return m;
  }

  replaceAllUses(old: Value, nu: Value) {
    for (const i of this.instructions()) {
      for (let k = 0; k < i.args.length; k++) if (i.args[k] === old) i.args[k] = nu;
    }
  }
}

export interface Global {
  name: string;
  words: number;
  init: bigint[];
  isArray: boolean;
  line?: number;
}

export class Module {
  funcs: Func[] = [];
  globals: Global[] = [];
  /** original source, for cross-referencing */
  source = '';
}

export const wrap64 = (v: bigint) => BigInt.asIntN(64, v);

export function valueName(v: Value): string {
  if (v instanceof Const) return v.type === 'i1' ? (v.v ? 'true' : 'false') : v.v.toString();
  const i = v as Instr;
  return `%${i.name ?? ''}${i.id}`;
}

// ---------------------------------------------------------------- cloning

/** Deep-copies a module so each pipeline stage can keep an immutable snapshot. */
export function cloneModule(m: Module): Module {
  const out = new Module();
  out.source = m.source;
  out.globals = m.globals.map((g) => ({ ...g, init: [...g.init] }));
  out.funcs = m.funcs.map(cloneFunc);
  return out;
}

export function cloneFunc(f: Func): Func {
  const nf = new Func(f.name);
  nf.nextId = f.nextId;
  nf.line = f.line;
  nf.endLine = f.endLine;
  const bmap = new Map<Block, Block>();
  for (const b of f.blocks) {
    const nb = new Block(b.id, b.name, nf);
    bmap.set(b, nb);
    nf.blocks.push(nb);
  }
  nf.nextBlockId = f.nextBlockId;
  nf.blockNames = new Map(f.blockNames);
  const vmap = new Map<Value, Value>();
  const copy = (i: Instr) => {
    const n = new Instr(i.op, i.type, [...i.args], i.id);
    n.name = i.name;
    n.pred = i.pred;
    n.sym = i.sym;
    n.size = i.size;
    n.index = i.index;
    n.line = i.line;
    n.note = i.note;
    vmap.set(i, n);
    return n;
  };
  nf.params = f.params.map(copy);
  for (const b of f.blocks) {
    const nb = bmap.get(b)!;
    for (const i of b.instrs) {
      const n = copy(i);
      n.block = nb;
      nb.instrs.push(n);
    }
  }
  for (const i of nf.instructions()) {
    i.args = i.args.map((a) => vmap.get(a) ?? a);
  }
  for (const b of f.blocks) {
    b.instrs.forEach((i, k) => {
      bmap.get(b)!.instrs[k].blocks = i.blocks.map((x) => bmap.get(x)!);
    });
  }
  nf.computePreds();
  return nf;
}
