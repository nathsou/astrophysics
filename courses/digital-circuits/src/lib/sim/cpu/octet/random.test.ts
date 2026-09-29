import { describe, expect, test } from 'vitest';
import { DECODE_TABLE, OCTET_INSTRUCTIONS } from './spec';
import { OctetMachine, compareStates } from './machine';
import { randomProgram } from './random';

/**
 * An independent model of Octet for the differential tests. It decodes with the spec's table (the
 * interpreter decodes with its own switch) and works out every flag from wide arithmetic (the
 * interpreter uses bit tricks), so a mistake in either shows up as a difference.
 */
function oracle(image: Uint8Array, maxSteps: number) {
  const mem = new Uint8Array(256);
  mem.set(image.subarray(0, 0xf0));
  const r = [0, 0, 0, 0];
  let pc = 0;
  let sp = 0xf0;
  let z = false;
  let c = false;
  let n = false;
  let v = false;
  let cycles = 0;
  let steps = 0;
  const signed = (x: number) => (x << 24) >> 24;
  const set = (result: number, carry: boolean, overflow: boolean) => {
    z = (result & 255) === 0;
    n = (result & 128) !== 0;
    c = carry;
    v = overflow;
    return result & 255;
  };
  const cond = (code: number): boolean => {
    const base = [true, z, c, n, v, n !== v, c || z, z || n !== v][code >> 1]!;
    return code & 1 ? !base : base;
  };
  for (; steps < maxSteps; steps++) {
    const first = mem[pc]!;
    const spec = DECODE_TABLE[first]!;
    const d = (first >> 2) & 3;
    const s = first & 3;
    const arg = mem[(pc + 1) & 255]!;
    cycles += spec.cycles;
    let next = (pc + spec.bytes) & 255;
    switch (spec.mnemonic) {
      case 'HLT':
        return { r, pc: (pc + 1) & 255, sp, flags: { z, c, n, v }, mem, cycles, steps, halted: true };
      case 'MOV': r[d] = r[s]!; break;
      case 'LDI': r[d] = arg; break;
      case 'LD': r[d] = mem[arg]!; break;
      case 'ST': mem[arg] = r[d]!; break;
      case 'LDR': r[d] = mem[r[s]!]!; break;
      case 'STR': mem[r[d]!] = r[s]!; break;
      case 'PUSH': sp = (sp + 255) & 255; mem[sp] = r[d]!; break;
      case 'POP': r[d] = mem[sp]!; sp = (sp + 1) & 255; break;
      case 'CALL': sp = (sp + 255) & 255; mem[sp] = next; next = arg; break;
      case 'RET': next = mem[sp]!; sp = (sp + 1) & 255; break;
      case 'ADD': { const a = r[d]!; const b = r[s]!; const sum = a + b; r[d] = set(sum, sum > 255, signed(a) + signed(b) !== signed(sum & 255)); break; }
      case 'SUB':
      case 'CMP': {
        const a = r[d]!;
        const b = r[s]!;
        const diff = set(a - b, a < b, signed(a) - signed(b) !== signed((a - b) & 255));
        if (spec.mnemonic === 'SUB') r[d] = diff;
        break;
      }
      case 'AND': r[d] = set(r[d]! & r[s]!, false, false); break;
      case 'OR': r[d] = set(r[d]! | r[s]!, false, false); break;
      case 'XOR': r[d] = set(r[d]! ^ r[s]!, false, false); break;
      case 'SHL': { const a = r[d]!; r[d] = set(a * 2, a >= 128, signed(a) + signed(a) !== signed((a * 2) & 255)); break; }
      case 'SHR': { const a = r[d]!; r[d] = set(a >> 1, (a & 1) === 1, false); break; }
      case 'NOT': r[d] = set(255 - r[d]!, false, false); break;
      case 'INC': { const a = r[d]!; r[d] = set(a + 1, a === 255, signed(a) + 1 !== signed((a + 1) & 255)); break; }
      default:
        // Jumps: the condition is the low nibble.
        if (spec.group === 'jump') {
          if (cond(first & 15)) next = arg;
        } else throw new Error(`oracle: cannot run ${spec.mnemonic}`);
    }
    pc = next;
  }
  throw new Error('oracle: did not halt');
}

function runBoth(seed: number, options = {}) {
  const { program } = randomProgram(seed, options);
  const m = new OctetMachine().load(program);
  const run = m.run(100_000);
  return { m, run, o: oracle(program.image, 100_000), program };
}

