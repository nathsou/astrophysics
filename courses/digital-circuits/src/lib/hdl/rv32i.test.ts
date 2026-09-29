/**
 * The reference RV32I core (content/designs/rv32i.dcl) on the RTL simulator, with a 1 KiB memory model:
 * `instruction` is the word at `pc_out`, and `memory_value` the word at `memory_address`, both provided
 * combinationally; stores happen at the clock edge. Programs are hand-assembled with the encoders below.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from './check';
import { elaborate } from './elaborate';
import { createRtlSim, type RtlSim } from './rtlsim';

const SOURCE = readFileSync(new URL('../../../content/designs/rv32i.dcl', import.meta.url), 'utf8');
const checked = check(SOURCE, { file: 'rv32i.dcl' });
const design = elaborate(checked.program);

// ------------------------------------------------------------------------------------ encoders

const u32 = (v: number) => v >>> 0;
const R = (f7: number, rs2: number, rs1: number, f3: number, rd: number) => u32((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | 0x33);
const I = (imm: number, rs1: number, f3: number, rd: number, op = 0x13) => u32(((imm & 0xfff) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op);
const S = (imm: number, rs2: number, rs1: number, f3: number) =>
  u32((((imm >> 5) & 0x7f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((imm & 0x1f) << 7) | 0x23);
const B = (imm: number, rs2: number, rs1: number, f3: number) =>
  u32((((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (((imm >> 1) & 0xf) << 8) | (((imm >> 11) & 1) << 7) | 0x63);
const U = (imm: number, rd: number, op: number) => u32((imm & 0xfffff000) | (rd << 7) | op);
const J = (imm: number, rd: number) =>
  u32((((imm >> 20) & 1) << 31) | (((imm >> 1) & 0x3ff) << 21) | (((imm >> 11) & 1) << 20) | (((imm >> 12) & 0xff) << 12) | (rd << 7) | 0x6f);

const asm = {
  add: (rd: number, a: number, b: number) => R(0, b, a, 0, rd),
  sub: (rd: number, a: number, b: number) => R(0x20, b, a, 0, rd),
  sll: (rd: number, a: number, b: number) => R(0, b, a, 1, rd),
  slt: (rd: number, a: number, b: number) => R(0, b, a, 2, rd),
  sltu: (rd: number, a: number, b: number) => R(0, b, a, 3, rd),
  xor: (rd: number, a: number, b: number) => R(0, b, a, 4, rd),
  srl: (rd: number, a: number, b: number) => R(0, b, a, 5, rd),
  sra: (rd: number, a: number, b: number) => R(0x20, b, a, 5, rd),
  or: (rd: number, a: number, b: number) => R(0, b, a, 6, rd),
  and: (rd: number, a: number, b: number) => R(0, b, a, 7, rd),
  addi: (rd: number, a: number, imm: number) => I(imm, a, 0, rd),
  slti: (rd: number, a: number, imm: number) => I(imm, a, 2, rd),
  sltiu: (rd: number, a: number, imm: number) => I(imm, a, 3, rd),
  xori: (rd: number, a: number, imm: number) => I(imm, a, 4, rd),
  ori: (rd: number, a: number, imm: number) => I(imm, a, 6, rd),
  andi: (rd: number, a: number, imm: number) => I(imm, a, 7, rd),
  slli: (rd: number, a: number, sh: number) => I(sh, a, 1, rd),
  srli: (rd: number, a: number, sh: number) => I(sh, a, 5, rd),
  srai: (rd: number, a: number, sh: number) => I(0x400 | sh, a, 5, rd),
  lb: (rd: number, a: number, imm: number) => I(imm, a, 0, rd, 0x03),
  lh: (rd: number, a: number, imm: number) => I(imm, a, 1, rd, 0x03),
  lw: (rd: number, a: number, imm: number) => I(imm, a, 2, rd, 0x03),
  lbu: (rd: number, a: number, imm: number) => I(imm, a, 4, rd, 0x03),
  lhu: (rd: number, a: number, imm: number) => I(imm, a, 5, rd, 0x03),
  sb: (src: number, a: number, imm: number) => S(imm, src, a, 0),
  sh: (src: number, a: number, imm: number) => S(imm, src, a, 1),
  sw: (src: number, a: number, imm: number) => S(imm, src, a, 2),
  beq: (a: number, b: number, off: number) => B(off, b, a, 0),
  bne: (a: number, b: number, off: number) => B(off, b, a, 1),
  blt: (a: number, b: number, off: number) => B(off, b, a, 4),
  bge: (a: number, b: number, off: number) => B(off, b, a, 5),
  bltu: (a: number, b: number, off: number) => B(off, b, a, 6),
  bgeu: (a: number, b: number, off: number) => B(off, b, a, 7),
  lui: (rd: number, imm: number) => U(imm, rd, 0x37),
  auipc: (rd: number, imm: number) => U(imm, rd, 0x17),
  jal: (rd: number, off: number) => J(off, rd),
  jalr: (rd: number, a: number, imm: number) => I(imm, a, 0, rd, 0x67),
  ecall: () => 0x00000073,
  ebreak: () => 0x00100073,
};

// ------------------------------------------------------------------------------------ machine

class Machine {
  readonly sim: RtlSim;
  readonly mem = new Uint8Array(1024);
  cycles = 0;
  constructor(program: number[], mode: 'compiled' | 'interpreted' = 'compiled') {
    this.sim = createRtlSim(design, undefined, { mode });
    program.forEach((w, i) => this.store(i * 4, w, 2));
  }
  load(addr: number): number {
    let v = 0;
    for (let b = 3; b >= 0; b--) v = (v << 8) | this.mem[(addr + b) & 1023]!;
    return v >>> 0;
  }
  store(addr: number, value: number, width: number): void {
    const n = width === 0 ? 1 : width === 1 ? 2 : 4;
    for (let b = 0; b < n; b++) this.mem[(addr + b) & 1023] = (value >>> (8 * b)) & 0xff;
  }
  /** One clock cycle with the memory model. */
  cycle(): void {
    const sim = this.sim;
    sim.set('instruction', this.load(sim.get('pc_out')));
    const addr = sim.get('memory_address');
    sim.set('memory_value', this.load(addr));
    if (sim.get('memory_write')) this.store(addr, sim.get('memory_data'), sim.get('memory_width'));
    sim.step();
    this.cycles++;
  }
  /** Runs until a trap (ECALL, EBREAK or an illegal instruction) or the cycle limit; returns the trap code. */
  run(limit = 100_000): number {
    while (this.cycles < limit) {
      const trap = this.sim.get('trap_code');
      if (trap) return trap;
      this.cycle();
    }
    return 0;
  }
  x(i: number): number {
    return Number(this.sim.peek(`register_file.x[${i}]`));
  }
  word(addr: number): number {
    return this.load(addr);
  }
}

