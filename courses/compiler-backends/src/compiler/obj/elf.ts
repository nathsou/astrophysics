// ELF64 (little-endian) writer and parser.
// Spec: System V ABI, "Object Files" chapter (the gABI), plus the RISC-V,
// AArch64 and x86-64 psABI supplements for machine numbers and relocations.

import type { Machine, ObjectCode, Reloc } from '../emit/objcode';

export const EM: Record<Machine, number> = { rv64: 243, aarch64: 183, x86_64: 62 };
export const SHT = { NULL: 0, PROGBITS: 1, SYMTAB: 2, STRTAB: 3, RELA: 4, NOBITS: 8 } as const;
export const SHF = { WRITE: 1, ALLOC: 2, EXECINSTR: 4, INFO_LINK: 0x40 } as const;
const SHT_NAMES: Record<number, string> = { 0: 'NULL', 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 8: 'NOBITS' };

class Writer {
  buf: number[] = [];
  get pos() { return this.buf.length; }
  u8(v: number) { this.buf.push(v & 0xff); }
  u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { for (let k = 0; k < 4; k++) this.u8(v >>> (8 * k)); }
  u64(v: bigint | number) { let x = BigInt.asUintN(64, BigInt(v)); for (let k = 0; k < 8; k++) { this.u8(Number(x & 0xffn)); x >>= 8n; } }
  bytes(b: ArrayLike<number>) { for (let k = 0; k < b.length; k++) this.buf.push(b[k]); }
  align(a: number) { while (this.buf.length % a) this.buf.push(0); }
  patch32(at: number, v: number) { for (let k = 0; k < 4; k++) this.buf[at + k] = (v >>> (8 * k)) & 0xff; }
  patch64(at: number, v: number | bigint) { let x = BigInt.asUintN(64, BigInt(v)); for (let k = 0; k < 8; k++) { this.buf[at + k] = Number(x & 0xffn); x >>= 8n; } }
  patch16(at: number, v: number) { this.buf[at] = v & 0xff; this.buf[at + 1] = (v >> 8) & 0xff; }
}

class StrTab {
  data: number[] = [0];
  map = new Map<string, number>();
  add(s: string): number {
    if (!s) return 0;
    const e = this.map.get(s);
    if (e !== undefined) return e;
    const off = this.data.length;
    for (const c of new TextEncoder().encode(s)) this.data.push(c);
    this.data.push(0);
    this.map.set(s, off);
    return off;
  }
}

interface OutSection {
  name: string;
  type: number;
  flags: number;
  addr: number;
  data: ArrayLike<number>;
  size: number;
  link: number;
  info: number;
  align: number;
  entsize: number;
}

