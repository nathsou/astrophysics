// AArch64 (A64) encoder: every instruction is exactly 32 bits.

import type { Module } from '../ir/ir';
import type { MFunc, MInstr, MOperand, MemOp, RegOp } from '../codegen/mir';
import type { Target } from '../target/target';
import type { EncField, ListingEntry, ObjectCode, Reloc, SymDef } from './objcode';
import { dataSections } from './x64enc';

const COND: Record<string, number> = { eq: 0, ne: 1, hs: 2, lo: 3, mi: 4, pl: 5, vs: 6, vc: 7, hi: 8, ls: 9, ge: 10, lt: 11, gt: 12, le: 13 };
const INV: Record<string, string> = { eq: 'ne', ne: 'eq', lt: 'ge', ge: 'lt', gt: 'le', le: 'gt' };

/** Encode a 64-bit logical immediate as N:immr:imms, or undefined if not encodable. */
export function encodeLogicalImm(v: bigint): { N: number; immr: number; imms: number } | undefined {
  let imm = BigInt.asUintN(64, v);
  if (imm === 0n || imm === (1n << 64n) - 1n) return undefined;
  let size = 64;
  for (;;) {
    const half = size / 2;
    const mask = (1n << BigInt(half)) - 1n;
    if ((imm & mask) !== ((imm >> BigInt(half)) & mask)) break;
    size = half;
    if (size === 2) break;
  }
  const mask = size === 64 ? (1n << 64n) - 1n : (1n << BigInt(size)) - 1n;
  imm &= mask;
  const isShiftedMask = (x: bigint) => { if (x === 0n) return false; while ((x & 1n) === 0n) x >>= 1n; return (x & (x + 1n)) === 0n; };
  const ctz = (x: bigint) => { let n = 0; while (x && (x & 1n) === 0n) { x >>= 1n; n++; } return n; };
  const cto = (x: bigint) => { let n = 0; while (x & 1n) { x >>= 1n; n++; } return n; };
  let I: number, CTO: number;
  if (isShiftedMask(imm)) {
    I = ctz(imm);
    CTO = cto(imm >> BigInt(I));
  } else {
    // the run of ones wraps around: look at the inverted pattern
    const full = imm | (~mask & ((1n << 64n) - 1n));
    const inv = ~full & ((1n << 64n) - 1n);
    if (!isShiftedMask(inv)) return undefined;
    let clo = 0;
    for (let b = 63; b >= 0 && (full >> BigInt(b)) & 1n; b--) clo++;
    I = 64 - clo;
    CTO = clo + cto(full) - (64 - size);
  }
  const immr = (size - I) & (size - 1);
  let nimms = (~(size - 1) << 1) & 0x7f;
  nimms |= CTO - 1;
  const N = ((nimms >> 6) & 1) ^ 1;
  return { N, immr, imms: nimms & 0x3f };
}

interface Enc { word: number; fields: EncField[]; reloc?: Omit<Reloc, 'offset'>; branch?: { target: string; kind: 'b26' | 'b19' } }

const F = (name: string, hi: number, lo: number, value: number, meaning?: string): EncField => ({ name, hi, lo, value: value & ((1 << (hi - lo + 1)) - 1), meaning });
const pack = (fields: EncField[]) => fields.reduce((w, f) => (w | ((f.value & ((1 << (f.hi - f.lo + 1)) - 1)) << f.lo)) >>> 0, 0) >>> 0;
const rname = (r: number) => (r === 31 ? 'sp/xzr' : r === 32 ? 'xzr' : `x${r}`);

