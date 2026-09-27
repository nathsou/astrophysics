// RISC-V assembler core: pseudo-instruction expansion, layout with branch
// relaxation, binary encoding, relocations; plus a text front-end (used for
// the runtime library) and a disassembler (used by the emulator views).

import type { EncField, ListingEntry, ObjectCode, Reloc, Section, SymDef } from './objcode';
import { rvMatInt } from '../target/riscv';

export const RV_ABI = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];

export type AOperand =
  | { k: 'reg'; r: number }
  | { k: 'imm'; v: bigint }
  | { k: 'label'; name: string }
  | { k: 'mem'; base: number; disp: bigint }
  | { k: 'rel'; mod: 'pcrel_hi' | 'pcrel_lo'; sym: string };

export interface AsmInstr {
  op: string;
  ops: AOperand[];
  mi?: number;
  note?: string;
}

export type AsmItem =
  | { k: 'section'; name: string }
  | { k: 'label'; name: string; global?: boolean; kind?: 'func' | 'object'; fnEnd?: string }
  | { k: 'instr'; ins: AsmInstr; fn?: string }
  | { k: 'align'; pow: number }
  | { k: 'data'; bytes: number[]; text: string }
  | { k: 'zero'; n: number }
  | { k: 'size'; name: string };

export const R_RISCV: Record<string, number> = {
  R_RISCV_64: 2, R_RISCV_BRANCH: 16, R_RISCV_JAL: 17, R_RISCV_CALL_PLT: 19,
  R_RISCV_PCREL_HI20: 23, R_RISCV_PCREL_LO12_I: 24, R_RISCV_PCREL_LO12_S: 25, R_RISCV_RELAX: 51,
};

// ---------------------------------------------------------------- encoding

const OP = { LUI: 0x37, AUIPC: 0x17, JAL: 0x6f, JALR: 0x67, BRANCH: 0x63, LOAD: 0x03, STORE: 0x23, OPIMM: 0x13, OPIMM32: 0x1b, OP: 0x33, OP32: 0x3b, SYSTEM: 0x73 };

interface RDesc { f: 'R' | 'I' | 'S' | 'B' | 'U' | 'J' | 'Ish' | 'SYS'; opc: number; f3?: number; f7?: number }
export const RV_ENC: Record<string, RDesc> = {
  lui: { f: 'U', opc: OP.LUI }, auipc: { f: 'U', opc: OP.AUIPC }, jal: { f: 'J', opc: OP.JAL }, jalr: { f: 'I', opc: OP.JALR, f3: 0 },
  beq: { f: 'B', opc: OP.BRANCH, f3: 0 }, bne: { f: 'B', opc: OP.BRANCH, f3: 1 }, blt: { f: 'B', opc: OP.BRANCH, f3: 4 },
  bge: { f: 'B', opc: OP.BRANCH, f3: 5 }, bltu: { f: 'B', opc: OP.BRANCH, f3: 6 }, bgeu: { f: 'B', opc: OP.BRANCH, f3: 7 },
  lb: { f: 'I', opc: OP.LOAD, f3: 0 }, lh: { f: 'I', opc: OP.LOAD, f3: 1 }, lw: { f: 'I', opc: OP.LOAD, f3: 2 }, ld: { f: 'I', opc: OP.LOAD, f3: 3 },
  lbu: { f: 'I', opc: OP.LOAD, f3: 4 }, lhu: { f: 'I', opc: OP.LOAD, f3: 5 }, lwu: { f: 'I', opc: OP.LOAD, f3: 6 },
  sb: { f: 'S', opc: OP.STORE, f3: 0 }, sh: { f: 'S', opc: OP.STORE, f3: 1 }, sw: { f: 'S', opc: OP.STORE, f3: 2 }, sd: { f: 'S', opc: OP.STORE, f3: 3 },
  addi: { f: 'I', opc: OP.OPIMM, f3: 0 }, slti: { f: 'I', opc: OP.OPIMM, f3: 2 }, sltiu: { f: 'I', opc: OP.OPIMM, f3: 3 },
  xori: { f: 'I', opc: OP.OPIMM, f3: 4 }, ori: { f: 'I', opc: OP.OPIMM, f3: 6 }, andi: { f: 'I', opc: OP.OPIMM, f3: 7 },
  slli: { f: 'Ish', opc: OP.OPIMM, f3: 1, f7: 0 }, srli: { f: 'Ish', opc: OP.OPIMM, f3: 5, f7: 0 }, srai: { f: 'Ish', opc: OP.OPIMM, f3: 5, f7: 0x20 },
  addiw: { f: 'I', opc: OP.OPIMM32, f3: 0 },
  add: { f: 'R', opc: OP.OP, f3: 0, f7: 0 }, sub: { f: 'R', opc: OP.OP, f3: 0, f7: 0x20 }, sll: { f: 'R', opc: OP.OP, f3: 1, f7: 0 },
  slt: { f: 'R', opc: OP.OP, f3: 2, f7: 0 }, sltu: { f: 'R', opc: OP.OP, f3: 3, f7: 0 }, xor: { f: 'R', opc: OP.OP, f3: 4, f7: 0 },
  srl: { f: 'R', opc: OP.OP, f3: 5, f7: 0 }, sra: { f: 'R', opc: OP.OP, f3: 5, f7: 0x20 }, or: { f: 'R', opc: OP.OP, f3: 6, f7: 0 }, and: { f: 'R', opc: OP.OP, f3: 7, f7: 0 },
  mul: { f: 'R', opc: OP.OP, f3: 0, f7: 1 }, mulh: { f: 'R', opc: OP.OP, f3: 1, f7: 1 }, mulhu: { f: 'R', opc: OP.OP, f3: 3, f7: 1 },
  div: { f: 'R', opc: OP.OP, f3: 4, f7: 1 }, divu: { f: 'R', opc: OP.OP, f3: 5, f7: 1 }, rem: { f: 'R', opc: OP.OP, f3: 6, f7: 1 }, remu: { f: 'R', opc: OP.OP, f3: 7, f7: 1 },
  addw: { f: 'R', opc: OP.OP32, f3: 0, f7: 0 },
  sh1add: { f: 'R', opc: OP.OP, f3: 2, f7: 0x10 }, sh2add: { f: 'R', opc: OP.OP, f3: 4, f7: 0x10 }, sh3add: { f: 'R', opc: OP.OP, f3: 6, f7: 0x10 },
  'czero.eqz': { f: 'R', opc: OP.OP, f3: 5, f7: 0x07 }, 'czero.nez': { f: 'R', opc: OP.OP, f3: 7, f7: 0x07 },
  ecall: { f: 'SYS', opc: OP.SYSTEM }, ebreak: { f: 'SYS', opc: OP.SYSTEM },
};

