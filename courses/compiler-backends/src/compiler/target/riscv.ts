// RISC-V RV64IM (+ optional Zba / Zicond) target, LP64 ABI.
// Reference: The RISC-V Instruction Set Manual, Volume I (Unprivileged ISA),
// and the RISC-V ELF psABI specification.

import { Const, Instr, type Func, type Module } from '../ir/ir';
import { force, rule, type INode, type Rule, type SelCtx, type Addr } from '../codegen/isel';
import { MFunc, R, isReg, sameReg, firstTerminator, type MBlock, type MInstr, type MOperand, type RegOp, type MemOp } from '../codegen/mir';
import { tok, type Tok } from '../listing';
import { blockLabelDefault, blockTok, frameTok, immTok, insertIR, joinOps, k64, opTok, regTok, toLibcall, vregTok, PHI_COPY_INFO } from './common';
import type { OpInfo, Peephole, RegInfo, Target, TargetOptions } from './target';

// ----------------------------------------------------------------- registers

const ABI = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];

function role(i: number): string {
  if (i === 0) return 'hard-wired zero: reads as 0, writes are discarded';
  if (i === 1) return 'return address (link register), written by call/jal';
  if (i === 2) return 'stack pointer; must stay 16-byte aligned at calls';
  if (i === 3) return 'global pointer (used for linker relaxation of small data; not allocated)';
  if (i === 4) return 'thread pointer (TLS base; not allocated)';
  if (i === 8) return 'saved register 0 / frame pointer (callee-saved)';
  if (i >= 10 && i <= 11) return `argument ${i - 10} and return value ${i - 10} (caller-saved)`;
  if (i >= 12 && i <= 17) return `argument ${i - 10} (caller-saved)`;
  if (ABI[i].startsWith('t')) return 'temporary (caller-saved: clobbered by calls)';
  return 'saved register (callee-saved: a function must restore it before returning)';
}

export const RV_REGS: RegInfo[] = ABI.map((name, i) => ({
  name,
  arch: `x${i}`,
  role: role(i),
  callerSaved: i === 1 || (i >= 5 && i <= 7) || (i >= 10 && i <= 17) || i >= 28,
  calleeSaved: i === 2 || i === 8 || i === 9 || (i >= 18 && i <= 27),
  allocatable: i >= 5 && i !== 8 || i === 8,
}));

const X = Object.fromEntries(ABI.map((n, i) => [n, i])) as Record<string, number>;
const CALLER_SAVED = RV_REGS.map((r, i) => (r.callerSaved ? i : -1)).filter((i) => i >= 0);
const ARG_REGS = [10, 11, 12, 13, 14, 15, 16, 17];

// ----------------------------------------------------------------- opcodes

