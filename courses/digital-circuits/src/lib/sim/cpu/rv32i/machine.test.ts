import { describe, expect, test } from 'vitest';
import { Prng } from '../common/prng';
import { lfsr32 } from '../common/board';
import { assembleOrThrow } from './assembler';
import { RV32_IO, RV32_MEMORY, type Rv32Trap } from './board';
import { Rv32Machine, compareStates, type Rv32MachineOptions } from './machine';
import { decode } from './spec';

/** Assemble `source` (an `ebreak` is appended), run it, and return the machine. */
function exec(source: string, options: Rv32MachineOptions = {}): Rv32Machine {
  const m = new Rv32Machine(options).load(assembleOrThrow(source + '\n ebreak'));
  m.run(100_000);
  return m;
}
const u = (n: number) => n >>> 0;
const a0 = (m: Rv32Machine) => m.reg(10);

describe('arithmetic and logic', () => {
  test('add, sub and addi wrap around at 32 bits', () => {
    const m = exec(`
      li  t0, 0x7FFFFFFF
      addi a0, t0, 1
      li  t1, -1
      addi a1, t1, 1
      sub a2, zero, t0
      sub a3, zero, a0
      li  t2, 0xFFFFFFFF
      add a4, t2, t2`);
    expect([m.reg(10), m.reg(11), m.reg(12), m.reg(13), m.reg(14)]).toEqual([0x80000000, 0, 0x80000001, 0x80000000, 0xfffffffe]);
  });

  test('x0 reads as zero and ignores writes, whatever writes it', () => {
    const m = exec(`
      addi zero, zero, 5
      li   t0, 7
      add  zero, t0, t0
      lui  zero, 0x12345
      jal  zero, next
next: lw   zero, 0(zero)
      add  a0, zero, zero
      addi a1, zero, 3`);
    expect(m.reg(0)).toBe(0);
    expect([m.reg(10), m.reg(11)]).toEqual([0, 3]);
  });

  test('slt and sltu: signed and unsigned comparison', () => {
    const m = exec(`
      li   t0, -1
      li   t1, 1
      slt  a0, t0, t1       # -1 < 1 signed
      sltu a1, t0, t1       # 0xFFFFFFFF < 1 unsigned: no
      slt  a2, t1, t0
      sltu a3, t1, t0
      slt  a4, t0, t0
      li   t2, 0x80000000
      li   t3, 0x7FFFFFFF
      slt  a5, t2, t3       # most negative < most positive
      sltu a6, t2, t3`);
    expect([10, 11, 12, 13, 14, 15, 16].map((r) => m.reg(r))).toEqual([1, 0, 0, 1, 0, 1, 0]);
  });

  test('slti and sltiu sign-extend the immediate first', () => {
    const m = exec(`
      li    t0, 5
      slti  a0, t0, 6
      slti  a1, t0, 5
      slti  a2, t0, -1
      sltiu a3, t0, -1       # 5 < 0xFFFFFFFF unsigned: yes
      sltiu a4, zero, -1
      sltiu a5, zero, 1      # seqz
      sltiu a6, t0, 1
      li    t1, -3
      slti  a7, t1, -2`);
    expect([10, 11, 12, 13, 14, 15, 16, 17].map((r) => m.reg(r))).toEqual([1, 0, 0, 1, 1, 1, 0, 1]);
  });

  test('logic operations, and their immediates are sign-extended', () => {
    const m = exec(`
      li   t0, 0x0F0F0F0F
      li   t1, 0x00FF00FF
      and  a0, t0, t1
      or   a1, t0, t1
      xor  a2, t0, t1
      andi a3, t0, 0xFF
      ori  a4, t0, -256        # sign-extended: sets the upper 24 bits
      xori a5, t0, -1          # not
      andi a6, t0, -1
      xori a7, t0, 0x7FF`);
    expect([10, 11, 12, 13, 14, 15, 16, 17].map((r) => m.reg(r))).toEqual([
      0x000f000f, 0x0fff0fff, 0x0ff00ff0, 0x0f, 0xffffff0f, 0xf0f0f0f0, 0x0f0f0f0f, 0x0f0f0f0f ^ 0x7ff,
    ]);
  });

  test('shifts: only the low five bits of the amount count; sra keeps the sign', () => {
    const m = exec(`
      li   t0, 0x80000001
      li   t1, 33            # 33 & 31 = 1
      sll  a0, t0, t1
      srl  a1, t0, t1
      sra  a2, t0, t1
      li   t2, 31
      srl  a3, t0, t2
      sra  a4, t0, t2
      li   t3, 32            # shift by 0
      sll  a5, t0, t3
      slli a6, t0, 31
      srli a7, t0, 31
      srai s2, t0, 31
      srai s3, t0, 4
      srli s4, t0, 4
      slli s5, t0, 0
      li   t4, 0x7FFFFFFF
      srai s6, t4, 30`);
    expect([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((r) => m.reg(r))).toEqual([
      0x00000002, 0x40000000, 0xc0000000, 1, 0xffffffff, 0x80000001, 0x80000000, 1, 0xffffffff, 0xf8000000, 0x08000000, 0x80000001, 1,
    ]);
  });

  test('lui and auipc', () => {
    const m = exec(`
      lui   a0, 0xFFFFF
      lui   a1, 0x80000
      lui   a2, 0
      nop
      auipc a3, 0
      auipc a4, 1
      auipc a5, 0xFFFFF     # pc − 4096`);
    expect([10, 11, 12].map((r) => m.reg(r))).toEqual([0xfffff000, 0x80000000, 0]);
    expect(m.reg(13)).toBe(16);
    expect(m.reg(14)).toBe(20 + 0x1000);
    expect(m.reg(15)).toBe(u(24 - 0x1000));
  });

  test('li of every kind of constant', () => {
    const values = [0, 1, -1, 2047, 2048, -2048, -2049, 0x7ff, 0x800, 0xfff, 0x1000, 0x12345678, 0x12345fff, 0x7fffffff, -0x80000000, 0x80000000, 0xffffffff, 0xfffff800];
    for (const v of values) {
      const m = exec(`li a0, ${v}`);
      expect(a0(m), String(v)).toBe(u(v));
    }
  });
});

describe('loads and stores', () => {
  test('sign and zero extension, and little-endian layout', () => {
    const m = exec(`
      li   t0, 0x1000
      li   t1, 0x8090A0B0
      sw   t1, 0(t0)
      lb   a0, 0(t0)        # 0xB0 → sign-extended
      lbu  a1, 0(t0)
      lb   a2, 3(t0)        # 0x80
      lbu  a3, 3(t0)
      lh   a4, 0(t0)        # 0xA0B0
      lhu  a5, 0(t0)
      lh   a6, 2(t0)        # 0x8090
      lhu  a7, 2(t0)
      lw   s2, 0(t0)
      lb   s3, 1(t0)        # 0xA0
      lb   s4, 2(t0)        # 0x90`);
    expect([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((r) => m.reg(r))).toEqual([
      0xffffffb0, 0xb0, 0xffffff80, 0x80, 0xffffa0b0, 0xa0b0, 0xffff8090, 0x8090, 0x8090a0b0, 0xffffffa0, 0xffffff90,
    ]);
    expect([...m.memory.slice(0x1000, 0x1004)]).toEqual([0xb0, 0xa0, 0x90, 0x80]);
  });

  test('sb and sh store only their bytes', () => {
    const m = exec(`
      li  t0, 0x1000
      li  t1, 0xFFFFFFFF
      sw  t1, 0(t0)
      sw  zero, 4(t0)
      li  t2, 0x12345678
      sb  t2, 1(t0)         # 0x78
      sh  t2, 6(t0)         # 0x5678
      sb  t2, 4(t0)`);
    expect([...m.memory.slice(0x1000, 0x1008)]).toEqual([0xff, 0x78, 0xff, 0xff, 0x78, 0, 0x78, 0x56]);
  });

  test('negative offsets, and the offset is added to the whole register', () => {
    const m = exec(`
      li  t0, 0x1010
      li  t1, 42
      sw  t1, -16(t0)
      lw  a0, -16(t0)
      li  t2, 0x1800
      lw  a1, -2048(t2)      # the most negative offset
      li  t3, 0x804
      lw  a2, 2044(t3)       # a large positive one
      lw  a3, 0x100(zero)    # (nothing there)
      li  t4, 0x1004
      sw  t1, -4(t4)`);
    expect([a0(m), m.reg(11), m.reg(12), m.reg(13)]).toEqual([42, 42, 42, 0]);
    expect(m.memory[0x1000]).toBe(42);
  });

  test('the whole of RAM is addressable, and nothing past it', () => {
    const m = exec(`
      li  t0, 0xFFFC
      li  t1, 0x600D
      sw  t1, 0(t0)
      lw  a0, 0(t0)`);
    expect(a0(m)).toBe(0x600d);
    const small = new Rv32Machine({ ramSize: 64 });
    small.load(assembleOrThrow('li t0, 64\nlw a0, 0(t0)'));
    small.run();
    expect(small.trap?.cause).toBe('load-access-fault');
    expect(small.trap?.value).toBe(64);
  });
});

describe('jumps and branches', () => {
  test('jal and jalr link the address of the next instruction', () => {
    const m = exec(`
      jal  a0, sub1          # at 0: a0 = 4
back: li   a3, 99
      j    end
sub1: jalr a1, 0(a0)         # a1 = the address after this instruction; goes to back
end:  nop`);
    expect(a0(m)).toBe(4);
    expect(m.reg(13)).toBe(99);
    expect(m.reg(11)).toBe(16);
  });

  test('call and ret', () => {
    const m = exec(`
      li   a0, 5
      call double
      call double
      j    end
double: add a0, a0, a0
      ret
end:  nop`);
    expect(a0(m)).toBe(20);
  });

  test('jalr clears bit 0 of the target', () => {
    const m = exec(`
      la   t0, target        # 0 and 4
      addi t0, t0, 1         # an odd address
      jalr t1, 0(t0)         # at 12: goes to target (bit 0 cleared); t1 = 16
      li   a0, 111           # skipped
target: li a1, 222`);
    expect(a0(m)).toBe(0);
    expect(m.reg(11)).toBe(222);
    expect(m.reg(6)).toBe(16);
  });

  test('jalr with rd = rs1 jumps to the old value and links the new one', () => {
    const m = exec(`
      la   a2, there
      jalr a2, 0(a2)         # jumps to there; a2 = address after the jalr
      li   a0, 1             # skipped
there: nop`);
    expect(a0(m)).toBe(0);
    expect(m.reg(12)).toBe(12);
  });

  test('all six branches, taken and not taken, at the signed/unsigned boundaries', () => {
    const cases: [string, number, number, boolean][] = [
      ['beq', 5, 5, true], ['beq', 5, 6, false], ['bne', 5, 6, true], ['bne', 5, 5, false],
      ['blt', -1, 1, true], ['blt', 1, -1, false], ['blt', 3, 3, false], ['blt', -0x80000000, 0x7fffffff, true],
      ['bge', 1, -1, true], ['bge', -1, 1, false], ['bge', 3, 3, true], ['bge', 0x7fffffff, -0x80000000, true],
      ['bltu', 1, -1, true], ['bltu', -1, 1, false], ['bltu', 3, 3, false], ['bltu', 0x7fffffff, 0x80000000, true],
      ['bgeu', -1, 1, true], ['bgeu', 1, -1, false], ['bgeu', 3, 3, true], ['bgeu', 0x80000000, 0x7fffffff, true],
    ];
    for (const [op, a, b, taken] of cases) {
      const m = exec(`
        li  t0, ${a}
        li  t1, ${b}
        li  a0, 0
        ${op} t0, t1, yes
        j   end
yes:    li  a0, 1
end:    nop`);
      expect(a0(m), `${op} ${a} ${b}`).toBe(taken ? 1 : 0);
    }
  });

  test('backward branches make loops; the pseudo-branches', () => {
    const m = exec(`
      li   t0, 10
      li   a0, 0
loop: add  a0, a0, t0
      addi t0, t0, -1
      bnez t0, loop
      li   t1, 3
      li   a1, 0
      bgtz t1, pos
      li   a1, 99
pos:  bltz t1, neg
      addi a1, a1, 1
neg:  blez t1, out
      addi a1, a1, 1
out:  bgez t1, done
      li   a1, 77
done: bgt  t1, zero, g
      li   a1, 55
g:    ble  zero, t1, l
      li   a1, 66
l:    nop`);
    expect(a0(m)).toBe(55);
    expect(m.reg(11)).toBe(2);
  });

  test('a taken branch across the whole ±4 KiB range', () => {
    const m = exec(`
      li   a0, 0
      beqz a0, far
      .space 4000
far:  li   a1, 1
      j    fwd
back: li   a2, 2
      j    end
      .space 3900
fwd:  j    back
end:  nop`);
    expect([m.reg(11), m.reg(12)]).toEqual([1, 2]);
  });
});

describe('traps', () => {
  const trap = (source: string, options: Rv32MachineOptions = {}): { m: Rv32Machine; t: Rv32Trap } => {
    const m = new Rv32Machine(options).load(assembleOrThrow(source));
    m.run(1000);
    expect(m.trap, 'a trap').toBeDefined();
    return { m, t: m.trap! };
  };

  test('ebreak and ecall stop the machine with the PC on the instruction', () => {
    let { m, t } = trap('li a0, 5\nebreak\nli a0, 6');
    expect([t.cause, t.code, t.pc, m.pc, m.halted, a0(m)]).toEqual(['breakpoint', 3, 4, 4, true, 5]);
    ({ m, t } = trap('nop\nnop\necall'));
    expect([t.cause, t.code, t.pc]).toEqual(['ecall', 11, 8]);
    expect(t.message).toMatch(/ecall at 0x00000008/);
    expect(m.step()).toBe(0); // stopped for good
  });

  test('illegal instructions: the word is reported, and nothing changes', () => {
    const { m, t } = trap('li a0, 7\n.word 0x02000033\nli a0, 8');
    expect([t.cause, t.code, t.pc, t.value]).toEqual(['illegal-instruction', 2, 4, 0x02000033]);
    expect(t.message).toMatch(/illegal instruction 0x02000033 at 0x00000004/);
    expect(a0(m)).toBe(7);
    // Empty memory is illegal too (all zeros is not an instruction).
    expect(trap('.org 4\nnop').t.cause).toBe('illegal-instruction');
  });

  test('misaligned loads and stores trap and leave memory alone', () => {
    let { m, t } = trap('li t0, 0x1001\nlw a0, 0(t0)');
    expect([t.cause, t.value, t.pc]).toEqual(['load-misaligned', 0x1001, 8]); // li of 0x1001 is two instructions
    ({ m, t } = trap('li t0, 0x1002\nlh a0, 1(t0)'));
    expect([t.cause, t.value]).toEqual(['load-misaligned', 0x1003]);
    ({ m, t } = trap('li t0, 0x1002\nsw a0, 0(t0)'));
    expect(t.cause).toBe('store-misaligned');
    ({ m, t } = trap('li t0, 0x1002\nsh zero, 0(t0)\nli t1, 0x1001\nsh zero, 0(t1)'));
    expect([t.cause, t.value]).toEqual(['store-misaligned', 0x1001]);
    // Bytes are never misaligned.
    ({ m, t } = trap('li t0, 0x1001\nlb a0, 0(t0)\nsb a0, 1(t0)\nebreak'));
    expect(t.cause).toBe('breakpoint');
  });

  test('loads and stores outside RAM and the I/O block are access faults', () => {
    let { t } = trap('li t0, 0x20000\nlw a0, 0(t0)');
    expect([t.cause, t.value]).toEqual(['load-access-fault', 0x20000]);
    ({ t } = trap('li t0, 0x20000\nsb a0, 0(t0)'));
    expect(t.cause).toBe('store-access-fault');
    ({ t } = trap('lw a0, -200(zero)')); // 0xFFFFFF38: I/O block, but no register there
    expect([t.cause, t.value]).toEqual(['load-access-fault', 0xffffff38]);
    ({ t } = trap('lw a0, -4(zero)'));
    expect(t.cause).toBe('load-access-fault');
    ({ t } = trap('li t0, 0x80000000\nlw a0, 0(t0)'));
    expect(t.cause).toBe('load-access-fault');
  });

  test('jumps to addresses that are not multiples of 4 trap, at the jump', () => {
    let { m, t } = trap('li t0, 0x102\njalr zero, 0(t0)');
    expect([t.cause, t.pc, t.value]).toEqual(['instruction-misaligned', 4, 0x102]);
    ({ m, t } = trap('li t0, 0x101\njalr ra, 1(t0)\nnop')); // (0x101 + 1) & ~1 = 0x102
    expect([t.cause, t.value]).toEqual(['instruction-misaligned', 0x102]);
    expect(m.reg(1)).toBe(0); // the link register is not written when the jump traps
    // A branch to a misaligned target traps only when it is taken (the assembler will not write one,
    // so the word is made by hand: beq x0, x0, +6 and bne x0, x0, +6).
    ({ t } = trap('.word 0x00000363\nebreak'));
    expect(t.cause).toBe('instruction-misaligned');
    ({ t } = trap('.word 0x00001363\nebreak'));
    expect(t.cause).toBe('breakpoint');
  });

  test('fetching from outside RAM is an access fault', () => {
    let { t } = trap('li t0, 0x10000\njalr zero, 0(t0)');
    expect([t.cause, t.pc, t.value]).toEqual(['instruction-access-fault', 0x10000, 0x10000]);
    ({ t } = trap('lui t0, 0xFFFFF\njalr zero, -256(t0)')); // the I/O block
    expect(t.cause).toBe('instruction-access-fault');
  });

  test('traps are logged on the board, passed to hooks, and can be resumed for ecall and ebreak', () => {
    const seen: string[] = [];
    const m = new Rv32Machine({
      hooks: { onTrap: (t) => seen.push(t.cause) },
      onTrap: (t, machine) => {
        if (t.cause === 'ecall') {
          machine.setReg(10, machine.reg(10) + 100); // a host service: a0 += 100
          return true;
        }
      },
    });
    m.load(assembleOrThrow('li a0, 1\necall\necall\nebreak\nli a0, 0'));
    expect(m.run().reason).toBe('trap');
    expect(a0(m)).toBe(201);
    expect(seen).toEqual(['ecall', 'ecall', 'breakpoint']);
    expect(m.board.traps.map((t) => t.cause)).toEqual(['ecall', 'ecall', 'breakpoint']);
    expect(m.board.lastTrap?.pc).toBe(12);
    expect(m.trap?.cause).toBe('breakpoint');
    m.resume();
    expect(m.halted).toBe(false);
    m.run();
    expect(a0(m)).toBe(0);
    // An illegal instruction cannot be resumed.
    const bad = new Rv32Machine({ onTrap: () => true }).load(assembleOrThrow('.word 0'));
    bad.run();
    expect(bad.halted).toBe(true);
    expect(() => bad.resume()).toThrow(/only possible/);
  });

  test('decode() and the interpreter agree on which words are illegal instructions', () => {
    const rng = new Prng(77);
    for (let i = 0; i < 30000; i++) {
      const w = rng.u32();
      const m = new Rv32Machine({ ramSize: 64 });
      m.memory.set([w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, w >>> 24]);
      m.step();
      expect(m.trap?.cause === 'illegal-instruction', `0x${w.toString(16)}`).toBe(decode(w) === undefined);
    }
  });
});

describe('the board', () => {
  test('LEDs, hex digits, console and PWM/DAC, with byte and halfword accesses', () => {
    const writes: string[] = [];
    const m = exec(
      `
      li   t0, 0xA5
      sw   t0, LEDS(zero)
      li   t1, 0x1234
      sw   t1, HEX(zero)
      sb   t0, HEX + 1(zero)     # the upper byte only: 0xA534
      li   t2, 'H'
      sb   t2, CONSOLE(zero)
      li   t2, 'i'
      sw   t2, CONSOLE(zero)
      li   t3, 0x80
      sw   t3, PWM(zero)
      sh   t3, DAC(zero)
      lw   a0, LEDS(zero)
      lw   a1, HEX(zero)
      lbu  a2, PWM(zero)`,
      {
        hooks: {
          onLeds: (v) => writes.push(`leds ${v}`),
          onHex: (v) => writes.push(`hex ${v.toString(16)}`),
          onConsole: (c) => writes.push(`con ${String.fromCharCode(c)}`),
        },
      },
    );
    expect(m.trap?.cause).toBe('breakpoint');
    expect(writes).toEqual(['leds 165', 'hex 1234', 'hex a534', 'con H', 'con i']);
    expect([a0(m), m.reg(11), m.reg(12)]).toEqual([0xa5, 0xa534, 0x80]);
    expect(m.board.consoleText).toBe('Hi');
    expect([m.board.pwm, m.board.dac]).toEqual([0x80, 0x80]);
  });

  test('the matrix: byte rows, and word accesses cover four rows', () => {
    const m = exec(`
      li   t0, 0x80
      sb   t0, MATRIX(zero)
      li   t1, 0x11
      sb   t1, MATRIX + 7(zero)
      li   t2, 0x44332211
      sw   t2, MATRIX + 4(zero)     # rows 4 to 7 = 11 22 33 44
      lw   a0, MATRIX(zero)
      lw   a1, MATRIX + 4(zero)
      lbu  a2, MATRIX + 5(zero)
      li   t3, 0xAABB
      sh   t3, MATRIX + 2(zero)     # rows 2 and 3`);
    expect([...m.board.matrix]).toEqual([0x80, 0, 0xbb, 0xaa, 0x11, 0x22, 0x33, 0x44]);
    expect([a0(m), m.reg(11), m.reg(12)]).toEqual([0x80, 0x44332211, 0x22]);
    expect(m.board.matrixText()[0]).toBe('#.......');
  });

  test('inputs: switches, buttons with the comparator bit, ADC, console input', () => {
    const m = new Rv32Machine();
    m.board.switches = 0b10100101;
    m.board.buttons = 0b0110;
    m.board.adc = 200;
    m.board.type('AB');
    m.load(
      assembleOrThrow(`
      lw   a0, SWITCHES(zero)
      lw   a1, BUTTONS(zero)
      lw   a2, ADC(zero)
      li   t0, 100
      sw   t0, DAC(zero)      # the analogue input (200) is now above the DAC (100)
      lw   a3, BUTTONS(zero)
      lw   a4, CONSOLE(zero)
      lw   a5, CONSOLE(zero)
      lw   a6, CONSOLE(zero)  # nothing waiting: 0
      sw   zero, SWITCHES(zero)   # writes to inputs are ignored
      lw   a7, SWITCHES(zero)
      ebreak`),
    );
    // load() keeps the board's inputs (they are switches, not memory).
    m.run();
    expect([10, 11, 12, 13, 14, 15, 16, 17].map((r) => m.reg(r))).toEqual([0xa5, 0x86, 200, 0x86, 65, 66, 0, 0xa5]); // buttons 0110, and the comparator bit: 200 is above the DAC
  });

  test('RANDOM steps a 32-bit LFSR; a write seeds it, zero is ignored', () => {
    const m = exec(`
      lw   a0, RANDOM(zero)
      lw   a1, RANDOM(zero)
      li   t0, 0x12345678
      sw   t0, RANDOM(zero)
      lw   a2, RANDOM(zero)
      sw   zero, RANDOM(zero)
      lw   a3, RANDOM(zero)`);
    const s1 = lfsr32(1);
    const s2 = lfsr32(s1);
    const s3 = lfsr32(0x12345678);
    expect([a0(m), m.reg(11), m.reg(12), m.reg(13)]).toEqual([s1, s2, s3, lfsr32(s3)]);
    // It never sticks at 0, and does not repeat quickly.
    let s = 1;
    const seen = new Set<number>();
    for (let i = 0; i < 100000; i++) {
      s = lfsr32(s);
      expect(s).not.toBe(0);
      seen.add(s);
    }
    expect(seen.size).toBe(100000);
  });

  test('TIMER counts clock cycles: the cycles completed before the load', () => {
    const m = exec(`
      lw   a0, TIMER(zero)      # nothing ran before it: 0
      nop
      lw   a1, TIMER(zero)      # lw (2) + nop (2) = 4
      lw   a2, TIMER_HI(zero)`);
    expect([a0(m), m.reg(11), m.reg(12)]).toEqual([0, 4, 0]);
    const long = new Rv32Machine().load(assembleOrThrow('lw a0, TIMER(zero)\nlw a1, TIMER_HI(zero)'));
    long.cycles = 0x1_0000_0005;
    long.step();
    long.step();
    expect([a0(long), long.reg(11)]).toEqual([5, 1]);
  });

  test('input hooks override the fields; the random hook replaces the LFSR', () => {
    const m = new Rv32Machine({ hooks: { switches: () => 0x3c, buttons: () => 1, adc: () => 7, random: () => 0xcafe } });
    m.load(assembleOrThrow('lw a0, SWITCHES(zero)\nlw a1, BUTTONS(zero)\nlw a2, ADC(zero)\nlw a3, RANDOM(zero)\nebreak'));
    m.run();
    expect([10, 11, 12, 13].map((r) => m.reg(r))).toEqual([0x3c, 1 | 0x80, 7, 0xcafe]); // the ADC (7) is above the DAC (0)
  });

  test('the I/O block is above the reach of RAM and fetch, and the names are addresses', () => {
    expect(RV32_IO.LEDS).toBe(0xffffff08);
    expect(RV32_IO.MATRIX).toBe(RV32_MEMORY.ioBase);
    expect(RV32_IO.ADC).toBe(RV32_IO.DAC);
    expect(RV32_MEMORY.ramSize).toBe(0x10000);
  });
});

describe('timing, running, tracing and snapshots', () => {
  test('cycles per instruction follow the model', () => {
    const cycles = (src: string) => {
      const m = new Rv32Machine().load(assembleOrThrow(src));
      return m.step();
    };
    expect(cycles('add a0, a0, a0')).toBe(2);
    expect(cycles('lui a0, 1')).toBe(2);
    // The DCL core takes two cycles for every instruction, loads, stores, jumps and taken branches included.
    expect(cycles('lw a0, 0(zero)')).toBe(2);
    expect(cycles('sw a0, 0x100(zero)')).toBe(2);
    expect(cycles('beq a0, a0, . + 8')).toBe(2);
    expect(cycles('bne a0, a0, . + 8')).toBe(2);
    expect(cycles('jal ra, . + 8')).toBe(2);
    expect(cycles('jalr zero, 8(zero)')).toBe(2);
    expect(cycles('fence')).toBe(2);
    // A trap costs the fetch cycle only: the core reports it in the execute cycle and stops.
    expect(cycles('ebreak')).toBe(1);
    expect(cycles('ecall')).toBe(1);
    expect(cycles('.word 0')).toBe(1);
    const m = new Rv32Machine().load(assembleOrThrow('nop\nnop\nlw a0, 0(zero)\nebreak'));
    m.run();
    expect(m.cycles).toBe(2 + 2 + 2 + 1);
    expect(m.steps).toBe(3); // the ebreak does not retire
    // Resumed after an ecall (a host system call), the instruction has taken its two cycles like any other.
    const h = new Rv32Machine({ onTrap: () => true }).load(assembleOrThrow('nop\necall\nnop\nebreak'));
    h.run(3);
    expect(h.cycles).toBe(2 + 2 + 2);
  });

  test('run(maxSteps), runCycles, breakpoints and runUntil', () => {
    const m = new Rv32Machine().load(assembleOrThrow('loop: addi a0, a0, 1\nj loop'));
    expect(m.run(10)).toEqual({ reason: 'max-steps', steps: 10, cycles: 10 * 2 });
    m.reset();
    expect(m.runCycles(20).reason).toBe('cycles');
    expect(m.cycles).toBeGreaterThanOrEqual(20);
    m.reset();
    m.breakpoints.add(4);
    expect(m.run().reason).toBe('breakpoint');
    expect(m.pc).toBe(4);
    expect(m.run(1).reason).toBe('max-steps'); // continues from the breakpoint
    expect(m.pc).toBe(0);
    m.breakpoints.clear();
    m.reset();
    expect(m.runUntil(4).reason).toBe('breakpoint');
    expect(a0(m)).toBe(1);
  });

  test('trace keeps the last N instructions with their text', () => {
    const m = new Rv32Machine({ traceLimit: 3 }).load(assembleOrThrow('li a0, 1\nli a1, 2\nadd a2, a0, a1\nsw a2, LEDS(zero)\nebreak'));
    m.run();
    expect(m.trace.map((t) => t.text)).toEqual(['li a1, 2', 'add a2, a0, a1', 'sw a2, LEDS(zero)']);
    expect(m.trace[2]).toMatchObject({ pc: 12, cycles: 2, step: 3 });
    expect(m.trace[1]!.cycle).toBe(4);
  });

  test('snapshot, restore and compareStates', () => {
    const p = assembleOrThrow('li a0, 5\nsw a0, LEDS(zero)\nsw a0, 0x100(zero)\nebreak');
    const a = new Rv32Machine().load(p);
    a.step();
    const s = a.snapshot();
    a.run();
    const done = a.snapshot();
    expect(compareStates(s, done).length).toBeGreaterThan(0);
    const b = new Rv32Machine().load(p);
    b.restore(s);
    b.run();
    expect(compareStates(done, b.snapshot(), { timing: true })).toEqual([]);
    // A difference in one register, one byte of memory, one board output.
    const c = b.snapshot();
    c.x[7] = 1;
    c.ram[0x100] = c.ram[0x100]! ^ 1;
    c.board.leds = 0;
    const diffs = compareStates(done, c);
    expect(diffs).toEqual(expect.arrayContaining(['x7: 0x00000000 ≠ 0x00000001', 'M[0x00000100]: 0x05 ≠ 0x04', 'board.leds: 5 ≠ 0']));
  });

  test('load() rejects programs that do not fit; reset keeps memory; _start is the entry', () => {
    expect(() => new Rv32Machine({ ramSize: 16 }).load(new Uint8Array(20))).toThrow(/does not fit/);
    const m = new Rv32Machine().load(assembleOrThrow('nop\n_start: li a0, 9\nebreak'));
    expect(m.pc).toBe(4);
    m.run();
    m.reset();
    expect(m.pc).toBe(4);
    expect(m.memory[4]).not.toBe(0);
    expect(a0(m)).toBe(0);
  });
});
