// An RV64IM (+ Zba, Zicond) emulator that loads a static ELF executable and
// runs it with a tiny Linux system-call layer (write, exit). This is how the
// course "executes the machine code" it generates, entirely in the browser.

import { parseElf } from '../obj/elf';
import { disasmRV, RV_ABI } from '../emit/rv64asm';

const MEM_SIZE = 1 << 24; // 16 MiB address space
export const STACK_TOP = MEM_SIZE - 16;
const M64 = (1n << 64n) - 1n;
const s64 = (v: bigint) => BigInt.asIntN(64, v);
const u64 = (v: bigint) => BigInt.asUintN(64, v);

interface Dec { op: number; rd: number; rs1: number; rs2: number; f3: number; f7: number; imm: bigint; immN: number }

export interface EmuResult {
  output: string;
  exitCode: bigint;
  steps: number;
  error?: string;
  /** execution count per pc */
  profile: Map<number, number>;
  maxStackDepth: number;
}

export interface Symbolized { name: string; addr: number; size: number }

export class RV64 {
  mem = new Uint8Array(MEM_SIZE);
  view = new DataView(this.mem.buffer);
  x: bigint[] = new Array(32).fill(0n);
  pc = 0;
  steps = 0;
  output = '';
  exited = false;
  exitCode = 0n;
  textLo = 0;
  textHi = 0;
  decoded: (Dec | undefined)[] = [];
  profile = new Map<number, number>();
  minSp = STACK_TOP;
  symbols: Symbolized[] = [];
  /** last memory write, for the step-through view */
  lastWrite?: { addr: number; size: number };

  constructor(exe: Uint8Array) {
    const elf = parseElf(exe);
    if (elf.machine !== 243) throw new Error('not a RISC-V executable');
    for (const seg of elf.segments) {
      if (seg.type !== 1) continue;
      if (seg.vaddr + seg.memsz > MEM_SIZE) throw new Error('segment outside emulated memory');
      this.mem.set(exe.subarray(seg.offset, seg.offset + seg.filesz), seg.vaddr);
      if (seg.flags & 1) { this.textLo = seg.vaddr; this.textHi = seg.vaddr + seg.memsz; }
    }
    this.symbols = elf.symbols.filter((s) => s.type === 'FUNC').map((s) => ({ name: s.name, addr: s.value, size: s.size })).sort((a, b) => a.addr - b.addr);
    this.pc = elf.entry;
    this.x[2] = BigInt(STACK_TOP);
  }

  symbolize(pc: number): string {
    for (const s of this.symbols) if (pc >= s.addr && pc < s.addr + Math.max(4, s.size)) return pc === s.addr ? s.name : `${s.name}+${pc - s.addr}`;
    return '0x' + pc.toString(16);
  }

  fault(msg: string): never {
    throw new Error(`${msg} at pc=0x${this.pc.toString(16)} (${this.symbolize(this.pc)})`);
  }

  addr(a: bigint, size: number): number {
    const n = Number(u64(a));
    if (n < 0x10000 || n + size > MEM_SIZE) this.fault(`segmentation fault: access to 0x${u64(a).toString(16)}`);
    return n;
  }

  decode(pc: number): Dec {
    const k = (pc - this.textLo) >> 2;
    let d = this.decoded[k];
    if (d) return d;
    if (pc < this.textLo || pc >= this.textHi || pc & 3) this.fault('instruction fetch outside .text');
    const w = this.view.getUint32(pc, true);
    const op = w & 0x7f, rd = (w >>> 7) & 31, f3 = (w >>> 12) & 7, rs1 = (w >>> 15) & 31, rs2 = (w >>> 20) & 31, f7 = w >>> 25;
    let immN = 0;
    switch (op) {
      case 0x37: case 0x17: immN = w & 0xfffff000; immN = immN | 0; break;
      case 0x6f: immN = (((w >>> 31) << 20) | (((w >>> 12) & 0xff) << 12) | (((w >>> 20) & 1) << 11) | (((w >>> 21) & 0x3ff) << 1)) << 11 >> 11; break;
      case 0x63: immN = (((w >>> 31) << 12) | (((w >>> 7) & 1) << 11) | (((w >>> 25) & 0x3f) << 5) | (((w >>> 8) & 0xf) << 1)) << 19 >> 19; break;
      case 0x23: immN = (((w >>> 25) << 5) | ((w >>> 7) & 31)) << 20 >> 20; break;
      default: immN = (w | 0) >> 20;
    }
    d = { op, rd, rs1, rs2, f3, f7, imm: BigInt(immN), immN };
    this.decoded[k] = d;
    return d;
  }