const I: Record<string, OpInfo> = {
  ...PHI_COPY_INFO,
  add: { syntax: 'add rd, rs1, rs2', desc: 'rd = rs1 + rs2 (64-bit, wraps on overflow)', cls: 'alu', lat: 1, fmt: 'R' },
  sub: { syntax: 'sub rd, rs1, rs2', desc: 'rd = rs1 - rs2', cls: 'alu', lat: 1, fmt: 'R' },
  addi: { syntax: 'addi rd, rs1, imm12', desc: 'rd = rs1 + sign-extended 12-bit immediate (-2048..2047). RISC-V has no subi: subtract by adding a negative immediate.', cls: 'alu', lat: 1, fmt: 'I' },
  addiw: { syntax: 'addiw rd, rs1, imm12', desc: 'rd = sign-extend(32-bit(rs1 + imm)). Used in constant materialisation after lui.', cls: 'alu', lat: 1, fmt: 'I' },
  and: { syntax: 'and rd, rs1, rs2', desc: 'rd = rs1 & rs2', cls: 'alu', lat: 1, fmt: 'R' },
  or: { syntax: 'or rd, rs1, rs2', desc: 'rd = rs1 | rs2', cls: 'alu', lat: 1, fmt: 'R' },
  xor: { syntax: 'xor rd, rs1, rs2', desc: 'rd = rs1 ^ rs2', cls: 'alu', lat: 1, fmt: 'R' },
  andi: { syntax: 'andi rd, rs1, imm12', desc: 'rd = rs1 & sext(imm12)', cls: 'alu', lat: 1, fmt: 'I' },
  ori: { syntax: 'ori rd, rs1, imm12', desc: 'rd = rs1 | sext(imm12)', cls: 'alu', lat: 1, fmt: 'I' },
  xori: { syntax: 'xori rd, rs1, imm12', desc: 'rd = rs1 ^ sext(imm12); xori rd, rs, -1 is bitwise NOT', cls: 'alu', lat: 1, fmt: 'I' },
  sll: { syntax: 'sll rd, rs1, rs2', desc: 'rd = rs1 << (rs2 & 63)', cls: 'alu', lat: 1, fmt: 'R' },
  srl: { syntax: 'srl rd, rs1, rs2', desc: 'rd = rs1 >>u (rs2 & 63) (logical)', cls: 'alu', lat: 1, fmt: 'R' },
  sra: { syntax: 'sra rd, rs1, rs2', desc: 'rd = rs1 >>s (rs2 & 63) (arithmetic: copies the sign bit)', cls: 'alu', lat: 1, fmt: 'R' },
  slli: { syntax: 'slli rd, rs1, shamt6', desc: 'rd = rs1 << shamt', cls: 'alu', lat: 1, fmt: 'I' },
  srli: { syntax: 'srli rd, rs1, shamt6', desc: 'rd = rs1 >>u shamt', cls: 'alu', lat: 1, fmt: 'I' },
  srai: { syntax: 'srai rd, rs1, shamt6', desc: 'rd = rs1 >>s shamt', cls: 'alu', lat: 1, fmt: 'I' },
  slt: { syntax: 'slt rd, rs1, rs2', desc: 'rd = (rs1 <s rs2) ? 1 : 0 — the only signed comparison that produces a value; everything else is derived from it', cls: 'alu', lat: 1, fmt: 'R' },
  sltu: { syntax: 'sltu rd, rs1, rs2', desc: 'rd = (rs1 <u rs2) ? 1 : 0', cls: 'alu', lat: 1, fmt: 'R' },
  slti: { syntax: 'slti rd, rs1, imm12', desc: 'rd = (rs1 <s sext(imm)) ? 1 : 0', cls: 'alu', lat: 1, fmt: 'I' },
  sltiu: { syntax: 'sltiu rd, rs1, imm12', desc: 'rd = (rs1 <u sext(imm)) ? 1 : 0', cls: 'alu', lat: 1, fmt: 'I' },
  seqz: { syntax: 'seqz rd, rs', desc: 'rd = (rs == 0). Assembler pseudo for sltiu rd, rs, 1 (unsigned x < 1 ⟺ x == 0).', cls: 'alu', lat: 1, fmt: 'I', expands: 'sltiu rd, rs, 1' },
  snez: { syntax: 'snez rd, rs', desc: 'rd = (rs != 0). Pseudo for sltu rd, zero, rs (0 <u x ⟺ x != 0).', cls: 'alu', lat: 1, fmt: 'R', expands: 'sltu rd, zero, rs' },
  neg: { syntax: 'neg rd, rs', desc: 'rd = -rs. Pseudo for sub rd, zero, rs.', cls: 'alu', lat: 1, fmt: 'R', expands: 'sub rd, zero, rs' },
  not: { syntax: 'not rd, rs', desc: 'rd = ~rs. Pseudo for xori rd, rs, -1.', cls: 'alu', lat: 1, fmt: 'I', expands: 'xori rd, rs, -1' },
  mv: { syntax: 'mv rd, rs', desc: 'rd = rs. Pseudo for addi rd, rs, 0 — RISC-V has no dedicated move instruction.', cls: 'move', lat: 1, fmt: 'I', expands: 'addi rd, rs, 0' },
  li: { syntax: 'li rd, imm', desc: 'Load immediate. Assembler pseudo: expands to 1–8 instructions (addi / lui+addiw / … slli …) depending on the constant.', cls: 'alu', lat: 1, fmt: 'pseudo', expands: 'lui/addi(w)/slli sequence' },
  lui: { syntax: 'lui rd, imm20', desc: 'rd = sext(imm20 << 12): load the upper 20 bits of a 32-bit value', cls: 'alu', lat: 1, fmt: 'U' },
  auipc: { syntax: 'auipc rd, imm20', desc: 'rd = pc + sext(imm20 << 12): the building block of position-independent addressing', cls: 'alu', lat: 1, fmt: 'U' },
  lla: { syntax: 'lla rd, symbol', desc: 'Load local address, pc-relative. Pseudo for auipc rd, %pcrel_hi(sym); addi rd, rd, %pcrel_lo(label). Needs two relocations.', cls: 'alu', lat: 2, fmt: 'pseudo', expands: 'auipc + addi' },
  mul: { syntax: 'mul rd, rs1, rs2', desc: 'rd = low 64 bits of rs1 × rs2 (M extension)', cls: 'mul', lat: 3, fmt: 'R', ext: 'M' },
  div: { syntax: 'div rd, rs1, rs2', desc: 'rd = rs1 ÷ rs2, signed, rounds toward zero. Division by zero does not trap: it returns -1. (M extension)', cls: 'div', lat: 20, fmt: 'R', ext: 'M' },
  rem: { syntax: 'rem rd, rs1, rs2', desc: 'rd = rs1 mod rs2 (sign follows the dividend). x rem 0 = x. (M extension)', cls: 'div', lat: 20, fmt: 'R', ext: 'M' },
  sh1add: { syntax: 'sh1add rd, rs1, rs2', desc: 'rd = (rs1 << 1) + rs2 (Zba address generation)', cls: 'alu', lat: 1, fmt: 'R', ext: 'Zba' },
  sh2add: { syntax: 'sh2add rd, rs1, rs2', desc: 'rd = (rs1 << 2) + rs2 (Zba)', cls: 'alu', lat: 1, fmt: 'R', ext: 'Zba' },
  sh3add: { syntax: 'sh3add rd, rs1, rs2', desc: 'rd = (rs1 << 3) + rs2 (Zba) — indexing an array of 8-byte elements in one instruction', cls: 'alu', lat: 1, fmt: 'R', ext: 'Zba' },
  'czero.eqz': { syntax: 'czero.eqz rd, rs1, rs2', desc: 'rd = (rs2 == 0) ? 0 : rs1 (Zicond conditional zero)', cls: 'alu', lat: 1, fmt: 'R', ext: 'Zicond' },
  'czero.nez': { syntax: 'czero.nez rd, rs1, rs2', desc: 'rd = (rs2 != 0) ? 0 : rs1 (Zicond)', cls: 'alu', lat: 1, fmt: 'R', ext: 'Zicond' },
  ld: { syntax: 'ld rd, imm12(rs1)', desc: 'rd = mem64[rs1 + sext(imm12)] — load doubleword', cls: 'load', lat: 3, fmt: 'I' },
  sd: { syntax: 'sd rs2, imm12(rs1)', desc: 'mem64[rs1 + sext(imm12)] = rs2 — store doubleword', cls: 'store', lat: 1, fmt: 'S' },
  beq: { syntax: 'beq rs1, rs2, label', desc: 'branch if rs1 == rs2 (±4 KiB range, B-type)', cls: 'branch', lat: 1, fmt: 'B' },
  bne: { syntax: 'bne rs1, rs2, label', desc: 'branch if rs1 != rs2', cls: 'branch', lat: 1, fmt: 'B' },
  blt: { syntax: 'blt rs1, rs2, label', desc: 'branch if rs1 <s rs2. There is no bgt: swap the operands.', cls: 'branch', lat: 1, fmt: 'B' },
  bge: { syntax: 'bge rs1, rs2, label', desc: 'branch if rs1 >=s rs2. There is no ble: swap the operands.', cls: 'branch', lat: 1, fmt: 'B' },
  bltu: { syntax: 'bltu rs1, rs2, label', desc: 'branch if rs1 <u rs2', cls: 'branch', lat: 1, fmt: 'B' },
  bgeu: { syntax: 'bgeu rs1, rs2, label', desc: 'branch if rs1 >=u rs2', cls: 'branch', lat: 1, fmt: 'B' },
  j: { syntax: 'j label', desc: 'unconditional jump. Pseudo for jal zero, label (±1 MiB, J-type).', cls: 'jump', lat: 1, fmt: 'J', expands: 'jal zero, offset' },
  jal: { syntax: 'jal rd, label', desc: 'rd = pc + 4; pc += offset', cls: 'jump', lat: 1, fmt: 'J' },
  jalr: { syntax: 'jalr rd, imm(rs1)', desc: 'rd = pc + 4; pc = (rs1 + imm) & ~1', cls: 'jump', lat: 1, fmt: 'I' },
  call: { syntax: 'call symbol', desc: 'Call a function: ra = return address. Pseudo for auipc ra, %pcrel_hi(f); jalr ra, %pcrel_lo(f)(ra) with an R_RISCV_CALL_PLT relocation; the linker may relax it to a single jal. Clobbers every caller-saved register.', cls: 'call', lat: 1, fmt: 'pseudo', expands: 'auipc ra + jalr ra' },
  ret: { syntax: 'ret', desc: 'return to caller. Pseudo for jalr zero, 0(ra).', cls: 'ret', lat: 1, fmt: 'pseudo', expands: 'jalr zero, 0(ra)' },
  ecall: { syntax: 'ecall', desc: 'environment call: trap into the OS (Linux: syscall number in a7, args in a0-a5)', cls: 'call', lat: 1, fmt: 'I' },
  nop: { syntax: 'nop', desc: 'no operation (addi zero, zero, 0)', cls: 'nop', lat: 1, fmt: 'I' },
  lb: { syntax: 'lb rd, imm(rs1)', desc: 'load byte, sign-extended', cls: 'load', lat: 3, fmt: 'I' },
  lbu: { syntax: 'lbu rd, imm(rs1)', desc: 'load byte, zero-extended', cls: 'load', lat: 3, fmt: 'I' },
  sb: { syntax: 'sb rs2, imm(rs1)', desc: 'store low byte of rs2', cls: 'store', lat: 1, fmt: 'S' },
  lw: { syntax: 'lw rd, imm(rs1)', desc: 'load 32-bit word, sign-extended', cls: 'load', lat: 3, fmt: 'I' },
  sw: { syntax: 'sw rs2, imm(rs1)', desc: 'store low 32 bits', cls: 'store', lat: 1, fmt: 'S' },
  divu: { syntax: 'divu rd, rs1, rs2', desc: 'unsigned division', cls: 'div', lat: 20, fmt: 'R', ext: 'M' },
  remu: { syntax: 'remu rd, rs1, rs2', desc: 'unsigned remainder', cls: 'div', lat: 20, fmt: 'R', ext: 'M' },
};