const bits = (v: number, hi: number, lo: number) => (v >>> lo) & ((1 << (hi - lo + 1)) - 1);
const rn = (r: number) => `${RV_ABI[r]} (x${r})`;

/** Encode one real (non-pseudo) instruction. imm is the already-resolved immediate. */
export function encodeRV(op: string, rd: number, rs1: number, rs2: number, imm: number): { word: number; fields: EncField[]; format: string } {
  const d = RV_ENC[op];
  if (!d) throw new Error(`cannot encode '${op}'`);
  const F = (name: string, hi: number, lo: number, value: number, meaning?: string): EncField => ({ name, hi, lo, value: value & ((1 << (hi - lo + 1)) - 1) >>> 0, meaning });
  let fields: EncField[];
  switch (d.f) {
    case 'R':
      fields = [F('funct7', 31, 25, d.f7!), F('rs2', 24, 20, rs2, rn(rs2)), F('rs1', 19, 15, rs1, rn(rs1)), F('funct3', 14, 12, d.f3!), F('rd', 11, 7, rd, rn(rd)), F('opcode', 6, 0, d.opc)];
      break;
    case 'I':
      if (imm < -2048 || imm > 2047) throw new Error(`${op}: immediate ${imm} out of 12-bit range`);
      fields = [F('imm[11:0]', 31, 20, imm, `${imm}`), F('rs1', 19, 15, rs1, rn(rs1)), F('funct3', 14, 12, d.f3!), F('rd', 11, 7, rd, rn(rd)), F('opcode', 6, 0, d.opc)];
      break;
    case 'Ish':
      if (imm < 0 || imm > 63) throw new Error(`${op}: shift amount ${imm} out of range`);
      fields = [F('funct6', 31, 26, d.f7! >> 1), F('shamt', 25, 20, imm, `${imm}`), F('rs1', 19, 15, rs1, rn(rs1)), F('funct3', 14, 12, d.f3!), F('rd', 11, 7, rd, rn(rd)), F('opcode', 6, 0, d.opc)];
      break;
    case 'S':
      if (imm < -2048 || imm > 2047) throw new Error(`${op}: offset ${imm} out of 12-bit range`);
      fields = [F('imm[11:5]', 31, 25, bits(imm, 11, 5), `${imm}`), F('rs2', 24, 20, rs2, rn(rs2)), F('rs1', 19, 15, rs1, rn(rs1)), F('funct3', 14, 12, d.f3!), F('imm[4:0]', 11, 7, bits(imm, 4, 0)), F('opcode', 6, 0, d.opc)];
      break;
    case 'B':
      if (imm < -4096 || imm > 4094 || imm & 1) throw new Error(`${op}: branch offset ${imm} out of range`);
      fields = [F('imm[12]', 31, 31, bits(imm, 12, 12)), F('imm[10:5]', 30, 25, bits(imm, 10, 5)), F('rs2', 24, 20, rs2, rn(rs2)), F('rs1', 19, 15, rs1, rn(rs1)),
        F('funct3', 14, 12, d.f3!), F('imm[4:1]', 11, 8, bits(imm, 4, 1)), F('imm[11]', 7, 7, bits(imm, 11, 11)), F('opcode', 6, 0, d.opc)];
      break;
    case 'U':
      fields = [F('imm[31:12]', 31, 12, imm, `0x${(imm & 0xfffff).toString(16)}`), F('rd', 11, 7, rd, rn(rd)), F('opcode', 6, 0, d.opc)];
      break;
    case 'J':
      if (imm < -(1 << 20) || imm >= 1 << 20 || imm & 1) throw new Error(`${op}: jump offset ${imm} out of range`);
      fields = [F('imm[20]', 31, 31, bits(imm, 20, 20)), F('imm[10:1]', 30, 21, bits(imm, 10, 1)), F('imm[11]', 20, 20, bits(imm, 11, 11)), F('imm[19:12]', 19, 12, bits(imm, 19, 12)), F('rd', 11, 7, rd, rn(rd)), F('opcode', 6, 0, d.opc)];
      break;
    case 'SYS':
      fields = [F('funct12', 31, 20, op === 'ebreak' ? 1 : 0), F('rs1', 19, 15, 0), F('funct3', 14, 12, 0), F('rd', 11, 7, 0), F('opcode', 6, 0, d.opc)];
      break;
  }
  let word = 0;
  for (const f of fields) word |= (f.value & ((1 << (f.hi - f.lo + 1)) - 1)) << f.lo;
  const fmt = d.f === 'Ish' ? 'I' : d.f === 'SYS' ? 'I' : d.f;
  return { word: word >>> 0, fields, format: fmt };
}

