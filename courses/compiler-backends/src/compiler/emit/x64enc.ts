// x86-64 encoder: variable-length instructions built from
// [REX] opcode [ModRM] [SIB] [disp8/32] [imm8/32/64], with iterative
// short/near jump relaxation (rel8 -> rel32), as every x86 assembler does.

import type { Module } from '../ir/ir';
import type { MFunc, MInstr, MemOp, RegOp } from '../codegen/mir';
import type { Target } from '../target/target';
import type { EncField, ListingEntry, ObjectCode, Reloc, Section, SymDef } from './objcode';

const NAMES = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'];
const CC: Record<string, number> = { o: 0, no: 1, b: 2, ae: 3, e: 4, ne: 5, be: 6, a: 7, s: 8, ns: 9, p: 10, np: 11, l: 12, ge: 13, le: 14, g: 15 };
const ALU_DIGIT: Record<string, number> = { add: 0, or: 1, and: 4, sub: 5, xor: 6, cmp: 7 };
const ALU_MR: Record<string, number> = { add: 0x01, or: 0x09, and: 0x21, sub: 0x29, xor: 0x31, cmp: 0x39 };
const ALU_RM: Record<string, number> = { add: 0x03, or: 0x0b, and: 0x23, sub: 0x2b, xor: 0x33, cmp: 0x3b };
const ALU_RAX: Record<string, number> = { add: 0x05, or: 0x0d, and: 0x25, sub: 0x2d, xor: 0x35, cmp: 0x3d };

export function dataSections(m: Module): { sections: Section[]; symbols: SymDef[] } {
  const data: number[] = [];
  let bss = 0;
  const symbols: SymDef[] = [];
  for (const g of m.globals) {
    if (g.init.length) {
      while (data.length % 8) data.push(0);
      symbols.push({ name: g.name, section: '.data', offset: data.length, size: g.words * 8, global: true, kind: 'object' });
      for (let w = 0; w < g.words; w++) { let v = BigInt.asUintN(64, g.init[w] ?? 0n); for (let k = 0; k < 8; k++) { data.push(Number(v & 0xffn)); v >>= 8n; } }
    } else {
      bss = Math.ceil(bss / 8) * 8;
      symbols.push({ name: g.name, section: '.bss', offset: bss, size: g.words * 8, global: true, kind: 'object' });
      bss += g.words * 8;
    }
  }
  const sections: Section[] = [];
  if (data.length) sections.push({ name: '.data', bytes: new Uint8Array(data), size: data.length, align: 8, relocs: [], flags: 'aw' });
  if (bss) sections.push({ name: '.bss', bytes: new Uint8Array(0), size: bss, align: 8, relocs: [], flags: 'bss' });
  return { sections, symbols };
}

interface XEnc {
  bytes: number[];
  fields: EncField[];
  reloc?: { at: number; sym: string; type: number; typeName: string; addend: bigint; why: string };
  branch?: { target: string; opShort: number[]; opNear: number[]; short: boolean };
}

class B {
  bytes: number[] = [];
  fields: EncField[] = [];
  mark(name: string, n: number, meaning?: string) {
    const start = this.bytes.length - n;
    this.fields.push({ name, hi: this.bytes.length * 8 - 1, lo: start * 8, value: this.bytes.slice(start).reduce((v, b, i) => v | (b << (8 * i)), 0) >>> 0, meaning });
  }
  u8(v: number) { this.bytes.push(v & 0xff); }
  i32(v: number) { for (let k = 0; k < 4; k++) this.bytes.push((v >>> (8 * k)) & 0xff); }
}

const fits8 = (v: number) => v >= -128 && v <= 127;