export function encodeA64(t: Target, mi: MInstr, blockLabel: (b: unknown) => string): Enc {
  const o = mi.ops;
  const reg = (k: number) => { const x = o[k] as RegOp; if (x.k !== 'preg') throw new Error('unallocated register'); return x.r === 32 ? 31 : x.r; };
  const imm = (k: number) => Number((o[k] as { v: bigint }).v);
  const R3 = (base: number, name: string, rd: number, rn: number, rm: number, extra: EncField[] = []) => {
    const fields = [F(name, 31, 21, base >>> 21), F('Rm', 20, 16, rm, rname(rm)), ...extra, F('Rn', 9, 5, rn, rname(rn)), F('Rd', 4, 0, rd, rname(rd))];
    if (!extra.length) fields.splice(2, 0, F('imm6/opts', 15, 10, (base >>> 10) & 0x3f));
    return { word: pack(fields), fields };
  };
  const addsubImm = (op: number, rd: number, rn: number, v: number, name: string) => {
    let sh = 0;
    if (v > 4095) { if (v & 0xfff) throw new Error(`immediate ${v} not encodable`); v >>= 12; sh = 1; }
    const fields = [F(name, 31, 23, op >>> 23), F('sh', 22, 22, sh), F('imm12', 21, 10, v, `${v}${sh ? ' << 12' : ''}`), F('Rn', 9, 5, rn, rname(rn)), F('Rd', 4, 0, rd, rname(rd))];
    return { word: pack(fields), fields };
  };
  const logImm = (op: number, rd: number, rn: number, v: bigint, name: string) => {
    const e = encodeLogicalImm(v);
    if (!e) throw new Error(`${v} is not a logical immediate`);
    const fields = [F(name, 31, 23, op >>> 23), F('N', 22, 22, e.N), F('immr', 21, 16, e.immr), F('imms', 15, 10, e.imms), F('Rn', 9, 5, rn, rname(rn)), F('Rd', 4, 0, rd, rname(rd))];
    return { word: pack(fields), fields };
  };
  const ldst = (load: boolean, rt: number, m: MemOp): Enc => {
    const rn = (m.base as RegOp & { r: number }).r;
    if (m.index) {
      const rm = (m.index as RegOp & { r: number }).r;
      const S = m.scale === 8 ? 1 : 0;
      const fields = [F(load ? 'ldr (reg)' : 'str (reg)', 31, 21, (load ? 0xf8600000 : 0xf8200000) >>> 21), F('Rm', 20, 16, rm, rname(rm)), F('option', 15, 13, 3, 'LSL/UXTX'), F('S', 12, 12, S, S ? 'lsl #3' : 'no shift'), F('10', 11, 10, 2), F('Rn', 9, 5, rn, rname(rn)), F('Rt', 4, 0, rt, rname(rt))];
      return { word: pack(fields), fields };
    }
    if (m.disp >= 0 && m.disp % 8 === 0 && m.disp <= 32760) {
      const fields = [F(load ? 'ldr (uimm)' : 'str (uimm)', 31, 22, (load ? 0xf9400000 : 0xf9000000) >>> 22), F('imm12', 21, 10, m.disp / 8, `${m.disp} / 8`), F('Rn', 9, 5, rn, rname(rn)), F('Rt', 4, 0, rt, rname(rt))];
      return { word: pack(fields), fields };
    }
    if (m.disp >= -256 && m.disp <= 255) {
      const fields = [F(load ? 'ldur' : 'stur', 31, 21, (load ? 0xf8400000 : 0xf8000000) >>> 21), F('imm9', 20, 12, m.disp & 0x1ff, `${m.disp}`), F('00', 11, 10, 0), F('Rn', 9, 5, rn, rname(rn)), F('Rt', 4, 0, rt, rname(rt))];
      return { word: pack(fields), fields };
    }
    throw new Error(`offset ${m.disp} not encodable`);
  };
  switch (mi.op) {
    case 'add': return R3(0x8b000000, 'add (shifted reg)', reg(0), reg(1), reg(2));
    case 'sub': return R3(0xcb000000, 'sub (shifted reg)', reg(0), reg(1), reg(2));
    case 'and': return R3(0x8a000000, 'and (shifted reg)', reg(0), reg(1), reg(2));
    case 'orr': return R3(0xaa000000, 'orr (shifted reg)', reg(0), reg(1), reg(2));
    case 'eor': return R3(0xca000000, 'eor (shifted reg)', reg(0), reg(1), reg(2));
    case 'addsl': return R3(0x8b000000, 'add (shifted reg)', reg(0), reg(1), reg(2), [F('imm6', 15, 10, imm(3), `lsl #${imm(3)}`)]);
    case 'subsl': return R3(0xcb000000, 'sub (shifted reg)', reg(0), reg(1), reg(2), [F('imm6', 15, 10, imm(3), `lsl #${imm(3)}`)]);
    case 'mov': return R3(0xaa0003e0, 'orr (mov alias)', reg(0), 31, reg(1));
    case 'neg': return R3(0xcb0003e0, 'sub (neg alias)', reg(0), 31, reg(1));
    case 'mvn': return R3(0xaa2003e0, 'orn (mvn alias)', reg(0), 31, reg(1));
    case 'mul': return R3(0x9b007c00, 'madd (mul alias)', reg(0), reg(1), reg(2), [F('o0', 15, 15, 0), F('Ra', 14, 10, 31, 'xzr')]);
    case 'madd': return R3(0x9b000000, 'madd', reg(0), reg(1), reg(2), [F('o0', 15, 15, 0), F('Ra', 14, 10, reg(3), rname(reg(3)))]);
    case 'msub': return R3(0x9b008000, 'msub', reg(0), reg(1), reg(2), [F('o0', 15, 15, 1), F('Ra', 14, 10, reg(3), rname(reg(3)))]);
    case 'sdiv': return R3(0x9ac00c00, 'sdiv', reg(0), reg(1), reg(2), [F('opcode2', 15, 10, 3)]);
    case 'lsl': return R3(0x9ac02000, 'lslv', reg(0), reg(1), reg(2), [F('opcode2', 15, 10, 8)]);
    case 'lsr': return R3(0x9ac02400, 'lsrv', reg(0), reg(1), reg(2), [F('opcode2', 15, 10, 9)]);
    case 'asr': return R3(0x9ac02800, 'asrv', reg(0), reg(1), reg(2), [F('opcode2', 15, 10, 10)]);
    case 'addi': return addsubImm(0x91000000, reg(0), reg(1), imm(2), 'add (imm)');
    case 'subi': return addsubImm(0xd1000000, reg(0), reg(1), imm(2), 'sub (imm)');
    case 'cmpi': return addsubImm(0xf1000000, 31, reg(0), imm(1), 'subs (cmp alias)');
    case 'cmni': return addsubImm(0xb1000000, 31, reg(0), imm(1), 'adds (cmn alias)');
    case 'cmp': { const e = R3(0xeb000000, 'subs (cmp alias)', 31, reg(0), reg(1)); return e; }
    case 'andi': return logImm(0x92000000, reg(0), reg(1), (o[2] as { v: bigint }).v, 'and (imm)');
    case 'orri': return logImm(0xb2000000, reg(0), reg(1), (o[2] as { v: bigint }).v, 'orr (imm)');
    case 'eori': return logImm(0xd2000000, reg(0), reg(1), (o[2] as { v: bigint }).v, 'eor (imm)');
    case 'lsli': case 'lsri': case 'asri': {
      const s = imm(2);
      const immr = mi.op === 'lsli' ? (64 - s) & 63 : s;
      const imms = mi.op === 'lsli' ? 63 - s : 63;
      const base = mi.op === 'asri' ? 0x93400000 : 0xd3400000;
      const fields = [F(mi.op === 'asri' ? 'sbfm' : 'ubfm', 31, 22, base >>> 22), F('immr', 21, 16, immr), F('imms', 15, 10, imms), F('Rn', 9, 5, reg(1), rname(reg(1))), F('Rd', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields };
    }
    case 'movz': case 'movn': case 'movk': {
      const base = { movz: 0xd2800000, movn: 0x92800000, movk: 0xf2800000 }[mi.op];
      const fields = [F(mi.op, 31, 23, base >>> 23), F('hw', 22, 21, imm(2) / 16, `lsl #${imm(2)}`), F('imm16', 20, 5, imm(1), `0x${imm(1).toString(16)}`), F('Rd', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields };
    }
    case 'cset': {
      const cc = (o[1] as { cc: string }).cc;
      const fields = [F('csinc (cset alias)', 31, 21, 0x9a9f07e0 >>> 21), F('Rm', 20, 16, 31, 'xzr'), F('cond', 15, 12, COND[INV[cc]], `inverted: ${INV[cc]}`), F('01', 11, 10, 1), F('Rn', 9, 5, 31, 'xzr'), F('Rd', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields };
    }
    case 'csel': {
      const cc = (o[3] as { cc: string }).cc;
      const fields = [F('csel', 31, 21, 0x9a800000 >>> 21), F('Rm', 20, 16, reg(2), rname(reg(2))), F('cond', 15, 12, COND[cc], cc), F('00', 11, 10, 0), F('Rn', 9, 5, reg(1), rname(reg(1))), F('Rd', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields };
    }
    case 'ldr': return ldst(true, reg(0), o[1] as MemOp);
    case 'str': return ldst(false, reg(0), o[1] as MemOp);
    case 'stp': case 'ldp': {
      const m = o[2] as MemOp;
      const fields = [F(mi.op === 'stp' ? 'stp (signed offset)' : 'ldp (signed offset)', 31, 22, (mi.op === 'stp' ? 0xa9000000 : 0xa9400000) >>> 22), F('imm7', 21, 15, (m.disp / 8) & 0x7f, `${m.disp} / 8`), F('Rt2', 14, 10, reg(1), rname(reg(1))), F('Rn', 9, 5, 31, 'sp'), F('Rt', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields };
    }
    case 'adrp': {
      const s = o[1] as { name: string };
      const fields = [F('op', 31, 31, 1), F('immlo', 30, 29, 0), F('10000', 28, 24, 0x10), F('immhi', 23, 5, 0, 'filled by the linker'), F('Rd', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields, reloc: { type: 275, typeName: 'R_AARCH64_ADR_PREL_PG_HI21', sym: s.name, addend: 0n, why: `page of ${s.name} relative to the page of this instruction` } };
    }
    case 'addlo': {
      const s = o[2] as { name: string };
      const e = addsubImm(0x91000000, reg(0), reg(1), 0, 'add (imm)');
      return { ...e, reloc: { type: 277, typeName: 'R_AARCH64_ADD_ABS_LO12_NC', sym: s.name, addend: 0n, why: `low 12 bits of ${s.name}'s address` } };
    }
    case 'b': case 'bl': {
      const fields = [F('op', 31, 31, mi.op === 'bl' ? 1 : 0), F('00101', 30, 26, 5), F('imm26', 25, 0, 0, 'pc-relative words')];
      if (mi.op === 'bl') return { word: pack(fields), fields, reloc: { type: 283, typeName: 'R_AARCH64_CALL26', sym: (o[0] as { name: string }).name, addend: 0n, why: '26-bit word offset to the callee (±128 MiB)' } };
      return { word: pack(fields), fields, branch: { target: blockLabel((o[0] as { b: unknown }).b), kind: 'b26' } };
    }
    case 'b.cond': {
      const cc = (o[0] as { cc: string }).cc;
      const fields = [F('b.cond', 31, 24, 0x54), F('imm19', 23, 5, 0), F('0', 4, 4, 0), F('cond', 3, 0, COND[cc], cc)];
      return { word: pack(fields), fields, branch: { target: blockLabel((o[1] as { b: unknown }).b), kind: 'b19' } };
    }
    case 'cbz': case 'cbnz': {
      const fields = [F(mi.op, 31, 24, mi.op === 'cbz' ? 0xb4 : 0xb5), F('imm19', 23, 5, 0), F('Rt', 4, 0, reg(0), rname(reg(0)))];
      return { word: pack(fields), fields, branch: { target: blockLabel((o[1] as { b: unknown }).b), kind: 'b19' } };
    }
    case 'ret': {
      const fields = [F('ret', 31, 10, 0xd65f03c0 >>> 10), F('Rn', 9, 5, 30, 'x30'), F('00000', 4, 0, 0)];
      return { word: pack(fields), fields };
    }
  }
  throw new Error(`AArch64 encoder: cannot encode ${mi.op}`);
}

export function emitA64(t: Target, funcs: MFunc[], m: Module, fmt: (mi: MInstr, f: MFunc) => string): ObjectCode {
  const text: number[] = [];
  const relocs: Reloc[] = [];
  const listing: ListingEntry[] = [];
  const symbols: SymDef[] = [];
  const labels = new Map<string, number>();
  const pending: { at: number; target: string; kind: 'b26' | 'b19'; idx: number }[] = [];
  for (const f of funcs) {
    const start = text.length;
    listing.push({ section: '.text', addr: start, bytes: [], text: '', label: f.name, fn: f.name });
    f.blocks.forEach((b, i) => {
      const lbl = t.blockLabel(f, b);
      labels.set(lbl, text.length);
      if (i > 0) listing.push({ section: '.text', addr: text.length, bytes: [], text: '', label: lbl, fn: f.name });
      for (const mi of b.instrs) {
        const e = encodeA64(t, mi, (x) => t.blockLabel(f, x as never));
        const at = text.length;
        if (e.reloc) relocs.push({ ...e.reloc, offset: at });
        if (e.branch) pending.push({ at, target: e.branch.target, kind: e.branch.kind, idx: listing.length });
        text.push(e.word & 0xff, (e.word >>> 8) & 0xff, (e.word >>> 16) & 0xff, (e.word >>> 24) & 0xff);
        listing.push({ section: '.text', addr: at, bytes: text.slice(at, at + 4), text: fmt(mi, f), fn: f.name, mi: mi.id, fields: e.fields, format: e.fields[0].name, reloc: e.reloc ? { ...e.reloc, offset: at } : undefined });
      }
    });
    symbols.push({ name: f.name, section: '.text', offset: start, size: text.length - start, global: true, kind: 'func' });
  }
  for (const p of pending) {
    const off = (labels.get(p.target)! - p.at) >> 2;
    let w = text[p.at] | (text[p.at + 1] << 8) | (text[p.at + 2] << 16) | (text[p.at + 3] << 24);
    if (p.kind === 'b26') w = (w & 0xfc000000) | (off & 0x3ffffff);
    else w = (w & 0xff00001f) | ((off & 0x7ffff) << 5);
    for (let k = 0; k < 4; k++) text[p.at + k] = (w >>> (8 * k)) & 0xff;
    const L = listing[p.idx];
    L.bytes = text.slice(p.at, p.at + 4);
    const fld = L.fields!.find((x) => x.name.startsWith('imm'));
    if (fld) { fld.value = off & ((1 << (fld.hi - fld.lo + 1)) - 1); fld.meaning = `${off} instructions (${off * 4} bytes)`; }
  }
  const data = dataSections(m);
  for (const r of relocs) if (!symbols.some((s) => s.name === r.sym) && !data.symbols.some((s) => s.name === r.sym) && !symbols.some((s) => s.name === r.sym && !s.section)) symbols.push({ name: r.sym, section: '', offset: 0, size: 0, global: true, kind: 'notype' });
  return {
    machine: 'aarch64',
    sections: [{ name: '.text', bytes: new Uint8Array(text), size: text.length, align: 4, relocs, flags: 'ax' }, ...data.sections],
    symbols: [...symbols, ...data.symbols].filter((s, i, a) => a.findIndex((x) => x.name === s.name) === i),
    listing,
    relaxations: [],
  };
}

export type { MOperand };
