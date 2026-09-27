// A small static linker for RISC-V ELF64 relocatable objects.
//
// Steps (the same ones ld/lld/mold perform, minus a great many features):
//   1. read every input object
//   2. lay out output sections by concatenating input sections of the same name
//   3. assign virtual addresses (text at 0x11000, data on the next page, bss after data)
//   4. resolve symbols: every undefined reference must match exactly one global definition
//   5. apply relocations: patch instruction/data bits with final addresses
//   6. write an executable with PT_LOAD program headers and an entry point

import { parseElf, writeElfExec, type ElfFile, type ExecImage } from './elf';
import { disasmRV } from '../emit/rv64asm';

export interface LinkInput { name: string; bytes: Uint8Array }

export interface Placement { file: string; section: string; out: string; addr: number; size: number }
export interface ResolvedSym { name: string; addr: number; file: string; section: string; global: boolean; kind: string; size: number }
export interface RelocTrace {
  file: string;
  type: string;
  sym: string;
  P: number;
  S: number;
  A: bigint;
  formula: string;
  value: number;
  before: number;
  after: number;
  beforeText: string;
  afterText: string;
  explain: string;
}

export interface LinkResult {
  exe: Uint8Array;
  image: ExecImage;
  inputs: { name: string; elf: ElfFile }[];
  placements: Placement[];
  symbols: ResolvedSym[];
  relocs: RelocTrace[];
  entry: number;
  log: string[];
}

export const TEXT_BASE = 0x11000;

