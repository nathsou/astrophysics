/**
 * A reader for the 32-bit little-endian RISC-V ELF files of riscv-arch-test, for `validate:rv32i`: the loadable
 * segments, the entry point and the symbol table (`begin_signature`, `end_signature`, `tohost`). `buildElf32`
 * writes a minimal file of the same kind, for the tests.
 */
export interface ElfSegment {
  vaddr: number;
  /** The file bytes, followed by zeros up to the segment's size in memory. */
  data: Uint8Array;
}

export interface Elf32 {
  entry: number;
  segments: ElfSegment[];
  symbols: Map<string, number>;
}

export class ElfError extends Error {}

export function parseElf32(bytes: Uint8Array): Elf32 {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 52 || v.getUint32(0, false) !== 0x7f454c46) throw new ElfError('not an ELF file');
  if (bytes[4] !== 1) throw new ElfError('not a 32-bit ELF file');
  if (bytes[5] !== 1) throw new ElfError('not a little-endian ELF file');
  if (v.getUint16(18, true) !== 0xf3) throw new ElfError(`not a RISC-V ELF file (machine ${v.getUint16(18, true)})`);
  const entry = v.getUint32(24, true);
  const phoff = v.getUint32(28, true);
  const shoff = v.getUint32(32, true);
  const phentsize = v.getUint16(42, true);
  const phnum = v.getUint16(44, true);
  const shentsize = v.getUint16(46, true);
  const shnum = v.getUint16(48, true);
  const segments: ElfSegment[] = [];
  for (let i = 0; i < phnum; i++) {
    const p = phoff + i * phentsize;
    if (v.getUint32(p, true) !== 1) continue; // PT_LOAD
    const offset = v.getUint32(p + 4, true);
    const vaddr = v.getUint32(p + 8, true);
    const filesz = v.getUint32(p + 16, true);
    const memsz = v.getUint32(p + 20, true);
    if (offset + filesz > bytes.length) throw new ElfError('a segment extends past the end of the file');
    const data = new Uint8Array(memsz);
    data.set(bytes.subarray(offset, offset + filesz));
    if (memsz > 0) segments.push({ vaddr, data });
  }
  const symbols = new Map<string, number>();
  for (let i = 0; i < shnum; i++) {
    const s = shoff + i * shentsize;
    if (v.getUint32(s + 4, true) !== 2) continue; // SHT_SYMTAB
    const offset = v.getUint32(s + 16, true);
    const size = v.getUint32(s + 20, true);
    const link = shoff + v.getUint32(s + 24, true) * shentsize;
    const strOffset = v.getUint32(link + 16, true);
    for (let k = 0; k + 16 <= size; k += 16) {
      const nameAt = strOffset + v.getUint32(offset + k, true);
      let end = nameAt;
      while (bytes[end]) end++;
      const name = new TextDecoder().decode(bytes.subarray(nameAt, end));
      if (name) symbols.set(name, v.getUint32(offset + k + 4, true));
    }
  }
  return { entry, segments, symbols };
}

/** A minimal RISC-V ELF32: one loadable segment at `vaddr` holding `image`, and a symbol table. */
export function buildElf32(opts: { vaddr: number; image: Uint8Array; entry: number; symbols: Record<string, number> }): Uint8Array {
  const strings: number[] = [0];
  const nameOffsets = Object.keys(opts.symbols).map((n) => {
    const at = strings.length;
    strings.push(...new TextEncoder().encode(n), 0);
    return at;
  });
  const names = Object.keys(opts.symbols);
  const symtab = new Uint8Array((names.length + 1) * 16);
  const sv = new DataView(symtab.buffer);
  names.forEach((n, i) => {
    sv.setUint32((i + 1) * 16, nameOffsets[i]!, true);
    sv.setUint32((i + 1) * 16 + 4, opts.symbols[n]! >>> 0, true);
    symtab[(i + 1) * 16 + 12] = 0x10; // global, no type
  });
  const phoff = 52;
  const dataOff = phoff + 32;
  const symOff = dataOff + opts.image.length;
  const strOff = symOff + symtab.length;
  const shoff = (strOff + strings.length + 3) & ~3;
  const out = new Uint8Array(shoff + 3 * 40);
  const v = new DataView(out.buffer);
  out.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0);
  v.setUint16(16, 2, true);
  v.setUint16(18, 0xf3, true);
  v.setUint32(20, 1, true);
  v.setUint32(24, opts.entry >>> 0, true);
  v.setUint32(28, phoff, true);
  v.setUint32(32, shoff, true);
  v.setUint16(40, 52, true);
  v.setUint16(42, 32, true);
  v.setUint16(44, 1, true);
  v.setUint16(46, 40, true);
  v.setUint16(48, 3, true);
  v.setUint32(phoff, 1, true);
  v.setUint32(phoff + 4, dataOff, true);
  v.setUint32(phoff + 8, opts.vaddr >>> 0, true);
  v.setUint32(phoff + 12, opts.vaddr >>> 0, true);
  v.setUint32(phoff + 16, opts.image.length, true);
  v.setUint32(phoff + 20, opts.image.length, true);
  v.setUint32(phoff + 24, 7, true);
  out.set(opts.image, dataOff);
  out.set(symtab, symOff);
  out.set(strings, strOff);
  // Section 1: .symtab (links to section 2); section 2: .strtab.
  const s1 = shoff + 40;
  v.setUint32(s1 + 4, 2, true);
  v.setUint32(s1 + 16, symOff, true);
  v.setUint32(s1 + 20, symtab.length, true);
  v.setUint32(s1 + 24, 2, true);
  v.setUint32(s1 + 36, 16, true);
  const s2 = shoff + 80;
  v.setUint32(s2 + 4, 3, true);
  v.setUint32(s2 + 16, strOff, true);
  v.setUint32(s2 + 20, strings.length, true);
  return out;
}