/** Emit REX + opcode + ModRM/SIB/disp for a reg field and a register-or-memory operand. */
function modrm(b: B, opcode: number[], regField: number, rm: { reg: number } | MemOp, opts: { w?: boolean; forceRex?: boolean; immBytes?: number } = {}): XEnc['reloc'] {
  const w = opts.w !== false;
  let rex = 0x40 | (w ? 8 : 0) | ((regField >> 3) & 1) << 2;
  let reloc: XEnc['reloc'];
  if ('reg' in rm) {
    rex |= (rm.reg >> 3) & 1;
    if (rex !== 0x40 || opts.forceRex) { b.u8(rex); b.mark('REX', 1, rexMeaning(rex)); }
    for (const o of opcode) b.u8(o);
    b.mark('opcode', opcode.length);
    b.u8(0xc0 | ((regField & 7) << 3) | (rm.reg & 7));
    b.mark('ModRM', 1, `mod=11 (register), reg=${regField & 7}${regField >= 8 ? '+8' : ''}, rm=${NAMES[rm.reg]}`);
    return undefined;
  }
  const m = rm;
  if (m.base.k === 'sym') {
    if (rex !== 0x40 || opts.forceRex) { b.u8(rex); b.mark('REX', 1, rexMeaning(rex)); }
    for (const o of opcode) b.u8(o);
    b.mark('opcode', opcode.length);
    b.u8(((regField & 7) << 3) | 5);
    b.mark('ModRM', 1, 'mod=00 rm=101: RIP-relative [rip + disp32]');
    const at = b.bytes.length;
    b.i32(0);
    b.mark('disp32', 4, `${m.base.name} - next instruction (filled by the linker)`);
    reloc = { at, sym: m.base.name, type: 2, typeName: 'R_X86_64_PC32', addend: BigInt(-4 - (opts.immBytes ?? 0)), why: `rip-relative reference to ${m.base.name}; addend −${4 + (opts.immBytes ?? 0)} because rip points past the rest of the instruction` };
    return reloc;
  }
  const base = (m.base as RegOp & { r: number }).r;
  const index = m.index ? (m.index as RegOp & { r: number }).r : undefined;
  rex |= (base >> 3) & 1;
  if (index !== undefined) rex |= ((index >> 3) & 1) << 1;
  if (rex !== 0x40 || opts.forceRex) { b.u8(rex); b.mark('REX', 1, rexMeaning(rex)); }
  for (const o of opcode) b.u8(o);
  b.mark('opcode', opcode.length);
  const needSib = index !== undefined || (base & 7) === 4;
  let mod = m.disp === 0 && (base & 7) !== 5 ? 0 : fits8(m.disp) ? 1 : 2;
  b.u8((mod << 6) | ((regField & 7) << 3) | (needSib ? 4 : base & 7));
  b.mark('ModRM', 1, `mod=${mod.toString(2).padStart(2, '0')} (${['no disp', 'disp8', 'disp32'][mod]}), reg=${regField}, rm=${needSib ? '100 → SIB follows' : NAMES[base]}`);
  if (needSib) {
    const ss = { 1: 0, 2: 1, 4: 2, 8: 3 }[m.scale ?? 1] ?? 0;
    b.u8((ss << 6) | (((index ?? 4) & 7) << 3) | (base & 7));
    b.mark('SIB', 1, `scale=${1 << ss}, index=${index === undefined ? 'none' : NAMES[index]}, base=${NAMES[base]}`);
  }
  if (mod === 1) { b.u8(m.disp); b.mark('disp8', 1, `${m.disp}`); }
  if (mod === 2) { b.i32(m.disp); b.mark('disp32', 4, `${m.disp}`); }
  return undefined;
}

function rexMeaning(r: number) {
  return `0100WRXB: W=${(r >> 3) & 1} (64-bit operand), R=${(r >> 2) & 1}, X=${(r >> 1) & 1}, B=${r & 1}`;
}