export function linkObjects(inputs: LinkInput[], entrySym = '_start'): LinkResult {
  const log: string[] = [];
  const files = inputs.map((i) => ({ name: i.name, elf: parseElf(i.bytes) }));
  for (const f of files) {
    if (f.elf.type !== 1) throw new Error(`${f.name}: not a relocatable object`);
    if (f.elf.machine !== 243) throw new Error(`${f.name}: this linker only handles RISC-V objects`);
  }
  // ---- 2+3: layout
  const outNames = ['.text', '.data', '.bss'];
  const placements: Placement[] = [];
  const outBytes = new Map<string, number[]>(outNames.map((n) => [n, []]));
  const outSize = new Map<string, number>(outNames.map((n) => [n, 0]));
  const place = new Map<string, number>(); // `${file}:${secIndex}` -> offset in output section
  for (const f of files) {
    for (const s of f.elf.sections) {
      if (!outNames.includes(s.name)) continue;
      const align = Math.max(1, s.align);
      const off = Math.ceil(outSize.get(s.name)! / align) * align;
      place.set(`${f.name}:${s.index}`, off);
      const buf = outBytes.get(s.name)!;
      while (buf.length < off) buf.push(0);
      if (s.name !== '.bss') for (const b of s.data) buf.push(b);
      outSize.set(s.name, off + s.size);
      placements.push({ file: f.name, section: s.name, out: s.name, addr: off, size: s.size });
    }
  }
  const base = new Map<string, number>();
  base.set('.text', TEXT_BASE);
  const textEnd = TEXT_BASE + outSize.get('.text')!;
  base.set('.data', Math.ceil(textEnd / 0x1000) * 0x1000 + (textEnd % 0x1000));
  base.set('.bss', Math.ceil((base.get('.data')! + outSize.get('.data')!) / 8) * 8);
  for (const p of placements) p.addr += base.get(p.out)!;
  log.push(`.text at 0x${base.get('.text')!.toString(16)} (${outSize.get('.text')} bytes), .data at 0x${base.get('.data')!.toString(16)} (${outSize.get('.data')} bytes), .bss at 0x${base.get('.bss')!.toString(16)} (${outSize.get('.bss')} bytes)`);

  // ---- 4: symbol resolution
  const globals = new Map<string, ResolvedSym>();
  const symAddr = (f: (typeof files)[number], symIdx: number): number => {
    const s = f.elf.symbols[symIdx];
    if (s.section === 'UND') {
      const g = globals.get(s.name);
      if (!g) throw new Error(`${f.name}: undefined reference to \`${s.name}'`);
      return g.addr;
    }
    const sec = f.elf.sections[s.shndx];
    return base.get(sec.name)! + place.get(`${f.name}:${s.shndx}`)! + s.value;
  };
  const all: ResolvedSym[] = [];
  for (const f of files) {
    for (const s of f.elf.symbols) {
      if (!s.index || s.section === 'UND' || s.type === 'FILE' || s.section === 'ABS') continue;
      const sec = f.elf.sections[s.shndx];
      if (!outNames.includes(sec.name)) continue;
      const r: ResolvedSym = { name: s.name, addr: base.get(sec.name)! + place.get(`${f.name}:${s.shndx}`)! + s.value, file: f.name, section: sec.name, global: s.bind !== 'LOCAL', kind: s.type, size: s.size };
      all.push(r);
      if (r.global) {
        const prev = globals.get(s.name);
        if (prev) throw new Error(`multiple definition of \`${s.name}': first in ${prev.file}, again in ${f.name}`);
        globals.set(s.name, r);
      }
    }
  }
  for (const f of files) for (const s of f.elf.symbols) if (s.section === 'UND' && s.index && !globals.has(s.name)) throw new Error(`${f.name}: undefined reference to \`${s.name}'`);
  log.push(`resolved ${globals.size} global symbols`);

  // ---- 5: relocations
  const relocs: RelocTrace[] = [];
  const text = outBytes.get('.text')!;
  const rd32 = (buf: number[], o: number) => (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0;
  const wr32 = (buf: number[], o: number, w: number) => { for (let k = 0; k < 4; k++) buf[o + k] = (w >>> (8 * k)) & 0xff; };
  const hi20 = (off: number) => ((off + 0x800) >> 12) & 0xfffff;
  const lo12 = (off: number) => off - (((off + 0x800) >> 12) << 12);
  const setI = (w: number, imm: number) => ((w & 0x000fffff) | ((imm & 0xfff) << 20)) >>> 0;
  const setU = (w: number, imm20: number) => ((w & 0xfff) | (imm20 << 12)) >>> 0;
  const setB = (w: number, imm: number) => ((w & 0x01fff07f) | (((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3f) << 25) | (((imm >> 1) & 0xf) << 8) | (((imm >> 11) & 1) << 7)) >>> 0;
  const setJ = (w: number, imm: number) => ((w & 0xfff) | (((imm >> 20) & 1) << 31) | (((imm >> 1) & 0x3ff) << 21) | (((imm >> 11) & 1) << 20) | (((imm >> 12) & 0xff) << 12)) >>> 0;
  const hex = (n: number) => '0x' + n.toString(16);

  for (const f of files) {
    // remember the pc-relative offsets computed at each HI20 site, for the paired LO12 relocations
    const hiAt = new Map<number, number>();
    const fileRelocs = f.elf.relocs.filter((r) => outNames.includes(r.target));
    const secIdx = (name: string) => f.elf.sections.find((s) => s.name === name)!.index;
    for (const pass of [0, 1]) {
      for (const r of fileRelocs) {
        const isLo = r.typeName === 'R_RISCV_PCREL_LO12_I' || r.typeName === 'R_RISCV_PCREL_LO12_S';
        if ((pass === 0) === isLo) continue;
        const outName = r.target;
        const buf = outBytes.get(outName)!;
        const secOff = place.get(`${f.name}:${secIdx(r.target)}`)!;
        const o = secOff + r.offset;
        const P = base.get(outName)! + o;
        const S = symAddr(f, r.sym);
        const A = r.addend;
        const before = rd32(buf, o);
        let after = before, formula = '', value = 0, explain = '';
        const off = S + Number(A) - P;
        switch (r.typeName) {
          case 'R_RISCV_CALL_PLT': {
            if (off < -(2 ** 31) || off >= 2 ** 31) throw new Error(`call to ${r.symName} out of range`);
            after = setU(before, hi20(off));
            const jw = rd32(buf, o + 4);
            const jafter = setI(jw, lo12(off));
            wr32(buf, o + 4, jafter);
            formula = 'S + A − P';
            value = off;
            explain = `call distance ${off} = hi20 ${hex(hi20(off))} (into auipc) + lo12 ${lo12(off)} (into the following jalr)`;
            break;
          }
          case 'R_RISCV_PCREL_HI20':
            after = setU(before, hi20(off));
            hiAt.set(P, off);
            formula = 'S + A − P';
            value = off;
            explain = `${r.symName} is ${off} bytes from this auipc; upper part ${hex(hi20(off))} is rounded (+0x800) so the low 12 bits fit in a signed immediate`;
            break;
          case 'R_RISCV_PCREL_LO12_I': case 'R_RISCV_PCREL_LO12_S': {
            // S is the address of the auipc (the local label); the value is the low part of *its* offset
            const hiOff = hiAt.get(S);
            if (hiOff === undefined) throw new Error(`${f.name}: %pcrel_lo without matching %pcrel_hi at ${hex(S)}`);
            const lo = lo12(hiOff);
            after = r.typeName === 'R_RISCV_PCREL_LO12_I' ? setI(before, lo) : ((before & 0x01fff07f) | (((lo >> 5) & 0x7f) << 25) | ((lo & 31) << 7)) >>> 0;
            formula = 'lo12(offset computed at the paired auipc)';
            value = lo;
            explain = `the paired auipc at ${hex(S)} computed offset ${hiOff}; its low 12 bits are ${lo}`;
            break;
          }
          case 'R_RISCV_JAL':
            if (off < -(1 << 20) || off >= 1 << 20) throw new Error(`jal to ${r.symName} out of range`);
            after = setJ(before, off);
            formula = 'S + A − P'; value = off; explain = `21-bit pc-relative jump of ${off} bytes`;
            break;
          case 'R_RISCV_BRANCH':
            after = setB(before, off);
            formula = 'S + A − P'; value = off; explain = `13-bit pc-relative branch of ${off} bytes`;
            break;
          case 'R_RISCV_64': {
            const v = BigInt.asUintN(64, BigInt(S) + A);
            for (let k = 0; k < 8; k++) buf[o + k] = Number((v >> BigInt(8 * k)) & 0xffn);
            formula = 'S + A'; value = Number(v); explain = 'absolute 64-bit address';
            relocs.push({ file: f.name, type: r.typeName, sym: r.symName, P, S, A, formula, value, before, after: rd32(buf, o), beforeText: '.quad 0', afterText: `.quad ${hex(Number(v))}`, explain });
            continue;
          }
          case 'R_RISCV_RELAX':
            continue;
          default:
            throw new Error(`unsupported relocation ${r.typeName}`);
        }
        wr32(buf, o, after);
        relocs.push({ file: f.name, type: r.typeName, sym: r.symName, P, S, A, formula, value, before, after, beforeText: disasmRV(before, P), afterText: disasmRV(after, P), explain });
      }
    }
  }
  log.push(`applied ${relocs.length} relocations`);
  const entry = globals.get(entrySym);
  if (!entry) throw new Error(`entry symbol ${entrySym} not found`);
  void text;
  const image: ExecImage = {
    machine: 'rv64',
    entry: entry.addr,
    sections: outNames.filter((n) => outSize.get(n)! > 0 || n === '.text').map((n) => ({
      name: n, addr: base.get(n)!, bytes: new Uint8Array(outBytes.get(n)!), size: outSize.get(n)!, flags: n === '.text' ? 'ax' : n === '.bss' ? 'bss' : 'aw',
    })),
    symbols: all.filter((s) => !s.name.startsWith('.L')).map((s) => ({ name: s.name, addr: s.addr, size: s.size, kind: s.kind === 'FUNC' ? 'func' : s.kind === 'OBJECT' ? 'object' : 'notype', global: s.global, section: s.section })),
  };
  const exe = writeElfExec(image);
  return { exe, image, inputs: files, placements, symbols: all, relocs, entry: entry.addr, log };
}
