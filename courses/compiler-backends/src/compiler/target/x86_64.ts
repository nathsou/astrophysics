// x86-64 target, System V AMD64 ABI, Intel assembly syntax.
// Reference: Intel 64 and IA-32 Architectures Software Developer's Manual;
// System V Application Binary Interface, AMD64 Architecture Processor Supplement.

import type { Func, Module } from '../ir/ir';
import { force, rule, type INode, type Rule, type SelCtx, type Addr } from '../codegen/isel';
import { R, isReg, sameReg, type MBlock, type MFunc, type MInstr, type MOperand, type RegOp, type MemOp } from '../codegen/mir';
import { tok, type Tok } from '../listing';
import { blockTok, frameTok, immTok, joinOps, opTok, regTok, vregTok, PHI_COPY_INFO } from './common';
import type { OpInfo, Peephole, RegInfo, Target, TargetOptions } from './target';

const NAMES = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'];
const BYTE = ['al', 'cl', 'dl', 'bl', 'spl', 'bpl', 'sil', 'dil', 'r8b', 'r9b', 'r10b', 'r11b', 'r12b', 'r13b', 'r14b', 'r15b'];
const RAX = 0, RCX = 1, RDX = 2, RSP = 4, RBP = 5, FLAGS = 16;
const ARGS = [7, 6, 2, 1, 8, 9]; // rdi, rsi, rdx, rcx, r8, r9
const CALLEE = [3, 5, 12, 13, 14, 15];

const ROLE: Record<number, string> = {
  0: 'accumulator: return value; implicit operand of idiv/cqo (caller-saved)',
  1: 'counter: 4th argument; variable shift counts must be in cl (caller-saved)',
  2: 'data: 3rd argument; high half of the dividend/remainder for idiv (caller-saved)',
  3: 'base: callee-saved',
  4: 'stack pointer; must be 16-byte aligned at every call instruction',
  5: 'frame pointer (callee-saved)',
  6: 'source index: 2nd argument (caller-saved)',
  7: 'destination index: 1st argument (caller-saved)',
};

export const X64_REGS: RegInfo[] = [
  ...NAMES.map((name, i): RegInfo => ({
    name, arch: name,
    role: ROLE[i] ?? (i <= 9 ? `${i === 8 ? '5th' : '6th'} argument (caller-saved)` : i <= 11 ? 'temporary (caller-saved)' : 'callee-saved'),
    callerSaved: !CALLEE.includes(i) && i !== RSP, calleeSaved: CALLEE.includes(i), allocatable: i !== RSP && i !== RBP,
  })),
  { name: 'rflags', arch: 'rflags', role: 'status flags (ZF, SF, CF, OF, …): set by almost every ALU instruction, read by jcc/setcc/cmovcc', callerSaved: true, calleeSaved: false, allocatable: false },
];
const CALLER_SAVED = [0, 1, 2, 6, 7, 8, 9, 10, 11, FLAGS];
const CC: Record<string, string> = { eq: 'e', ne: 'ne', slt: 'l', sle: 'le', sgt: 'g', sge: 'ge' };
const INV_CC: Record<string, string> = { e: 'ne', ne: 'e', l: 'ge', ge: 'l', g: 'le', le: 'g' };

