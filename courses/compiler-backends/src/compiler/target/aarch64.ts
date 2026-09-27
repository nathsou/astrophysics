// AArch64 (ARMv8-A, A64 instruction set) target, AAPCS64 calling convention.
// Reference: Arm Architecture Reference Manual for A-profile; "Procedure Call
// Standard for the Arm 64-bit Architecture" (AAPCS64).

import type { Func, Module } from '../ir/ir';
import { force, isLogicalImm, rule, type INode, type Rule, type SelCtx, type Addr } from '../codegen/isel';
import { R, isReg, sameReg, type MBlock, type MFunc, type MInstr, type MOperand, type RegOp, type MemOp } from '../codegen/mir';
import { tok, type Tok } from '../listing';
import { blockTok, frameTok, immTok, joinOps, opTok, regTok, toLibcall, vregTok, PHI_COPY_INFO } from './common';
import type { OpInfo, Peephole, RegInfo, Target, TargetOptions } from './target';

const SP = 31, XZR = 32, NZCV = 33;

export const A64_REGS: RegInfo[] = [
  ...Array.from({ length: 31 }, (_, i): RegInfo => {
    let role = '';
    if (i < 8) role = `argument/result register ${i} (caller-saved)`;
    else if (i === 8) role = 'indirect result location register (caller-saved temporary)';
    else if (i <= 15) role = 'temporary (caller-saved)';
    else if (i <= 17) role = `IP${i - 16}: intra-procedure-call scratch; linkers may clobber it in veneers/PLT stubs (not allocated)`;
    else if (i === 18) role = 'platform register (reserved on Apple platforms and Windows; not allocated)';
    else if (i <= 28) role = 'callee-saved register';
    else if (i === 29) role = 'frame pointer (FP): points at the saved {FP, LR} pair — the frame record';
    else role = 'link register (LR): return address written by bl';
    return { name: i === 29 ? 'x29' : i === 30 ? 'x30' : `x${i}`, arch: `x${i}`, role, callerSaved: i <= 18 || i === 30, calleeSaved: i >= 19 && i <= 29, allocatable: i <= 15 || (i >= 19 && i <= 28) };
  }),
  { name: 'sp', arch: 'sp', role: 'stack pointer (register 31 in address/add contexts); must be 16-byte aligned whenever it is used to access memory', callerSaved: false, calleeSaved: true, allocatable: false },
  { name: 'xzr', arch: 'xzr', role: 'zero register (register 31 in most data-processing contexts)', callerSaved: false, calleeSaved: false, allocatable: false },
  { name: 'nzcv', arch: 'nzcv', role: 'condition flags: Negative, Zero, Carry, oVerflow — set by cmp/adds/subs, read by b.cond, csel, cset', callerSaved: true, calleeSaved: false, allocatable: false },
];
const CALLER_SAVED = [...Array.from({ length: 19 }, (_, i) => i), 30, NZCV];
const ARG = [0, 1, 2, 3, 4, 5, 6, 7];

const CC: Record<string, string> = { eq: 'eq', ne: 'ne', slt: 'lt', sle: 'le', sgt: 'gt', sge: 'ge' };
const INV_CC: Record<string, string> = { eq: 'ne', ne: 'eq', lt: 'ge', ge: 'lt', gt: 'le', le: 'gt' };

