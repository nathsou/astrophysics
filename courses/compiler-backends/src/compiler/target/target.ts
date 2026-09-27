// Target description interface. Each backend (RISC-V, AArch64, x86-64)
// implements this: register file, calling convention, instruction selection
// rules, frame lowering, scheduling model, peepholes, printing and encoding.

import type { Func, Module } from '../ir/ir';
import type { MBlock, MFunc, MInstr, MOperand, RegOp } from '../codegen/mir';
import type { Rule } from '../codegen/isel';
import type { Tok } from '../listing';

export type TargetName = 'rv64' | 'aarch64' | 'x86_64';

export interface RegInfo {
  /** canonical name used in assembly */
  name: string;
  /** architectural name (x5, r8, ...) */
  arch: string;
  role: string;
  callerSaved: boolean;
  calleeSaved: boolean;
  allocatable: boolean;
}

export type OpClass = 'alu' | 'mul' | 'div' | 'load' | 'store' | 'branch' | 'jump' | 'call' | 'ret' | 'move' | 'pseudo' | 'nop';

export interface OpInfo {
  syntax: string;
  desc: string;
  cls: OpClass;
  /** result latency in cycles (scheduling model) */
  lat?: number;
  /** instruction format / encoding class */
  fmt?: string;
  /** assembler pseudo-instruction expansion, if any */
  expands?: string;
  ext?: string;
}

export interface TargetOptions {
  /** RISC-V: M extension (hardware multiply/divide) */
  mExt?: boolean;
  /** RISC-V: Zba address-generation extension (sh1add/sh2add/sh3add) */
  zba?: boolean;
  /** RISC-V: Zicond (czero.eqz / czero.nez) */
  zicond?: boolean;
  /** keep a frame pointer */
  framePointer?: boolean;
  /** restrict the allocator to the first N allocatable registers (for demos) */
  maxRegs?: number;
  /** darwin-flavoured assembly (AArch64 tests on macOS) */
  darwin?: boolean;
}

export interface LegalizeLog {
  msgs: string[];
}

export interface Target {
  name: TargetName;
  label: string;
  opts: TargetOptions;
  regs: RegInfo[];
  sp: number;
  fp: number;
  ra?: number;
  zero?: number;
  flags?: number;
  argRegs: number[];
  retReg: number;
  /** other fixed registers instructions may name explicitly (x86 rax/rdx/rcx) */
  pinnedRegs?: number[];
  allocOrder: number[];
  wordAlign: number;
  stackAlign: number;

  opInfo(op: string): OpInfo | undefined;

  /** IR-level legalization: rewrite ops the target cannot select directly. */
  legalize(m: Module, fn: Func, log: LegalizeLog): void;
  rules: Rule[];
  /** nonterminals of the rule grammar */
  nonterminals: string[];

  // ABI hooks used by instruction selection
  lowerParams(f: MFunc, entry: MBlock, paramVregs: number[], emit: (mi: MInstr) => void): void;
  lowerCall(f: MFunc, sym: string, args: RegOp[], result: number | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>): void;
  lowerReturn(f: MFunc, v: RegOp | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>): void;
  jump(f: MFunc, target: MBlock): MInstr;
  /** materialise a constant into a fresh or given vreg */
  loadImm(f: MFunc, dst: RegOp, v: bigint, meta: Partial<MInstr>): MInstr[];

  // register allocation hooks
  copy(f: MFunc, dst: RegOp, src: RegOp, meta?: Partial<MInstr>): MInstr;
  spillStore(f: MFunc, reg: RegOp, fi: number): MInstr;
  reload(f: MFunc, reg: RegOp, fi: number): MInstr;

  /** branch helpers for edge splitting / layout */
  retarget(mi: MInstr, from: MBlock, to: MBlock): void;
  invertBranch(mi: MInstr): boolean;

  // frame lowering (after register allocation)
  lowerFrame(f: MFunc): void;
  /** expand remaining pseudos (COPY -> mv, ...) after allocation */
  expandPostRA(f: MFunc): void;

  peepholes: Peephole[];
  sched: { issueWidth: number; lat(mi: MInstr): number; unit(mi: MInstr): string };

  formatInstr(mi: MInstr, f: MFunc, post: boolean): Tok[];
  formatOperand(o: MOperand, f: MFunc): Tok[];
  blockLabel(f: MFunc, b: MBlock): string;
  asmPrologue(fnName: string): string[];
  commentChar: string;
}

export interface Peephole {
  name: string;
  desc: string;
  /** try at index k in block b; returns a description if something changed */
  apply(f: MFunc, b: MBlock, k: number, next?: MBlock): string | undefined;
}
