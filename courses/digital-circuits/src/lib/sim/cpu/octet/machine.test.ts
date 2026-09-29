import { describe, expect, test } from 'vitest';
import { assembleOrThrow } from './assembler';
import { OctetMachine, compareStates } from './machine';
import { DECODE_TABLE, OCTET_INSTRUCTIONS, instructionByMnemonic, isCanonical } from './spec';
import { lfsr8 } from '../common/board';

/** Assemble, load, and run to HLT. */
function run(src: string, setup?: (m: OctetMachine) => void, maxSteps = 100_000): OctetMachine {
  const m = new OctetMachine().load(assembleOrThrow(src));
  setup?.(m);
  m.run(maxSteps);
  return m;
}

const signed = (x: number) => (x > 127 ? x - 256 : x);

describe('ALU semantics and flags (exhaustive over all operand pairs)', () => {
  // Execute one ALU instruction directly with chosen operands.
  const m = new OctetMachine();
  const exec = (byte: number, a: number, b: number) => {
    m.memory[0] = byte;
    m.pc = 0;
    m.halted = false;
    m.r[0] = a;
    m.r[1] = b;
    m.step();
    return { r: m.r[0]!, ...m.flags };
  };
  const ADD_R0_R1 = 0x81;
  const SUB_R0_R1 = 0x91;
  const CMP_R0_R1 = 0xd1;

  test('ADD: C = unsigned carry, V = signed overflow', () => {
    for (let a = 0; a < 256; a++)
      for (let b = 0; b < 256; b++) {
        const x = exec(ADD_R0_R1, a, b);
        const s = signed(a) + signed(b);
        expect(x).toEqual({ r: (a + b) & 255, z: ((a + b) & 255) === 0, c: a + b > 255, n: ((a + b) & 128) !== 0, v: s < -128 || s > 127 });
      }
  });

  test('SUB and CMP: C = borrow (a < b unsigned), V = signed overflow', () => {
    for (let a = 0; a < 256; a++)
      for (let b = 0; b < 256; b++) {
        const r = (a - b) & 255;
        const s = signed(a) - signed(b);
        const flags = { z: r === 0, c: a < b, n: r > 127, v: s < -128 || s > 127 };
        expect(exec(SUB_R0_R1, a, b)).toEqual({ r, ...flags });
        expect(exec(CMP_R0_R1, a, b)).toEqual({ r: a, ...flags });
      }
  });

  test('AND, OR, XOR clear C and V', () => {
    for (let a = 0; a < 256; a += 3)
      for (let b = 0; b < 256; b += 5) {
        for (const [byte, f] of [
          [0xa1, (x: number, y: number) => x & y],
          [0xb1, (x: number, y: number) => x | y],
          [0xc1, (x: number, y: number) => x ^ y],
        ] as const) {
          m.c = m.v = true;
          const r = f(a, b);
          expect(exec(byte, a, b)).toEqual({ r, z: r === 0, c: false, n: r > 127, v: false });
        }
      }
  });

  test('unary group', () => {
    for (let a = 0; a < 256; a++) {
      const shl = exec(0xe0, a, 0);
      const add = exec(ADD_R0_R1, a, a);
      expect(shl).toEqual(add); // SHL sets flags exactly as ADD Rd, Rd
      expect(exec(0xe1, a, 0)).toEqual({ r: a >> 1, z: a >> 1 === 0, c: (a & 1) === 1, n: false, v: false });
      const not = ~a & 255;
      expect(exec(0xe2, a, 0)).toEqual({ r: not, z: not === 0, c: false, n: not > 127, v: false });
      const inc = (a + 1) & 255;
      expect(exec(0xe3, a, 0)).toEqual({ r: inc, z: inc === 0, c: a === 255, n: inc > 127, v: a === 127 });
    }
  });

  test('the unary group works on any register (dd), with ss choosing the operation', () => {
    const mm = run('LDI R2, 5\nINC R2\nLDI R3, 0x81\nSHR R3\nHLT');
    expect([mm.r[2], mm.r[3], mm.c]).toEqual([6, 0x40, true]);
  });
});