// ---------------------------------------------------------------- expansion

interface Real {
  op: string;
  rd: number; rs1: number; rs2: number;
  imm: number;
  /** label/symbol the immediate refers to */
  target?: string;
  kind?: 'branch' | 'jal' | 'pcrel_hi' | 'pcrel_lo' | 'call_auipc' | 'call_jalr';
  sym?: string;
  text: string;
}

function fmtOps(ops: AOperand[]) {
  return ops.map((o) => {
    switch (o.k) {
      case 'reg': return RV_ABI[o.r];
      case 'imm': return o.v.toString();
      case 'label': return o.name;
      case 'mem': return `${o.disp}(${RV_ABI[o.base]})`;
      case 'rel': return `%${o.mod}(${o.sym})`;
    }
  }).join(', ');
}
export const asmText = (i: AsmInstr) => `${i.op}${i.ops.length ? ' ' + fmtOps(i.ops) : ''}`;

let pcrelCounter = 0;

/** Expand assembler pseudo-instructions into real instructions. */
export function expandRV(i: AsmInstr, pcrelLabel: () => string): Real[] {
  const o = i.ops;
  const reg = (k: number) => (o[k] as { r: number }).r;
  const R3 = (op: string, rd: number, rs1: number, rs2: number): Real => ({ op, rd, rs1, rs2, imm: 0, text: `${op} ${RV_ABI[rd]}, ${RV_ABI[rs1]}, ${RV_ABI[rs2]}` });
  const RI = (op: string, rd: number, rs1: number, imm: number): Real => ({ op, rd, rs1, rs2: 0, imm, text: `${op} ${RV_ABI[rd]}, ${RV_ABI[rs1]}, ${imm}` });
  const BR = (op: string, rs1: number, rs2: number, target: string): Real => ({ op, rd: 0, rs1, rs2, imm: 0, target, kind: 'branch', text: `${op} ${RV_ABI[rs1]}, ${RV_ABI[rs2]}, ${target}` });
  switch (i.op) {
    case 'li': {
      const rd = reg(0);
      const v = (o[1] as { v: bigint }).v;
      const seq = rvMatInt(v);
      let first = true;
      return seq.map((s) => {
        const src = first ? 0 : rd;
        const r: Real = s.op === 'lui'
          ? { op: 'lui', rd, rs1: 0, rs2: 0, imm: Number(s.imm), text: `lui ${RV_ABI[rd]}, ${s.imm}` }
          : RI(s.op, rd, first ? 0 : src, Number(s.imm));
        if (s.op === 'lui') first = false;
        else first = false;
        return r;
      });
    }
    case 'mv': return [RI('addi', reg(0), reg(1), 0)];
    case 'neg': return [R3('sub', reg(0), 0, reg(1))];
    case 'not': return [RI('xori', reg(0), reg(1), -1)];
    case 'seqz': return [RI('sltiu', reg(0), reg(1), 1)];
    case 'snez': return [R3('sltu', reg(0), 0, reg(1))];
    case 'nop': return [RI('addi', 0, 0, 0)];
    case 'ret': return [{ op: 'jalr', rd: 0, rs1: 1, rs2: 0, imm: 0, text: 'jalr zero, 0(ra)' }];
    case 'j': return [{ op: 'jal', rd: 0, rs1: 0, rs2: 0, imm: 0, target: (o[0] as { name: string }).name, kind: 'jal', text: `jal zero, ${(o[0] as { name: string }).name}` }];
    case 'jal':
      if (o.length === 1) return [{ op: 'jal', rd: 1, rs1: 0, rs2: 0, imm: 0, target: (o[0] as { name: string }).name, kind: 'jal', text: `jal ra, ${(o[0] as { name: string }).name}` }];
      return [{ op: 'jal', rd: reg(0), rs1: 0, rs2: 0, imm: 0, target: (o[1] as { name: string }).name, kind: 'jal', text: `jal ${RV_ABI[reg(0)]}, ${(o[1] as { name: string }).name}` }];
    case 'call': case 'tail': {
      const sym = (o[0] as { name: string }).name;
      const link = i.op === 'call' ? 1 : 0;
      const scratch = i.op === 'call' ? 1 : 6;
      return [
        { op: 'auipc', rd: scratch, rs1: 0, rs2: 0, imm: 0, kind: 'call_auipc', sym, text: `auipc ${RV_ABI[scratch]}, 0     # R_RISCV_CALL_PLT ${sym}` },
        { op: 'jalr', rd: link, rs1: scratch, rs2: 0, imm: 0, kind: 'call_jalr', sym, text: `jalr ${RV_ABI[link]}, 0(${RV_ABI[scratch]})` },
      ];
    }
    case 'la': case 'lla': {
      const rd = reg(0);
      const sym = (o[1] as { name: string }).name;
      const lbl = pcrelLabel();
      return [
        { op: 'auipc', rd, rs1: 0, rs2: 0, imm: 0, kind: 'pcrel_hi', sym, target: lbl, text: `auipc ${RV_ABI[rd]}, %pcrel_hi(${sym})` },
        { op: 'addi', rd, rs1: rd, rs2: 0, imm: 0, kind: 'pcrel_lo', sym: lbl, text: `addi ${RV_ABI[rd]}, ${RV_ABI[rd]}, %pcrel_lo(${lbl})` },
      ];
    }
    case 'beqz': return [BR('beq', reg(0), 0, (o[1] as { name: string }).name)];
    case 'bnez': return [BR('bne', reg(0), 0, (o[1] as { name: string }).name)];
    case 'bltz': return [BR('blt', reg(0), 0, (o[1] as { name: string }).name)];
    case 'bgez': return [BR('bge', reg(0), 0, (o[1] as { name: string }).name)];
    case 'blez': return [BR('bge', 0, reg(0), (o[1] as { name: string }).name)];
    case 'bgtz': return [BR('blt', 0, reg(0), (o[1] as { name: string }).name)];
    case 'bgt': return [BR('blt', reg(1), reg(0), (o[2] as { name: string }).name)];
    case 'ble': return [BR('bge', reg(1), reg(0), (o[2] as { name: string }).name)];
    case 'beq': case 'bne': case 'blt': case 'bge': case 'bltu': case 'bgeu':
      return [BR(i.op, reg(0), reg(1), (o[2] as { name: string }).name)];
    case 'ecall': case 'ebreak': return [{ op: i.op, rd: 0, rs1: 0, rs2: 0, imm: 0, text: i.op }];
  }
  const d = RV_ENC[i.op];
  if (!d) throw new Error(`unknown RISC-V instruction '${i.op}'`);
  if (d.f === 'R') return [R3(i.op, reg(0), reg(1), reg(2))];
  if (d.f === 'U') return [{ op: i.op, rd: reg(0), rs1: 0, rs2: 0, imm: Number((o[1] as { v: bigint }).v), text: asmText(i) }];
  if (d.opc === OP.LOAD || i.op === 'jalr') {
    const m = o[1] as { base: number; disp: bigint };
    return [{ op: i.op, rd: reg(0), rs1: m.base, rs2: 0, imm: Number(m.disp), text: `${i.op} ${RV_ABI[reg(0)]}, ${m.disp}(${RV_ABI[m.base]})` }];
  }
  if (d.f === 'S') {
    const m = o[1] as { base: number; disp: bigint };
    return [{ op: i.op, rd: 0, rs1: m.base, rs2: reg(0), imm: Number(m.disp), text: `${i.op} ${RV_ABI[reg(0)]}, ${m.disp}(${RV_ABI[m.base]})` }];
  }
  return [RI(i.op, reg(0), reg(1), Number((o[2] as { v: bigint }).v))];
}