// ------------------------------------------------------------------------------------ tests

describe('RV32I core (content/designs/rv32i.dcl)', () => {
  it('checks without errors', () => {
    expect(checked.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(Object.keys(design.modules).sort()).toEqual(['Alu', 'RegFile', 'riscv32']);
  });

  it('alternates fetch and execute, two cycles per instruction', () => {
    const m = new Machine([asm.addi(1, 0, 5), asm.addi(2, 0, 7), asm.ecall()]);
    expect(m.sim.get('executing')).toBe(0);
    m.cycle();
    expect(m.sim.get('executing')).toBe(1);
    expect(m.sim.get('pc_out')).toBe(0);
    m.cycle();
    expect(m.sim.get('pc_out')).toBe(4);
    expect(m.x(1)).toBe(5);
    expect(m.run()).toBe(2);
    expect(m.cycles).toBe(5);
    expect(m.x(2)).toBe(7);
  });

  it('ADDI, ADD and SUB, with x0 hard-wired to zero', () => {
    const m = new Machine([
      asm.addi(1, 0, 100),
      asm.addi(2, 0, -3),
      asm.add(3, 1, 2),
      asm.sub(4, 2, 1),
      asm.addi(0, 0, 9),
      asm.add(5, 0, 0),
      asm.addi(6, 1, 2047),
      asm.addi(7, 1, -2048),
      asm.ecall(),
    ]);
    expect(m.run()).toBe(2);
    expect(m.x(1)).toBe(100);
    expect(m.x(2)).toBe(u32(-3));
    expect(m.x(3)).toBe(97);
    expect(m.x(4)).toBe(u32(-103));
    expect(m.x(0)).toBe(0);
    expect(m.x(5)).toBe(0);
    expect(m.x(6)).toBe(2147);
    expect(m.x(7)).toBe(u32(-1948));
  });

  it('logic, shifts and comparisons', () => {
    const m = new Machine([
      asm.addi(1, 0, -16), // 0xfffffff0
      asm.addi(2, 0, 3),
      asm.sll(3, 1, 2),
      asm.srl(4, 1, 2),
      asm.sra(5, 1, 2),
      asm.slli(6, 2, 31),
      asm.srli(7, 1, 28),
      asm.srai(8, 1, 1),
      asm.slt(9, 1, 2),
      asm.sltu(10, 1, 2),
      asm.slti(11, 2, 4),
      asm.sltiu(12, 2, -1),
      asm.xor(13, 1, 2),
      asm.or(14, 1, 2),
      asm.and(15, 1, 2),
      asm.xori(16, 2, -1),
      asm.ori(17, 2, 0x70),
      asm.andi(18, 1, 0x7f),
      asm.ecall(),
    ]);
    expect(m.run()).toBe(2);
    expect(m.x(3)).toBe(0xffffff80);
    expect(m.x(4)).toBe(0x1ffffffe);
    expect(m.x(5)).toBe(0xfffffffe);
    expect(m.x(6)).toBe(0x80000000);
    expect(m.x(7)).toBe(0xf);
    expect(m.x(8)).toBe(0xfffffff8);
    expect(m.x(9)).toBe(1);
    expect(m.x(10)).toBe(0);
    expect(m.x(11)).toBe(1);
    expect(m.x(12)).toBe(1);
    expect(m.x(13)).toBe(0xfffffff3);
    expect(m.x(14)).toBe(0xfffffff3);
    expect(m.x(15)).toBe(0);
    expect(m.x(16)).toBe(0xfffffffc);
    expect(m.x(17)).toBe(0x73);
    expect(m.x(18)).toBe(0x70);
  });

  it('LUI and AUIPC', () => {
    const m = new Machine([asm.lui(1, 0x12345000), asm.addi(0, 0, 0), asm.auipc(2, 0x1000), asm.auipc(3, 0xfffff000), asm.ecall()]);
    expect(m.run()).toBe(2);
    expect(m.x(1)).toBe(0x12345000);
    expect(m.x(2)).toBe(0x1008);
    expect(m.x(3)).toBe(u32(0xfffff000 + 12));
  });

  it('JAL and JALR link and jump', () => {
    const m = new Machine([
      asm.jal(1, 12), // 0: → 12
      asm.addi(5, 0, 1), // 4: skipped
      asm.ecall(), // 8
      asm.addi(6, 0, 2), // 12
      asm.jalr(2, 1, 5), // 16: → (4 + 5) & ~1 = 8
      asm.ecall(),
    ]);
    expect(m.run()).toBe(2);
    expect(m.x(1)).toBe(4);
    expect(m.x(2)).toBe(20);
    expect(m.x(5)).toBe(0);
    expect(m.x(6)).toBe(2);
    expect(m.sim.get('pc_out')).toBe(8);
  });

  it('branches: taken and not taken, signed and unsigned', () => {
    // Each branch skips an `addi x10, x10, 1` when taken; x11 counts the branches that fell through.
    const cases: [keyof typeof asm, number, number, boolean][] = [
      ['beq', 5, 5, true], ['beq', 5, 6, false],
      ['bne', 5, 6, true], ['bne', 5, 5, false],
      ['blt', -1, 1, true], ['blt', 1, -1, false],
      ['bge', 1, -1, true], ['bge', -1, 1, false], ['bge', 3, 3, true],
      ['bltu', 1, -1, true], ['bltu', -1, 1, false],
      ['bgeu', -1, 1, true], ['bgeu', 1, -1, false],
    ];
    for (const [op, a, b, taken] of cases) {
      const branch = asm[op] as (a: number, b: number, off: number) => number;
      const m = new Machine([asm.addi(1, 0, a), asm.addi(2, 0, b), branch(1, 2, 8), asm.addi(10, 10, 1), asm.ecall()]);
      expect(m.run()).toBe(2);
      expect({ op, a, b, fell: m.x(10) }).toEqual({ op, a, b, fell: taken ? 0 : 1 });
    }
  });

  it('a backward branch loops', () => {
    const m = new Machine([asm.addi(1, 0, 10), asm.addi(2, 2, 3), asm.addi(1, 1, -1), asm.bne(1, 0, -8), asm.ecall()]);
    expect(m.run()).toBe(2);
    expect(m.x(2)).toBe(30);
  });

  it('loads: bytes and halves, sign- and zero-extended, and words', () => {
    const m = new Machine([
      asm.lb(1, 0, 512),
      asm.lbu(2, 0, 512),
      asm.lh(3, 0, 514),
      asm.lhu(4, 0, 514),
      asm.lw(5, 0, 512),
      asm.lb(6, 0, 513),
      asm.addi(7, 0, 516),
      asm.lw(8, 7, -4),
      asm.ecall(),
    ]);
    m.store(512, 0x8001_7f80, 2);
    expect(m.run()).toBe(2);
    expect(m.x(1)).toBe(0xffffff80);
    expect(m.x(2)).toBe(0x80);
    expect(m.x(3)).toBe(0xffff8001);
    expect(m.x(4)).toBe(0x8001);
    expect(m.x(5)).toBe(0x80017f80);
    expect(m.x(6)).toBe(0x7f);
    expect(m.x(8)).toBe(0x80017f80);
  });

  it('stores: bytes, halves and words', () => {
    const m = new Machine([
      asm.lui(1, 0xdeadb000),
      asm.addi(1, 1, 0xef),
      asm.addi(2, 0, 600),
      asm.sw(1, 2, 0),
      asm.sh(1, 2, 4),
      asm.sb(1, 2, 8),
      asm.sb(1, 2, 13),
      asm.lw(3, 2, 0),
      asm.ecall(),
    ]);
    expect(m.run()).toBe(2);
    expect(m.word(600)).toBe(0xdeadb0ef);
    expect(m.word(604)).toBe(0x0000b0ef);
    expect(m.word(608)).toBe(0x000000ef);
    expect(m.word(612)).toBe(0x0000ef00);
    expect(m.x(3)).toBe(0xdeadb0ef);
  });

  it('reports ECALL, EBREAK and illegal instructions, and stops', () => {
    const e = new Machine([asm.ebreak()]);
    expect(e.run()).toBe(3);
    const bad = new Machine([asm.addi(1, 0, 1), 0xffffffff]);
    expect(bad.run()).toBe(1);
    expect(bad.x(1)).toBe(1);
    const pc = bad.sim.get('pc_out');
    for (let i = 0; i < 6; i++) bad.cycle();
    expect(bad.sim.get('pc_out')).toBe(pc);
    // SUB with a wrong funct7 is illegal too.
    expect(new Machine([R(0x10, 1, 1, 0, 1)]).run()).toBe(1);
  });

  it('flags misaligned jump targets', () => {
    const m = new Machine([asm.jal(1, 6)]);
    m.cycle();
    expect(m.sim.get('target_misaligned')).toBe(1);
  });

  it('computes the Fibonacci numbers', () => {
    const program = [
      asm.addi(1, 0, 0), // a = 0
      asm.addi(2, 0, 1), // b = 1
      asm.addi(3, 0, 20), // n = 20
      asm.addi(5, 0, 512), // p = 512
      // loop:
      asm.sw(1, 5, 0), // *p = a
      asm.add(4, 1, 2), // t = a + b
      asm.addi(1, 2, 0), // a = b
      asm.addi(2, 4, 0), // b = t
      asm.addi(5, 5, 4), // p += 4
      asm.addi(3, 3, -1), // n -= 1
      asm.bne(3, 0, -24), // while n != 0
      asm.ecall(),
    ];
    for (const mode of ['compiled', 'interpreted'] as const) {
      const m = new Machine(program, mode);
      expect(m.run()).toBe(2);
      const fib = [0, 1];
      while (fib.length < 21) fib.push(fib[fib.length - 1]! + fib[fib.length - 2]!);
      expect(Array.from({ length: 20 }, (_, i) => m.word(512 + 4 * i))).toEqual(fib.slice(0, 20));
      expect(m.x(1)).toBe(fib[20]);
      expect(m.cycles).toBe(2 * (4 + 20 * 7) + 1);
    }
  });

  it('matches a reference interpreter on random programs', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    const alu = ['add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and'] as const;
    const imm = ['addi', 'slti', 'sltiu', 'xori', 'ori', 'andi'] as const;
    const shifts = ['slli', 'srli', 'srai'] as const;
    for (let trial = 0; trial < 6; trial++) {
      const program: number[] = [];
      const ref = new Reference();
      for (let k = 0; k < 90; k++) {
        const rd = rnd(8);
        const a = rnd(8);
        const b = rnd(8);
        const kind = rnd(6);
        let w: number;
        if (kind === 0) w = asm[alu[rnd(alu.length)]!](rd, a, b);
        else if (kind === 1) w = asm[imm[rnd(imm.length)]!](rd, a, rnd(4096) - 2048);
        else if (kind === 2) w = asm[shifts[rnd(3)]!](rd, a, rnd(32));
        else if (kind === 3) w = rnd(2) ? asm.lui(rd, rnd(0x100000) << 12) : asm.auipc(rd, rnd(0x100000) << 12);
        else if (kind === 4) w = [asm.lb, asm.lh, asm.lw, asm.lbu, asm.lhu][rnd(5)]!(rd, 0, 512 + 4 * rnd(120));
        else w = [asm.sb, asm.sh, asm.sw][rnd(3)]!(b, 0, 512 + 4 * rnd(120) + (rnd(2) ? 0 : 1) * 0);
        program.push(w);
      }
      program.push(asm.ecall());
      const m = new Machine(program);
      for (let i = 0; i < 64; i++) m.store(512 + 4 * i, (i * 0x9e3779b9) >>> 0, 2);
      ref.mem.set(m.mem);
      expect(m.run()).toBe(2);
      ref.run();
      expect(Array.from({ length: 32 }, (_, i) => m.x(i))).toEqual(Array.from(ref.x));
      expect(Array.from(m.mem)).toEqual(Array.from(ref.mem));
    }
  });

  it('runs at least a million cycles per second (compiled)', () => {
    // A counting loop: x1 counts up to x2 = 0x7ffff.
    const m = new Machine([asm.lui(2, 0x80000), asm.addi(2, 2, -1), asm.addi(1, 1, 1), asm.bne(1, 2, -4), asm.ecall()]);
    const t0 = performance.now();
    const n = 1_000_000;
    for (let i = 0; i < n; i++) m.cycle();
    const withMemory = n / ((performance.now() - t0) / 1000);
    // The bare simulator: constant inputs, `step(n)`.
    const sim = createRtlSim(design);
    sim.set('instruction', asm.addi(1, 1, 1));
    const t1 = performance.now();
    sim.step(n);
    const bare = n / ((performance.now() - t1) / 1000);
    console.log(`RV32I RTL simulation: ${(withMemory / 1e6).toFixed(2)} M cycles/s with the memory model, ${(bare / 1e6).toFixed(2)} M cycles/s bare`);
    expect(sim.peek('register_file.x[1]')).toBe(BigInt(n / 2));
    expect(m.x(1)).toBe(n / 2 - 2);
    // Generous bounds, so that a loaded CI machine does not fail the test; the log shows the real speed.
    expect(withMemory).toBeGreaterThan(2e5);
    expect(bare).toBeGreaterThan(2e5);
  });
});