const I: Record<string, OpInfo> = {
  ...PHI_COPY_INFO,
  add: { syntax: 'add Xd, Xn, Xm', desc: 'Xd = Xn + Xm', cls: 'alu', lat: 1 },
  addi: { syntax: 'add Xd, Xn, #imm12{, lsl #12}', desc: 'Xd = Xn + imm; the immediate is 12 bits, optionally shifted left by 12', cls: 'alu', lat: 1 },
  addsl: { syntax: 'add Xd, Xn, Xm, lsl #s', desc: 'Xd = Xn + (Xm << s): the second operand can be shifted for free — one tile covers add + shl', cls: 'alu', lat: 1 },
  sub: { syntax: 'sub Xd, Xn, Xm', desc: 'Xd = Xn - Xm', cls: 'alu', lat: 1 },
  subi: { syntax: 'sub Xd, Xn, #imm12', desc: 'Xd = Xn - imm', cls: 'alu', lat: 1 },
  subsl: { syntax: 'sub Xd, Xn, Xm, lsl #s', desc: 'Xd = Xn - (Xm << s)', cls: 'alu', lat: 1 },
  neg: { syntax: 'neg Xd, Xm', desc: 'Xd = -Xm (alias of sub Xd, xzr, Xm)', cls: 'alu', lat: 1 },
  mul: { syntax: 'mul Xd, Xn, Xm', desc: 'Xd = Xn × Xm (alias of madd Xd, Xn, Xm, xzr)', cls: 'mul', lat: 3 },
  madd: { syntax: 'madd Xd, Xn, Xm, Xa', desc: 'Xd = Xa + Xn × Xm: fused multiply-add, one tile for mul + add', cls: 'mul', lat: 3 },
  msub: { syntax: 'msub Xd, Xn, Xm, Xa', desc: 'Xd = Xa - Xn × Xm. Remainder is computed as a - (a/b)*b with sdiv + msub: AArch64 has no remainder instruction.', cls: 'mul', lat: 3 },
  sdiv: { syntax: 'sdiv Xd, Xn, Xm', desc: 'Xd = Xn ÷ Xm, signed, truncating. Division by zero gives 0 (no trap).', cls: 'div', lat: 12 },
  and: { syntax: 'and Xd, Xn, Xm', desc: 'bitwise AND', cls: 'alu', lat: 1 },
  andi: { syntax: 'and Xd, Xn, #bitmask', desc: 'AND with a "logical immediate": a rotated run of ones, replicated across 2/4/8/16/32/64-bit elements (13-bit N:immr:imms encoding)', cls: 'alu', lat: 1 },
  orr: { syntax: 'orr Xd, Xn, Xm', desc: 'bitwise OR', cls: 'alu', lat: 1 },
  orri: { syntax: 'orr Xd, Xn, #bitmask', desc: 'OR with a logical immediate', cls: 'alu', lat: 1 },
  eor: { syntax: 'eor Xd, Xn, Xm', desc: 'bitwise exclusive OR', cls: 'alu', lat: 1 },
  eori: { syntax: 'eor Xd, Xn, #bitmask', desc: 'XOR with a logical immediate', cls: 'alu', lat: 1 },
  mvn: { syntax: 'mvn Xd, Xm', desc: 'Xd = ~Xm (alias of orn Xd, xzr, Xm)', cls: 'alu', lat: 1 },
  lsl: { syntax: 'lsl Xd, Xn, Xm', desc: 'Xd = Xn << (Xm mod 64) (alias of lslv)', cls: 'alu', lat: 1 },
  asr: { syntax: 'asr Xd, Xn, Xm', desc: 'arithmetic shift right (alias of asrv)', cls: 'alu', lat: 1 },
  lsr: { syntax: 'lsr Xd, Xn, Xm', desc: 'logical shift right (alias of lsrv)', cls: 'alu', lat: 1 },
  lsli: { syntax: 'lsl Xd, Xn, #s', desc: 'shift left by a constant (alias of ubfm)', cls: 'alu', lat: 1 },
  asri: { syntax: 'asr Xd, Xn, #s', desc: 'arithmetic shift right by a constant (alias of sbfm)', cls: 'alu', lat: 1 },
  lsri: { syntax: 'lsr Xd, Xn, #s', desc: 'logical shift right by a constant (alias of ubfm)', cls: 'alu', lat: 1 },
  mov: { syntax: 'mov Xd, Xm', desc: 'register move (alias of orr Xd, xzr, Xm)', cls: 'move', lat: 1 },
  movz: { syntax: 'movz Xd, #imm16{, lsl #s}', desc: 'move a 16-bit immediate into one of four 16-bit lanes, zeroing the rest. Printed as mov when it is the whole constant.', cls: 'alu', lat: 1 },
  movn: { syntax: 'movn Xd, #imm16{, lsl #s}', desc: 'move the bitwise NOT of a shifted 16-bit immediate: builds mostly-ones (negative) constants', cls: 'alu', lat: 1 },
  movk: { syntax: 'movk Xd, #imm16, lsl #s', desc: 'insert a 16-bit immediate into one lane, keeping the others: builds 64-bit constants 16 bits at a time', cls: 'alu', lat: 1 },
  cmp: { syntax: 'cmp Xn, Xm', desc: 'set NZCV from Xn - Xm (alias of subs xzr, Xn, Xm)', cls: 'alu', lat: 1 },
  cmpi: { syntax: 'cmp Xn, #imm12', desc: 'set NZCV from Xn - imm', cls: 'alu', lat: 1 },
  cmni: { syntax: 'cmn Xn, #imm12', desc: 'set NZCV from Xn + imm (compare with a negative constant)', cls: 'alu', lat: 1 },
  cset: { syntax: 'cset Xd, cond', desc: 'Xd = cond ? 1 : 0 (alias of csinc Xd, xzr, xzr, !cond)', cls: 'alu', lat: 1 },
  csel: { syntax: 'csel Xd, Xn, Xm, cond', desc: 'Xd = cond ? Xn : Xm — conditional select, the branch-free way to implement select', cls: 'alu', lat: 1 },
  ldr: { syntax: 'ldr Xt, [Xn{, #imm}] / [Xn, Xm, lsl #3]', desc: 'load 64-bit. Addressing modes: base + scaled unsigned 12-bit offset, or base + (index << 3)', cls: 'load', lat: 4 },
  str: { syntax: 'str Xt, [Xn{, #imm}]', desc: 'store 64-bit', cls: 'store', lat: 1 },
  stp: { syntax: 'stp Xt1, Xt2, [Xn, #imm]', desc: 'store a pair of registers: used to save the frame record {x29, x30}', cls: 'store', lat: 1 },
  ldp: { syntax: 'ldp Xt1, Xt2, [Xn, #imm]', desc: 'load a pair of registers', cls: 'load', lat: 4 },
  adrp: { syntax: 'adrp Xd, sym', desc: 'Xd = page address (4 KiB aligned) of sym, pc-relative ±4 GiB. Paired with add :lo12: for the low 12 bits.', cls: 'alu', lat: 1 },
  addlo: { syntax: 'add Xd, Xn, :lo12:sym', desc: 'add the low 12 bits of a symbol address (R_AARCH64_ADD_ABS_LO12_NC)', cls: 'alu', lat: 1 },
  b: { syntax: 'b label', desc: 'unconditional branch (±128 MiB)', cls: 'jump', lat: 1 },
  'b.cond': { syntax: 'b.cond label', desc: 'branch if the condition holds in NZCV (±1 MiB)', cls: 'branch', lat: 1 },
  cbz: { syntax: 'cbz Xt, label', desc: 'compare and branch if zero — no flags needed', cls: 'branch', lat: 1 },
  cbnz: { syntax: 'cbnz Xt, label', desc: 'compare and branch if not zero', cls: 'branch', lat: 1 },
  bl: { syntax: 'bl sym', desc: 'branch with link: x30 = return address; clobbers all caller-saved registers (x0–x18, x30) and the flags', cls: 'call', lat: 1 },
  ret: { syntax: 'ret', desc: 'return: branch to x30', cls: 'ret', lat: 1 },
};