const alu = (d: string): OpInfo => ({ syntax: '', desc: d, cls: 'alu', lat: 1 });
const I: Record<string, OpInfo> = {
  ...PHI_COPY_INFO,
  mov: { syntax: 'mov r64, r64', desc: 'register copy', cls: 'move', lat: 1 },
  movri: { syntax: 'mov r64, imm32', desc: 'load a sign-extended 32-bit immediate (7-byte encoding: REX.W C7 /0 id)', cls: 'alu', lat: 1 },
  movabs: { syntax: 'movabs r64, imm64', desc: 'load a full 64-bit immediate (10-byte encoding: REX.W B8+r io) — the only x86 instruction with an 8-byte immediate', cls: 'alu', lat: 1 },
  load: { syntax: 'mov r64, qword ptr [m]', desc: 'load 64 bits from memory. Addressing: [base + index*scale + disp32] in a single instruction', cls: 'load', lat: 4 },
  store: { syntax: 'mov qword ptr [m], r64', desc: 'store 64 bits', cls: 'store', lat: 1 },
  storei: { syntax: 'mov qword ptr [m], imm32', desc: 'store a sign-extended 32-bit immediate', cls: 'store', lat: 1 },
  lea: { syntax: 'lea r64, [m]', desc: 'load effective address: computes base + index*scale + disp WITHOUT accessing memory. Compilers use it as a non-destructive three-operand add that does not touch the flags.', cls: 'alu', lat: 1 },
  add: { ...alu('dst += src (two-address: the destination is also a source) — sets flags'), syntax: 'add r64, r64' },
  addi: { ...alu('dst += imm32'), syntax: 'add r64, imm32' },
  addm: { syntax: 'add r64, qword ptr [m]', desc: 'dst += memory: CISC folds the load into the arithmetic instruction', cls: 'load', lat: 5 },
  sub: { ...alu('dst -= src'), syntax: 'sub r64, r64' },
  subi: { ...alu('dst -= imm32'), syntax: 'sub r64, imm32' },
  subm: { syntax: 'sub r64, qword ptr [m]', desc: 'dst -= memory', cls: 'load', lat: 5 },
  and: { ...alu('dst &= src'), syntax: 'and r64, r64' },
  andi: { ...alu('dst &= imm32'), syntax: 'and r64, imm32' },
  andm: { syntax: 'and r64, [m]', desc: 'dst &= memory', cls: 'load', lat: 5 },
  or: { ...alu('dst |= src'), syntax: 'or r64, r64' },
  ori: { ...alu('dst |= imm32'), syntax: 'or r64, imm32' },
  orm: { syntax: 'or r64, [m]', desc: 'dst |= memory', cls: 'load', lat: 5 },
  xor: { ...alu('dst ^= src. xor r, r is the idiomatic way to zero a register (short, breaks dependencies)'), syntax: 'xor r64, r64' },
  xori: { ...alu('dst ^= imm32'), syntax: 'xor r64, imm32' },
  xorm: { syntax: 'xor r64, [m]', desc: 'dst ^= memory', cls: 'load', lat: 5 },
  imul: { syntax: 'imul r64, r64', desc: 'dst *= src (signed multiply, low 64 bits)', cls: 'mul', lat: 3 },
  imul3: { syntax: 'imul r64, r/m64, imm32', desc: 'dst = src × imm: a genuine three-operand form, no tie needed', cls: 'mul', lat: 3 },
  imulm: { syntax: 'imul r64, qword ptr [m]', desc: 'dst *= memory', cls: 'mul', lat: 7 },
  neg: { ...alu('dst = -dst'), syntax: 'neg r64' },
  not: { ...alu('dst = ~dst (does not set flags)'), syntax: 'not r64' },
  shl: { ...alu('dst <<= imm8'), syntax: 'shl r64, imm8' },
  sar: { ...alu('dst >>= imm8 (arithmetic)'), syntax: 'sar r64, imm8' },
  shr: { ...alu('dst >>= imm8 (logical)'), syntax: 'shr r64, imm8' },
  shlcl: { ...alu('dst <<= cl: variable shift counts must be in cl, a fixed-register constraint the allocator must honour'), syntax: 'shl r64, cl' },
  sarcl: { ...alu('dst >>= cl (arithmetic)'), syntax: 'sar r64, cl' },
  shrcl: { ...alu('dst >>= cl (logical)'), syntax: 'shr r64, cl' },
  cqo: { syntax: 'cqo', desc: 'sign-extend rax into rdx:rax (128-bit dividend) before idiv', cls: 'alu', lat: 1 },
  idiv: { syntax: 'idiv r64', desc: 'signed divide rdx:rax by the operand: quotient → rax, remainder → rdx. Traps (#DE) on division by zero or overflow.', cls: 'div', lat: 40 },
  cmp: { ...alu('set flags from a - b'), syntax: 'cmp r64, r64' },
  cmpi: { ...alu('set flags from a - imm32'), syntax: 'cmp r64, imm32' },
  cmpm: { syntax: 'cmp r64, qword ptr [m]', desc: 'compare with memory', cls: 'load', lat: 5 },
  test: { ...alu('set flags from a & b; test r, r is the idiomatic compare-with-zero'), syntax: 'test r64, r64' },
  set: { ...alu('byte register = condition ? 1 : 0'), syntax: 'setcc r8' },
  movzx: { ...alu('zero-extend the byte produced by setcc to 64 bits'), syntax: 'movzx r64, r8' },
  cmov: { ...alu('dst = cond ? src : dst — conditional move (P6, 1995), the branch-free select'), syntax: 'cmovcc r64, r64' },
  jmp: { syntax: 'jmp label', desc: 'unconditional jump (rel8 or rel32)', cls: 'jump', lat: 1 },
  j: { syntax: 'jcc label', desc: 'conditional jump on the flags', cls: 'branch', lat: 1 },
  call: { syntax: 'call sym', desc: 'push the return address and jump; clobbers rax, rcx, rdx, rsi, rdi, r8–r11 and the flags', cls: 'call', lat: 1 },
  ret: { syntax: 'ret', desc: 'pop the return address and jump to it', cls: 'ret', lat: 1 },
  push: { syntax: 'push r64', desc: 'rsp -= 8; [rsp] = r', cls: 'store', lat: 1 },
  pop: { syntax: 'pop r64', desc: 'r = [rsp]; rsp += 8', cls: 'load', lat: 3 },
  subrsp: { syntax: 'sub rsp, imm32', desc: 'allocate stack space', cls: 'alu', lat: 1 },
  addrsp: { syntax: 'add rsp, imm32', desc: 'free stack space', cls: 'alu', lat: 1 },
};