describe('random Octet programs', () => {
  test('the same seed gives the same program, different seeds give different ones', () => {
    expect(randomProgram(5).source).toBe(randomProgram(5).source);
    expect(randomProgram(5).source).not.toBe(randomProgram(6).source);
  });

  test('every program assembles, halts at its HLT, and keeps the stack balanced and inside its window', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { program } = randomProgram(seed);
      expect(program.diagnostics, `seed ${seed}`).toEqual([]);
      const m = new OctetMachine().load(program);
      expect(m.run(100_000).reason, `seed ${seed}`).toBe('halted');
      expect(m.sp, `seed ${seed}`).toBe(0xf0);
      // Only the data window and the stack below 0xF0 change (the code is never written).
      for (let a = 0; a < 0xc0; a++) {
        const stack = a >= 0xe0;
        if (!stack && m.memory[a] !== program.image[a]) throw new Error(`seed ${seed}: byte 0x${a.toString(16)} changed outside the window`);
      }
    }
  });

  test('the interpreter and an independent model agree on 500 programs: registers, flags, memory, cycles', () => {
    for (let seed = 2000; seed < 2500; seed++) {
      const { m, o } = runBoth(seed, { length: 15 + (seed % 60) });
      expect([...m.r], `seed ${seed} registers`).toEqual(o.r);
      expect(m.pc, `seed ${seed} pc`).toBe(o.pc);
      expect(m.sp, `seed ${seed} sp`).toBe(o.sp);
      expect(m.flags, `seed ${seed} flags`).toEqual(o.flags);
      expect([...m.memory.subarray(0, 0xf0)], `seed ${seed} memory`).toEqual([...o.mem.subarray(0, 0xf0)]);
      expect(m.cycles, `seed ${seed} cycles`).toBe(o.cycles);
      expect(m.steps, `seed ${seed} steps`).toBe(o.steps + 1);
    }
  });

  test('options: no jumps, no calls, no stack, and I/O', () => {
    const plain = randomProgram(9, { jumps: false, calls: false, stack: false, length: 80 });
    expect(plain.source).not.toMatch(/\b(JMP|JZ|JNZ|JC|CALL|PUSH|POP|RET)\b/);
    const withIo = randomProgram(9, { io: true, length: 80 });
    expect(withIo.source).toMatch(/\[(LEDS|HEX|MATRIX|CONSOLE|PWM|DAC|RANDOM|SWITCHES|BUTTONS|ADC)/);
    let touched = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const m = new OctetMachine().load(randomProgram(seed, { io: true, length: 40 }).program);
      expect(m.run(100_000).reason, `seed ${seed}`).toBe('halted');
      if (m.board.leds || m.board.hex || m.board.consoleOutput.length || m.board.matrix.some((x) => x)) touched++;
    }
    expect(touched).toBeGreaterThan(20);
    const shortWindow = randomProgram(3, { dataWindow: [0x80, 0x90], length: 20 });
    expect(new OctetMachine().load(shortWindow.program).run().reason).toBe('halted');
  });

  test('over many seeds every mnemonic appears', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { program } = randomProgram(seed, { length: 60 });
      for (let a = 0; a < 256; a++) if (program.instructionStart[a]) seen.add(DECODE_TABLE[program.image[a]!]!.mnemonic);
    }
    const missing = OCTET_INSTRUCTIONS.map((i) => i.mnemonic).filter((mn) => !seen.has(mn));
    expect(missing).toEqual([]);
  });

  test('compareStates finds differences planted in a copy, and can compare timing', () => {
    const { program } = randomProgram(77);
    const a = new OctetMachine().load(program);
    const b = new OctetMachine().load(program);
    a.run();
    b.run();
    expect(compareStates(a.snapshot(), b.snapshot(), { timing: true })).toEqual([]);
    b.r[2] = b.r[2]! ^ 0x10;
    b.memory[0xc5] = b.memory[0xc5]! ^ 1;
    b.c = !b.c;
    const diffs = compareStates(a.snapshot(), b.snapshot());
    expect(diffs.some((d) => d.startsWith('R2:'))).toBe(true);
    expect(diffs.some((d) => d.startsWith('M[0xC5]'))).toBe(true);
    expect(diffs.some((d) => d.startsWith('flag C'))).toBe(true);
    b.cycles += 1;
    expect(compareStates(a.snapshot(), b.snapshot(), { timing: true }).some((d) => d.startsWith('cycles'))).toBe(true);
    expect(compareStates(a.snapshot(), b.snapshot()).some((d) => d.startsWith('cycles'))).toBe(false);
  });
});