// ---------------------------------------------------------------- assembly

interface Frag {
  section: string;
  real?: Real;
  data?: number[];
  zero?: number;
  align?: number;
  label?: string;
  size: number;
  src?: AsmInstr;
  fn?: string;
  expandedFrom?: string;
  relaxed?: boolean;
}

export interface AssembleOptions {
  /** allow long-branch relaxation (b!cc +8; jal target) when a branch is out of range */
  relax?: boolean;
  /** artificially shrink the branch range, for demonstrating relaxation */
  branchRange?: number;
}

export function assembleRV(items: AsmItem[], opts: AssembleOptions = {}): ObjectCode {
  const frags: Frag[] = [];
  let section = '.text';
  let fn: string | undefined;
  const globals = new Set<string>();
  const kinds = new Map<string, 'func' | 'object'>();
  const sizes = new Map<string, string>();
  let pc = 0;
  const pcrelLabel = () => `.Lpcrel_hi${pcrelCounter++}`;
  pcrelCounter = 0;
  for (const it of items) {
    switch (it.k) {
      case 'section': section = it.name; break;
      case 'label':
        frags.push({ section, label: it.name, size: 0 });
        if (it.global) globals.add(it.name);
        if (it.kind) kinds.set(it.name, it.kind);
        if (it.kind === 'func') fn = it.name;
        break;
      case 'align': frags.push({ section, align: 1 << it.pow, size: 0 }); break;
      case 'data': frags.push({ section, data: it.bytes, size: it.bytes.length }); break;
      case 'zero': frags.push({ section, zero: it.n, size: it.n }); break;
      case 'size': sizes.set(it.name, it.name); break;
      case 'instr': {
        const reals = expandRV(it.ins, pcrelLabel);
        const exp = reals.length > 1 || reals[0].op !== it.ins.op ? asmText(it.ins) : undefined;
        for (const r of reals) {
          if (r.kind === 'pcrel_hi') frags.push({ section, label: r.target!, size: 0 });
          frags.push({ section, real: r, size: 4, src: it.ins, fn: it.fn ?? fn, expandedFrom: exp });
        }
      }
    }
  }
  void pc;
  // layout with iterative branch relaxation
  const range = opts.branchRange ?? 4096;
  const relaxations: ObjectCode['relaxations'] = [];
  let addrs: number[] = [];
  const labelAddr = new Map<string, { section: string; addr: number }>();
  for (let iter = 0; iter < 20; iter++) {
    const off = new Map<string, number>();
    addrs = frags.map((f) => {
      let a = off.get(f.section) ?? 0;
      if (f.align) a = Math.ceil(a / f.align) * f.align;
      if (f.label) labelAddr.set(f.label, { section: f.section, addr: a });
      off.set(f.section, a + f.size);
      return a;
    });
    let grew = false;
    frags.forEach((f, k) => {
      if (f.real?.kind !== 'branch' || f.relaxed) return;
      const t = labelAddr.get(f.real.target!);
      if (!t) return;
      const d = t.addr - addrs[k];
      if (d < -range || d >= range) {
        if (opts.relax === false) throw new Error(`branch to ${f.real.target} out of range (${d} bytes)`);
        f.relaxed = true;
        f.size = 8;
        grew = true;
        relaxations.push({ fn: f.fn ?? '', at: addrs[k], what: `${f.real.text}: target is ${d} bytes away (> ±${range}); rewritten as inverted branch over a jal` });
      }
    });
    if (!grew) break;
  }
  // encode
  const secBytes = new Map<string, number[]>();
  const secRelocs = new Map<string, Reloc[]>();
  const listing: ListingEntry[] = [];
  const symbols: SymDef[] = [];
  const bytesOf = (s: string) => { if (!secBytes.has(s)) { secBytes.set(s, []); secRelocs.set(s, []); } return secBytes.get(s)!; };
  const put32 = (buf: number[], w: number) => buf.push(w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, (w >>> 24) & 0xff);
  const INV: Record<string, string> = { beq: 'bne', bne: 'beq', blt: 'bge', bge: 'blt', bltu: 'bgeu', bgeu: 'bltu' };
  frags.forEach((f, k) => {
    const buf = bytesOf(f.section);
    while (buf.length < addrs[k]) buf.push(f.section === '.text' ? 0 : 0);
    if (f.label) {
      listing.push({ section: f.section, addr: addrs[k], bytes: [], text: '', label: f.label, fn: f.fn });
      return;
    }
    if (f.data) { buf.push(...f.data); listing.push({ section: f.section, addr: addrs[k], bytes: f.data.slice(0, 16), text: `(${f.data.length} bytes of data)` }); return; }
    if (f.zero) { for (let z = 0; z < f.zero; z++) buf.push(0); return; }
    if (!f.real) return;
    const r = f.real;
    const at = addrs[k];
    const relocs = secRelocs.get(f.section)!;
    const emit = (op: string, rd: number, rs1: number, rs2: number, imm: number, text: string, reloc?: Reloc, note?: string) => {
      const e = encodeRV(op, rd, rs1, rs2, imm);
      const a = buf.length;
      put32(buf, e.word);
      if (reloc) relocs.push(reloc);
      listing.push({ section: f.section, addr: a, bytes: buf.slice(a, a + 4), text, fn: f.fn, mi: f.src?.mi, expandedFrom: f.expandedFrom, fields: e.fields, format: e.format, reloc, note });
    };
    const lab = (name: string) => {
      const t = labelAddr.get(name);
      if (!t || t.section !== f.section) return undefined;
      return t.addr;
    };
    switch (r.kind) {
      case 'branch': {
        const t = lab(r.target!);
        if (t === undefined) throw new Error(`undefined label ${r.target}`);
        if (f.relaxed) {
          emit(INV[r.op], 0, r.rs1, r.rs2, 8, `${INV[r.op]} ${RV_ABI[r.rs1]}, ${RV_ABI[r.rs2]}, .+8`, undefined, 'relaxed: inverted condition skips the long jump');
          emit('jal', 0, 0, 0, t - (at + 4), `jal zero, ${r.target}`, undefined, 'relaxed: jal reaches ±1 MiB');
        } else emit(r.op, 0, r.rs1, r.rs2, t - at, `${r.op} ${RV_ABI[r.rs1]}, ${RV_ABI[r.rs2]}, ${r.target}  # pc${t - at >= 0 ? '+' : ''}${t - at}`);
        break;
      }
      case 'jal': {
        const t = lab(r.target!);
        if (t === undefined) {
          emit('jal', r.rd, 0, 0, 0, r.text, { offset: at, type: R_RISCV.R_RISCV_JAL, typeName: 'R_RISCV_JAL', sym: r.target!, addend: 0n, why: 'jump to a symbol in another section/object: the linker fills in the 21-bit offset' });
        } else emit('jal', r.rd, 0, 0, t - at, `${r.text}  # pc${t - at >= 0 ? '+' : ''}${t - at}`);
        break;
      }
      case 'call_auipc':
        emit('auipc', r.rd, 0, 0, 0, `auipc ${RV_ABI[r.rd]}, 0`, { offset: at, type: R_RISCV.R_RISCV_CALL_PLT, typeName: 'R_RISCV_CALL_PLT', sym: r.sym!, addend: 0n, why: `the linker patches this auipc/jalr pair with the pc-relative distance to ${r.sym}` });
        break;
      case 'call_jalr':
        emit('jalr', r.rd, r.rs1, 0, 0, r.text, undefined, 'low 12 bits of the call offset (patched together with the auipc)');
        break;
      case 'pcrel_hi':
        emit('auipc', r.rd, 0, 0, 0, r.text, { offset: at, type: R_RISCV.R_RISCV_PCREL_HI20, typeName: 'R_RISCV_PCREL_HI20', sym: r.sym!, addend: 0n, why: `upper 20 bits of (${r.sym} - pc), rounded so the low part fits in a signed 12-bit immediate` });
        break;
      case 'pcrel_lo':
        emit('addi', r.rd, r.rs1, 0, 0, r.text, { offset: at, type: R_RISCV.R_RISCV_PCREL_LO12_I, typeName: 'R_RISCV_PCREL_LO12_I', sym: r.sym!, addend: 0n, why: `low 12 bits of the offset computed for the auipc at label ${r.sym} (not of this instruction's own pc!)` });
        break;
      default:
        emit(r.op, r.rd, r.rs1, r.rs2, r.imm, r.text);
    }
  });
  // symbols
  const fnSizes = new Map<string, number>();
  const funcLabels = frags.map((f, k) => ({ f, k })).filter(({ f }) => f.label && kinds.get(f.label) === 'func');
  funcLabels.forEach(({ f, k }, n) => {
    const next = funcLabels[n + 1];
    const end = next && next.f.section === f.section ? addrs[next.k] : secBytes.get(f.section)!.length;
    fnSizes.set(f.label!, end - addrs[k]);
  });
  const objLabels = frags.map((f, k) => ({ f, k })).filter(({ f }) => f.label && kinds.get(f.label) === 'object');
  objLabels.forEach(({ f, k }) => {
    let end = k + 1, size = 0;
    while (end < frags.length && !frags[end].label && frags[end].section === f.section) { size += frags[end].size; end++; }
    fnSizes.set(f.label!, size);
  });
  for (const [name, loc] of labelAddr) {
    const isLocal = name.startsWith('.L');
    if (isLocal && !name.startsWith('.Lpcrel_hi')) continue; // assembler-local labels are not emitted
    symbols.push({ name, section: loc.section, offset: loc.addr, size: fnSizes.get(name) ?? 0, global: globals.has(name), kind: kinds.get(name) ?? 'notype' });
  }
  const referenced = new Set<string>();
  for (const rs of secRelocs.values()) for (const r of rs) referenced.add(r.sym);
  for (const s of referenced) if (!labelAddr.has(s)) symbols.push({ name: s, section: '', offset: 0, size: 0, global: true, kind: 'notype' });
  const sections: Section[] = [];
  for (const name of ['.text', '.data', '.bss', ...[...secBytes.keys()].filter((n) => !['.text', '.data', '.bss'].includes(n))]) {
    const b = secBytes.get(name);
    if (!b && name !== '.text') continue;
    const arr = new Uint8Array(b ?? []);
    sections.push({ name, bytes: name === '.bss' ? new Uint8Array(0) : arr, size: arr.length, align: name === '.text' ? 4 : 8, relocs: secRelocs.get(name) ?? [], flags: name === '.text' ? 'ax' : name === '.bss' ? 'bss' : 'aw' });
  }
  return { machine: 'rv64', sections, symbols, listing, relaxations };
}

