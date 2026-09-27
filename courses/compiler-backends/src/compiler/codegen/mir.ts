// Machine IR: target instructions over virtual and physical registers.
// Modelled loosely on LLVM's MachineInstr: each instruction has an opcode and
// a flat operand list; register operands carry def/use flags; calls and other
// instructions with fixed-register side effects list them as implicit
// defs/uses. Before register allocation most registers are virtual (vregs).

import type { Target } from '../target/target';

export type RegOp = { k: 'vreg'; id: number; def?: boolean; use?: boolean } | { k: 'preg'; r: number; def?: boolean; use?: boolean; /** the vreg this was allocated from */ vreg?: number };

/** Memory address: base (+ index*scale) + disp. Base may be a register, a frame object, or a symbol (pc-relative). */
export interface MemOp {
  k: 'mem';
  base: RegOp | FrameOp | SymOp;
  index?: RegOp;
  scale?: number;
  disp: number;
  /** AArch64 pre-index writeback, e.g. [sp, #-16]! */
  pre?: boolean;
}

export interface FrameOp {
  k: 'frame';
  fi: number;
}

export type SymMod = 'call' | 'pcrel_hi' | 'pcrel_lo' | 'page' | 'pageoff' | 'rip' | undefined;
export interface SymOp {
  k: 'sym';
  name: string;
  mod?: SymMod;
}

export type MOperand =
  | RegOp
  | { k: 'imm'; v: bigint; note?: string }
  | { k: 'block'; b: MBlock }
  | SymOp
  | FrameOp
  | MemOp
  | { k: 'cc'; cc: string };

export interface MInstr {
  id: number;
  op: string;
  ops: MOperand[];
  implDefs?: number[];
  implUses?: number[];
  /** origin IR instruction id */
  ir?: number;
  line?: number;
  note?: string;
  /** provenance: 'copy' | 'phi-copy' | 'spill' | 'reload' | 'remat' | 'prologue' | 'epilogue' | 'abi' | 'legalize' | 'split' */
  tag?: string;
}

export interface MBlock {
  id: number;
  name: string;
  instrs: MInstr[];
  succs: MBlock[];
  preds: MBlock[];
  loopDepth: number;
  /** IR block this came from (undefined for blocks created by edge splitting) */
  irBlock?: number;
  fn: MFunc;
}

export type FrameKind = 'local' | 'spill' | 'callee-save' | 'ra' | 'fp' | 'incoming-arg' | 'outgoing';
export interface FrameObject {
  fi: number;
  size: number;
  align: number;
  kind: FrameKind;
  name: string;
  /** offset from the stack pointer after frame layout */
  offset?: number;
  /** for incoming stack arguments: offset from the canonical frame address (CFA) */
  cfaOffset?: number;
  reg?: number;
}

export interface FrameInfo {
  objects: FrameObject[];
  size: number;
  maxOutgoingArgs: number;
  hasCalls: boolean;
  usesFP: boolean;
  savedRegs: number[];
  laidOut: boolean;
}

export class MFunc {
  blocks: MBlock[] = [];
  nextVreg: number;
  nextInstrId = 0;
  nextBlockId = 0;
  vregNames = new Map<number, string>();
  frame: FrameInfo = { objects: [], size: 0, maxOutgoingArgs: 0, hasCalls: false, usesFP: false, savedRegs: [], laidOut: false };
  /** after regalloc: vreg -> preg */
  assignment?: Map<number, number>;
  line?: number;
  isLeaf = true;
  constructor(
    public name: string,
    public target: Target,
    firstVreg: number,
  ) {
    this.nextVreg = firstVreg;
  }

  newVreg(name?: string): number {
    const id = this.nextVreg++;
    if (name) this.vregNames.set(id, name);
    return id;
  }

  newBlock(name: string, irBlock?: number): MBlock {
    const b: MBlock = { id: this.nextBlockId++, name, instrs: [], succs: [], preds: [], loopDepth: 0, irBlock, fn: this };
    this.blocks.push(b);
    return b;
  }

  /** Create an instruction. Operands are copied so no two instructions ever share an operand object. */
  mi(op: string, ops: MOperand[], extra: Partial<MInstr> = {}): MInstr {
    return { ...extra, id: this.nextInstrId++, op, ops: ops.map(cloneOperand) };
  }

  addFrameObject(o: Omit<FrameObject, 'fi'>): number {
    const fi = this.frame.objects.length;
    this.frame.objects.push({ fi, ...o });
    return fi;
  }

  vregName(id: number): string {
    return `%${this.vregNames.get(id) ?? ''}${id}`;
  }

  /** Recompute succs/preds from branch operands, in terminator order. */
  computeCFG() {
    for (const b of this.blocks) { b.succs = []; b.preds = []; }
    for (const b of this.blocks) {
      for (const mi of b.instrs) {
        if (mi.op === 'PHI') continue; // phi operands name predecessors, not successors
        for (const o of mi.ops) if (o.k === 'block' && !b.succs.includes(o.b)) b.succs.push(o.b);
      }
    }
    for (const b of this.blocks) for (const s of b.succs) if (!s.preds.includes(b)) s.preds.push(b);
  }
}

export function cloneOperand(o: MOperand): MOperand {
  if (o.k === 'mem') return { ...o, base: { ...o.base }, index: o.index ? { ...o.index } : undefined };
  return { ...o };
}