// ----------------------------------------------------------------- constants

export type RvSeq = { op: 'lui' | 'addi' | 'addiw' | 'slli'; imm: bigint }[];

const sext = (v: bigint, bits: number) => BigInt.asIntN(bits, v);
const ctz = (v: bigint) => { let n = 0; while (v !== 0n && (v & 1n) === 0n) { v >>= 1n; n++; } return n; };

/**
 * RISC-V constant materialisation (after LLVM's RISCVMatInt):
 *  - 12-bit: addi rd, zero, imm
 *  - 32-bit: lui hi20 ; addiw lo12, where hi20 is rounded so that adding the
 *    sign-extended lo12 lands exactly (the "+0x800" trick)
 *  - 64-bit: materialise the upper part recursively, shift left, add the low 12 bits.
 */
export function rvMatInt(v: bigint, top = true): RvSeq {
  v = BigInt.asIntN(64, v);
  if (v >= -(1n << 31n) && v < 1n << 31n) {
    const hi20 = ((v + 0x800n) >> 12n) & 0xfffffn;
    const lo12 = sext(v, 12);
    const seq: RvSeq = [];
    if (hi20 !== 0n) seq.push({ op: 'lui', imm: hi20 });
    // like GNU as: plain addi only for a top-level 12-bit constant, addiw otherwise
    if (lo12 !== 0n || hi20 === 0n) seq.push({ op: hi20 !== 0n || !top ? 'addiw' : 'addi', imm: lo12 });
    return seq;
  }
  const lo12 = sext(v, 12);
  let hi = (v - lo12) >> 12n;
  let sh = 12;
  const tz = ctz(hi);
  hi >>= BigInt(tz);
  sh += tz;
  const seq = rvMatInt(hi, false);
  seq.push({ op: 'slli', imm: BigInt(sh) });
  if (lo12 !== 0n) seq.push({ op: 'addi', imm: lo12 });
  return seq;
}

// ----------------------------------------------------------------- isel rules

type B = (() => any)[];
const asOp = (x: RegOp | bigint): MOperand => (typeof x === 'bigint' ? R.imm(x) : x);

/** rd = op(a, b) */
const bin = (op: string) => (c: SelCtx, n: INode, b: B) => {
  const [x, y] = force(b);
  const d = c.dst(n);
  c.emit(op, [d, asOp(x), asOp(y)]);
  return R.use(d);
};
const un = (op: string) => (c: SelCtx, n: INode, b: B) => {
  const [x] = force(b);
  const d = c.dst(n);
  c.emit(op, [d, x]);
  return R.use(d);
};