describe('moves, memory and flags left alone', () => {
  test('MOV, LDI, LD, ST, LDR, STR', () => {
    const m = run(`
        LDI R0, 0x12
        MOV R1, R0
        ST [0x80], R1
        LD R2, [0x80]
        LDI R3, 0x81
        STR [R3], R2
        LDR R0, [R3]
        HLT`);
    expect([...m.r]).toEqual([0x12, 0x12, 0x12, 0x81]);
    expect(m.memory[0x80]).toBe(0x12);
    expect(m.memory[0x81]).toBe(0x12);
  });

  test('non-ALU instructions keep the flags', () => {
    // Set every flag, then run one of each non-ALU instruction.
    const m = run(`
        LDI R0, 0x80
        LDI R1, 0x80
        ADD R0, R1        ; 0x80 + 0x80 = 0x00: Z C V set
        LDI R2, 0x7F
        MOV R3, R2
        LD R3, [0x80]
        ST [0x80], R3
        LDR R3, [R2]
        STR [R2], R3
        PUSH R3
        POP R3
        CALL sub
        JNEVER 0
        JMP end
sub:    RET
end:    HLT`);
    expect(m.flags).toEqual({ z: true, c: true, n: false, v: true });
  });

  test('two-byte operands and PC wrap round at 0xFF', () => {
    const m = new OctetMachine();
    m.memory[0xef] = 0x20; // LDI R0, <0xF0: the matrix row 0>
    m.board.matrix[0] = 0x5a;
    m.pc = 0xef;
    m.step();
    expect(m.r[0]).toBe(0x5a);
    expect(m.pc).toBe(0xf1);
    m.pc = 0xff; // fetching at 0xFF reads the ADC; the next byte is 0x00
    m.board.adc = 0x10; // MOV R0, R0
    m.step();
    expect(m.pc).toBe(0x00);
  });
});

describe('stack, calls and jumps', () => {
  test('PUSH/POP: SP starts at 0xF0, pre-decrements, first push goes to 0xEF', () => {
    const m = new OctetMachine().load(assembleOrThrow('LDI R0, 7\nPUSH R0\nLDI R1, 9\nPUSH R1\nPOP R2\nPOP R3\nHLT'));
    expect(m.sp).toBe(0xf0);
    m.run();
    expect(m.memory[0xef]).toBe(7);
    expect(m.memory[0xee]).toBe(9);
    expect([m.r[2], m.r[3], m.sp]).toEqual([9, 7, 0xf0]);
  });

  test('CALL pushes the address after itself; RET pops it', () => {
    const m = new OctetMachine().load(assembleOrThrow('CALL f\nHLT\nf: LDI R0, 1\nRET'));
    m.step();
    expect([m.pc, m.sp, m.memory[0xef]]).toEqual([3, 0xef, 2]);
    m.run();
    expect([m.r[0], m.sp, m.pc]).toEqual([1, 0xf0, 3]);
  });

  test('nested calls and recursion: sum 1..10 recursively', () => {
    const m = run(`
        LDI R0, 10
        LDI R1, 0
        CALL sum
        HLT
; sum: R1 += R0 + (R0 − 1) + … + 1
sum:    OR R0, R0
        JZ base
        ADD R1, R0
        PUSH R0
        LDI R2, 1
        SUB R0, R2
        CALL sum
        POP R0
base:   RET`);
    expect(m.r[1]).toBe(55);
    expect(m.sp).toBe(0xf0);
  });

  test('conditional jumps taken and not taken both take 5 cycles', () => {
    const taken = run('LDI R0, 0\nOR R0, R0\nJZ t\nHLT\nt: HLT');
    const not = run('LDI R0, 1\nOR R0, R0\nJZ t\nHLT\nt: HLT');
    expect(taken.pc).toBe(7);
    expect(not.pc).toBe(6);
    expect(taken.cycles).toBe(not.cycles);
  });

  test('HLT stops the machine; PC points past it', () => {
    const m = run('HLT');
    expect([m.halted, m.pc, m.cycles, m.steps]).toEqual([true, 1, 4, 1]);
    expect(m.step()).toBe(0);
  });

  test('every non-canonical byte executes like its canonical form', () => {
    for (let b = 0; b < 256; b++) {
      if (isCanonical(b)) continue;
      const canon = b & ~DECODE_TABLE[b]!.ignored;
      const states = [b, canon].map((byte) => {
        const m = new OctetMachine();
        m.memory.set([byte, 0x40]);
        m.r.set([1, 2, 3, 4]);
        m.step();
        m.memory[0] = 0; // the instruction bytes themselves differ
        return m.snapshot();
      });
      expect(compareStates(states[0]!, states[1]!, { timing: true }), b.toString(16)).toEqual([]);
    }
  });
});