const DISPLAY: Record<string, string> = {
  addi: 'add', addsl: 'add', subi: 'sub', subsl: 'sub', andi: 'and', orri: 'orr', eori: 'eor', lsli: 'lsl', asri: 'asr', lsri: 'lsr',
  cmpi: 'cmp', cmni: 'cmn', addlo: 'add',
};

// ---------------------------------------------------------------- constants

export type A64Seq = { op: 'movz' | 'movn' | 'movk' | 'orri'; imm: bigint; shift: number }[];

/** Materialise a 64-bit constant: one logical immediate, or movz/movn + movk per remaining 16-bit chunk. */
export function a64MatInt(v: bigint): A64Seq {
  const u = BigInt.asUintN(64, v);
  const chunks = [0, 1, 2, 3].map((k) => (u >> BigInt(16 * k)) & 0xffffn);
  const zeros = chunks.filter((c) => c === 0n).length;
  const ones = chunks.filter((c) => c === 0xffffn).length;
  if (zeros < 3 && ones < 3 && isLogicalImm(v)) return [{ op: 'orri', imm: u, shift: 0 }];
  const seq: A64Seq = [];
  if (ones > zeros) {
    const first = chunks.findIndex((c) => c !== 0xffffn);
    if (first < 0) return [{ op: 'movn', imm: 0n, shift: 0 }];
    seq.push({ op: 'movn', imm: ~chunks[first] & 0xffffn, shift: 16 * first });
    chunks.forEach((c, k) => { if (k !== first && c !== 0xffffn) seq.push({ op: 'movk', imm: c, shift: 16 * k }); });
  } else {
    const first = chunks.findIndex((c) => c !== 0n);
    if (first < 0) return [{ op: 'movz', imm: 0n, shift: 0 }];
    seq.push({ op: 'movz', imm: chunks[first], shift: 16 * first });
    chunks.forEach((c, k) => { if (k !== first && c !== 0n) seq.push({ op: 'movk', imm: c, shift: 16 * k }); });
  }
  return seq;
}

// ---------------------------------------------------------------- rules

type B = (() => any)[];
const bin = (op: string) => (c: SelCtx, n: INode, b: B) => {
  const [x, y] = force(b);
  const d = c.dst(n);
  c.emit(op, [d, x, typeof y === 'bigint' ? R.imm(y) : y]);
  return R.use(d);
};