export namespace R {
  export const v = (id: number): RegOp => ({ k: 'vreg', id, use: true });
  export const vd = (id: number): RegOp => ({ k: 'vreg', id, def: true });
  export const vdu = (id: number): RegOp => ({ k: 'vreg', id, def: true, use: true });
  export const p = (r: number): RegOp => ({ k: 'preg', r, use: true });
  export const pd = (r: number): RegOp => ({ k: 'preg', r, def: true });
  export const imm = (v: bigint | number, note?: string): MOperand => ({ k: 'imm', v: BigInt(v), note });
  export const blk = (b: MBlock): MOperand => ({ k: 'block', b });
  export const sym = (name: string, mod?: SymMod): SymOp => ({ k: 'sym', name, mod });
  export const frame = (fi: number): FrameOp => ({ k: 'frame', fi });
  export const mem = (base: MemOp['base'], disp = 0, index?: RegOp, scale?: number): MemOp => ({ k: 'mem', base, disp, index, scale });
  export const cc = (cc: string): MOperand => ({ k: 'cc', cc });
  /** a use of the same register as `r` */
  export const use = (r: RegOp): RegOp => (r.k === 'vreg' ? { k: 'vreg', id: r.id, use: true } : { k: 'preg', r: r.r, use: true });
  export const def = (r: RegOp): RegOp => (r.k === 'vreg' ? { k: 'vreg', id: r.id, def: true } : { k: 'preg', r: r.r, def: true });
  export const defuse = (r: RegOp): RegOp => (r.k === 'vreg' ? { k: 'vreg', id: r.id, def: true, use: true } : { k: 'preg', r: r.r, def: true, use: true });
}

export const isReg = (o: MOperand | undefined): o is RegOp => !!o && (o.k === 'vreg' || o.k === 'preg');
export const sameReg = (a: RegOp, b: RegOp) => a.k === b.k && (a.k === 'vreg' ? a.id === (b as { id: number }).id : a.r === (b as { r: number }).r);

/** Visit every register operand, including those nested in memory operands. */
export function forEachReg(mi: MInstr, f: (r: RegOp, isDef: boolean, isUse: boolean) => void) {
  for (const o of mi.ops) {
    if (o.k === 'vreg' || o.k === 'preg') f(o, !!o.def, !!o.use);
    else if (o.k === 'mem') {
      if (o.base.k === 'vreg' || o.base.k === 'preg') f(o.base, false, true);
      if (o.index) f(o.index, false, true);
    }
  }
}

/** Register "names" for dataflow: vregs are numbers >= 0, pregs are encoded as -(r+1). */
export const regKey = (r: RegOp) => (r.k === 'vreg' ? r.id : -(r.r + 1));
export const keyIsPreg = (k: number) => k < 0;
export const keyPreg = (k: number) => -k - 1;

export function instrDefs(mi: MInstr): number[] {
  const out: number[] = [];
  forEachReg(mi, (r, d) => { if (d) out.push(regKey(r)); });
  for (const p of mi.implDefs ?? []) out.push(-(p + 1));
  return out;
}

export function instrUses(mi: MInstr): number[] {
  const out: number[] = [];
  forEachReg(mi, (r, _d, u) => { if (u) out.push(regKey(r)); });
  for (const p of mi.implUses ?? []) out.push(-(p + 1));
  return out;
}

export const isCopy = (mi: MInstr) => mi.op === 'COPY';
export const isPhi = (mi: MInstr) => mi.op === 'PHI';

/** Deep clone for snapshots between pipeline stages. */
export function cloneMFunc(f: MFunc): MFunc {
  const nf = new MFunc(f.name, f.target, f.nextVreg);
  nf.nextInstrId = f.nextInstrId;
  nf.nextBlockId = f.nextBlockId;
  nf.vregNames = new Map(f.vregNames);
  nf.frame = { ...f.frame, objects: f.frame.objects.map((o) => ({ ...o })), savedRegs: [...f.frame.savedRegs] };
  nf.assignment = f.assignment ? new Map(f.assignment) : undefined;
  nf.line = f.line;
  nf.isLeaf = f.isLeaf;
  const bmap = new Map<MBlock, MBlock>();
  for (const b of f.blocks) {
    const nb: MBlock = { ...b, instrs: [], succs: [], preds: [], fn: nf };
    bmap.set(b, nb);
    nf.blocks.push(nb);
  }
  const cloneOp = (o: MOperand): MOperand => {
    switch (o.k) {
      case 'block': return { k: 'block', b: bmap.get(o.b) ?? o.b };
      case 'mem': return { ...o, base: { ...o.base }, index: o.index ? { ...o.index } : undefined };
      default: return { ...o };
    }
  };
  for (const b of f.blocks) {
    const nb = bmap.get(b)!;
    nb.instrs = b.instrs.map((mi) => ({ ...mi, ops: mi.ops.map(cloneOp), implDefs: mi.implDefs && [...mi.implDefs], implUses: mi.implUses && [...mi.implUses] }));
  }
  nf.computeCFG();
  return nf;
}

/** Terminator = branches/jumps/returns at the end of a block. */
export function isTerminator(t: Target, mi: MInstr): boolean {
  const c = t.opInfo(mi.op)?.cls;
  return c === 'branch' || c === 'jump' || c === 'ret';
}

export function firstTerminator(t: Target, b: MBlock): number {
  let k = b.instrs.length;
  while (k > 0 && isTerminator(t, b.instrs[k - 1])) k--;
  return k;
}