describe('cycle counts match the spec', () => {
  test.each(OCTET_INSTRUCTIONS.map((i) => [i.mnemonic, i] as const))('%s', (_name, spec) => {
    const m = new OctetMachine();
    const second = 0x40;
    m.memory.set([(spec.opcode << 4) | spec.fixed, second]);
    expect(m.step()).toBe(spec.cycles);
  });

  test('NOP (MOV R0, R0) takes 4 cycles', () => {
    expect(run('NOP\nHLT').cycles).toBe(instructionByMnemonic('MOV')!.cycles + 4);
  });
});

describe('I/O registers', () => {
  test('outputs: matrix, LEDs, hex, console, PWM, DAC', () => {
    const seen: string[] = [];
    const m = new OctetMachine({
      hooks: {
        onLeds: (v) => seen.push(`leds ${v}`),
        onHex: (v) => seen.push(`hex ${v}`),
        onMatrix: (r, v) => seen.push(`matrix ${r} ${v}`),
        onConsole: (c) => seen.push(`console ${String.fromCharCode(c)}`),
        onPwm: (v) => seen.push(`pwm ${v}`),
        onDac: (v) => seen.push(`dac ${v}`),
      },
    });
    m.load(
      assembleOrThrow(`
        LDI R0, 0x81
        ST [MATRIX + 2], R0
        ST [LEDS], R0
        ST [HEX], R0
        LDI R1, 'A'
        ST [CONSOLE], R1
        ST [PWM], R1
        ST [DAC], R1
        LD R2, [MATRIX + 2]   ; outputs read back
        LD R3, [LEDS]
        HLT`),
    );
    m.run();
    expect(seen).toEqual(['matrix 2 129', 'leds 129', 'hex 129', 'console A', 'pwm 65', 'dac 65']);
    expect([m.r[2], m.r[3]]).toEqual([0x81, 0x81]);
    expect(m.board.consoleText).toBe('A');
    expect(m.board.matrixText()[2]).toBe('#......#');
    expect(m.peek(0xfb)).toBe(0x81);
  });

  test('inputs: switches, buttons with the comparator bit, ADC, console input', () => {
    const m = new OctetMachine().load(
      assembleOrThrow(`
        LD R0, [SWITCHES]
        LD R1, [BUTTONS]
        LD R2, [ADC]
        LD R3, [CONSOLE]
        HLT`),
    );
    m.board.switches = 0xa5;
    m.board.buttons = 0b1010;
    m.board.adc = 0x90;
    m.board.type('x');
    m.run();
    // The ADC (0x90) is above the DAC (0), so the comparator bit is set.
    expect([...m.r]).toEqual([0xa5, 0x8a, 0x90, 0x78]);
    m.reset();
    m.run();
    expect(m.r[3]).toBe(0); // no more console input
  });

  test('writes to input registers are ignored', () => {
    const m = run('LDI R0, 0xFF\nST [SWITCHES], R0\nST [BUTTONS], R0\nLD R1, [SWITCHES]\nHLT');
    expect(m.r[1]).toBe(0);
  });

  test('RANDOM: each read steps the LFSR; writes seed it; 0 is ignored', () => {
    const m = run('LD R0, [RANDOM]\nLD R1, [RANDOM]\nLDI R2, 0x42\nST [RANDOM], R2\nLDI R3, 0\nST [RANDOM], R3\nLD R3, [RANDOM]\nHLT');
    expect([m.r[0], m.r[1], m.r[3]]).toEqual([lfsr8(1), lfsr8(lfsr8(1)), lfsr8(0x42)]);
  });

  test('the LFSR has period 255 and visits every non-zero value', () => {
    const seen = new Set<number>();
    let s = 1;
    for (let i = 0; i < 255; i++) {
      seen.add(s);
      s = lfsr8(s);
    }
    expect(s).toBe(1);
    expect(seen.size).toBe(255);
  });

  test('input hooks override the fields', () => {
    const m = new OctetMachine({ hooks: { switches: () => 0x3c, random: () => 7 } });
    m.load(assembleOrThrow('LD R0, [SWITCHES]\nLD R1, [RANDOM]\nHLT')).run();
    expect([m.r[0], m.r[1]]).toEqual([0x3c, 7]);
  });
});