function rvRules(t: RiscV): Rule[] {
  const M = () => (t.opts.mExt === false ? Infinity : 1);
  const ZBA = () => (t.opts.zba ? 1 : Infinity);
  const ZIC = () => (t.opts.zicond ? 3 : Infinity);
  const cmpBr = (op: string, swap = false) => (c: SelCtx, n: INode, b: B) => {
    const [x, y] = force(b);
    c.emit(op, swap ? [y, x, R.blk(n.targets![0])] : [x, y, R.blk(n.targets![0])], { note: `fused compare-and-branch: one instruction for icmp + condbr` });
    c.emit('j', [R.blk(n.targets![1])], { note: 'jump to the false successor (removed later if it is the fall-through block)' });
  };
  // (icmp …) -> bool in a register, 0 or 1
  const setcc = (seq: (c: SelCtx, d: RegOp, x: RegOp, y: RegOp | bigint) => void) => (c: SelCtx, n: INode, b: B) => {
    const [x, y] = force(b);
    const d = c.dst(n);
    seq(c, d, x, y);
    return R.use(d);
  };
  const tmp = (c: SelCtx) => c.fresh();
  return [
    // leaves
    ...rule('reg', '#zero', 0, 'zero (x0)', () => R.p(0)),
    ...rule('reg', '#any', (n) => rvMatInt(n.c!).length, 'li rd, imm', (c, n, b) => c.li(c.dst(n), b[0]())),
    ...rule('reg', 'gaddr', 2, 'lla rd, sym', (c, n, b) => { const d = c.dst(n); c.emit('lla', [d, R.sym(b[0]())]); return R.use(d); }),
    ...rule('reg', 'frame', 1, 'addi rd, sp, off', (c, n, b) => { const d = c.dst(n); c.emit('addi', [d, b[0](), R.imm(0)], { note: 'address of a stack object: sp + offset (offset fixed during frame lowering)' }); return R.use(d); }),
    ...rule('reg', '(add frame #simm12)', 1, 'addi rd, sp, off+imm', (c, n, b) => { const d = c.dst(n); c.emit('addi', [d, b[0](), R.imm(b[1]())]); return R.use(d); }),
    // arithmetic
    ...rule('reg', '(add reg reg)', 1, 'add rd, rs1, rs2', bin('add')),
    ...rule('reg', '(add reg #simm12)', 1, 'addi rd, rs1, imm', bin('addi')),
    ...rule('reg', '(sub reg reg)', 1, 'sub rd, rs1, rs2', bin('sub')),
    ...rule('reg', '(sub #zero reg)', 1, 'neg rd, rs', (c, n, b) => un('neg')(c, n, [b[1]])),
    ...rule('reg', '(sub reg #nsimm12)', 1, 'addi rd, rs1, -imm', (c, n, b) => { const [x, y] = force(b); const d = c.dst(n); c.emit('addi', [d, x, R.imm(-y)]); return R.use(d); }),
    ...rule('reg', '(mul reg reg)', M, 'mul rd, rs1, rs2', bin('mul')),
    ...rule('reg', '(sdiv reg reg)', M, 'div rd, rs1, rs2', bin('div')),
    ...rule('reg', '(srem reg reg)', M, 'rem rd, rs1, rs2', bin('rem')),
    ...rule('reg', '(and reg reg)', 1, 'and rd, rs1, rs2', bin('and')),
    ...rule('reg', '(and reg #simm12)', 1, 'andi rd, rs1, imm', bin('andi')),
    ...rule('reg', '(or reg reg)', 1, 'or rd, rs1, rs2', bin('or')),
    ...rule('reg', '(or reg #simm12)', 1, 'ori rd, rs1, imm', bin('ori')),
    ...rule('reg', '(xor reg reg)', 1, 'xor rd, rs1, rs2', bin('xor')),
    ...rule('reg', '(xor reg #simm12)', 1, 'xori rd, rs1, imm', (c, n, b) => {
      const [x, y] = force(b);
      const d = c.dst(n);
      if (y === -1n) c.emit('not', [d, x]);
      else c.emit('xori', [d, x, R.imm(y)]);
      return R.use(d);
    }),
    ...rule('reg', '(shl reg reg)', 1, 'sll rd, rs1, rs2', bin('sll')),
    ...rule('reg', '(shl reg #uimm6)', 1, 'slli rd, rs1, sh', bin('slli')),
    ...rule('reg', '(ashr reg reg)', 1, 'sra rd, rs1, rs2', bin('sra')),
    ...rule('reg', '(ashr reg #uimm6)', 1, 'srai rd, rs1, sh', bin('srai')),
    ...rule('reg', '(lshr reg reg)', 1, 'srl rd, rs1, rs2', bin('srl')),
    ...rule('reg', '(lshr reg #uimm6)', 1, 'srli rd, rs1, sh', bin('srli')),
    // Zba: (x << k) + y in one instruction
    ...rule('reg', '(add reg (shl reg #scale))', ZBA, 'shNadd rd, rs1, rs2', (c, n, b) => {
      const [base, idx, s] = force(b);
      const d = c.dst(n);
      c.emit(`sh${s}add`, [d, idx, base]);
      return R.use(d);
    }, { commute: true }),
    // comparisons producing 0/1
    ...rule('bool', '(icmp.slt reg reg)', 1, 'slt rd, a, b', setcc((c, d, x, y) => c.emit('slt', [d, x, y as RegOp]))),
    ...rule('bool', '(icmp.slt reg #simm12)', 1, 'slti rd, a, imm', setcc((c, d, x, y) => c.emit('slti', [d, x, R.imm(y as bigint)]))),
    ...rule('bool', '(icmp.sgt reg reg)', 1, 'slt rd, b, a', setcc((c, d, x, y) => c.emit('slt', [d, y as RegOp, x], { note: 'a > b ⟺ b < a: swap operands' }))),
    ...rule('bool', '(icmp.sle reg reg)', 2, 'slt t, b, a ; xori rd, t, 1', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('slt', [t0, y as RegOp, x], { note: 'a <= b ⟺ !(b < a)' });
      c.emit('xori', [d, R.use(t0), R.imm(1)], { note: 'invert the 0/1 result' });
    })),
    ...rule('bool', '(icmp.sge reg reg)', 2, 'slt t, a, b ; xori rd, t, 1', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('slt', [t0, x, y as RegOp], { note: 'a >= b ⟺ !(a < b)' });
      c.emit('xori', [d, R.use(t0), R.imm(1)], { note: 'invert the 0/1 result' });
    })),
    ...rule('bool', '(icmp.sge reg #simm12)', 2, 'slti t, a, imm ; xori rd, t, 1', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('slti', [t0, x, R.imm(y as bigint)]);
      c.emit('xori', [d, R.use(t0), R.imm(1)]);
    })),
    ...rule('bool', '(icmp.eq reg #zero)', 1, 'seqz rd, a', setcc((c, d, x) => c.emit('seqz', [d, x]))),
    ...rule('bool', '(icmp.ne reg #zero)', 1, 'snez rd, a', setcc((c, d, x) => c.emit('snez', [d, x]))),
    ...rule('bool', '(icmp.eq reg reg)', 2, 'xor t, a, b ; seqz rd, t', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('xor', [t0, x, y as RegOp], { note: 'a == b ⟺ (a ^ b) == 0' });
      c.emit('seqz', [d, R.use(t0)]);
    })),
    ...rule('bool', '(icmp.ne reg reg)', 2, 'xor t, a, b ; snez rd, t', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('xor', [t0, x, y as RegOp], { note: 'a != b ⟺ (a ^ b) != 0' });
      c.emit('snez', [d, R.use(t0)]);
    })),
    ...rule('bool', '(icmp.eq reg #nsimm12)', 2, 'addi t, a, -imm ; seqz rd, t', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('addi', [t0, x, R.imm(-(y as bigint))], { note: 'a == k ⟺ (a - k) == 0' });
      c.emit('seqz', [d, R.use(t0)]);
    })),
    ...rule('bool', '(icmp.ne reg #nsimm12)', 2, 'addi t, a, -imm ; snez rd, t', setcc((c, d, x, y) => {
      const t0 = tmp(c);
      c.emit('addi', [t0, x, R.imm(-(y as bigint))]);
      c.emit('snez', [d, R.use(t0)]);
    })),
    ...rule('reg', 'bool', 0, '(0/1 already in a register)', (_c, _n, b) => b[0]()),
    ...rule('reg', '(zext bool)', 0, '(i1 is already 0/1 in a 64-bit register)', (_c, _n, b) => b[0]()),
    ...rule('reg', '(zext reg)', 0, '(i1 is already 0/1 in a 64-bit register)', (_c, _n, b) => b[0]()),
    // Zicond select
    ...rule('reg', '(select reg reg reg)', ZIC, 'czero.eqz t1, a, c ; czero.nez t2, b, c ; or rd, t1, t2', (c, n, b) => {
      const [cc, x, y] = force(b);
      const t1 = tmp(c), t2 = tmp(c), d = c.dst(n);
      c.emit('czero.eqz', [t1, x, cc], { note: 't1 = c ? a : 0' });
      c.emit('czero.nez', [t2, y, cc], { note: 't2 = c ? 0 : b' });
      c.emit('or', [d, R.use(t1), R.use(t2)]);
      return R.use(d);
    }),
    // addressing: base register or stack object + 12-bit displacement
    ...rule('addr', 'reg', 0, 'imm(rs1)', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', 'frame', 0, 'off(sp)', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', '(add reg #simm12)', 0, 'imm(rs1)', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('addr', '(add frame #simm12)', 0, 'off+imm(sp)', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('reg', '(load addr)', 1, 'ld rd, imm(rs1)', (c, n, b) => { const a = b[0]() as Addr; const d = c.dst(n); c.emit('ld', [d, a]); return R.use(d); }),
    ...rule('stmt', '(store reg addr)', 1, 'sd rs2, imm(rs1)', (c, _n, b) => { const [v, a] = force(b); c.emit('sd', [v, a]); }),
    // branches: RISC-V compares two registers directly in the branch
    ...rule('stmt', '(condbr (icmp.eq reg reg))', 2, 'beq a, b, T ; j F', cmpBr('beq')),
    ...rule('stmt', '(condbr (icmp.ne reg reg))', 2, 'bne a, b, T ; j F', cmpBr('bne')),
    ...rule('stmt', '(condbr (icmp.slt reg reg))', 2, 'blt a, b, T ; j F', cmpBr('blt')),
    ...rule('stmt', '(condbr (icmp.sge reg reg))', 2, 'bge a, b, T ; j F', cmpBr('bge')),
    ...rule('stmt', '(condbr (icmp.sgt reg reg))', 2, 'blt b, a, T ; j F', cmpBr('blt', true)),
    ...rule('stmt', '(condbr (icmp.sle reg reg))', 2, 'bge b, a, T ; j F', cmpBr('bge', true)),
    ...rule('stmt', '(condbr reg)', 2, 'bnez c, T ; j F', (c, n, b) => {
      const [x] = force(b);
      c.emit('bne', [x, R.p(0), R.blk(n.targets![0])]);
      c.emit('j', [R.blk(n.targets![1])]);
    }),
  ].flat();
}

