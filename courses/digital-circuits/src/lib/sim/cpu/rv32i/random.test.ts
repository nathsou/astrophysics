import { describe, expect, test } from 'vitest';
import { RV32I_INSTRUCTIONS, cyclesOf, decode } from './spec';
import { compareStates, Rv32Machine } from './machine';
import { randomProgram } from './random';

/**
 * An independent model of RV32I for the differential tests: it decodes with `spec.ts` (the
 * interpreter decodes with its own bit twiddling) and computes with BigInt (the interpreter uses
 * 32-bit integer operations), so a mistake in either shows up as a difference.
 */
function oracle(image: Uint8Array, maxSteps: number) {
  const mem = new Uint8Array(0x10000);
  mem.set(image);
  const x: bigint[] = Array(32).fill(0n);
  const U = (v: bigint) => BigInt.asUintN(32, v);
  const S = (v: bigint) => BigInt.asIntN(32, v);
  const rd = (a: number, n: number) => {
    let v = 0n;
    for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(mem[a + i]!);
    return v;
  };
  const wr = (a: number, n: number, v: bigint) => {
    for (let i = 0; i < n; i++) mem[a + i] = Number((v >> BigInt(8 * i)) & 0xffn);
  };
  let pc = 0;
  let cycles = 0;
  let steps = 0;
  for (; steps < maxSteps; steps++) {
    const d = decode(Number(rd(pc, 4)));
    if (!d) throw new Error(`oracle: illegal instruction at ${pc}`);
    const m = d.spec.mnemonic;
    if (m === 'ebreak') break;
    const a = x[d.rs1]!;
    const b = x[d.rs2]!;
    const imm = BigInt(d.imm);
    let out: bigint | undefined;
    let next = pc + 4;
    let taken = false;
    const addr = () => Number(U(a + imm));
    switch (m) {
      case 'lui': out = U(imm); break;
      case 'auipc': out = U(BigInt(pc) + imm); break;
      case 'jal': out = BigInt(pc + 4); next = Number(U(BigInt(pc) + imm)); break;
      case 'jalr': out = BigInt(pc + 4); next = Number(U(a + imm) & ~1n); break;
      case 'beq': taken = a === b; break;
      case 'bne': taken = a !== b; break;
      case 'blt': taken = S(a) < S(b); break;
      case 'bge': taken = S(a) >= S(b); break;
      case 'bltu': taken = a < b; break;
      case 'bgeu': taken = a >= b; break;
      case 'lb': out = U(BigInt.asIntN(8, rd(addr(), 1))); break;
      case 'lh': out = U(BigInt.asIntN(16, rd(addr(), 2))); break;
      case 'lw': out = rd(addr(), 4); break;
      case 'lbu': out = rd(addr(), 1); break;
      case 'lhu': out = rd(addr(), 2); break;
      case 'sb': wr(addr(), 1, b); break;
      case 'sh': wr(addr(), 2, b); break;
      case 'sw': wr(addr(), 4, b); break;
      case 'addi': out = U(a + imm); break;
      case 'slti': out = S(a) < imm ? 1n : 0n; break;
      case 'sltiu': out = a < U(imm) ? 1n : 0n; break;
      case 'xori': out = U(a ^ imm); break;
      case 'ori': out = U(a | imm); break;
      case 'andi': out = U(a & imm); break;
      case 'slli': out = U(a << imm); break;
      case 'srli': out = a >> imm; break;
      case 'srai': out = U(S(a) >> imm); break;
      case 'add': out = U(a + b); break;
      case 'sub': out = U(a - b); break;
      case 'sll': out = U(a << (b & 31n)); break;
      case 'slt': out = S(a) < S(b) ? 1n : 0n; break;
      case 'sltu': out = a < b ? 1n : 0n; break;
      case 'xor': out = a ^ b; break;
      case 'srl': out = a >> (b & 31n); break;
      case 'sra': out = U(S(a) >> (b & 31n)); break;
      case 'or': out = a | b; break;
      case 'and': out = a & b; break;
      case 'fence': break;
      default: throw new Error(`oracle: cannot run ${m}`);
    }
    if (d.spec.group === 'branch' && taken) next = Number(U(BigInt(pc) + imm));
    if (out !== undefined && d.rd !== 0) x[d.rd] = out;
    cycles += cyclesOf(m, taken);
    pc = next;
  }
  return { x: x.map(Number), pc, mem, cycles, steps };
}

function runBoth(seed: number, options = {}) {
  const { program } = randomProgram(seed, options);
  const m = new Rv32Machine().load(program);
  const r = m.run(100_000);
  const o = oracle(program.image, 100_000);
  return { m, r, o, program };
}