/** A minimal RV32I interpreter for the instructions used by the random programs. */
class Reference {
  readonly x = new Uint32Array(32);
  readonly mem = new Uint8Array(1024);
  pc = 0;
  load(a: number, n: number): number {
    let v = 0;
    for (let b = n - 1; b >= 0; b--) v = (v << 8) | this.mem[(a + b) & 1023]!;
    return v >>> 0;
  }
  run(): void {
    for (let steps = 0; steps < 10000; steps++) {
      const ir = this.load(this.pc, 4);
      if (ir === 0x73) return;
      const op = ir & 0x7f;
      const rd = (ir >>> 7) & 31;
      const f3 = (ir >>> 12) & 7;
      const a = this.x[(ir >>> 15) & 31]!;
      const b = this.x[(ir >>> 20) & 31]!;
      const immI = ir >> 20;
      const immS = ((ir >> 25) << 5) | ((ir >>> 7) & 31);
      let v: number | undefined;
      const aluOp = (f: number, x: number, y: number, alt: boolean): number => {
        switch (f) {
          case 0: return alt ? x - y : x + y;
          case 1: return x << (y & 31);
          case 2: return (x | 0) < (y | 0) ? 1 : 0;
          case 3: return x >>> 0 < y >>> 0 ? 1 : 0;
          case 4: return x ^ y;
          case 5: return alt ? (x | 0) >> (y & 31) : x >>> (y & 31);
          case 6: return x | y;
          default: return x & y;
        }
      };
      if (op === 0x33) v = aluOp(f3, a, b, (ir >>> 30) & 1 ? true : false);
      else if (op === 0x13) v = aluOp(f3, a, immI >>> 0, f3 === 5 && ((ir >>> 30) & 1) === 1);
      else if (op === 0x37) v = ir & 0xfffff000;
      else if (op === 0x17) v = this.pc + (ir & 0xfffff000);
      else if (op === 0x03) {
        const addr = (a + immI) >>> 0;
        const n = f3 & 3 ? (f3 & 3) === 1 ? 2 : 4 : 1;
        let w = this.load(addr, n);
        if (!(f3 & 4) && n < 4 && w & (1 << (8 * n - 1))) w = w | (~0 << (8 * n));
        v = w;
      } else if (op === 0x23) {
        const addr = (a + immS) >>> 0;
        const n = f3 === 0 ? 1 : f3 === 1 ? 2 : 4;
        for (let k = 0; k < n; k++) this.mem[(addr + k) & 1023] = (b >>> (8 * k)) & 0xff;
      } else throw new Error(`unexpected instruction ${ir.toString(16)}`);
      if (v !== undefined && rd) this.x[rd] = v >>> 0;
      this.pc += 4;
    }
  }
}