// ---------------------------------------------------------------- text front-end

const REG_BY_NAME = new Map<string, number>([...RV_ABI.map((n, i) => [n, i] as [string, number]), ...Array.from({ length: 32 }, (_, i) => [`x${i}`, i] as [string, number]), ['fp', 8]]);

export function parseRVAsm(src: string): AsmItem[] {
  const items: AsmItem[] = [];
  let fn: string | undefined;
  const pending = new Map<string, 'func' | 'object'>();
  src.split('\n').forEach((raw, ln) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const fail = (m: string) => { throw new Error(`asm line ${ln + 1}: ${m}`); };
    const lm = /^([A-Za-z_.$][\w.$]*):\s*(.*)$/.exec(line);
    let rest = line;
    if (lm) {
      const kind = pending.get(lm[1]);
      items.push({ k: 'label', name: lm[1], global: false, kind });
      if (kind === 'func') fn = lm[1];
      rest = lm[2];
      if (!rest) return;
    }
    const [op, ...argParts] = rest.split(/\s+/);
    const args = argParts.join(' ').split(',').map((s) => s.trim()).filter(Boolean);
    if (op.startsWith('.')) {
      switch (op) {
        case '.text': case '.data': case '.bss': items.push({ k: 'section', name: op }); return;
        case '.section': items.push({ k: 'section', name: args[0] }); return;
        case '.globl': case '.global': {
          // mark the label (which may come later) as global
          items.push({ k: 'label', name: `__globl__${args[0]}` });
          return;
        }
        case '.type': pending.set(args[0], args[1] === '@function' ? 'func' : 'object'); return;
        case '.p2align': case '.align': items.push({ k: 'align', pow: Number(args[0]) }); return;
        case '.quad': case '.dword': {
          const bytes: number[] = [];
          for (const a of args) { let v = BigInt.asUintN(64, BigInt(a)); for (let k = 0; k < 8; k++) { bytes.push(Number(v & 0xffn)); v >>= 8n; } }
          items.push({ k: 'data', bytes, text: rest });
          return;
        }
        case '.byte': items.push({ k: 'data', bytes: args.map((a) => Number(a) & 0xff), text: rest }); return;
        case '.zero': case '.space': items.push({ k: 'zero', n: Number(args[0]) }); return;
        case '.size': return;
        default: fail(`unknown directive ${op}`);
      }
    }
    const ops: AOperand[] = args.map((a) => {
      const mm = /^(-?\w*)\((\w+)\)$/.exec(a);
      if (mm) {
        const base = REG_BY_NAME.get(mm[2]);
        if (base === undefined) fail(`bad base register ${mm[2]}`);
        return { k: 'mem', base: base!, disp: BigInt(mm[1] || 0) };
      }
      if (REG_BY_NAME.has(a)) return { k: 'reg', r: REG_BY_NAME.get(a)! };
      if (/^-?(0x[0-9a-f]+|\d+)$/i.test(a)) return { k: 'imm', v: BigInt(a) };
      return { k: 'label', name: a };
    });
    items.push({ k: 'instr', ins: { op, ops }, fn });
  });
  // resolve the .globl markers
  const globals = new Set(items.filter((i) => i.k === 'label' && i.name.startsWith('__globl__')).map((i) => (i as { name: string }).name.slice(9)));
  return items.filter((i) => !(i.k === 'label' && i.name.startsWith('__globl__'))).map((i) => (i.k === 'label' && globals.has(i.name) ? { ...i, global: true } : i));
}