function a64Rules(): Rule[] {
  const cmp = (c: SelCtx, x: RegOp, y: RegOp | bigint) => {
    if (typeof y === 'bigint') c.emit(y < 0n ? 'cmni' : 'cmpi', [x, R.imm(y < 0n ? -y : y)], { implDefs: [NZCV] });
    else c.emit('cmp', [x, y], { implDefs: [NZCV] });
  };
  const ccRule = (pred: string, rhs: 'reg' | '#aimm' | '#naimm') =>
    rule('cc', `(icmp.${pred} reg ${rhs})`, 1, `cmp a, ${rhs === 'reg' ? 'b' : '#imm'} → ${CC[pred]}`, (c, _n, b) => {
      const [x, y] = force(b);
      cmp(c, x, y);
      return CC[pred];
    });
  return [
    ...rule('reg', '#any', (n) => a64MatInt(n.c!).length, 'mov / movz+movk', (c, n, b) => c.li(c.dst(n), b[0]())),
    ...rule('reg', 'gaddr', 2, 'adrp + add :lo12:', (c, n, b) => {
      const d = c.dst(n);
      c.emit('adrp', [d, R.sym(b[0](), 'page')], { note: 'page of the symbol (upper bits, pc-relative)' });
      c.emit('addlo', [R.def(d), R.use(d), R.sym(b[0](), 'pageoff')], { note: 'plus its offset within the 4 KiB page' });
      return R.use(d);
    }),
    ...rule('reg', 'frame', 1, 'add Xd, sp, #off', (c, n, b) => { const d = c.dst(n); c.emit('addi', [d, b[0](), R.imm(0)]); return R.use(d); }),
    ...rule('reg', '(add frame #aimm)', 1, 'add Xd, sp, #off+imm', (c, n, b) => { const d = c.dst(n); c.emit('addi', [d, b[0](), R.imm(b[1]())]); return R.use(d); }),
    ...rule('reg', '(add reg reg)', 1, 'add', bin('add')),
    ...rule('reg', '(add reg #aimm)', 1, 'add #imm', bin('addi')),
    ...rule('reg', '(add reg #naimm)', 1, 'sub #-imm', (c, n, b) => { const [x, y] = force(b); const d = c.dst(n); c.emit('subi', [d, x, R.imm(-y)]); return R.use(d); }),
    ...rule('reg', '(add reg (shl reg #uimm6))', 1, 'add Xd, Xn, Xm, lsl #s', (c, n, b) => {
      const [x, y, s] = force(b);
      const d = c.dst(n);
      c.emit('addsl', [d, x, y, R.imm(s)]);
      return R.use(d);
    }, { commute: true }),
    ...rule('reg', '(add (mul reg reg) reg)', 1, 'madd Xd, Xn, Xm, Xa', (c, n, b) => {
      const [x, y, a] = force(b);
      const d = c.dst(n);
      c.emit('madd', [d, x, y, a]);
      return R.use(d);
    }, { commute: true }),
    ...rule('reg', '(sub reg reg)', 1, 'sub', bin('sub')),
    ...rule('reg', '(sub reg #aimm)', 1, 'sub #imm', bin('subi')),
    ...rule('reg', '(sub #zero reg)', 1, 'neg', (c, n, b) => { const d = c.dst(n); c.emit('neg', [d, b[1]()]); return R.use(d); }),
    ...rule('reg', '(sub reg (shl reg #uimm6))', 1, 'sub Xd, Xn, Xm, lsl #s', (c, n, b) => {
      const [x, y, s] = force(b);
      const d = c.dst(n);
      c.emit('subsl', [d, x, y, R.imm(s)]);
      return R.use(d);
    }),
    ...rule('reg', '(sub reg (mul reg reg))', 1, 'msub', (c, n, b) => {
      const [a, x, y] = force(b);
      const d = c.dst(n);
      c.emit('msub', [d, x, y, a]);
      return R.use(d);
    }),
    ...rule('reg', '(mul reg reg)', 1, 'mul', bin('mul')),
    ...rule('reg', '(sdiv reg reg)', 1, 'sdiv', bin('sdiv')),
    ...rule('reg', '(srem reg reg)', 2, 'sdiv t, a, b ; msub d, t, b, a', (c, n, b) => {
      const [x, y] = force(b);
      const t = c.fresh(), d = c.dst(n);
      c.emit('sdiv', [t, x, y], { note: 'q = a / b' });
      c.emit('msub', [d, R.use(t), y, x], { note: 'r = a - q*b (no remainder instruction on AArch64)' });
      return R.use(d);
    }),
    ...rule('reg', '(and reg reg)', 1, 'and', bin('and')),
    ...rule('reg', '(and reg #limm)', 1, 'and #bitmask', bin('andi')),
    ...rule('reg', '(or reg reg)', 1, 'orr', bin('orr')),
    ...rule('reg', '(or reg #limm)', 1, 'orr #bitmask', bin('orri')),
    ...rule('reg', '(xor reg reg)', 1, 'eor', bin('eor')),
    ...rule('reg', '(xor reg #limm)', 1, 'eor #bitmask', bin('eori')),
    ...rule('reg', '(xor reg #m1)', 1, 'mvn', (c, n, b) => { const d = c.dst(n); c.emit('mvn', [d, b[0]()]); return R.use(d); }),
    ...rule('reg', '(shl reg reg)', 1, 'lsl', bin('lsl')),
    ...rule('reg', '(shl reg #uimm6)', 1, 'lsl #s', bin('lsli')),
    ...rule('reg', '(ashr reg reg)', 1, 'asr', bin('asr')),
    ...rule('reg', '(ashr reg #uimm6)', 1, 'asr #s', bin('asri')),
    ...rule('reg', '(lshr reg reg)', 1, 'lsr', bin('lsr')),
    ...rule('reg', '(lshr reg #uimm6)', 1, 'lsr #s', bin('lsri')),
    // compares set NZCV; the result nonterminal carries the condition code
    ...['eq', 'ne', 'slt', 'sle', 'sgt', 'sge'].flatMap((p) => [...ccRule(p, 'reg'), ...ccRule(p, '#aimm'), ...ccRule(p, '#naimm')]),
    ...rule('cc', 'reg', 1, 'cmp x, #0 → ne', (c, _n, b) => { c.emit('cmpi', [b[0](), R.imm(0)], { implDefs: [NZCV] }); return 'ne'; }),
    ...rule('reg', 'cc', 1, 'cset Xd, cond', (c, n, b) => { const cc = b[0](); const d = c.dst(n); c.emit('cset', [d, R.cc(cc)], { implUses: [NZCV] }); return R.use(d); }),
    ...rule('reg', '(zext cc)', 1, 'cset Xd, cond', (c, n, b) => { const cc = b[0](); const d = c.dst(n); c.emit('cset', [d, R.cc(cc)], { implUses: [NZCV] }); return R.use(d); }),
    ...rule('reg', '(zext reg)', 0, '(i1 already 0/1)', (_c, _n, b) => b[0]()),
    ...rule('reg', '(select cc reg reg)', 1, 'csel Xd, Xn, Xm, cond', (c, n, b) => {
      // evaluate the arms first: anything they emit could clobber the flags
      const x = b[1](), y = b[2](), cc = b[0]();
      const d = c.dst(n);
      c.emit('csel', [d, x, y, R.cc(cc)], { implUses: [NZCV] });
      return R.use(d);
    }),
    // addressing modes
    ...rule('addr', 'reg', 0, '[Xn]', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', 'frame', 0, '[sp, #off]', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', '(add reg #ldoff)', 0, '[Xn, #imm]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('addr', '(add frame #aimm)', 0, '[sp, #off+imm]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('addr', '(add reg (shl reg #3))', 0, '[Xn, Xm, lsl #3]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, 0, y, 8); }, { commute: true }),
    ...rule('addr', '(add reg reg)', 0, '[Xn, Xm]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, 0, y, 1); }),
    ...rule('reg', '(load addr)', 1, 'ldr Xt, [addr]', (c, n, b) => { const a = b[0]() as Addr; const d = c.dst(n); c.emit('ldr', [d, a]); return R.use(d); }),
    ...rule('stmt', '(store reg addr)', 1, 'str Xt, [addr]', (c, _n, b) => { const [v, a] = force(b); c.emit('str', [v, a]); }),
    ...rule('stmt', '(store #zero addr)', 1, 'str xzr, [addr]', (c, _n, b) => { const [, a] = force(b); c.emit('str', [R.p(XZR), a]); }),
    // branches
    ...rule('stmt', '(condbr cc)', 2, 'b.cond T ; b F', (c, n, b) => {
      const cc = b[0]();
      c.emit('b.cond', [R.cc(cc), R.blk(n.targets![0])], { implUses: [NZCV] });
      c.emit('b', [R.blk(n.targets![1])]);
    }),
    ...rule('stmt', '(condbr (icmp.eq reg #zero))', 2, 'cbz Xt, T ; b F', (c, n, b) => {
      c.emit('cbz', [b[0](), R.blk(n.targets![0])], { note: 'compare-and-branch on zero: no separate cmp, no flags' });
      c.emit('b', [R.blk(n.targets![1])]);
    }),
    ...rule('stmt', '(condbr (icmp.ne reg #zero))', 2, 'cbnz Xt, T ; b F', (c, n, b) => {
      c.emit('cbnz', [b[0](), R.blk(n.targets![0])]);
      c.emit('b', [R.blk(n.targets![1])]);
    }),
    ...rule('stmt', '(condbr reg)', 2, 'cbnz Xt, T ; b F', (c, n, b) => {
      c.emit('cbnz', [b[0](), R.blk(n.targets![0])]);
      c.emit('b', [R.blk(n.targets![1])]);
    }),
  ].flat();
}

// ---------------------------------------------------------------- target

export class AArch64 implements Target {
  name = 'aarch64' as const;
  label = 'AArch64';
  regs = A64_REGS;
  sp = SP;
  fp = 29;
  ra = 30;
  zero = XZR;
  flags = NZCV;
  argRegs = ARG;
  retReg = 0;
  wordAlign = 8;
  stackAlign = 16;
  commentChar = '//';
  nonterminals = ['reg', 'cc', 'addr', 'stmt'];
  rules = a64Rules();
  constructor(public opts: TargetOptions = {}) {}

  get allocOrder() {
    const o = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
    return this.opts.maxRegs ? o.slice(0, this.opts.maxRegs) : o;
  }
  opInfo(op: string) { return I[op]; }

  legalize(_m: Module, fn: Func, log: { msgs: string[] }) {
    // AArch64 selects every KIR operation directly (srem via sdiv+msub is a tile).
    void fn; void log; void toLibcall;
  }

  lowerParams(f: MFunc, _e: MBlock, params: number[], emit: (mi: MInstr) => void) {
    params.forEach((p, k) => {
      if (k < 8) emit(f.mi('COPY', [R.vd(p), R.p(ARG[k])], { tag: 'abi', note: `parameter #${k} arrives in x${k} (AAPCS64)` }));
      else {
        const fi = f.addFrameObject({ size: 8, align: 8, kind: 'incoming-arg', name: `arg${k}`, cfaOffset: 8 * (k - 8) });
        emit(f.mi('ldr', [R.vd(p), R.mem(R.frame(fi), 0)], { tag: 'abi', note: `parameter #${k} is on the caller's stack` }));
      }
    });
  }
  lowerCall(f: MFunc, sym: string, args: RegOp[], result: number | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    args.forEach((a, k) => { if (k >= 8) emit(f.mi('str', [a, R.mem(R.p(SP), 8 * (k - 8))], { ...meta, tag: 'abi', note: `argument #${k} goes on the stack at [sp, #${8 * (k - 8)}]` })); });
    const uses: number[] = [];
    args.forEach((a, k) => { if (k < 8) { emit(f.mi('COPY', [R.pd(ARG[k]), a], { ...meta, tag: 'abi', note: `argument #${k} in x${k}` })); uses.push(ARG[k]); } });
    f.frame.maxOutgoingArgs = Math.max(f.frame.maxOutgoingArgs, Math.max(0, args.length - 8));
    emit(f.mi('bl', [R.sym(sym, 'call')], { ...meta, implUses: uses, implDefs: [...CALLER_SAVED], note: `call ${sym}: x30 gets the return address; x0–x18 and the flags are clobbered` }));
    if (result !== undefined) emit(f.mi('COPY', [R.vd(result), R.p(0)], { ...meta, tag: 'abi', note: 'result in x0' }));
  }
  lowerReturn(f: MFunc, v: RegOp | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    if (v) emit(f.mi('COPY', [R.pd(0), v], { ...meta, tag: 'abi', note: 'return value in x0' }));
    emit(f.mi('ret', [], { ...meta, implUses: v ? [0] : [] }));
  }
  jump(f: MFunc, t: MBlock) { return f.mi('b', [R.blk(t)]); }
  loadImm(f: MFunc, dst: RegOp, v: bigint, meta: Partial<MInstr>): MInstr[] {
    const seq = a64MatInt(v);
    return seq.map((s, k) => {
      if (s.op === 'orri') return f.mi('orri', [R.def(dst), R.p(XZR), R.imm(s.imm)], { ...meta, note: `${v} is a valid logical (bitmask) immediate: one instruction` });
      const ops: MOperand[] = [k === 0 ? R.def(dst) : R.defuse(dst), R.imm(s.imm), R.imm(s.shift)];
      return f.mi(s.op, ops, { ...meta, note: seq.length > 1 ? `constant ${v}: 16 bits at a time (${k + 1}/${seq.length})` : meta.note });
    });
  }
  copy(f: MFunc, dst: RegOp, src: RegOp, meta: Partial<MInstr> = {}) { return f.mi('COPY', [R.def(dst), R.use(src)], { tag: 'copy', ...meta }); }
  spillStore(f: MFunc, reg: RegOp, fi: number) { return f.mi('str', [R.use(reg), R.mem(R.frame(fi), 0)], { tag: 'spill' }); }
  reload(f: MFunc, reg: RegOp, fi: number) { return f.mi('ldr', [R.def(reg), R.mem(R.frame(fi), 0)], { tag: 'reload' }); }
  retarget(mi: MInstr, from: MBlock, to: MBlock) { for (const o of mi.ops) if (o.k === 'block' && o.b === from) o.b = to; }
  invertBranch(mi: MInstr) {
    if (mi.op === 'cbz') { mi.op = 'cbnz'; return true; }
    if (mi.op === 'cbnz') { mi.op = 'cbz'; return true; }
    if (mi.op === 'b.cond') { const c = mi.ops[0] as { cc: string }; c.cc = INV_CC[c.cc]; return true; }
    return false;
  }

  lowerFrame(f: MFunc) {
    const fr = f.frame;
    const used = new Set<number>();
    for (const b of f.blocks) for (const mi of b.instrs) for (const o of mi.ops) if (o.k === 'preg' && o.def) used.add(o.r);
    const saved = [...used].filter((r) => r >= 19 && r <= 28).sort((a, b) => a - b);
    const needRecord = fr.hasCalls || this.opts.framePointer || !!this.opts.darwin && fr.hasCalls;
    let dist = needRecord ? 16 : 0;
    const place = (fi: number) => { const o = fr.objects[fi]; dist = Math.ceil((dist + o.size) / o.align) * o.align; o.cfaOffset = -dist; };
    const slots = saved.map((r) => ({ r, fi: f.addFrameObject({ size: 8, align: 8, kind: 'callee-save', name: `x${r}`, reg: r }) }));
    for (const s of slots) place(s.fi);
    for (const o of fr.objects) if (o.kind === 'local') place(o.fi);
    for (const o of fr.objects) if (o.kind === 'spill') place(o.fi);
    const size = Math.ceil((dist + fr.maxOutgoingArgs * 8) / 16) * 16;
    fr.size = size;
    fr.savedRegs = saved;
    fr.usesFP = needRecord;
    for (const o of fr.objects) o.offset = size + (o.cfaOffset ?? 0);
    fr.laidOut = true;
    if (needRecord) {
      f.addFrameObject({ size: 8, align: 8, kind: 'fp', name: 'x29 (frame record)', offset: size - 16, cfaOffset: -16, reg: 29 });
      f.addFrameObject({ size: 8, align: 8, kind: 'ra', name: 'x30 (lr)', offset: size - 8, cfaOffset: -8, reg: 30 });
    }
    for (const b of f.blocks) for (const mi of b.instrs) {
      mi.ops.forEach((o, k) => {
        if (o.k === 'mem' && o.base.k === 'frame') {
          const obj = fr.objects[o.base.fi];
          mi.ops[k] = { ...o, base: R.p(SP), disp: o.disp + obj.offset! };
        } else if (o.k === 'frame') {
          const obj = fr.objects[o.fi];
          mi.ops[k] = R.p(SP);
          const imm = mi.ops[k + 1];
          if (imm?.k === 'imm') mi.ops[k + 1] = R.imm(imm.v + BigInt(obj.offset!));
          mi.note = `address of '${obj.name}' = sp + ${obj.offset}`;
        }
      });
    }
    if (!size) return;
    const pro: MInstr[] = [];
    const P = (op: string, ops: MOperand[], note: string) => pro.push(f.mi(op, ops, { tag: 'prologue', note }));
    P('subi', [R.pd(SP), R.p(SP), R.imm(size)], `allocate a ${size}-byte frame (sp stays 16-byte aligned)`);
    if (needRecord) {
      P('stp', [R.p(29), R.p(30), R.mem(R.p(SP), size - 16)], 'save the frame record: caller\'s frame pointer and our return address');
      P('addi', [R.pd(29), R.p(SP), R.imm(size - 16)], 'x29 points at the frame record: the chain unwinders and debuggers follow');
    }
    for (const s of slots) P('str', [R.p(s.r), R.mem(R.p(SP), fr.objects[s.fi].offset!)], `save callee-saved x${s.r}`);
    f.blocks[0].instrs.unshift(...pro);
    for (const b of f.blocks) {
      const k = b.instrs.findIndex((mi) => mi.op === 'ret');
      if (k < 0) continue;
      const epi: MInstr[] = [];
      for (const s of slots) epi.push(f.mi('ldr', [R.pd(s.r), R.mem(R.p(SP), fr.objects[s.fi].offset!)], { tag: 'epilogue', note: `restore x${s.r}` }));
      if (needRecord) epi.push(f.mi('ldp', [R.pd(29), R.pd(30), R.mem(R.p(SP), size - 16)], { tag: 'epilogue', note: 'restore frame pointer and return address' }));
      epi.push(f.mi('addi', [R.pd(SP), R.p(SP), R.imm(size)], { tag: 'epilogue', note: 'pop the frame' }));
      b.instrs.splice(k, 0, ...epi);
    }
  }

  expandPostRA(f: MFunc) {
    for (const b of f.blocks) {
      b.instrs = b.instrs.filter((mi) => {
        if (mi.op !== 'COPY') return true;
        const [d, s] = mi.ops as RegOp[];
        if (d.k === 'preg' && s.k === 'preg' && d.r === s.r) return false;
        mi.op = 'mov';
        return true;
      });
    }
  }

  peepholes: Peephole[] = a64Peepholes(this);
  sched = {
    issueWidth: 2,
    lat: (mi: MInstr) => I[mi.op]?.lat ?? 1,
    unit: (mi: MInstr) => {
      const c = I[mi.op]?.cls;
      return c === 'load' || c === 'store' ? 'mem' : c === 'mul' || c === 'div' ? 'muldiv' : c === 'branch' || c === 'jump' || c === 'call' || c === 'ret' ? 'branch' : 'alu';
    },
  };

  blockLabel(f: MFunc, b: MBlock) {
    return `${this.opts.darwin ? 'L' : '.L'}${f.name}_${b.name.replace(/[^A-Za-z0-9_]/g, '_')}`;
  }
  asmPrologue(name: string) {
    return this.opts.darwin ? ['.text', `.globl _${name}`, '.p2align 2'] : ['.text', `.globl ${name}`, '.p2align 2', `.type ${name},%function`];
  }
  symName(s: string) { return this.opts.darwin ? `_${s}` : s; }

  formatOperand(o: MOperand, f: MFunc): Tok[] {
    switch (o.k) {
      case 'vreg': return [vregTok(f, o.id)];
      case 'preg': return [regTok(this, o.r)];
      case 'imm': return [immTok(o.v, o.note)];
      case 'block': return [blockTok(f, this, o.b)];
      case 'cc': return [tok(o.cc, 'kw', undefined, { kind: 'term', term: 'condition code' })];
      case 'frame': return [frameTok(f, o.fi)];
      case 'sym': {
        const n = this.symName(o.name);
        const txt = o.mod === 'page' ? (this.opts.darwin ? `${n}@PAGE` : n) : o.mod === 'pageoff' ? (this.opts.darwin ? `${n}@PAGEOFF` : `:lo12:${n}`) : n;
        return [tok(txt, 'sym', `s:${o.name}`, { kind: 'sym', name: o.name })];
      }
      case 'mem': {
        const base = o.base.k === 'frame' ? [frameTok(f, o.base.fi)] : this.formatOperand(o.base, f);
        const parts: Tok[] = [tok('[', 'punct'), ...base];
        if (o.index) {
          parts.push(tok(', ', 'punct'), ...this.formatOperand(o.index, f));
          if (o.scale === 8) parts.push(tok(', lsl #3', 'punct'));
        } else if (o.disp) parts.push(tok(', #', 'punct'), immTok(BigInt(o.disp)));
        parts.push(tok(']', 'punct'));
        return parts;
      }
    }
  }

  formatInstr(mi: MInstr, f: MFunc): Tok[] {
    const F = (o: MOperand) => this.formatOperand(o, f);
    const imm = (o: MOperand) => [tok('#', 'punct'), ...F(o)];
    let name = DISPLAY[mi.op] ?? mi.op;
    const ops = mi.ops;
    let parts: Tok[][];
    switch (mi.op) {
      case 'PHI': {
        parts = [F(ops[0])];
        for (let k = 1; k < ops.length; k += 2) parts.push([tok('[', 'punct'), ...F(ops[k]), tok(', ', 'punct'), ...F(ops[k + 1]), tok(']', 'punct')]);
        break;
      }
      case 'addi': case 'subi': case 'andi': case 'orri': case 'eori': case 'lsli': case 'asri': case 'lsri':
        if (mi.op === 'orri' && isReg(ops[1]) && ops[1].k === 'preg' && ops[1].r === XZR) { name = 'mov'; parts = [F(ops[0]), imm(ops[2])]; break; }
        parts = [F(ops[0]), F(ops[1]), imm(ops[2])];
        break;
      case 'cmpi': case 'cmni': parts = [F(ops[0]), imm(ops[1])]; break;
      case 'addsl': case 'subsl': parts = [F(ops[0]), F(ops[1]), F(ops[2]), [tok('lsl #', 'punct'), ...F(ops[3])]]; break;
      case 'movz': case 'movn': case 'movk': {
        const sh = (ops[2] as { v: bigint }).v;
        const v = (ops[1] as { v: bigint }).v;
        if (mi.op === 'movz' && sh === 0n) { name = 'mov'; parts = [F(ops[0]), [tok('#', 'punct'), immTok(v)]]; break; }
        if (mi.op === 'movn' && sh === 0n) { name = 'mov'; parts = [F(ops[0]), [tok('#', 'punct'), immTok(~v)]]; break; }
        parts = [F(ops[0]), [tok('#', 'punct'), immTok(v)]];
        if (sh) parts.push([tok(`lsl #${sh}`, 'punct')]);
        break;
      }
      case 'b.cond': name = `b.${(ops[0] as { cc: string }).cc}`; parts = [F(ops[1])]; break;
      case 'ret': parts = []; break;
      default: parts = ops.map(F);
    }
    return [opTok(this, mi, name), ...(parts.length ? [tok(' ')] : []), ...joinOps(parts)];
  }
}

const memEq = (a: MOperand, b: MOperand) =>
  a.k === 'mem' && b.k === 'mem' && isReg(a.base) && isReg(b.base) && sameReg(a.base, b.base) && a.disp === b.disp && !a.index && !b.index;

function a64Peepholes(t: AArch64): Peephole[] {
  return [
    {
      name: 'self-move', desc: 'mov x, x does nothing',
      apply(_f, b, k) {
        const mi = b.instrs[k];
        if (mi.op === 'mov' && isReg(mi.ops[0]) && isReg(mi.ops[1]) && sameReg(mi.ops[0], mi.ops[1])) { b.instrs.splice(k, 1); return 'deleted mov x, x'; }
      },
    },
    {
      name: 'store-load-forward', desc: 'reload right after a store of the same slot → register move',
      apply(f, b, k) {
        const st = b.instrs[k], ld = b.instrs[k + 1];
        if (!ld || st.op !== 'str' || ld.op !== 'ldr' || !memEq(st.ops[1], ld.ops[1])) return;
        const src = st.ops[0] as RegOp, dst = ld.ops[0] as RegOp;
        if (src.k === 'preg' && src.r === XZR) return;
        if (sameReg(src, dst)) { b.instrs.splice(k + 1, 1); return 'deleted a reload of a value still in its register'; }
        b.instrs[k + 1] = f.mi('mov', [R.def(dst), R.use(src)], { note: 'forwarded from the preceding store' });
        return 'replaced a load by a register move';
      },
    },
    {
      name: 'jump-to-next', desc: 'b L where L is the next block: fall through',
      apply(_f, b, k, next) {
        const mi = b.instrs[k];
        if (mi.op === 'b' && next && k === b.instrs.length - 1 && (mi.ops[0] as { b: MBlock }).b === next) { b.instrs.splice(k, 1); return `deleted 'b ${next.name}'`; }
      },
    },
    {
      name: 'branch-over-jump', desc: 'b.cc L1; b L2; L1:  →  b.!cc L2',
      apply(_f, b, k, next) {
        const br = b.instrs[k], j = b.instrs[k + 1];
        if (!j || k + 2 !== b.instrs.length || j.op !== 'b' || I[br.op]?.cls !== 'branch') return;
        const tgt = br.ops.find((o) => o.k === 'block') as { b: MBlock } | undefined;
        if (!tgt || tgt.b !== next) return;
        const other = (j.ops[0] as { b: MBlock }).b;
        if (!t.invertBranch(br)) return;
        tgt.b = other;
        b.instrs.splice(k + 1, 1);
        return `inverted the branch to ${other.name} and fell through`;
      },
    },
  ];
}

export type { MemOp };