// ----------------------------------------------------------------- target

export class RiscV implements Target {
  name = 'rv64' as const;
  label = 'RISC-V RV64';
  regs = RV_REGS;
  sp = 2;
  fp = 8;
  ra = 1;
  zero = 0;
  argRegs = ARG_REGS;
  retReg = 10;
  wordAlign = 8;
  stackAlign = 16;
  commentChar = '#';
  nonterminals = ['reg', 'bool', 'addr', 'stmt'];
  rules: Rule[];
  constructor(public opts: TargetOptions = {}) {
    this.opts = { mExt: true, zba: false, zicond: false, framePointer: false, ...opts };
    this.rules = rvRules(this);
  }

  get allocOrder(): number[] {
    const order = [10, 11, 12, 13, 14, 15, 16, 17, 5, 6, 7, 28, 29, 30, 31, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
    if (!this.opts.framePointer) order.push(8);
    return this.opts.maxRegs ? order.slice(0, this.opts.maxRegs) : order;
  }

  opInfo(op: string) { return I[op]; }

  // ------------------------------------------------------------- legalization
  legalize(_m: Module, fn: Func, log: { msgs: string[] }) {
    for (const b of fn.blocks) {
      for (const i of [...b.instrs]) {
        if (this.opts.mExt === false && (i.op === 'mul' || i.op === 'sdiv' || i.op === 'srem')) {
          const sym = { mul: '__muldi3', sdiv: '__divdi3', srem: '__moddi3' }[i.op];
          toLibcall(fn, i, sym, `RV64I has no ${i.op} instruction without the M extension: expanded into a libcall to ${sym}`);
          log.msgs.push(`${i.op} → call @${sym} (no M extension: libcall)`);
        }
        if (i.op === 'select' && !this.opts.zicond) {
          // r = f ^ ((t ^ f) & -c)
          const [cnd, tv, fv] = i.args;
          const c64 = insertIR(fn, i, 'zext', [cnd], { note: 'select expansion: widen condition to 0/1' });
          const mask = insertIR(fn, i, 'sub', [k64(0), c64], { note: 'mask = -c: all ones if c, else 0' });
          const diff = insertIR(fn, i, 'xor', [tv, fv], { note: 't ^ f' });
          const sel = insertIR(fn, i, 'and', [diff, mask], { note: '(t ^ f) & mask' });
          i.op = 'xor';
          i.args = [fv, sel];
          i.note = 'select expanded branch-free: f ^ ((t ^ f) & -c) (RISC-V has no conditional move without Zicond)';
          log.msgs.push(`select ${i.name ?? i.id} → branch-free and/xor sequence (no cmov on base RISC-V)`);
        }
      }
    }
    void Const; void Instr;
  }

  // ------------------------------------------------------------- ABI
  lowerParams(f: MFunc, _entry: MBlock, params: number[], emit: (mi: MInstr) => void) {
    params.forEach((p, k) => {
      if (k < 8) emit(f.mi('COPY', [R.vd(p), R.p(ARG_REGS[k])], { tag: 'abi', note: `parameter #${k} arrives in ${ABI[ARG_REGS[k]]} (LP64 calling convention)` }));
      else {
        const fi = f.addFrameObject({ size: 8, align: 8, kind: 'incoming-arg', name: `arg${k}`, cfaOffset: 8 * (k - 8) });
        emit(f.mi('ld', [R.vd(p), R.mem(R.frame(fi), 0)], { tag: 'abi', note: `parameter #${k}: only 8 go in registers, the rest are on the caller's stack` }));
      }
    });
  }

  lowerCall(f: MFunc, sym: string, args: RegOp[], result: number | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    const uses: number[] = [];
    args.forEach((a, k) => {
      if (k >= 8) {
        emit(f.mi('sd', [a, R.mem(R.p(2), 8 * (k - 8))], { ...meta, tag: 'abi', note: `argument #${k} goes in the outgoing argument area at sp+${8 * (k - 8)}` }));
      }
    });
    args.forEach((a, k) => {
      if (k < 8) {
        emit(f.mi('COPY', [R.pd(ARG_REGS[k]), a], { ...meta, tag: 'abi', note: `argument #${k} is passed in ${ABI[ARG_REGS[k]]}` }));
        uses.push(ARG_REGS[k]);
      }
    });
    f.frame.maxOutgoingArgs = Math.max(f.frame.maxOutgoingArgs, Math.max(0, args.length - 8));
    emit(f.mi('call', [R.sym(sym, 'call')], { ...meta, implUses: uses, implDefs: [...CALLER_SAVED], note: `call ${sym}: clobbers all caller-saved registers (ra, t0–t6, a0–a7)` }));
    if (result !== undefined) emit(f.mi('COPY', [R.vd(result), R.p(10)], { ...meta, tag: 'abi', note: 'the return value comes back in a0' }));
  }

  lowerReturn(f: MFunc, v: RegOp | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    if (v) emit(f.mi('COPY', [R.pd(10), v], { ...meta, tag: 'abi', note: 'return value goes in a0' }));
    emit(f.mi('ret', [], { ...meta, implUses: v ? [10] : [] }));
  }

  jump(f: MFunc, target: MBlock) { return f.mi('j', [R.blk(target)]); }

  loadImm(f: MFunc, dst: RegOp, v: bigint, meta: Partial<MInstr>): MInstr[] {
    const n = rvMatInt(v).length;
    return [f.mi('li', [R.def(dst), R.imm(v)], { ...meta, note: meta.note ?? (n > 1 ? `constant needs ${n} instructions (${rvMatInt(v).map((s) => s.op).join(' + ')})` : undefined) })];
  }

  copy(f: MFunc, dst: RegOp, src: RegOp, meta: Partial<MInstr> = {}) {
    return f.mi('COPY', [R.def(dst), R.use(src)], { tag: 'copy', ...meta });
  }
  spillStore(f: MFunc, reg: RegOp, fi: number) {
    return f.mi('sd', [R.use(reg), R.mem(R.frame(fi), 0)], { tag: 'spill', note: 'spill: store the value to its stack slot' });
  }
  reload(f: MFunc, reg: RegOp, fi: number) {
    return f.mi('ld', [R.def(reg), R.mem(R.frame(fi), 0)], { tag: 'reload', note: 'reload the spilled value from its stack slot' });
  }

  retarget(mi: MInstr, from: MBlock, to: MBlock) {
    for (const o of mi.ops) if (o.k === 'block' && o.b === from) o.b = to;
  }
  invertBranch(mi: MInstr): boolean {
    const inv: Record<string, string> = { beq: 'bne', bne: 'beq', blt: 'bge', bge: 'blt', bltu: 'bgeu', bgeu: 'bltu' };
    if (!inv[mi.op]) return false;
    mi.op = inv[mi.op];
    return true;
  }

  // ------------------------------------------------------------- frame
  lowerFrame(f: MFunc) {
    const fr = f.frame;
    const usedRegs = new Set<number>();
    for (const b of f.blocks) for (const mi of b.instrs) for (const o of mi.ops) {
      if (o.k === 'preg' && o.def) usedRegs.add(o.r);
    }
    const saved = [...usedRegs].filter((r) => RV_REGS[r].calleeSaved && r !== 2).sort((a, b) => a - b);
    if (this.opts.framePointer && !saved.includes(8)) saved.unshift(8);
    const saveRA = fr.hasCalls;
    let dist = 0; // bytes below the CFA
    const place = (fi: number) => {
      const o = fr.objects[fi];
      dist = Math.ceil((dist + o.size) / o.align) * o.align;
      o.cfaOffset = -dist;
    };
    const saveSlots: { reg: number; fi: number }[] = [];
    if (saveRA) saveSlots.push({ reg: 1, fi: f.addFrameObject({ size: 8, align: 8, kind: 'ra', name: 'ra', reg: 1 }) });
    for (const r of saved) saveSlots.push({ reg: r, fi: f.addFrameObject({ size: 8, align: 8, kind: r === 8 && this.opts.framePointer ? 'fp' : 'callee-save', name: ABI[r], reg: r }) });
    for (const s of saveSlots) place(s.fi);
    for (const o of fr.objects) if (o.kind === 'local') place(o.fi);
    for (const o of fr.objects) if (o.kind === 'spill') place(o.fi);
    const outgoing = fr.maxOutgoingArgs * 8;
    const size = Math.ceil((dist + outgoing) / 16) * 16;
    fr.size = size;
    fr.savedRegs = saved;
    fr.usesFP = !!this.opts.framePointer;
    for (const o of fr.objects) {
      if (o.kind === 'incoming-arg') o.offset = size + (o.cfaOffset ?? 0);
      else o.offset = size + (o.cfaOffset ?? 0);
    }
    if (fr.maxOutgoingArgs) f.addFrameObject({ size: outgoing, align: 8, kind: 'outgoing', name: 'outgoing args', offset: 0, cfaOffset: -size });
    fr.laidOut = true;

    // resolve frame indices
    for (const b of f.blocks) for (const mi of b.instrs) {
      for (let k = 0; k < mi.ops.length; k++) {
        const o = mi.ops[k];
        if (o.k === 'mem' && o.base.k === 'frame') {
          const obj = fr.objects[o.base.fi];
          mi.ops[k] = { ...o, base: R.p(2), disp: o.disp + obj.offset! };
          if (!mi.note) mi.note = `stack slot '${obj.name}' is at sp+${obj.offset! + o.disp}`;
        } else if (o.k === 'frame') {
          const obj = fr.objects[o.fi];
          mi.ops[k] = R.p(2);
          const imm = mi.ops[k + 1];
          if (imm?.k === 'imm') mi.ops[k + 1] = R.imm(imm.v + BigInt(obj.offset!));
          mi.note = `address of '${obj.name}' = sp + ${obj.offset}`;
        }
      }
      for (const o of mi.ops) {
        const d = o.k === 'mem' ? o.disp : o.k === 'imm' && mi.op === 'addi' ? Number(o.v) : 0;
        if (d > 2047 || d < -2048) throw new Error(`frame of ${f.name} is too large (${size} bytes): offset ${d} does not fit in a 12-bit immediate. Real compilers use a scratch register here (LLVM's RegScavenger).`);
      }
    }
    if (size === 0) return;
    // prologue
    const entry = f.blocks[0];
    const pro: MInstr[] = [];
    const P = (op: string, ops: MOperand[], note: string) => pro.push(f.mi(op, ops, { tag: 'prologue', note }));
    if (size > 2048) throw new Error(`frame of ${f.name} is too large for this backend (${size} bytes)`);
    P('addi', [R.pd(2), R.p(2), R.imm(-size)], `allocate the ${size}-byte stack frame (sp stays 16-byte aligned)`);
    for (const s of saveSlots) {
      P('sd', [R.p(s.reg), R.mem(R.p(2), fr.objects[s.fi].offset!)], s.reg === 1 ? 'save the return address: this function makes calls, which overwrite ra' : `save callee-saved ${ABI[s.reg]}: we use it, so we must restore it for our caller`);
    }
    if (this.opts.framePointer) P('addi', [R.pd(8), R.p(2), R.imm(size)], 'frame pointer s0 = CFA (value of sp on entry): debuggers and unwinders walk this chain');
    entry.instrs.unshift(...pro);
    // epilogues
    for (const b of f.blocks) {
      const k = b.instrs.findIndex((mi) => mi.op === 'ret');
      if (k < 0) continue;
      const epi: MInstr[] = [];
      for (const s of saveSlots) epi.push(f.mi('ld', [R.pd(s.reg), R.mem(R.p(2), fr.objects[s.fi].offset!)], { tag: 'epilogue', note: `restore ${ABI[s.reg]}` }));
      epi.push(f.mi('addi', [R.pd(2), R.p(2), R.imm(size)], { tag: 'epilogue', note: 'deallocate the stack frame' }));
      b.instrs.splice(k, 0, ...epi);
    }
  }

  expandPostRA(f: MFunc) {
    for (const b of f.blocks) {
      b.instrs = b.instrs.filter((mi) => {
        if (mi.op !== 'COPY') return true;
        const [d, s] = mi.ops as RegOp[];
        if (d.k === 'preg' && s.k === 'preg' && d.r === s.r) return false;
        mi.op = 'mv';
        return true;
      });
    }
  }

  // ------------------------------------------------------------- peepholes
  peepholes: Peephole[] = rvPeepholes(this);

  sched = {
    issueWidth: 2,
    lat: (mi: MInstr) => I[mi.op]?.lat ?? 1,
    unit: (mi: MInstr) => {
      const c = I[mi.op]?.cls;
      return c === 'load' || c === 'store' ? 'mem' : c === 'mul' || c === 'div' ? 'muldiv' : c === 'branch' || c === 'jump' || c === 'call' || c === 'ret' ? 'branch' : 'alu';
    },
  };

  // ------------------------------------------------------------- printing
  blockLabel(f: MFunc, b: MBlock) { return blockLabelDefault(f, b); }
  asmPrologue(name: string) { return ['.text', `.globl ${name}`, '.p2align 2', `.type ${name},@function`]; }

  formatOperand(o: MOperand, f: MFunc): Tok[] {
    switch (o.k) {
      case 'vreg': return [vregTok(f, o.id)];
      case 'preg': return [regTok(this, o.r)];
      case 'imm': return [immTok(o.v, o.note)];
      case 'block': return [blockTok(f, this, o.b)];
      case 'sym': return [tok(o.name, 'sym', `s:${o.name}`, { kind: 'sym', name: o.name })];
      case 'frame': return [frameTok(f, o.fi)];
      case 'cc': return [tok(o.cc, 'kw')];
      case 'mem': {
        const base = o.base.k === 'frame' ? [frameTok(f, o.base.fi)] : this.formatOperand(o.base, f);
        return [immTok(BigInt(o.disp)), tok('(', 'punct'), ...base, tok(')', 'punct')];
      }
    }
  }

  formatInstr(mi: MInstr, f: MFunc): Tok[] {
    const ops = mi.ops;
    const F = (o: MOperand) => this.formatOperand(o, f);
    let name = mi.op;
    let shown: Tok[][] = ops.map(F);
    const isZero = (o: MOperand) => o.k === 'preg' && o.r === 0;
    if (mi.op === 'PHI') {
      const parts: Tok[][] = [F(ops[0])];
      for (let k = 1; k < ops.length; k += 2) parts.push([tok('[', 'punct'), ...F(ops[k]), tok(', ', 'punct'), ...F(ops[k + 1]), tok(']', 'punct')]);
      shown = parts;
    } else if ((mi.op === 'beq' || mi.op === 'bne' || mi.op === 'bge' || mi.op === 'blt') && isZero(ops[1])) {
      name = { beq: 'beqz', bne: 'bnez', bge: 'bgez', blt: 'bltz' }[mi.op]!;
      shown = [F(ops[0]), F(ops[2])];
    } else if ((mi.op === 'blt' || mi.op === 'bge') && isZero(ops[0])) {
      name = mi.op === 'blt' ? 'bgtz' : 'blez';
      shown = [F(ops[1]), F(ops[2])];
    } else if (mi.op === 'ret') shown = [];
    return [opTok(this, mi, name), ...(shown.length ? [tok(' ')] : []), ...joinOps(shown)];
  }
}

// ----------------------------------------------------------------- peepholes

const memEq = (a: MOperand, b: MOperand) =>
  a.k === 'mem' && b.k === 'mem' && isReg(a.base) && isReg(b.base) && sameReg(a.base, b.base) && a.disp === b.disp && !a.index && !b.index;

function rvPeepholes(t: RiscV): Peephole[] {
  return [
    {
      name: 'self-move', desc: 'mv x, x does nothing: delete it (left behind when coalescing gives both sides the same register)',
      apply(_f, b, k) {
        const mi = b.instrs[k];
        if ((mi.op === 'mv' || mi.op === 'COPY') && isReg(mi.ops[0]) && isReg(mi.ops[1]) && sameReg(mi.ops[0], mi.ops[1])) {
          b.instrs.splice(k, 1);
          return 'deleted a move from a register to itself';
        }
      },
    },
    {
      name: 'addi-zero', desc: 'addi x, x, 0 is a no-op',
      apply(_f, b, k) {
        const mi = b.instrs[k];
        if (mi.op === 'addi' && isReg(mi.ops[0]) && isReg(mi.ops[1]) && sameReg(mi.ops[0], mi.ops[1]) && mi.ops[2].k === 'imm' && mi.ops[2].v === 0n) {
          b.instrs.splice(k, 1);
          return 'deleted addi x, x, 0';
        }
      },
    },
    {
      name: 'store-load-forward', desc: 'a load right after a store to the same address can reuse the stored register',
      apply(f, b, k) {
        const st = b.instrs[k], ld = b.instrs[k + 1];
        if (!ld || st.op !== 'sd' || ld.op !== 'ld' || !memEq(st.ops[1], ld.ops[1])) return;
        const src = st.ops[0] as RegOp, dst = ld.ops[0] as RegOp;
        if (sameReg(src, dst)) {
          b.instrs.splice(k + 1, 1);
          return `deleted reload of ${t.regs[(dst as { r: number }).r]?.name}: the value is still in the register`;
        }
        b.instrs[k + 1] = f.mi('mv', [R.def(dst), R.use(src)], { ...ld, id: ld.id, op: 'mv', ops: [R.def(dst), R.use(src)], note: 'forwarded from the preceding store (was a load)' });
        return 'replaced a load by a register move (store-to-load forwarding)';
      },
    },
    {
      name: 'redundant-load', desc: 'two identical loads in a row with no store in between: the second is redundant',
      apply(_f, b, k) {
        const a = b.instrs[k], c = b.instrs[k + 1];
        if (!c || a.op !== 'ld' || c.op !== 'ld' || !memEq(a.ops[1], c.ops[1])) return;
        if (!sameReg(a.ops[0] as RegOp, c.ops[0] as RegOp)) return;
        const base = (a.ops[1] as MemOp).base as RegOp;
        if (sameReg(base, a.ops[0] as RegOp)) return;
        b.instrs.splice(k + 1, 1);
        return 'deleted a repeated load of the same slot into the same register';
      },
    },
    {
      name: 'jump-to-next', desc: 'j L where L is the next block in layout order: fall through instead',
      apply(_f, b, k, next) {
        const mi = b.instrs[k];
        if (mi.op === 'j' && next && mi.ops[0].k === 'block' && mi.ops[0].b === next && k === b.instrs.length - 1) {
          b.instrs.splice(k, 1);
          return `deleted 'j ${next.name}': it is the fall-through block`;
        }
      },
    },
    {
      name: 'branch-over-jump', desc: 'bcc L1; j L2; L1: …  →  b!cc L2 (invert the condition and fall through)',
      apply(_f, b, k, next) {
        const br = b.instrs[k], j = b.instrs[k + 1];
        if (!j || k + 2 !== b.instrs.length || j.op !== 'j' || I[br.op]?.cls !== 'branch') return;
        const tgt = br.ops.find((o) => o.k === 'block') as { k: 'block'; b: MBlock } | undefined;
        if (!tgt || tgt.b !== next) return;
        const other = (j.ops[0] as { b: MBlock }).b;
        if (!t.invertBranch(br)) return;
        tgt.b = other;
        b.instrs.splice(k + 1, 1);
        return `inverted the branch to ${br.op} → ${other.name} and fell through to ${next!.name}`;
      },
    },
  ];
}

export { firstTerminator };
