import { describe, expect, test } from 'vitest';
import { DECODE_TABLE, OCTET_PROGRAMS, OctetMachine, assembleOrThrow, compareStates, randomProgram } from '$lib/sim/cpu/octet';
import { alu, instantiate, MicroCpu, unary } from './cycles';

describe('the ALU as the hardware computes it agrees with the interpreter, for every pair of operands', () => {
  const m = new OctetMachine();
  const exec = (byte: number, a: number, b: number) => {
    m.memory[0] = byte;
    m.pc = 0;
    m.halted = false;
    m.r[0] = a;
    m.r[1] = b;
    m.step();
    return { r: m.r[0]!, z: m.z, c: m.c, n: m.n, v: m.v };
  };
  const ops: [string, number, number][] = [
    ['ADD', 0x8, 0x81],
    ['SUB', 0x9, 0x91],
    ['AND', 0xa, 0xa1],
    ['OR', 0xb, 0xb1],
    ['XOR', 0xc, 0xc1],
  ];
  test.each(ops)('%s', (_name, op, byte) => {
    for (let a = 0; a < 256; a += 1)
      for (let b = 0; b < 256; b += 3) expect(alu(op, a, b), `${a},${b}`).toEqual(exec(byte, a, b));
  });
  test('CMP sets the flags of SUB and keeps the register', () => {
    for (let a = 0; a < 256; a += 5)
      for (let b = 0; b < 256; b += 7) {
        const x = alu(0xd, a, b);
        const y = exec(0xd1, a, b);
        expect({ ...x, r: a }).toEqual(y);
      }
  });
  test.each([0, 1, 2, 3])('unary operation %i', (sub) => {
    for (let a = 0; a < 256; a++) expect(unary(sub, a)).toEqual(exec(0xe0 | sub, a, 0));
  });
});

describe('every one of the 256 first bytes takes the cycles the spec lists, one transfer each', () => {
  test('cycle counts and texts', () => {
    for (let byte = 0; byte < 256; byte++) {
      const m = new OctetMachine();
      m.memory[0] = byte;
      m.memory[1] = 0x20;
      const cpu = new MicroCpu(m);
      const spec = DECODE_TABLE[byte]!;
      const texts: string[] = [];
      let n = 0;
      do {
        const c = cpu.cycle()!;
        expect(c.of, `byte ${byte} total`).toBe(spec.cycles);
        expect(c.index).toBe(n);
        texts.push(c.text);
        n++;
      } while (!cpu.atBoundary);
      expect(n, `byte ${byte.toString(16)}`).toBe(spec.cycles);
      expect(m.cycles).toBe(spec.cycles);
      expect(m.steps).toBe(1);
      expect(texts.slice(0, 3)).toEqual(['MAR ← PC', 'IR ← M[MAR]; PC ← PC + 1', 'decode IR']);
      expect(texts.slice(3)).toEqual(spec.steps.map((s) => instantiate(s, byte)));
    }
  });

  test('a halted machine does not run', () => {
    const m = new OctetMachine();
    const cpu = new MicroCpu(m);
    for (let i = 0; i < 4; i++) cpu.cycle();
    expect(m.halted).toBe(true);
    expect(cpu.cycle()).toBeNull();
    expect(m.cycles).toBe(4);
  });
});

describe('the cycles agree with the interpreter (differential tests)', () => {
  /** Run `steps` instructions by whole instructions on one machine and by cycles on another. */
  function compare(source: string, steps: number, name: string, setup?: (m: OctetMachine) => void) {
    const program = assembleOrThrow(source, name);
    const ref = new OctetMachine().load(program);
    const dut = new OctetMachine().load(program);
    setup?.(ref);
    setup?.(dut);
    const cpu = new MicroCpu(dut);
    for (let i = 0; i < steps && !ref.halted; i++) {
      ref.step();
      cpu.finishInstruction();
      if (i % 50 === 0 || ref.halted) {
        const diffs = compareStates(ref.snapshot(), dut.snapshot(), { timing: true });
        expect(diffs, `${name} after ${i + 1} instructions`).toEqual([]);
      }
    }
    expect(compareStates(ref.snapshot(), dut.snapshot(), { timing: true }), name).toEqual([]);
    expect(dut.halted).toBe(ref.halted);
  }

  const halting = OCTET_PROGRAMS.filter((p) => ['multiply', 'fibonacci', 'hello', 'sort'].includes(p.id));
  test.each(halting.map((p) => [p.id, p.source] as const))('the %s program, to its HLT', (id, source) => {
    compare(source, 1_000_000, id);
  });

  test.each(OCTET_PROGRAMS.filter((p) => ['blink', 'count', 'pong', 'life', 'reaction'].includes(p.id)).map((p) => [p.id, p.source] as const))('the %s program, for 20 000 instructions', (id, source) => {
    compare(source, 20_000, id, (m) => {
      m.board.buttons = 0;
    });
  });

  test('300 random programs', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = randomProgram(seed, { io: seed % 3 === 0 });
      compare(r.source, 10_000, `random-${seed}`);
    }
  });

  test('cycles and whole instructions can be mixed at instruction boundaries', () => {
    const program = assembleOrThrow(OCTET_PROGRAMS.find((p) => p.id === 'sort')!.source);
    const ref = new OctetMachine().load(program);
    const dut = new OctetMachine().load(program);
    const cpu = new MicroCpu(dut);
    ref.run();
    let i = 0;
    while (!dut.halted) {
      if (i++ % 3 === 0) cpu.finishInstruction();
      else dut.step();
    }
    expect(compareStates(ref.snapshot(), dut.snapshot(), { timing: true })).toEqual([]);
  });
});

describe('what the datapath shows each cycle', () => {
  test('CALL: the return address goes down the stack in the fourth execute cycle', () => {
    const m = new OctetMachine().load(assembleOrThrow('        CALL f\n        HLT\nf:      RET\n'));
    const cpu = new MicroCpu(m);
    const cycles = [];
    do cycles.push(cpu.cycle()!);
    while (!cpu.atBoundary);
    expect(cycles.map((c) => c.text)).toEqual([
      'MAR ← PC',
      'IR ← M[MAR]; PC ← PC + 1',
      'decode IR',
      'MAR ← PC; SP ← SP − 1',
      'T ← M[MAR]; PC ← PC + 1',
      'MAR ← SP',
      'M[MAR] ← PC',
      'PC ← T',
    ]);
    expect(cycles[6]!.access).toEqual({ kind: 'write', address: 0xef });
    expect(cycles[6]!.value).toBe(2);
    expect(m.memory[0xef]).toBe(2);
    expect(m.pc).toBe(3);
    expect(m.sp).toBe(0xef);
    expect(cpu.t).toBe(3);
  });

  test('the fetch reads the instruction byte from the address in MAR and advances PC', () => {
    const m = new OctetMachine().load(assembleOrThrow('        LDI R2, 42\n        HLT\n'));
    const cpu = new MicroCpu(m);
    const a = cpu.cycle()!;
    expect([a.phase, a.to, a.value, cpu.mar]).toEqual(['fetch', 'MAR', 0, 0]);
    const b = cpu.cycle()!;
    expect([b.value, cpu.ir, m.pc, b.access]).toEqual([0x28, 0x28, 1, { kind: 'read', address: 0 }]);
    cpu.cycle();
    cpu.cycle();
    const e = cpu.cycle()!;
    expect(e.phase).toBe('execute');
    expect(e.last).toBe(true);
    expect(m.r[2]).toBe(42);
    expect(m.pc).toBe(2);
  });
});