describe('running, tracing and snapshots', () => {
  const src = 'LDI R0, 0\nloop: INC R0\nJNZ loop\nHLT';

  test('run(maxSteps) and runCycles', () => {
    const m = new OctetMachine().load(assembleOrThrow(src));
    expect(m.run(10)).toEqual({ reason: 'max-steps', steps: 10, cycles: 5 + 9 * 5 });
    expect(m.runCycles(100).reason).toBe('cycles');
    const rest = m.run();
    expect(rest.reason).toBe('halted');
    expect(m.steps).toBe(1 + 256 * 2 + 1);
    expect(m.cycles).toBe(5 + 256 * 10 + 4);
  });

  test('breakpoints stop before the instruction, and run continues from them', () => {
    const m = new OctetMachine().load(assembleOrThrow(src));
    m.breakpoints.add(2);
    expect(m.run().reason).toBe('breakpoint');
    expect(m.pc).toBe(2);
    expect(m.r[0]).toBe(0);
    expect(m.run().reason).toBe('breakpoint');
    expect(m.r[0]).toBe(1);
  });

  test('runUntil stops when the PC reaches an address', () => {
    const m = new OctetMachine().load(assembleOrThrow(src));
    expect(m.runUntil(5).reason).toBe('breakpoint');
    expect(m.runUntil(0x80).reason).toBe('halted');
    m.reset();
    expect(m.runUntil(3).steps).toBe(2);
  });

  test('trace keeps the last N instructions with their text', () => {
    const m = new OctetMachine({ traceLimit: 3 }).load(assembleOrThrow(src));
    m.run();
    expect(m.trace.map((t) => t.text)).toEqual(['INC R0', 'JNZ 0x02', 'HLT']);
    expect(m.trace[2]).toMatchObject({ pc: 5, bytes: [0], cycles: 4, step: 513 });
  });

  test('snapshot, restore and compareStates', () => {
    const m = new OctetMachine().load(assembleOrThrow('LDI R0, 3\nST [0x80], R0\nST [LEDS], R0\nHLT'));
    m.run();
    const s = m.snapshot();
    const other = new OctetMachine();
    other.restore(s);
    expect(compareStates(s, other.snapshot(), { timing: true })).toEqual([]);
    other.r[1] = 9;
    other.memory[0x80] = 4;
    other.board.leds = 0;
    other.v = true;
    expect(compareStates(s, other.snapshot())).toEqual([
      'R1: 0x00 ≠ 0x09',
      'flag V: 0 ≠ 1',
      'M[0x80]: 0x03 ≠ 0x04',
      'board.leds: 3 ≠ 0',
    ]);
  });
});