  /** Execute one instruction. */
  step() {
    const pc = this.pc;
    const d = this.decode(pc);
    const x = this.x;
    this.steps++;
    this.profile.set(pc, (this.profile.get(pc) ?? 0) + 1);
    this.lastWrite = undefined;
    let next = pc + 4;
    const a = x[d.rs1], b = x[d.rs2];
    let r: bigint | undefined;
    switch (d.op) {
      case 0x37: r = BigInt(d.immN); break; // lui
      case 0x17: r = s64(BigInt(pc) + BigInt(d.immN)); break; // auipc
      case 0x6f: r = BigInt(pc + 4); next = pc + d.immN; break; // jal
      case 0x67: r = BigInt(pc + 4); next = Number(u64(a + d.imm) & ~1n); break; // jalr
      case 0x63: {
        let t = false;
        switch (d.f3) {
          case 0: t = a === b; break;
          case 1: t = a !== b; break;
          case 4: t = a < b; break;
          case 5: t = a >= b; break;
          case 6: t = u64(a) < u64(b); break;
          case 7: t = u64(a) >= u64(b); break;
          default: this.fault('illegal branch');
        }
        if (t) next = pc + d.immN;
        break;
      }
      case 0x03: {
        const ad = this.addr(a + d.imm, 8);
        switch (d.f3) {
          case 0: r = BigInt(this.view.getInt8(ad)); break;
          case 1: r = BigInt(this.view.getInt16(ad, true)); break;
          case 2: r = BigInt(this.view.getInt32(ad, true)); break;
          case 3: r = this.view.getBigInt64(ad, true); break;
          case 4: r = BigInt(this.view.getUint8(ad)); break;
          case 5: r = BigInt(this.view.getUint16(ad, true)); break;
          case 6: r = BigInt(this.view.getUint32(ad, true)); break;
          default: this.fault('illegal load');
        }
        break;
      }
      case 0x23: {
        const size = 1 << d.f3;
        const ad = this.addr(a + d.imm, size);
        switch (d.f3) {
          case 0: this.view.setUint8(ad, Number(b & 0xffn)); break;
          case 1: this.view.setUint16(ad, Number(b & 0xffffn), true); break;
          case 2: this.view.setUint32(ad, Number(b & 0xffffffffn), true); break;
          case 3: this.view.setBigInt64(ad, b, true); break;
          default: this.fault('illegal store');
        }
        this.lastWrite = { addr: ad, size };
        break;
      }
      case 0x13: {
        const i = d.imm, sh = BigInt(d.rs2 | ((d.f7 & 1) << 5));
        switch (d.f3) {
          case 0: r = s64(a + i); break;
          case 1: r = s64(a << sh); break;
          case 2: r = a < i ? 1n : 0n; break;
          case 3: r = u64(a) < u64(i) ? 1n : 0n; break;
          case 4: r = a ^ i; break;
          case 5: r = d.f7 >> 5 ? a >> sh : s64(u64(a) >> sh); break;
          case 6: r = a | i; break;
          case 7: r = a & i; break;
        }
        break;
      }
      case 0x1b: // addiw
        if (d.f3 !== 0) this.fault('unsupported OP-IMM-32');
        r = BigInt.asIntN(32, a + d.imm);
        break;
      case 0x3b: // addw/subw
        r = BigInt.asIntN(32, d.f7 === 0x20 ? a - b : a + b);
        break;
      case 0x33: {
        const sh = b & 63n;
        if (d.f7 === 0) {
          switch (d.f3) {
            case 0: r = s64(a + b); break;
            case 1: r = s64(a << sh); break;
            case 2: r = a < b ? 1n : 0n; break;
            case 3: r = u64(a) < u64(b) ? 1n : 0n; break;
            case 4: r = a ^ b; break;
            case 5: r = s64(u64(a) >> sh); break;
            case 6: r = a | b; break;
            case 7: r = a & b; break;
          }
        } else if (d.f7 === 0x20) {
          if (d.f3 === 0) r = s64(a - b);
          else if (d.f3 === 5) r = a >> sh;
          else this.fault('illegal instruction');
        } else if (d.f7 === 1) {
          switch (d.f3) {
            case 0: r = s64(a * b); break;
            case 1: r = s64((a * b) >> 64n); break;
            case 3: r = s64((u64(a) * u64(b)) >> 64n); break;
            case 4: r = b === 0n ? -1n : a === -(1n << 63n) && b === -1n ? a : s64(a / b); break;
            case 5: r = b === 0n ? -1n : s64(u64(a) / u64(b)); break;
            case 6: r = b === 0n ? a : a === -(1n << 63n) && b === -1n ? 0n : s64(a % b); break;
            case 7: r = b === 0n ? a : s64(u64(a) % u64(b)); break;
            default: this.fault('illegal M instruction');
          }
        } else if (d.f7 === 0x10) {
          const k = BigInt(d.f3 >> 1);
          r = s64((a << k) + b);
        } else if (d.f7 === 7) {
          r = d.f3 === 5 ? (b === 0n ? 0n : a) : b !== 0n ? 0n : a;
        } else this.fault('illegal instruction');
        break;
      }
      case 0x73:
        this.syscall();
        break;
      default:
        this.fault(`illegal instruction 0x${this.view.getUint32(pc, true).toString(16)}`);
    }
    if (r !== undefined && d.rd !== 0) x[d.rd] = s64(r);
    this.pc = next;
    const sp = Number(u64(x[2]));
    if (sp < this.minSp) this.minSp = sp;
  }

  syscall() {
    const n = Number(this.x[17]);
    switch (n) {
      case 64: { // write(fd, buf, count)
        const buf = this.addr(this.x[11], 1), len = Number(this.x[12]);
        this.output += new TextDecoder().decode(this.mem.subarray(buf, buf + len));
        this.x[10] = BigInt(len);
        break;
      }
      case 93: case 94:
        this.exited = true;
        this.exitCode = this.x[10];
        break;
      default:
        this.fault(`unsupported system call ${n}`);
    }
  }

  run(maxSteps = 20_000_000): EmuResult {
    try {
      while (!this.exited) {
        if (this.steps >= maxSteps) throw new Error(`step limit (${maxSteps}) exceeded — infinite loop?`);
        this.step();
      }
      return this.result();
    } catch (e) {
      return { ...this.result(), error: (e as Error).message };
    }
  }

  result(): EmuResult {
    return { output: this.output, exitCode: this.exitCode, steps: this.steps, profile: this.profile, maxStackDepth: STACK_TOP - this.minSp };
  }

  disasm(pc: number) {
    return disasmRV(this.view.getUint32(pc, true), pc);
  }
}

export function runExecutable(exe: Uint8Array, maxSteps?: number): EmuResult {
  return new RV64(exe).run(maxSteps);
}

export { RV_ABI };