function writeElf(machine: Machine, type: 1 | 2, sections: OutSection[], entry: number, segments: { vaddr: number; flags: number; fileOff?: number; secIndex: number[]; memsz: number; filesz: number; align: number }[]): Uint8Array {
  const w = new Writer();
  const phnum = segments.length;
  // header
  w.bytes([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  w.u16(type); w.u16(EM[machine]); w.u32(1); w.u64(entry);
  const phoffAt = w.pos; w.u64(0);
  const shoffAt = w.pos; w.u64(0);
  w.u32(0); // e_flags: RISC-V soft-float ABI, no compressed instructions
  w.u16(64); w.u16(56); w.u16(phnum); w.u16(64); w.u16(sections.length + 1);
  const shstrndxAt = w.pos; w.u16(0);
  // program headers (patched later)
  let phAt = 0;
  if (phnum) { phAt = w.pos; w.patch64(phoffAt, phAt); for (let k = 0; k < phnum * 56; k++) w.u8(0); }
  // section contents
  const offsets: number[] = [];
  for (const s of sections) {
    if (type === 2 && s.flags & SHF.ALLOC && s.type !== SHT.NOBITS) {
      // executable: file offset must be congruent to vaddr modulo page size
      const page = 0x1000;
      while (w.pos % page !== s.addr % page) w.u8(0);
    } else w.align(Math.max(1, Math.min(s.align, 8)));
    offsets.push(w.pos);
    if (s.type !== SHT.NOBITS) w.bytes(s.data);
  }
  w.align(8);
  w.patch64(shoffAt, w.pos);
  // null section header
  for (let k = 0; k < 64; k++) w.u8(0);
  const shstr = new StrTab();
  const nameOff = sections.map((s) => shstr.add(s.name));
  sections.forEach((s, k) => {
    w.u32(nameOff[k]); w.u32(s.type); w.u64(s.flags); w.u64(s.addr); w.u64(offsets[k]);
    w.u64(s.size); w.u32(s.link); w.u32(s.info); w.u64(s.align); w.u64(s.entsize);
  });
  // .shstrtab contents must be known before writing: we cheat by making it the last section and rewriting
  const shIdx = sections.findIndex((s) => s.name === '.shstrtab');
  w.patch16(shstrndxAt, shIdx + 1);
  const bytes = new Uint8Array(w.buf);
  // segments
  segments.forEach((seg, k) => {
    const at = phAt + 56 * k;
    const first = seg.secIndex[0];
    const off = seg.fileOff ?? offsets[first];
    const v = new DataView(bytes.buffer);
    v.setUint32(at, 1, true); v.setUint32(at + 4, seg.flags, true);
    v.setBigUint64(at + 8, BigInt(off), true); v.setBigUint64(at + 16, BigInt(seg.vaddr), true); v.setBigUint64(at + 24, BigInt(seg.vaddr), true);
    v.setBigUint64(at + 32, BigInt(seg.filesz), true); v.setBigUint64(at + 40, BigInt(seg.memsz), true); v.setBigUint64(at + 48, BigInt(seg.align), true);
  });
  return bytes;
}

/** Build the symbol table + string table for a set of symbols (locals first, as ELF requires). */
function symtab(symbols: { name: string; value: number; size: number; bind: number; type: number; shndx: number }[]) {
  const strtab = new StrTab();
  const sorted = [...symbols].sort((a, b) => a.bind - b.bind);
  const w = new Writer();
  for (let k = 0; k < 24; k++) w.u8(0);
  const index = new Map<string, number>();
  sorted.forEach((s, k) => {
    w.u32(strtab.add(s.name)); w.u8((s.bind << 4) | s.type); w.u8(0); w.u16(s.shndx); w.u64(s.value); w.u64(s.size);
    index.set(s.name, k + 1);
  });
  const firstGlobal = sorted.findIndex((s) => s.bind !== 0);
  return { data: w.buf, strtab: strtab.data, index, info: firstGlobal < 0 ? sorted.length + 1 : firstGlobal + 1 };
}

const STT = { notype: 0, object: 1, func: 2, section: 3, file: 4 } as const;

export function writeElfObject(obj: ObjectCode, fileName = 'program.kiln'): Uint8Array {
  const out: OutSection[] = [];
  const secIndex = new Map<string, number>();
  for (const s of obj.sections) {
    secIndex.set(s.name, out.length + 1);
    out.push({
      name: s.name, type: s.flags === 'bss' ? SHT.NOBITS : SHT.PROGBITS,
      flags: s.flags === 'ax' ? SHF.ALLOC | SHF.EXECINSTR : s.flags === 'a' ? SHF.ALLOC : SHF.ALLOC | SHF.WRITE,
      addr: 0, data: s.bytes, size: s.size, link: 0, info: 0, align: s.align, entsize: 0,
    });
  }
  const syms = [
    { name: fileName, value: 0, size: 0, bind: 0, type: STT.file, shndx: 0xfff1 },
    ...obj.symbols.map((s) => ({ name: s.name, value: s.offset, size: s.size, bind: s.global ? 1 : 0, type: STT[s.kind], shndx: s.section ? secIndex.get(s.section)! : 0 })),
  ];
  const st = symtab(syms);
  const symtabIdx = out.length + obj.sections.filter((s) => s.relocs.length).length + 1;
  for (const s of obj.sections) {
    if (!s.relocs.length) continue;
    const w = new Writer();
    for (const r of s.relocs) {
      w.u64(r.offset);
      w.u64((BigInt(st.index.get(r.sym) ?? 0) << 32n) | BigInt(r.type));
      w.u64(r.addend);
    }
    out.push({ name: `.rela${s.name}`, type: SHT.RELA, flags: SHF.INFO_LINK, addr: 0, data: w.buf, size: w.buf.length, link: symtabIdx, info: secIndex.get(s.name)!, align: 8, entsize: 24 });
  }
  out.push({ name: '.symtab', type: SHT.SYMTAB, flags: 0, addr: 0, data: st.data, size: st.data.length, link: symtabIdx + 1, info: st.info, align: 8, entsize: 24 });
  out.push({ name: '.strtab', type: SHT.STRTAB, flags: 0, addr: 0, data: st.strtab, size: st.strtab.length, link: 0, info: 0, align: 1, entsize: 0 });
  const shstr = new StrTab();
  for (const s of out) shstr.add(s.name);
  shstr.add('.shstrtab');
  out.push({ name: '.shstrtab', type: SHT.STRTAB, flags: 0, addr: 0, data: shstr.data, size: shstr.data.length, link: 0, info: 0, align: 1, entsize: 0 });
  return writeElf(obj.machine, 1, out, 0, []);
}

export interface ExecImage {
  machine: Machine;
  entry: number;
  sections: { name: string; addr: number; bytes: Uint8Array; size: number; flags: 'ax' | 'aw' | 'bss' }[];
  symbols: { name: string; addr: number; size: number; kind: 'func' | 'object' | 'notype'; global: boolean; section: string }[];
}

export function writeElfExec(img: ExecImage): Uint8Array {
  const out: OutSection[] = img.sections.map((s) => ({
    name: s.name, type: s.flags === 'bss' ? SHT.NOBITS : SHT.PROGBITS,
    flags: s.flags === 'ax' ? SHF.ALLOC | SHF.EXECINSTR : SHF.ALLOC | SHF.WRITE,
    addr: s.addr, data: s.bytes, size: s.size, link: 0, info: 0, align: s.flags === 'ax' ? 4 : 8, entsize: 0,
  }));
  const secIdx = new Map(img.sections.map((s, k) => [s.name, k + 1]));
  const st = symtab(img.symbols.map((s) => ({ name: s.name, value: s.addr, size: s.size, bind: s.global ? 1 : 0, type: STT[s.kind], shndx: secIdx.get(s.section) ?? 0xfff1 })));
  const symIdx = out.length + 1;
  out.push({ name: '.symtab', type: SHT.SYMTAB, flags: 0, addr: 0, data: st.data, size: st.data.length, link: symIdx + 1, info: st.info, align: 8, entsize: 24 });
  out.push({ name: '.strtab', type: SHT.STRTAB, flags: 0, addr: 0, data: st.strtab, size: st.strtab.length, link: 0, info: 0, align: 1, entsize: 0 });
  const shstr = new StrTab();
  for (const s of out) shstr.add(s.name);
  shstr.add('.shstrtab');
  out.push({ name: '.shstrtab', type: SHT.STRTAB, flags: 0, addr: 0, data: shstr.data, size: shstr.data.length, link: 0, info: 0, align: 1, entsize: 0 });
  // one PT_LOAD per allocated section group: text (R+X) and data+bss (R+W)
  const segs: { vaddr: number; flags: number; secIndex: number[]; memsz: number; filesz: number; align: number }[] = [];
  const text = img.sections.filter((s) => s.flags === 'ax');
  const rw = img.sections.filter((s) => s.flags !== 'ax');
  if (text.length) {
    const lo = text[0].addr, hi = Math.max(...text.map((s) => s.addr + s.size));
    segs.push({ vaddr: lo, flags: 5, secIndex: [secIdx.get(text[0].name)! - 1], memsz: hi - lo, filesz: hi - lo, align: 0x1000 });
  }
  if (rw.length) {
    const lo = rw[0].addr;
    const fileHi = Math.max(lo, ...rw.filter((s) => s.flags !== 'bss').map((s) => s.addr + s.size));
    const hi = Math.max(...rw.map((s) => s.addr + s.size));
    segs.push({ vaddr: lo, flags: 6, secIndex: [secIdx.get(rw[0].name)! - 1], memsz: hi - lo, filesz: fileHi - lo, align: 0x1000 });
  }
  return writeElf(img.machine, 2, out, img.entry, segs);
}

// ---------------------------------------------------------------- parsing

export interface ElfRegion {
  start: number;
  end: number;
  label: string;
  kind: 'header' | 'phdr' | 'shdr' | 'section' | 'symbol' | 'reloc' | 'string' | 'code' | 'data' | 'padding';
  fields?: { name: string; off: number; size: number; value: string; desc?: string }[];
}

export interface ElfSection {
  index: number;
  name: string;
  type: number;
  typeName: string;
  flags: number;
  addr: number;
  offset: number;
  size: number;
  link: number;
  info: number;
  align: number;
  entsize: number;
  data: Uint8Array;
}

export interface ElfSymbol { index: number; name: string; value: number; size: number; bind: 'LOCAL' | 'GLOBAL' | 'WEAK'; type: string; shndx: number; section: string }
export interface ElfReloc { section: string; target: string; offset: number; type: number; typeName: string; sym: number; symName: string; addend: bigint }
export interface ElfSegment { type: number; flags: number; offset: number; vaddr: number; filesz: number; memsz: number; align: number }

export interface ElfFile {
  type: number;
  machine: number;
  entry: number;
  sections: ElfSection[];
  symbols: ElfSymbol[];
  relocs: ElfReloc[];
  segments: ElfSegment[];
  regions: ElfRegion[];
  bytes: Uint8Array;
}

export const RELOC_NAMES: Record<number, Record<number, string>> = {
  243: { 2: 'R_RISCV_64', 16: 'R_RISCV_BRANCH', 17: 'R_RISCV_JAL', 19: 'R_RISCV_CALL_PLT', 23: 'R_RISCV_PCREL_HI20', 24: 'R_RISCV_PCREL_LO12_I', 25: 'R_RISCV_PCREL_LO12_S', 51: 'R_RISCV_RELAX' },
  183: { 257: 'R_AARCH64_ABS64', 275: 'R_AARCH64_ADR_PREL_PG_HI21', 277: 'R_AARCH64_ADD_ABS_LO12_NC', 282: 'R_AARCH64_JUMP26', 283: 'R_AARCH64_CALL26', 286: 'R_AARCH64_LDST64_ABS_LO12_NC' },
  62: { 1: 'R_X86_64_64', 2: 'R_X86_64_PC32', 4: 'R_X86_64_PLT32' },
};

export function parseElf(bytes: Uint8Array): ElfFile {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, false) !== 0x7f454c46) throw new Error('not an ELF file (bad magic)');
  if (bytes[4] !== 2 || bytes[5] !== 1) throw new Error('only ELF64 little-endian is supported');
  const u16 = (o: number) => v.getUint16(o, true), u32 = (o: number) => v.getUint32(o, true), u64 = (o: number) => Number(v.getBigUint64(o, true));
  const type = u16(16), machine = u16(18), entry = u64(24), phoff = u64(32), shoff = u64(40);
  const phnum = u16(56), shnum = u16(60), shstrndx = u16(62);
  const regions: ElfRegion[] = [];
  const hex = (n: number | bigint) => '0x' + n.toString(16);
  regions.push({
    start: 0, end: 64, label: 'ELF header', kind: 'header', fields: [
      { name: 'e_ident[EI_MAG]', off: 0, size: 4, value: '7f 45 4c 46', desc: "magic: 0x7f 'E' 'L' 'F'" },
      { name: 'e_ident[EI_CLASS]', off: 4, size: 1, value: String(bytes[4]), desc: '2 = ELFCLASS64 (64-bit)' },
      { name: 'e_ident[EI_DATA]', off: 5, size: 1, value: String(bytes[5]), desc: '1 = little-endian' },
      { name: 'e_ident[EI_VERSION]', off: 6, size: 1, value: String(bytes[6]), desc: 'ELF version 1' },
      { name: 'e_ident[EI_OSABI]', off: 7, size: 9, value: String(bytes[7]), desc: '0 = System V; rest is padding' },
      { name: 'e_type', off: 16, size: 2, value: String(type), desc: type === 1 ? 'ET_REL: relocatable object (.o)' : type === 2 ? 'ET_EXEC: executable' : 'other' },
      { name: 'e_machine', off: 18, size: 2, value: String(machine), desc: machine === 243 ? 'EM_RISCV' : machine === 183 ? 'EM_AARCH64' : machine === 62 ? 'EM_X86_64' : '?' },
      { name: 'e_version', off: 20, size: 4, value: String(u32(20)) },
      { name: 'e_entry', off: 24, size: 8, value: hex(entry), desc: 'virtual address where execution starts (0 for .o files)' },
      { name: 'e_phoff', off: 32, size: 8, value: String(phoff), desc: 'file offset of the program header table' },
      { name: 'e_shoff', off: 40, size: 8, value: String(shoff), desc: 'file offset of the section header table' },
      { name: 'e_flags', off: 48, size: 4, value: hex(u32(48)), desc: 'processor-specific flags (RISC-V: float ABI, RVC)' },
      { name: 'e_ehsize', off: 52, size: 2, value: String(u16(52)) },
      { name: 'e_phentsize', off: 54, size: 2, value: String(u16(54)) },
      { name: 'e_phnum', off: 56, size: 2, value: String(phnum) },
      { name: 'e_shentsize', off: 58, size: 2, value: String(u16(58)) },
      { name: 'e_shnum', off: 60, size: 2, value: String(shnum) },
      { name: 'e_shstrndx', off: 62, size: 2, value: String(shstrndx), desc: 'index of the section holding section names' },
    ],
  });
  const segments: ElfSegment[] = [];
  for (let k = 0; k < phnum; k++) {
    const o = phoff + 56 * k;
    const seg = { type: u32(o), flags: u32(o + 4), offset: u64(o + 8), vaddr: u64(o + 16), filesz: u64(o + 32), memsz: u64(o + 40), align: u64(o + 48) };
    segments.push(seg);
    const fl = `${seg.flags & 4 ? 'R' : '-'}${seg.flags & 2 ? 'W' : '-'}${seg.flags & 1 ? 'X' : '-'}`;
    regions.push({
      start: o, end: o + 56, label: `program header ${k} (PT_LOAD ${fl})`, kind: 'phdr', fields: [
        { name: 'p_type', off: o, size: 4, value: String(seg.type), desc: 'PT_LOAD: map this range into memory' },
        { name: 'p_flags', off: o + 4, size: 4, value: fl },
        { name: 'p_offset', off: o + 8, size: 8, value: hex(seg.offset) },
        { name: 'p_vaddr', off: o + 16, size: 8, value: hex(seg.vaddr) },
        { name: 'p_paddr', off: o + 24, size: 8, value: hex(u64(o + 24)) },
        { name: 'p_filesz', off: o + 32, size: 8, value: String(seg.filesz) },
        { name: 'p_memsz', off: o + 40, size: 8, value: String(seg.memsz), desc: 'memsz > filesz: the rest is zero-filled (.bss)' },
        { name: 'p_align', off: o + 48, size: 8, value: hex(seg.align) },
      ],
    });
  }
  const raw: { o: number; name: number; type: number; flags: number; addr: number; offset: number; size: number; link: number; info: number; align: number; entsize: number }[] = [];
  for (let k = 0; k < shnum; k++) {
    const o = shoff + 64 * k;
    raw.push({ o, name: u32(o), type: u32(o + 4), flags: u64(o + 8), addr: u64(o + 16), offset: u64(o + 24), size: u64(o + 32), link: u32(o + 40), info: u32(o + 44), align: u64(o + 48), entsize: u64(o + 56) });
  }
  const shstr = raw[shstrndx];
  const cstr = (off: number) => { let e = off; while (bytes[e]) e++; return new TextDecoder().decode(bytes.subarray(off, e)); };
  const sections: ElfSection[] = raw.map((r, k) => ({
    index: k, name: k ? cstr(shstr.offset + r.name) : '', type: r.type, typeName: SHT_NAMES[r.type] ?? String(r.type), flags: r.flags, addr: r.addr,
    offset: r.offset, size: r.size, link: r.link, info: r.info, align: r.align, entsize: r.entsize,
    data: r.type === SHT.NOBITS ? new Uint8Array(0) : bytes.subarray(r.offset, r.offset + r.size),
  }));
  sections.forEach((s, k) => {
    const o = raw[k].o;
    regions.push({
      start: o, end: o + 64, label: `section header ${k}${s.name ? ` (${s.name})` : ' (null)'}`, kind: 'shdr', fields: [
        { name: 'sh_name', off: o, size: 4, value: String(raw[k].name), desc: `offset into .shstrtab → "${s.name}"` },
        { name: 'sh_type', off: o + 4, size: 4, value: `${s.type} (${s.typeName})` },
        { name: 'sh_flags', off: o + 8, size: 8, value: `${s.flags & 2 ? 'A' : ''}${s.flags & 1 ? 'W' : ''}${s.flags & 4 ? 'X' : ''}${s.flags & 0x40 ? 'I' : ''}` || '0' },
        { name: 'sh_addr', off: o + 16, size: 8, value: hex(s.addr) },
        { name: 'sh_offset', off: o + 24, size: 8, value: String(s.offset) },
        { name: 'sh_size', off: o + 32, size: 8, value: String(s.size) },
        { name: 'sh_link', off: o + 40, size: 4, value: String(s.link) },
        { name: 'sh_info', off: o + 44, size: 4, value: String(s.info) },
        { name: 'sh_addralign', off: o + 48, size: 8, value: String(s.align) },
        { name: 'sh_entsize', off: o + 56, size: 8, value: String(s.entsize) },
      ],
    });
    if (k && s.type !== SHT.NOBITS && s.size) {
      const kind = s.type === SHT.SYMTAB ? 'symbol' : s.type === SHT.RELA ? 'reloc' : s.type === SHT.STRTAB ? 'string' : s.flags & SHF.EXECINSTR ? 'code' : 'data';
      if (kind !== 'symbol' && kind !== 'reloc') regions.push({ start: s.offset, end: s.offset + s.size, label: s.name, kind });
    }
  });
  const symbols: ElfSymbol[] = [];
  const symtabSec = sections.find((s) => s.type === SHT.SYMTAB);
  if (symtabSec) {
    const strSec = sections[symtabSec.link];
    const n = symtabSec.size / 24;
    for (let k = 0; k < n; k++) {
      const o = symtabSec.offset + 24 * k;
      const info = bytes[o + 4];
      const shndx = u16(o + 6);
      const s: ElfSymbol = {
        index: k, name: cstr(strSec.offset + u32(o)), value: u64(o + 8), size: u64(o + 16),
        bind: (['LOCAL', 'GLOBAL', 'WEAK'] as const)[info >> 4] ?? 'LOCAL',
        type: ['NOTYPE', 'OBJECT', 'FUNC', 'SECTION', 'FILE'][info & 15] ?? String(info & 15),
        shndx, section: shndx === 0 ? 'UND' : shndx === 0xfff1 ? 'ABS' : sections[shndx]?.name ?? '?',
      };
      symbols.push(s);
      regions.push({
        start: o, end: o + 24, label: k ? `symbol ${k}: ${s.name || '(none)'}` : 'symbol 0 (null)', kind: 'symbol', fields: [
          { name: 'st_name', off: o, size: 4, value: String(u32(o)), desc: `→ "${s.name}"` },
          { name: 'st_info', off: o + 4, size: 1, value: hex(info), desc: `bind ${s.bind}, type ${s.type}` },
          { name: 'st_other', off: o + 5, size: 1, value: String(bytes[o + 5]), desc: 'visibility (0 = default)' },
          { name: 'st_shndx', off: o + 6, size: 2, value: String(shndx), desc: s.section === 'UND' ? 'undefined: must be resolved by the linker' : `section ${s.section}` },
          { name: 'st_value', off: o + 8, size: 8, value: hex(s.value), desc: type === 1 ? 'offset within its section' : 'virtual address' },
          { name: 'st_size', off: o + 16, size: 8, value: String(s.size) },
        ],
      });
    }
  }
  const relocs: ElfReloc[] = [];
  for (const s of sections) {
    if (s.type !== SHT.RELA) continue;
    const target = sections[s.info].name;
    const n = s.size / 24;
    for (let k = 0; k < n; k++) {
      const o = s.offset + 24 * k;
      const info = v.getBigUint64(o + 8, true);
      const sym = Number(info >> 32n), rtype = Number(info & 0xffffffffn);
      const r: ElfReloc = { section: s.name, target, offset: u64(o), type: rtype, typeName: RELOC_NAMES[machine]?.[rtype] ?? `type ${rtype}`, sym, symName: symbols[sym]?.name ?? '?', addend: v.getBigInt64(o + 16, true) };
      relocs.push(r);
      regions.push({
        start: o, end: o + 24, label: `relocation: ${r.typeName} → ${r.symName}`, kind: 'reloc', fields: [
          { name: 'r_offset', off: o, size: 8, value: hex(r.offset), desc: `where in ${target} to patch` },
          { name: 'r_info', off: o + 8, size: 8, value: hex(info), desc: `symbol #${sym} (${r.symName}) << 32 | type ${rtype} (${r.typeName})` },
          { name: 'r_addend', off: o + 16, size: 8, value: String(r.addend), desc: 'constant added to the symbol value' },
        ],
      });
    }
  }
  regions.sort((a, b) => a.start - b.start || b.end - a.end);
  return { type, machine, entry, sections, symbols, relocs, segments, regions, bytes };
}

export type { Reloc };