const DISPLAY: Record<string, string> = {
  movri: 'mov', load: 'mov', store: 'mov', storei: 'mov', addi: 'add', addm: 'add', subi: 'sub', subm: 'sub', andi: 'and', andm: 'and',
  ori: 'or', orm: 'or', xori: 'xor', xorm: 'xor', imul3: 'imul', imulm: 'imul', shlcl: 'shl', sarcl: 'sar', shrcl: 'shr', cmpi: 'cmp', cmpm: 'cmp',
  subrsp: 'sub', addrsp: 'add',
};

// ---------------------------------------------------------------- rules

type B = (() => any)[];
const FL = { implDefs: [FLAGS] };

/** two-address: d = copy x; op d, y */
const two = (op: string) => (c: SelCtx, n: INode, b: B) => {
  const [x, y] = force(b);
  const d = c.dst(n);
  c.push(c.t.copy(c.f, d, x, { ...c.meta, note: 'x86 is two-address: copy the left operand into the destination first (coalescing usually removes this)' }));
  c.emit(op, [R.defuse(d), typeof y === 'bigint' ? R.imm(y) : y], FL);
  return R.use(d);
};

function x64Rules(): Rule[] {
  const cmpOps = (c: SelCtx, x: RegOp, y: RegOp | bigint | MemOp, pred: string) => {
    if (typeof y === 'bigint') {
      if (y === 0n && (pred === 'eq' || pred === 'ne')) c.emit('test', [x, R.use(x)], FL);
      else c.emit('cmpi', [x, R.imm(y)], FL);
    } else if (y.k === 'mem') c.emit('cmpm', [x, y], FL);
    else c.emit('cmp', [x, y], FL);
    return CC[pred];
  };
  const preds = ['eq', 'ne', 'slt', 'sle', 'sgt', 'sge'];
  const memFold = (irop: string, op: string) => rule('reg', `(${irop} reg (load addr))`, 1.5, `mov d, a ; ${DISPLAY[op] ?? op} d, [m]`, (c, n, b) => {
    const x = b[0](), m = b[1]();
    const d = c.dst(n);
    c.push(c.t.copy(c.f, d, x, c.meta));
    c.emit(op, [R.defuse(d), m], { ...FL, note: 'load folded into the arithmetic instruction (memory operand)' });
    return R.use(d);
  });
  return [
    ...rule('reg', '#zero', 0.5, 'xor r, r', (c, n) => { const d = c.dst(n); c.emit('xor', [R.def(d), R.use(d)], { ...FL, note: 'zeroing idiom: shorter than mov r, 0' }); return R.use(d); }),
    ...rule('reg', '#simm32', 1, 'mov r, imm32', (c, n, b) => c.li(c.dst(n), b[0]())),
    ...rule('reg', '#any', 2, 'movabs r, imm64', (c, n, b) => c.li(c.dst(n), b[0]())),
    // addressing modes: base + index*scale + disp32
    ...rule('addr', 'reg', 0, '[r]', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', 'frame', 0, '[rsp + off]', (_c, _n, b) => R.mem(b[0](), 0)),
    ...rule('addr', 'gaddr', 0, '[rip + sym]', (_c, _n, b) => R.mem(R.sym(b[0](), 'rip'), 0)),
    ...rule('addr', '(add reg #simm32)', 0, '[r + disp]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('addr', '(add frame #simm32)', 0, '[rsp + off + disp]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, Number(y)); }),
    ...rule('addr', '(add reg reg)', 0, '[r + r]', (_c, _n, b) => { const [x, y] = force(b); return R.mem(x, 0, y, 1); }),
    ...rule('addr', '(add reg (shl reg #scale))', 0, '[r + r*s]', (_c, _n, b) => { const [x, y, s] = force(b); return R.mem(x, 0, y, 1 << Number(s)); }, { commute: true }),
    ...rule('addr', '(add frame (shl reg #scale))', 0, '[rsp + off + r*s]', (_c, _n, b) => { const [x, y, s] = force(b); return R.mem(x, 0, y, 1 << Number(s)); }, { commute: true }),
    ...rule('addr', '(add (add reg (shl reg #scale)) #simm32)', 0, '[r + r*s + disp]', (_c, _n, b) => { const [x, y, s, d] = force(b); return R.mem(x, Number(d), y, 1 << Number(s)); }),
    ...rule('reg', 'addr', 1, 'lea r, [addr]', (c, n, b) => { const d = c.dst(n); c.emit('lea', [d, b[0]()]); return R.use(d); }),
    ...rule('reg', '(load addr)', 1, 'mov r, qword ptr [addr]', (c, n, b) => { const d = c.dst(n); c.emit('load', [d, b[0]()]); return R.use(d); }),
    ...rule('stmt', '(store reg addr)', 1, 'mov qword ptr [addr], r', (c, _n, b) => { const [v, a] = force(b); c.emit('store', [a, v]); }),
    ...rule('stmt', '(store #simm32 addr)', 1, 'mov qword ptr [addr], imm32', (c, _n, b) => { const [v, a] = force(b); c.emit('storei', [a, R.imm(v)]); }),
    // arithmetic
    ...rule('reg', '(add reg reg)', 1, 'lea d, [a + b]', (c, n, b) => { const [x, y] = force(b); const d = c.dst(n); c.emit('lea', [d, R.mem(x, 0, y, 1)], { note: 'lea as a non-destructive three-operand add' }); return R.use(d); }),
    ...rule('reg', '(add reg #simm32)', 1, 'lea d, [a + imm]', (c, n, b) => { const [x, y] = force(b); const d = c.dst(n); c.emit('lea', [d, R.mem(x, Number(y))]); return R.use(d); }),
    ...memFold('add', 'addm'),
    ...rule('reg', '(sub reg reg)', 2, 'mov d, a ; sub d, b', two('sub')),
    ...rule('reg', '(sub reg #simm32)', 2, 'mov d, a ; sub d, imm', two('subi')),
    ...memFold('sub', 'subm'),
    ...rule('reg', '(sub #zero reg)', 2, 'mov d, a ; neg d', (c, n, b) => { const x = b[1](); const d = c.dst(n); c.push(c.t.copy(c.f, d, x, c.meta)); c.emit('neg', [R.defuse(d)], FL); return R.use(d); }),
    ...rule('reg', '(and reg reg)', 2, 'mov d, a ; and d, b', two('and')),
    ...rule('reg', '(and reg #simm32)', 2, 'mov d, a ; and d, imm', two('andi')),
    ...memFold('and', 'andm'),
    ...rule('reg', '(or reg reg)', 2, 'mov d, a ; or d, b', two('or')),
    ...rule('reg', '(or reg #simm32)', 2, 'mov d, a ; or d, imm', two('ori')),
    ...memFold('or', 'orm'),
    ...rule('reg', '(xor reg reg)', 2, 'mov d, a ; xor d, b', two('xor')),
    ...rule('reg', '(xor reg #simm32)', 2, 'mov d, a ; xor d, imm', two('xori')),
    ...rule('reg', '(xor reg #m1)', 2, 'mov d, a ; not d', (c, n, b) => { const x = b[0](); const d = c.dst(n); c.push(c.t.copy(c.f, d, x, c.meta)); c.emit('not', [R.defuse(d)]); return R.use(d); }),
    ...memFold('xor', 'xorm'),
    ...rule('reg', '(mul reg reg)', 2, 'mov d, a ; imul d, b', two('imul')),
    ...rule('reg', '(mul reg #simm32)', 1, 'imul d, a, imm', (c, n, b) => { const [x, y] = force(b); const d = c.dst(n); c.emit('imul3', [d, x, R.imm(y)], FL); return R.use(d); }),
    ...memFold('mul', 'imulm'),
    ...rule('reg', '(shl reg #uimm6)', 2, 'mov d, a ; shl d, imm', two('shl')),
    ...rule('reg', '(ashr reg #uimm6)', 2, 'mov d, a ; sar d, imm', two('sar')),
    ...rule('reg', '(lshr reg #uimm6)', 2, 'mov d, a ; shr d, imm', two('shr')),
    ...(['shl', 'ashr', 'lshr'] as const).flatMap((irop) => rule('reg', `(${irop} reg reg)`, 3, `mov rcx, b ; mov d, a ; ${{ shl: 'shl', ashr: 'sar', lshr: 'shr' }[irop]} d, cl`, (c, n, b) => {
      const [x, y] = force(b);
      const d = c.dst(n);
      c.push(c.t.copy(c.f, R.pd(RCX), y, { ...c.meta, note: 'variable shift count must be in cl' }));
      c.push(c.t.copy(c.f, d, x, c.meta));
      c.emit(`${{ shl: 'shl', ashr: 'sar', lshr: 'shr' }[irop]}cl`, [R.defuse(d)], { implUses: [RCX], implDefs: [FLAGS] });
      return R.use(d);
    })),
    ...(['sdiv', 'srem'] as const).flatMap((irop) => rule('reg', `(${irop} reg reg)`, 4, `mov rax, a ; cqo ; idiv b ; mov d, ${irop === 'sdiv' ? 'rax' : 'rdx'}`, (c, n, b) => {
      const [x, y] = force(b);
      const d = c.dst(n);
      c.push(c.t.copy(c.f, R.pd(RAX), x, { ...c.meta, note: 'the dividend must be in rax' }));
      c.emit('cqo', [], { implUses: [RAX], implDefs: [RDX], note: 'sign-extend rax into rdx:rax' });
      c.emit('idiv', [y], { implUses: [RAX, RDX], implDefs: [RAX, RDX, FLAGS], note: 'quotient → rax, remainder → rdx' });
      c.push(c.t.copy(c.f, d, R.p(irop === 'sdiv' ? RAX : RDX), { ...c.meta, note: irop === 'sdiv' ? 'quotient from rax' : 'remainder from rdx' }));
      return R.use(d);
    })),
    // compares: the cc nonterminal carries the condition code in the flags
    ...preds.flatMap((p) => [
      ...rule('cc', `(icmp.${p} reg reg)`, 1, `cmp a, b → ${CC[p]}`, (c, _n, b) => { const [x, y] = force(b); return cmpOps(c, x, y, p); }),
      ...rule('cc', `(icmp.${p} reg #simm32)`, 1, `cmp a, imm → ${CC[p]}`, (c, _n, b) => { const [x, y] = force(b); return cmpOps(c, x, y, p); }),
      ...rule('cc', `(icmp.${p} reg (load addr))`, 1, `cmp a, [m] → ${CC[p]}`, (c, _n, b) => { const [x, y] = force(b); return cmpOps(c, x, y, p); }),
    ]),
    ...rule('cc', 'reg', 1, 'test r, r → ne', (c, _n, b) => { const x = b[0](); c.emit('test', [x, R.use(x)], FL); return 'ne'; }),
    ...rule('reg', 'cc', 2, 'setcc t8 ; movzx d, t8', (c, n, b) => {
      const cc = b[0]();
      const t = c.fresh(), d = c.dst(n);
      c.emit('set', [R.cc(cc), t], { implUses: [FLAGS] });
      c.emit('movzx', [d, R.use(t)]);
      return R.use(d);
    }),
    ...rule('reg', '(zext cc)', 2, 'setcc t8 ; movzx d, t8', (c, n, b) => {
      const cc = b[0]();
      const t = c.fresh(), d = c.dst(n);
      c.emit('set', [R.cc(cc), t], { implUses: [FLAGS] });
      c.emit('movzx', [d, R.use(t)]);
      return R.use(d);
    }),
    ...rule('reg', '(zext reg)', 0, '(i1 already 0/1)', (_c, _n, b) => b[0]()),
    ...rule('reg', '(select cc reg reg)', 2, 'mov d, f ; cmp … ; cmovcc d, t', (c, n, b) => {
      const x = b[1](), y = b[2]();
      const d = c.dst(n);
      c.push(c.t.copy(c.f, d, y, c.meta));
      const cc = b[0]();
      c.emit('cmov', [R.cc(cc), R.defuse(d), x], { implUses: [FLAGS] });
      return R.use(d);
    }),
    ...rule('stmt', '(condbr cc)', 2, 'jcc T ; jmp F', (c, n, b) => {
      const cc = b[0]();
      c.emit('j', [R.cc(cc), R.blk(n.targets![0])], { implUses: [FLAGS] });
      c.emit('jmp', [R.blk(n.targets![1])]);
    }),
  ].flat();
}

// ---------------------------------------------------------------- target

export class X86_64 implements Target {
  name = 'x86_64' as const;
  label = 'x86-64';
  regs = X64_REGS;
  sp = RSP;
  fp = RBP;
  flags = FLAGS;
  argRegs = ARGS;
  retReg = RAX;
  pinnedRegs = [RAX, RCX, RDX];
  wordAlign = 8;
  stackAlign = 16;
  commentChar = '#';
  nonterminals = ['reg', 'cc', 'addr', 'stmt'];
  rules = x64Rules();
  constructor(public opts: TargetOptions = {}) {}

  get allocOrder() {
    const o = [0, 1, 2, 6, 7, 8, 9, 10, 11, 3, 12, 13, 14, 15];
    return this.opts.maxRegs ? o.slice(0, this.opts.maxRegs) : o;
  }
  opInfo(op: string) { return I[op]; }
  legalize(_m: Module, _fn: Func, _log: { msgs: string[] }) {}

  lowerParams(f: MFunc, _e: MBlock, params: number[], emit: (mi: MInstr) => void) {
    params.forEach((p, k) => {
      if (k < 6) emit(f.mi('COPY', [R.vd(p), R.p(ARGS[k])], { tag: 'abi', note: `parameter #${k} arrives in ${NAMES[ARGS[k]]} (System V AMD64)` }));
      else {
        const fi = f.addFrameObject({ size: 8, align: 8, kind: 'incoming-arg', name: `arg${k}`, cfaOffset: 8 * (k - 6) });
        emit(f.mi('load', [R.vd(p), R.mem(R.frame(fi), 0)], { tag: 'abi', note: `parameter #${k} is on the stack above the return address` }));
      }
    });
  }
  lowerCall(f: MFunc, sym: string, args: RegOp[], result: number | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    args.forEach((a, k) => { if (k >= 6) emit(f.mi('store', [R.mem(R.p(RSP), 8 * (k - 6)), a], { ...meta, tag: 'abi', note: `argument #${k} goes on the stack at [rsp + ${8 * (k - 6)}]` })); });
    const uses: number[] = [];
    args.forEach((a, k) => { if (k < 6) { emit(f.mi('COPY', [R.pd(ARGS[k]), a], { ...meta, tag: 'abi', note: `argument #${k} in ${NAMES[ARGS[k]]}` })); uses.push(ARGS[k]); } });
    f.frame.maxOutgoingArgs = Math.max(f.frame.maxOutgoingArgs, Math.max(0, args.length - 6));
    emit(f.mi('call', [R.sym(sym, 'call')], { ...meta, implUses: uses, implDefs: [...CALLER_SAVED], note: `call ${sym}: caller-saved registers and flags are clobbered` }));
    if (result !== undefined) emit(f.mi('COPY', [R.vd(result), R.p(RAX)], { ...meta, tag: 'abi', note: 'result in rax' }));
  }
  lowerReturn(f: MFunc, v: RegOp | undefined, emit: (mi: MInstr) => void, meta: Partial<MInstr>) {
    if (v) emit(f.mi('COPY', [R.pd(RAX), v], { ...meta, tag: 'abi', note: 'return value in rax' }));
    emit(f.mi('ret', [], { ...meta, implUses: v ? [RAX] : [] }));
  }
  jump(f: MFunc, t: MBlock) { return f.mi('jmp', [R.blk(t)]); }
  loadImm(f: MFunc, dst: RegOp, v: bigint, meta: Partial<MInstr>): MInstr[] {
    const small = v >= -(1n << 31n) && v < 1n << 31n;
    return [f.mi(small ? 'movri' : 'movabs', [R.def(dst), R.imm(v)], { ...meta, note: meta.note ?? (small ? undefined : 'constant does not fit in a sign-extended imm32: needs the 10-byte movabs') })];
  }
  copy(f: MFunc, dst: RegOp, src: RegOp, meta: Partial<MInstr> = {}) { return f.mi('COPY', [R.def(dst), R.use(src)], { tag: 'copy', ...meta }); }
  spillStore(f: MFunc, reg: RegOp, fi: number) { return f.mi('store', [R.mem(R.frame(fi), 0), R.use(reg)], { tag: 'spill' }); }
  reload(f: MFunc, reg: RegOp, fi: number) { return f.mi('load', [R.def(reg), R.mem(R.frame(fi), 0)], { tag: 'reload' }); }
  retarget(mi: MInstr, from: MBlock, to: MBlock) { for (const o of mi.ops) if (o.k === 'block' && o.b === from) o.b = to; }
  invertBranch(mi: MInstr) {
    if (mi.op !== 'j') return false;
    const c = mi.ops[0] as { cc: string };
    c.cc = INV_CC[c.cc];
    return true;
  }

  lowerFrame(f: MFunc) {
    const fr = f.frame;
    const used = new Set<number>();
    for (const b of f.blocks) for (const mi of b.instrs) for (const o of mi.ops) if (o.k === 'preg' && o.def) used.add(o.r);
    const saved = [...used].filter((r) => CALLEE.includes(r) && r !== RBP).sort((a, b) => a - b);
    const locals = fr.objects.filter((o) => o.kind === 'local' || o.kind === 'spill');
    const needFrame = fr.hasCalls || locals.length > 0 || saved.length > 0 || fr.objects.some((o) => o.kind === 'incoming-arg');
    // distance below the CFA: return address (8) + saved rbp (8) + pushed callee-saves
    let dist = needFrame ? 16 + 8 * saved.length : 8;
    const pushed = dist;
    for (const o of locals) { dist = Math.ceil((dist + o.size) / o.align) * o.align; o.cfaOffset = -dist; }
    let size = dist + fr.maxOutgoingArgs * 8;
    size = Math.ceil(size / 16) * 16; // rsp must be 16-byte aligned at calls: CFA is 16-aligned
    const alloc = size - pushed;
    fr.size = size;
    fr.savedRegs = saved;
    fr.usesFP = needFrame;
    for (const o of fr.objects) o.offset = size + (o.cfaOffset ?? 0) - 0; // rsp-relative
    // the CFA is rsp_at_call + 8 (the return address); incoming args sit right above it
    for (const o of fr.objects) if (o.kind === 'incoming-arg') o.offset = size + (o.cfaOffset ?? 0);
    fr.laidOut = true;
    if (needFrame) {
      f.addFrameObject({ size: 8, align: 8, kind: 'ra', name: 'return address', offset: size - 8, cfaOffset: -8 });
      f.addFrameObject({ size: 8, align: 8, kind: 'fp', name: 'saved rbp', offset: size - 16, cfaOffset: -16, reg: RBP });
      saved.forEach((r, k) => f.addFrameObject({ size: 8, align: 8, kind: 'callee-save', name: NAMES[r], offset: size - 24 - 8 * k, cfaOffset: -24 - 8 * k, reg: r }));
    }
    for (const b of f.blocks) for (const mi of b.instrs) {
      mi.ops.forEach((o, k) => {
        if (o.k === 'mem' && o.base.k === 'frame') {
          const obj = fr.objects[o.base.fi];
          mi.ops[k] = { ...o, base: R.p(RSP), disp: o.disp + obj.offset! };
        }
      });
    }
    if (!needFrame) return;
    const P = (op: string, ops: MOperand[], note: string, extra: Partial<MInstr> = {}) => f.mi(op, ops, { tag: 'prologue', note, ...extra });
    const pro: MInstr[] = [
      P('push', [R.p(RBP)], 'save the caller\'s frame pointer'),
      P('mov', [R.pd(RBP), R.p(RSP)], 'rbp = frame base: debuggers walk the rbp chain'),
      ...saved.map((r) => P('push', [R.p(r)], `save callee-saved ${NAMES[r]}`)),
    ];
    if (alloc) pro.push(P('subrsp', [R.pd(RSP), R.imm(alloc)], `reserve ${alloc} bytes; keeps rsp 16-byte aligned at calls`, { implDefs: [FLAGS] }));
    f.blocks[0].instrs.unshift(...pro);
    for (const b of f.blocks) {
      const k = b.instrs.findIndex((mi) => mi.op === 'ret');
      if (k < 0) continue;
      const epi: MInstr[] = [];
      if (alloc) epi.push(f.mi('addrsp', [R.pd(RSP), R.imm(alloc)], { tag: 'epilogue', note: 'free the locals', implDefs: [FLAGS] }));
      for (const r of [...saved].reverse()) epi.push(f.mi('pop', [R.pd(r)], { tag: 'epilogue', note: `restore ${NAMES[r]}` }));
      epi.push(f.mi('pop', [R.pd(RBP)], { tag: 'epilogue', note: 'restore the caller\'s frame pointer' }));
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

  peepholes: Peephole[] = x64Peepholes(this);
  sched = {
    issueWidth: 2,
    lat: (mi: MInstr) => I[mi.op]?.lat ?? 1,
    unit: (mi: MInstr) => {
      const c = I[mi.op]?.cls;
      return c === 'load' || c === 'store' ? 'mem' : c === 'mul' || c === 'div' ? 'muldiv' : c === 'branch' || c === 'jump' || c === 'call' || c === 'ret' ? 'branch' : 'alu';
    },
  };

  blockLabel(f: MFunc, b: MBlock) { return `.L${f.name}_${b.name.replace(/[^A-Za-z0-9_]/g, '_')}`; }
  asmPrologue(name: string) { return ['.intel_syntax noprefix', '.text', `.globl ${name}`, '.p2align 4', `.type ${name},@function`]; }

  formatOperand(o: MOperand, f: MFunc): Tok[] {
    switch (o.k) {
      case 'vreg': return [vregTok(f, o.id)];
      case 'preg': return [regTok(this, o.r)];
      case 'imm': return [immTok(o.v, o.note)];
      case 'block': return [blockTok(f, this, o.b)];
      case 'cc': return [tok(o.cc, 'kw')];
      case 'frame': return [frameTok(f, o.fi)];
      case 'sym': return [tok(o.name, 'sym', `s:${o.name}`, { kind: 'sym', name: o.name })];
      case 'mem': {
        const parts: Tok[] = [tok('qword ptr [', 'punct')];
        if (o.base.k === 'frame') parts.push(frameTok(f, o.base.fi));
        else if (o.base.k === 'sym') parts.push(tok('rip + ', 'punct'), tok(o.base.name, 'sym', `s:${o.base.name}`, { kind: 'sym', name: o.base.name }));
        else parts.push(...this.formatOperand(o.base, f));
        if (o.index) parts.push(tok(' + ', 'punct'), ...this.formatOperand(o.index, f), ...(o.scale && o.scale > 1 ? [tok(`*${o.scale}`, 'punct')] : []));
        if (o.disp) parts.push(tok(o.disp < 0 ? ' - ' : ' + ', 'punct'), immTok(BigInt(Math.abs(o.disp))));
        parts.push(tok(']', 'punct'));
        return parts;
      }
    }
  }

  formatInstr(mi: MInstr, f: MFunc): Tok[] {
    const F = (o: MOperand) => this.formatOperand(o, f);
    const ops = mi.ops;
    let name = DISPLAY[mi.op] ?? mi.op;
    let parts: Tok[][];
    const byteReg = (o: MOperand): Tok[] => (o.k === 'preg' ? [tok(BYTE[o.r], 'preg', `r:${this.name}:${o.r}`, { kind: 'reg', target: this.name, reg: o.r })] : [...F(o), tok('.b', 'punct')]);
    const noPtr = (t: Tok[]) => t.map((x, i) => (i === 0 && x.t === 'qword ptr [' ? { ...x, t: '[' } : x));
    switch (mi.op) {
      case 'PHI':
        parts = [F(ops[0])];
        for (let k = 1; k < ops.length; k += 2) parts.push([tok('[', 'punct'), ...F(ops[k]), tok(', ', 'punct'), ...F(ops[k + 1]), tok(']', 'punct')]);
        break;
      case 'lea': parts = [F(ops[0]), noPtr(F(ops[1]))]; break;
      case 'set': name = `set${(ops[0] as { cc: string }).cc}`; parts = [byteReg(ops[1])]; break;
      case 'movzx': parts = [F(ops[0]), byteReg(ops[1])]; break;
      case 'cmov': name = `cmov${(ops[0] as { cc: string }).cc}`; parts = [F(ops[1]), F(ops[2])]; break;
      case 'j': name = `j${(ops[0] as { cc: string }).cc}`; parts = [F(ops[1])]; break;
      case 'shlcl': case 'sarcl': case 'shrcl': parts = [F(ops[0]), [tok('cl', 'preg', `r:${this.name}:1`, { kind: 'reg', target: this.name, reg: 1 })]]; break;
      case 'ret': case 'cqo': parts = []; break;
      default: parts = ops.map(F);
    }
    return [opTok(this, mi, name), ...(parts.length ? [tok(' ')] : []), ...joinOps(parts)];
  }
}

const memEq = (a: MOperand, b: MOperand) =>
  a.k === 'mem' && b.k === 'mem' && isReg(a.base) && isReg(b.base) && sameReg(a.base, b.base) && a.disp === b.disp && !a.index && !b.index;

function x64Peepholes(t: X86_64): Peephole[] {
  return [
    {
      name: 'self-move', desc: 'mov r, r does nothing',
      apply(_f, b, k) {
        const mi = b.instrs[k];
        if (mi.op === 'mov' && isReg(mi.ops[0]) && isReg(mi.ops[1]) && sameReg(mi.ops[0], mi.ops[1])) { b.instrs.splice(k, 1); return 'deleted mov r, r'; }
      },
    },
    {
      name: 'store-load-forward', desc: 'reload right after a store to the same slot → register move',
      apply(f, b, k) {
        const st = b.instrs[k], ld = b.instrs[k + 1];
        if (!ld || st.op !== 'store' || ld.op !== 'load' || !memEq(st.ops[0], ld.ops[1])) return;
        const src = st.ops[1] as RegOp, dst = ld.ops[0] as RegOp;
        if (sameReg(src, dst)) { b.instrs.splice(k + 1, 1); return 'deleted a reload of a value still in its register'; }
        b.instrs[k + 1] = f.mi('mov', [R.def(dst), R.use(src)], { note: 'forwarded from the preceding store' });
        return 'replaced a load by a register move';
      },
    },
    {
      name: 'mov-zero', desc: 'mov r, 0 → xor r, r (shorter), only when the flags are dead',
      apply(_f, b, k) {
        const mi = b.instrs[k];
        if (mi.op !== 'movri' || (mi.ops[1] as { v: bigint }).v !== 0n) return;
        // flags must not be live: scan forward for a reader before a writer
        for (let j = k + 1; j < b.instrs.length; j++) {
          const x = b.instrs[j];
          if (x.implUses?.includes(FLAGS)) return;
          if (x.implDefs?.includes(FLAGS)) break;
          if (j === b.instrs.length - 1) return; // flags may be live out
        }
        const r = mi.ops[0] as RegOp;
        mi.op = 'xor';
        mi.ops = [R.def(r), R.use(r)];
        mi.implDefs = [FLAGS];
        return 'mov r, 0 → xor r, r';
      },
    },
    {
      name: 'jump-to-next', desc: 'jmp L where L is the next block: fall through',
      apply(_f, b, k, next) {
        const mi = b.instrs[k];
        if (mi.op === 'jmp' && next && k === b.instrs.length - 1 && (mi.ops[0] as { b: MBlock }).b === next) { b.instrs.splice(k, 1); return `deleted 'jmp ${next.name}'`; }
      },
    },
    {
      name: 'branch-over-jump', desc: 'jcc L1; jmp L2; L1:  →  j!cc L2',
      apply(_f, b, k, next) {
        const br = b.instrs[k], j = b.instrs[k + 1];
        if (!j || k + 2 !== b.instrs.length || j.op !== 'jmp' || br.op !== 'j') return;
        const tgt = br.ops[1] as { b: MBlock };
        if (tgt.b !== next) return;
        const other = (j.ops[0] as { b: MBlock }).b;
        t.invertBranch(br);
        tgt.b = other;
        b.instrs.splice(k + 1, 1);
        return `inverted the branch to ${other.name} and fell through`;
      },
    },
  ];
}

export type { Addr };