// ---------------------------------------------------------------- disassembler

const sx = (v: number, b: number) => (v << (32 - b)) >> (32 - b);

export function disasmRV(w: number, pc = 0): string {
  const opc = w & 0x7f, rd = (w >>> 7) & 31, f3 = (w >>> 12) & 7, rs1 = (w >>> 15) & 31, rs2 = (w >>> 20) & 31, f7 = w >>> 25;
  const A = (r: number) => RV_ABI[r];
  const immI = sx(w >>> 20, 12);
  switch (opc) {
    case OP.LUI: return `lui ${A(rd)}, 0x${(w >>> 12).toString(16)}`;
    case OP.AUIPC: return `auipc ${A(rd)}, 0x${(w >>> 12).toString(16)}`;
    case OP.JAL: {
      const imm = sx(((w >>> 31) << 20) | (((w >>> 12) & 0xff) << 12) | (((w >>> 20) & 1) << 11) | (((w >>> 21) & 0x3ff) << 1), 21);
      return rd === 0 ? `j 0x${(pc + imm).toString(16)}` : rd === 1 ? `jal 0x${(pc + imm).toString(16)}` : `jal ${A(rd)}, 0x${(pc + imm).toString(16)}`;
    }
    case OP.JALR: return rd === 0 && rs1 === 1 && immI === 0 ? 'ret' : `jalr ${A(rd)}, ${immI}(${A(rs1)})`;
    case OP.BRANCH: {
      const imm = sx(((w >>> 31) << 12) | (((w >>> 7) & 1) << 11) | (((w >>> 25) & 0x3f) << 5) | (((w >>> 8) & 0xf) << 1), 13);
      const n = ['beq', 'bne', '?', '?', 'blt', 'bge', 'bltu', 'bgeu'][f3];
      return `${n} ${A(rs1)}, ${A(rs2)}, 0x${(pc + imm).toString(16)}`;
    }
    case OP.LOAD: return `${['lb', 'lh', 'lw', 'ld', 'lbu', 'lhu', 'lwu', '?'][f3]} ${A(rd)}, ${immI}(${A(rs1)})`;
    case OP.STORE: {
      const imm = sx(((w >>> 25) << 5) | ((w >>> 7) & 31), 12);
      return `${['sb', 'sh', 'sw', 'sd'][f3] ?? '?'} ${A(rs2)}, ${imm}(${A(rs1)})`;
    }
    case OP.OPIMM: {
      if (f3 === 1) return `slli ${A(rd)}, ${A(rs1)}, ${(w >>> 20) & 63}`;
      if (f3 === 5) return `${(w >>> 30) & 1 ? 'srai' : 'srli'} ${A(rd)}, ${A(rs1)}, ${(w >>> 20) & 63}`;
      if (f3 === 0 && rs1 === 0) return `li ${A(rd)}, ${immI}`;
      if (f3 === 0 && immI === 0) return `mv ${A(rd)}, ${A(rs1)}`;
      return `${['addi', '', 'slti', 'sltiu', 'xori', '', 'ori', 'andi'][f3]} ${A(rd)}, ${A(rs1)}, ${immI}`;
    }
    case OP.OPIMM32: return `addiw ${A(rd)}, ${A(rs1)}, ${immI}`;
    case OP.OP: {
      let n = '?';
      if (f7 === 0) n = ['add', 'sll', 'slt', 'sltu', 'xor', 'srl', 'or', 'and'][f3];
      else if (f7 === 0x20) n = f3 === 0 ? 'sub' : f3 === 5 ? 'sra' : '?';
      else if (f7 === 1) n = ['mul', 'mulh', 'mulhsu', 'mulhu', 'div', 'divu', 'rem', 'remu'][f3];
      else if (f7 === 0x10) n = { 2: 'sh1add', 4: 'sh2add', 6: 'sh3add' }[f3] ?? '?';
      else if (f7 === 7) n = f3 === 5 ? 'czero.eqz' : 'czero.nez';
      return `${n} ${A(rd)}, ${A(rs1)}, ${A(rs2)}`;
    }
    case OP.OP32: return `${f7 === 0x20 ? 'subw' : 'addw'} ${A(rd)}, ${A(rs1)}, ${A(rs2)}`;
    case OP.SYSTEM: return w === 0x73 ? 'ecall' : w === 0x100073 ? 'ebreak' : 'system';
  }
  return `.word 0x${(w >>> 0).toString(16)}`;
}