export function encodeX64(mi: MInstr, label: (b: unknown) => string): XEnc {
  const b = new B();
  const o = mi.ops;
  const reg = (k: number) => (o[k] as RegOp & { r: number }).r;
  const imm = (k: number) => Number((o[k] as { v: bigint }).v);
  const immOut = (v: number, n: 1 | 4) => { if (n === 1) b.u8(v); else b.i32(v); b.mark(n === 1 ? 'imm8' : 'imm32', n, `${v}`); };
  let reloc: XEnc['reloc'];
  const aluBase = (op: string) => op.replace(/[im]$/, '').replace(/^imul.*/, 'imul');
  switch (mi.op) {
    case 'mov': modrm(b, [0x89], reg(1), { reg: reg(0) }); break;
    case 'movri': modrm(b, [0xc7], 0, { reg: reg(0) }); immOut(imm(1), 4); break;
    case 'movabs': {
      const r = reg(0);
      b.u8(0x48 | ((r >> 3) & 1)); b.mark('REX', 1, rexMeaning(0x48 | ((r >> 3) & 1)));
      b.u8(0xb8 + (r & 7)); b.mark('opcode', 1, `B8+r: register ${NAMES[r]} is encoded in the opcode byte`);
      let v = BigInt.asUintN(64, (o[1] as { v: bigint }).v);
      for (let k = 0; k < 8; k++) { b.u8(Number(v & 0xffn)); v >>= 8n; }
      b.mark('imm64', 8, `${(o[1] as { v: bigint }).v}`);
      break;
    }
    case 'load': reloc = modrm(b, [0x8b], reg(0), o[1] as MemOp); break;
    case 'store': reloc = modrm(b, [0x89], reg(1), o[0] as MemOp); break;
    case 'storei': reloc = modrm(b, [0xc7], 0, o[0] as MemOp, { immBytes: 4 }); immOut(imm(1), 4); break;
    case 'lea': reloc = modrm(b, [0x8d], reg(0), o[1] as MemOp); break;
    case 'add': case 'sub': case 'and': case 'or': case 'xor': case 'cmp':
      modrm(b, [ALU_MR[mi.op]], reg(1), { reg: reg(0) });
      break;
    case 'addi': case 'subi': case 'andi': case 'ori': case 'xori': case 'cmpi': case 'subrsp': case 'addrsp': {
      const op = mi.op === 'subrsp' ? 'sub' : mi.op === 'addrsp' ? 'add' : aluBase(mi.op);
      const r = mi.op === 'subrsp' || mi.op === 'addrsp' ? 4 : reg(0);
      const v = mi.op === 'subrsp' || mi.op === 'addrsp' ? imm(1) : imm(1);
      if (fits8(v)) { modrm(b, [0x83], ALU_DIGIT[op], { reg: r }); immOut(v, 1); }
      else if (r === 0) { b.u8(0x48); b.mark('REX', 1, rexMeaning(0x48)); b.u8(ALU_RAX[op]); b.mark('opcode', 1, 'short form with rax as the implicit destination'); immOut(v, 4); }
      else { modrm(b, [0x81], ALU_DIGIT[op], { reg: r }); immOut(v, 4); }
      break;
    }
    case 'addm': case 'subm': case 'andm': case 'orm': case 'xorm': case 'cmpm':
      reloc = modrm(b, [ALU_RM[aluBase(mi.op)]], reg(0), o[1] as MemOp);
      break;
    case 'test': modrm(b, [0x85], reg(1), { reg: reg(0) }); break;
    case 'imul': modrm(b, [0x0f, 0xaf], reg(0), { reg: reg(1) }); break;
    case 'imulm': reloc = modrm(b, [0x0f, 0xaf], reg(0), o[1] as MemOp); break;
    case 'imul3': {
      const v = imm(2);
      if (fits8(v)) { modrm(b, [0x6b], reg(0), { reg: reg(1) }); immOut(v, 1); }
      else { modrm(b, [0x69], reg(0), { reg: reg(1) }); immOut(v, 4); }
      break;
    }
    case 'neg': modrm(b, [0xf7], 3, { reg: reg(0) }); break;
    case 'not': modrm(b, [0xf7], 2, { reg: reg(0) }); break;
    case 'idiv': modrm(b, [0xf7], 7, { reg: reg(0) }); break;
    case 'cqo': b.u8(0x48); b.mark('REX', 1, rexMeaning(0x48)); b.u8(0x99); b.mark('opcode', 1); break;
    case 'shl': case 'sar': case 'shr': {
      const digit = { shl: 4, shr: 5, sar: 7 }[mi.op];
      if (imm(1) === 1) modrm(b, [0xd1], digit, { reg: reg(0) });
      else { modrm(b, [0xc1], digit, { reg: reg(0) }); immOut(imm(1), 1); }
      break;
    }
    case 'shlcl': case 'sarcl': case 'shrcl': modrm(b, [0xd3], { shlcl: 4, shrcl: 5, sarcl: 7 }[mi.op], { reg: reg(0) }); break;
    case 'set': {
      const cc = (o[0] as { cc: string }).cc;
      const r = reg(1);
      modrm(b, [0x0f, 0x90 + CC[cc]], 0, { reg: r }, { w: false, forceRex: r >= 4 && r < 8 });
      break;
    }
    case 'movzx': modrm(b, [0x0f, 0xb6], reg(0), { reg: reg(1) }, { forceRex: true }); break;
    case 'cmov': modrm(b, [0x0f, 0x40 + CC[(o[0] as { cc: string }).cc]], reg(1), { reg: reg(2) }); break;
    case 'push': case 'pop': {
      const r = reg(0);
      if (r >= 8) { b.u8(0x41); b.mark('REX', 1, 'REX.B: r8–r15'); }
      b.u8((mi.op === 'push' ? 0x50 : 0x58) + (r & 7)); b.mark('opcode', 1, `${mi.op === 'push' ? '50' : '58'}+r`);
      break;
    }
    case 'ret': b.u8(0xc3); b.mark('opcode', 1); break;
    case 'call': {
      b.u8(0xe8); b.mark('opcode', 1, 'call rel32');
      const at = b.bytes.length;
      b.i32(0); b.mark('rel32', 4, 'filled by the linker');
      const sym = (o[0] as { name: string }).name;
      reloc = { at, sym, type: 4, typeName: 'R_X86_64_PLT32', addend: -4n, why: `pc-relative call to ${sym} (via the PLT if it ends up in a shared library)` };
      break;
    }
    case 'jmp': return { bytes: [], fields: [], branch: { target: label((o[0] as { b: unknown }).b), opShort: [0xeb], opNear: [0xe9], short: true } };
    case 'j': {
      const cc = CC[(o[0] as { cc: string }).cc];
      return { bytes: [], fields: [], branch: { target: label((o[1] as { b: unknown }).b), opShort: [0x70 + cc], opNear: [0x0f, 0x80 + cc], short: true } };
    }
    default: throw new Error(`x86-64 encoder: cannot encode ${mi.op}`);
  }
  return { bytes: b.bytes, fields: b.fields, reloc };
}