describe('random RV32I programs', () => {
  test('the same seed gives the same program, different seeds give different ones', () => {
    expect(randomProgram(5).source).toBe(randomProgram(5).source);
    expect(randomProgram(5).source).not.toBe(randomProgram(6).source);
    expect(randomProgram(5, { length: 10 }).source).not.toBe(randomProgram(5, { length: 60 }).source);
  });

  test('every program assembles, runs to its ebreak without a trap, and stays in its data window', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { program } = randomProgram(seed);
      expect(program.diagnostics, `seed ${seed}`).toEqual([]);
      const m = new Rv32Machine({ ramSize: 0x10000 }).load(program);
      const r = m.run(100_000);
      expect(r.reason, `seed ${seed}`).toBe('trap');
      expect(m.trap?.cause, `seed ${seed}`).toBe('breakpoint');
      // Stores only touch the data window and the stack below 0x2000.
      for (let a = 0; a < 0x10000; a++) {
        if ((program.image[a] ?? 0) !== m.memory[a] && !(a >= 0x1000 && a < 0x2000)) throw new Error(`seed ${seed}: byte 0x${a.toString(16)} changed outside the window`);
      }
      expect(m.reg(2), `seed ${seed}: sp restored`).toBe(0x2000);
    }
  });

  test('the interpreter and an independent model agree on 400 programs: registers, pc, memory, cycles', () => {
    for (let seed = 1000; seed < 1400; seed++) {
      const { m, o } = runBoth(seed, { length: 20 + (seed % 60) });
      expect(m.trap?.cause, `seed ${seed}`).toBe('breakpoint');
      expect(m.pc, `seed ${seed} pc`).toBe(o.pc);
      expect(Array.from(m.x, (v) => v >>> 0), `seed ${seed} registers`).toEqual(o.x);
      expect(Buffer.compare(Buffer.from(m.memory), Buffer.from(o.mem)), `seed ${seed} memory`).toBe(0);
      expect(m.cycles, `seed ${seed} cycles`).toBe(o.cycles + 1); // the model stops before the ebreak (its fetch cycle)
      expect(m.steps, `seed ${seed} steps`).toBe(o.steps);
    }
  });

  test('options: no jumps, no calls, no stack, no memory, longer programs', () => {
    const plain = randomProgram(9, { jumps: false, calls: false, stack: false, memory: false, length: 80 });
    expect(plain.source).not.toMatch(/\b(beq|bne|blt|bge|call|jal|jalr|lw|sw|lb|sb)\b/);
    expect(plain.source).not.toMatch(/\bsp, sp\b/);
    for (const seed of [3, 4, 5]) {
      const { m, o } = runBoth(seed, { length: 150 });
      expect(Array.from(m.x, (v) => v >>> 0)).toEqual(o.x);
    }
    expect(() => randomProgram(1, { dataWindow: [0x1001, 0x1100] })).toThrow(/word aligned/);
    const moved = runBoth(2, { dataWindow: [0x800, 0x900], length: 30 });
    expect(moved.m.trap?.cause).toBe('breakpoint');
  });

  test('over many seeds every instruction but ecall is generated', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const { program } = randomProgram(seed, { length: 60 });
      for (let a = 0; a + 3 < program.image.length; a += 4) {
        if (!program.instructionStart[a]) continue;
        const d = decode((program.image[a]! | (program.image[a + 1]! << 8) | (program.image[a + 2]! << 16) | (program.image[a + 3]! << 24)) >>> 0);
        if (d) seen.add(d.spec.mnemonic);
      }
    }
    const missing = RV32I_INSTRUCTIONS.map((i) => i.mnemonic).filter((mn) => !seen.has(mn));
    expect(missing).toEqual(['ecall']);
  });

  test('programs with I/O run without traps, deterministically, and touch the devices', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { program } = randomProgram(seed, { io: true, length: 60 });
      const a = new Rv32Machine().load(program);
      const b = new Rv32Machine().load(program);
      expect(a.run(100_000).reason, `seed ${seed}`).toBe('trap');
      expect(a.trap?.cause, `seed ${seed}`).toBe('breakpoint');
      b.run(100_000);
      expect(compareStates(a.snapshot(), b.snapshot(), { timing: true }), `seed ${seed}`).toEqual([]);
    }
    let touched = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const m = new Rv32Machine().load(randomProgram(seed, { io: true, length: 60 }).program);
      m.run(100_000);
      if (m.board.leds || m.board.hex || m.board.consoleOutput.length || m.io.lfsr !== 1 || m.board.matrix.some((v) => v)) touched++;
    }
    expect(touched).toBeGreaterThan(15);
  });

  test('compareStates finds a difference planted in a copy', () => {
    const { program } = randomProgram(77);
    const a = new Rv32Machine().load(program);
    const b = new Rv32Machine().load(program);
    a.run();
    b.run();
    expect(compareStates(a.snapshot(), b.snapshot(), { timing: true })).toEqual([]);
    b.x[9] = b.x[9]! ^ 0x100;
    b.memory[0x1004] = b.memory[0x1004]! ^ 1;
    const diffs = compareStates(a.snapshot(), b.snapshot());
    expect(diffs.some((d) => d.startsWith('x9:'))).toBe(true);
    expect(diffs.some((d) => d.startsWith('M[0x00001004]'))).toBe(true);
  });
});