export function emitX64(t: Target, funcs: MFunc[], m: Module, fmt: (mi: MInstr, f: MFunc) => string): ObjectCode {
  interface Item { fn: string; mi?: MInstr; label?: string; enc?: XEnc; text: string; funcStart?: boolean }
  const items: Item[] = [];
  for (const f of funcs) {
    items.push({ fn: f.name, label: f.name, text: '', funcStart: true });
    f.blocks.forEach((bl, i) => {
      if (i > 0) items.push({ fn: f.name, label: t.blockLabel(f, bl), text: '' });
      for (const mi of bl.instrs) items.push({ fn: f.name, mi, enc: encodeX64(mi, (x) => t.blockLabel(f, x as never)), text: fmt(mi, f) });
    });
  }
  const relaxations: ObjectCode['relaxations'] = [];
  // start with every jump short; grow the ones that do not reach until nothing changes
  let addrs: number[] = [];
  const labels = new Map<string, number>();
  const size = (it: Item) => (it.enc?.branch ? (it.enc.branch.short ? it.enc.branch.opShort.length + 1 : it.enc.branch.opNear.length + 4) : it.enc?.bytes.length ?? 0);
  for (let iter = 0; iter < 50; iter++) {
    let a = 0;
    addrs = items.map((it) => {
      if (it.funcStart) a = Math.ceil(a / 16) * 16;
      if (it.label) labels.set(it.label, a);
      const at = a;
      a += size(it);
      return at;
    });
    let grew = false;
    items.forEach((it, k) => {
      const br = it.enc?.branch;
      if (!br?.short) return;
      const d = labels.get(br.target)! - (addrs[k] + size(it));
      if (!fits8(d)) { br.short = false; grew = true; relaxations.push({ fn: it.fn, at: addrs[k], what: `${it.text}: target ${d} bytes away does not fit rel8 → rel32` }); }
    });
    if (!grew) break;
  }
  const text: number[] = [];
  const relocs: Reloc[] = [];
  const listing: ListingEntry[] = [];
  const symbols: SymDef[] = [];
  let fnStart = 0, curFn = '', fnEnd = 0;
  items.forEach((it, k) => {
    while (text.length < addrs[k]) text.push(0x90); // nop padding between functions
    if (it.funcStart) {
      if (curFn) symbols.push({ name: curFn, section: '.text', offset: fnStart, size: fnEnd - fnStart, global: true, kind: 'func' });
      curFn = it.fn; fnStart = addrs[k];
    }
    if (it.label) { listing.push({ section: '.text', addr: addrs[k], bytes: [], text: '', label: it.label, fn: it.fn }); return; }
    const e = it.enc!;
    let bytes = e.bytes, fields = e.fields;
    if (e.branch) {
      const br = e.branch;
      const op = br.short ? br.opShort : br.opNear;
      const d = labels.get(br.target)! - (addrs[k] + size(it));
      const bb = new B();
      for (const x of op) bb.u8(x);
      bb.mark('opcode', op.length, br.short ? 'short form (rel8)' : 'near form (rel32)');
      if (br.short) bb.u8(d); else bb.i32(d);
      bb.mark(br.short ? 'rel8' : 'rel32', br.short ? 1 : 4, `${d} bytes from the next instruction`);
      bytes = bb.bytes; fields = bb.fields;
    }
    const at = text.length;
    text.push(...bytes);
    const reloc = e.reloc ? { offset: at + e.reloc.at, type: e.reloc.type, typeName: e.reloc.typeName, sym: e.reloc.sym, addend: e.reloc.addend, why: e.reloc.why } : undefined;
    if (reloc) relocs.push(reloc);
    fnEnd = text.length;
    listing.push({ section: '.text', addr: at, bytes, text: it.text, fn: it.fn, mi: it.mi?.id, fields, format: `${bytes.length} bytes`, reloc });
  });
  if (curFn) symbols.push({ name: curFn, section: '.text', offset: fnStart, size: text.length - fnStart, global: true, kind: 'func' });
  const data = dataSections(m);
  const defined = new Set([...symbols, ...data.symbols].map((s) => s.name));
  for (const r of relocs) if (!defined.has(r.sym)) { symbols.push({ name: r.sym, section: '', offset: 0, size: 0, global: true, kind: 'notype' }); defined.add(r.sym); }
  return {
    machine: 'x86_64',
    sections: [{ name: '.text', bytes: new Uint8Array(text), size: text.length, align: 16, relocs, flags: 'ax' }, ...data.sections],
    symbols: [...symbols, ...data.symbols],
    listing,
    relaxations,
  };
}
