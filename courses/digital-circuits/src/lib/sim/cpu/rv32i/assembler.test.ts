import { describe, expect, test } from 'vitest';
import { assemble, assembleOrThrow } from './assembler';
import { RV32I_INSTRUCTIONS, encode } from './spec';

const words = (image: Uint8Array): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 3 < image.length; i += 4) out.push((image[i]! | (image[i + 1]! << 8) | (image[i + 2]! << 16) | (image[i + 3]! << 24)) >>> 0);
  return out;
};
const asm = (source: string) => words(assembleOrThrow(source).image);
const hex = (ws: number[]) => ws.map((w) => '0x' + w.toString(16).toUpperCase().padStart(8, '0'));

/** The first error of a source: line, column and message. */
function firstError(source: string) {
  const p = assemble(source);
  expect(p.ok, source).toBe(false);
  const d = p.diagnostics.find((x) => x.severity === 'error')!;
  return { line: d.line, column: d.column, length: d.length, message: d.message };
}

describe('RV32I assembler: instruction forms', () => {
  test('every instruction, with hand-worked words', () => {
    const cases: [string, number[]][] = [
      ['add x3, x1, x2', [0x002081b3]],
      ['sub x3, x1, x2', [0x402081b3]],
      ['sra x3, x1, x2', [0x4020d1b3]],
      ['addi x1, x0, 1', [0x00100093]],
      ['addi x1, x0, -1', [0xfff00093]],
      ['slti x1, x2, 5', [0x00512093]],
      ['sltiu x1, x2, 5', [0x00513093]],
      ['srai x1, x2, 3', [0x40315093]],
      ['lw x5, 8(x2)', [0x00812283]],
      ['lb x5, 8(x2)', [0x00810283]],
      ['lhu x5, 8(x2)', [0x00815283]],
      ['sw x5, 8(x2)', [0x00512423]],
      ['sw x5, -4(x2)', [0xfe512e23]],
      ['sb x5, (x2)', [0x00510023]],
      ['lui x5, 0x12345', [0x123452b7]],
      ['auipc x5, 0x12345', [0x12345297]],
      ['jal x1, . + 8', [0x008000ef]],
      ['jal x0, . - 4', [0xffdff06f]], // at address 0 the target wraps to 0xFFFFFFFC: the offset is still −4
      ['jalr x1, 4(x2)', [0x004100e7]],
      ['jalr x1, x2, 4', [0x004100e7]],
      ['beq x1, x2, . + 8', [0x00208463]],
      ['bne x1, x2, . - 8', [0xfe209ce3]],
      ['bltu x1, x2, . + 8', [0x0020e463]],
      ['ecall', [0x00000073]],
      ['ebreak', [0x00100073]],
      ['fence', [0x0ff0000f]],
      ['fence r, rw', [0x0230000f]],
      ['fence 0, w', [0x00100000 | 0x0f]],
    ];
    for (const [src, want] of cases) expect(hex(asm(src)), src).toEqual(hex(want));
  });

  test('every mnemonic assembles', () => {
    const forms: Record<string, string> = {
      r: '{m} a0, a1, a2',
      i: '{m} a0, a1, 12',
      shift: '{m} a0, a1, 3',
      load: '{m} a0, 4(a1)',
      store: '{m} a0, 4(a1)',
      branch: '{m} a0, a1, . + 8',
      lui: '{m} a0, 0x1000',
      jal: '{m} a0, . + 8',
      jalr: '{m} a0, 4(a1)',
      fence: '{m}',
      none: '{m}',
    };
    for (const s of RV32I_INSTRUCTIONS) {
      const p = assemble(forms[s.kind]!.replace('{m}', s.mnemonic));
      expect(p.diagnostics, s.mnemonic).toEqual([]);
      expect(p.image.length, s.mnemonic).toBe(4);
    }
  });

  test('ABI names, x names, fp and case-insensitivity give the same code', () => {
    const a = asm('ADD A0, A1, A2\nadd x10, x11, x12\nadd a0, fp, s1');
    expect(a[0]).toBe(a[1]);
    expect(a[2]).toBe(encode('add', { rd: 10, rs1: 8, rs2: 9 }));
  });

  test('every pseudo-instruction, with hand-worked words', () => {
    const cases: [string, number[]][] = [
      ['nop', [0x00000013]],
      ['li a0, -1', [0xfff00513]],
      ['li a0, 2047', [0x7ff00513]],
      ['li a0, 0x80000000', [0x80000537]],
      ['li a0, 0xFFFFFFFF', [0xfff00513]],
      ['li a0, 2048', [0x00001537, 0x80050513]],
      ['li x5, 0x12345678', [0x123452b7, 0x67828293]],
      ['li x5, 0x12345FFF', [0x123462b7, 0xfff28293]],
      ['mv a0, a1', [0x00058513]],
      ['not a0, a1', [0xfff5c513]],
      ['neg a0, a1', [0x40b00533]],
      ['seqz a0, a1', [0x0015b513]],
      ['snez a0, a1', [0x00b03533]],
      ['sltz a0, a1', [encode('slt', { rd: 10, rs1: 11, rs2: 0 })]],
      ['sgtz a0, a1', [encode('slt', { rd: 10, rs1: 0, rs2: 11 })]],
      ['beqz a0, . + 8', [0x00050463]],
      ['bnez a0, . + 8', [encode('bne', { rs1: 10, rs2: 0, imm: 8 })]],
      ['blez a0, . + 8', [encode('bge', { rs1: 0, rs2: 10, imm: 8 })]],
      ['bgez a0, . + 8', [encode('bge', { rs1: 10, rs2: 0, imm: 8 })]],
      ['bltz a0, . + 8', [encode('blt', { rs1: 10, rs2: 0, imm: 8 })]],
      ['bgtz a0, . + 8', [encode('blt', { rs1: 0, rs2: 10, imm: 8 })]],
      ['bgt a0, a1, . + 8', [encode('blt', { rs1: 11, rs2: 10, imm: 8 })]],
      ['ble a0, a1, . + 8', [encode('bge', { rs1: 11, rs2: 10, imm: 8 })]],
      ['bgtu a0, a1, . + 8', [encode('bltu', { rs1: 11, rs2: 10, imm: 8 })]],
      ['bleu a0, a1, . + 8', [encode('bgeu', { rs1: 11, rs2: 10, imm: 8 })]],
      ['j . + 8', [0x0080006f]],
      ['jal . + 8', [0x008000ef]],
      ['jr a0', [0x00050067]],
      ['jalr a0', [0x000500e7]],
      ['ret', [0x00008067]],
    ];
    for (const [src, want] of cases) expect(hex(asm(src)), src).toEqual(hex(want));
  });

  test('call, tail, la and the symbol forms of loads and stores are auipc pairs (pc-relative)', () => {
    // Each pseudo is at address 0 and takes 8 bytes; its target is at 8 or 16.
    expect(hex(asm('call f\n.org 8\nf: ret').slice(0, 2))).toEqual(hex([0x00000097, 0x008080e7]));
    expect(hex(asm('tail f\n.org 8\nf: ret').slice(0, 2))).toEqual(hex([0x00000317, 0x00830067]));
    expect(hex(asm('la a0, d\n.org 16\nd: .word 1').slice(0, 2))).toEqual(hex([0x00000517, 0x01050513]));
    expect(hex(asm('lw a0, d\n.org 16\nd: .word 1').slice(0, 2))).toEqual(hex([0x00000517, 0x01052503]));
    expect(hex(asm('sw a1, d, t0\n.org 16\nd: .word 1').slice(0, 2))).toEqual(hex([0x00000297, 0x00b2a823]));
    // A far target needs hi20 to be rounded up because lo12 comes out negative: 0x1800 = 2·4096 − 2048.
    const far = asm('call far\n.org 0x1800\nfar: ret');
    expect(far[0]).toBe(0x00002097);
    expect(far[1]).toBe(0x800080e7);
    // Backwards: the offset is measured from the auipc, wherever it is.
    const back = asm('.org 0x100\nf: ret\n.org 0x2000\n call f');
    expect(back.at(-2)).toBe(encode('auipc', { rd: 1, imm: 0xfffff - 1 })); // 0x100 − 0x2000 = −0x1F00 → hi = −2
  });

  test('li: one instruction when it fits, lui alone when the low 12 bits are zero, else two', () => {
    const size = (v: string) => assembleOrThrow(`li a0, ${v}`).image.length / 4;
    expect(size('0')).toBe(1);
    expect(size('-2048')).toBe(1);
    expect(size('2047')).toBe(1);
    expect(size('2048')).toBe(2);
    expect(size('0x1000')).toBe(1);
    expect(size('0x12345000')).toBe(1);
    expect(size('0x12345001')).toBe(2);
    expect(size('-2049')).toBe(2);
    expect(size('0xFFFFF800')).toBe(1); // −2048 as a 32-bit number
    // Not known on the first pass (a constant defined later): always two.
    const late = assembleOrThrow('li a0, LATER\n.equ LATER, 5');
    expect(late.image.length / 4).toBe(2);
    expect(hex(words(late.image))).toEqual(hex([0x00000537, 0x00550513]));
  });

  test('a 12-bit offset is read as a 32-bit number: the I/O registers reach from zero', () => {
    expect(hex(asm('sw t0, LEDS(zero)'))).toEqual(hex([encode('sw', { rs1: 0, rs2: 5, imm: -248 })]));
    expect(hex(asm('lw t0, TIMER(zero)'))).toEqual(hex([encode('lw', { rd: 5, rs1: 0, imm: -216 })]));
    expect(hex(asm('sb t0, MATRIX + 7(zero)'))).toEqual(hex([encode('sb', { rs1: 0, rs2: 5, imm: -249 })]));
    expect(hex(asm('sb t0, MATRIX(a0)'))).toEqual(hex([encode('sb', { rs1: 10, rs2: 5, imm: -256 })]));
    const p = assembleOrThrow('li t0, RAM_TOP\nli t1, IO_BASE');
    expect(p.symbols.RAM_TOP).toBe(0x10000);
    expect(p.symbols.IO_BASE).toBe(0xffffff00);
  });

  test('%hi and %lo', () => {
    expect(hex(asm('lui a0, %hi(0x12345FFF)\naddi a0, a0, %lo(0x12345FFF)'))).toEqual(hex([0x12346537, 0xfff50513]));
    const p = asm('lui a0, %hi(d)\nlw a1, %lo(d)(a0)\n.org 0x1234\nd: .word 7');
    expect(p[0]).toBe(encode('lui', { rd: 10, imm: 1 }));
    expect(p[1]).toBe(encode('lw', { rd: 11, rs1: 10, imm: 0x234 }));
  });
});

describe('RV32I assembler: labels, expressions and directives', () => {
  test('forward and backward labels, branch offsets', () => {
    const w = asm(`
start:  beq  a0, a1, done     # forward: 3 words ahead
        addi a0, a0, 1
        j    start            # backward
done:   ebreak`);
    expect(w[0]).toBe(encode('beq', { rs1: 10, rs2: 11, imm: 12 }));
    expect(w[2]).toBe(encode('jal', { rd: 0, imm: -8 }));
  });

  test('expressions: + −, parentheses, characters, dot, constants defined later', () => {
    const p = assembleOrThrow(`
        .equ BASE, END - 4
        li   a0, (1 + 2) - 5
        li   a1, 'A' + 1
        li   a2, BASE
        li   a3, . + 8
END:    ebreak`);
    const w = words(p.image);
    expect(w[0]).toBe(encode('addi', { rd: 10, rs1: 0, imm: -2 }));
    expect(w[1]).toBe(encode('addi', { rd: 11, rs1: 0, imm: 66 }));
    expect(p.symbols.BASE).toBe(p.symbols.END! - 4);
    expect(p.symbols.END).toBe(20); // 1 + 1 + 2 (li a2: BASE is not known on the first pass) + 1 words
  });

  test('.word .half .byte .string .ascii .space .align .org and .equ', () => {
    const p = assembleOrThrow(`
        .org 0x10
a:      .byte 1, 'x', -1, 0xFF
        .half 0x1234, -2
        .align 2
w:      .word 0xDEADBEEF, a, -1
s:      .string "hi\\n"
t:      .ascii "ab"
        .balign 4
z:      .space 3, 7
        .zero 2
        .equ N, 5
e:      .byte N * 1 + 0`.replace('N * 1 + 0', 'N'));
    const b = (a: number) => p.image[a]!;
    expect([b(0x10), b(0x11), b(0x12), b(0x13)]).toEqual([1, 120, 255, 255]);
    expect([b(0x14), b(0x15), b(0x16), b(0x17)]).toEqual([0x34, 0x12, 0xfe, 0xff]);
    expect(p.symbols.w).toBe(0x18);
    expect([b(0x18), b(0x19), b(0x1a), b(0x1b)]).toEqual([0xef, 0xbe, 0xad, 0xde]);
    expect([b(0x1c), b(0x1d), b(0x1e), b(0x1f)]).toEqual([0x10, 0, 0, 0]);
    expect([b(0x20), b(0x21), b(0x22), b(0x23)]).toEqual([255, 255, 255, 255]);
    expect(p.symbols.s).toBe(0x24);
    expect([b(0x24), b(0x25), b(0x26), b(0x27)]).toEqual([104, 105, 10, 0]);
    expect(p.symbols.t).toBe(0x28);
    expect([b(0x28), b(0x29)]).toEqual([97, 98]);
    expect(p.symbols.z).toBe(0x2c);
    expect([b(0x2c), b(0x2d), b(0x2e), b(0x2f), b(0x30)]).toEqual([7, 7, 7, 0, 0]);
    expect(p.symbols.e).toBe(0x31);
    expect(b(0x31)).toBe(5);
    expect(p.image.length % 4).toBe(0);
  });

  test('sections and .globl are accepted; _start sets the entry point', () => {
    const p = assembleOrThrow('.text\n.globl _start\nnop\n_start: ebreak\n.data\nx: .word 1');
    expect(p.entry).toBe(4);
    expect(assembleOrThrow('nop').entry).toBe(0);
  });

  test('comments: #, ; and //, and not inside strings', () => {
    const p = assembleOrThrow('nop # one\nnop ; two\nnop // three\n.string "a#b;c//d"');
    expect(p.size).toBe(12 + 9);
    expect([...p.image.slice(12, 21)]).toEqual([97, 35, 98, 59, 99, 47, 47, 100, 0]);
  });

  test('the listing, line map and instruction starts', () => {
    const p = assembleOrThrow('nop\nli a0, 0x12345\n\nebreak');
    expect(p.listing[0]).toMatchObject({ line: 1, address: 0, bytes: [0x13, 0, 0, 0] });
    expect(p.listing[1]!.bytes).toHaveLength(8);
    expect(p.listing[2]!.bytes).toHaveLength(0);
    expect(p.lineOf[0]).toBe(1);
    expect(p.lineOf[4]).toBe(2);
    expect(p.lineOf[12]).toBe(4);
    expect([...p.instructionStart].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 8, 12]);
    expect(p.instructions).toBe(4);
  });
});

describe('RV32I assembler: errors carry line and column', () => {
  const at = (src: string, text: string, from = 0) => src.indexOf(text, from) + 1;

  test('an unknown instruction, with hints for what was probably meant', () => {
    const src = '        nop\n        mul a0, a1, a2\n';
    const e = firstError(src);
    expect([e.line, e.column]).toEqual([2, 9]);
    expect(e.message).toMatch(/unknown instruction 'mul'.*M extension/);
    expect(firstError('push a0').message).toMatch(/addi sp/);
    expect(firstError('mov a0, a1').message).toMatch(/did you mean mv/);
    expect(firstError('subi a0, a0, 1').message).toMatch(/addi/);
  });

  test('operand kinds and counts', () => {
    let src = '        add a0, a1, 5';
    let e = firstError(src);
    expect([e.line, e.column]).toEqual([1, at(src, '5')]);
    expect(e.message).toMatch(/addi/);
    src = '        addi a0, a1, a2';
    e = firstError(src);
    expect(e.column).toBe(at(src, 'a2'));
    expect(e.message).toMatch(/combine two registers use add/);
    src = '        add a0, a1';
    expect(firstError(src).message).toMatch(/takes 3 operands.*but 2 were given/);
    src = '        lw a0, a1';
    expect(firstError(src).message).toMatch(/address like 8\(sp\)/);
    src = '        sw a0, 4';
    expect(firstError(src).message).toMatch(/address like 8\(sp\)/);
    expect(firstError('ret a0').message).toMatch(/takes no operands/);
    expect(firstError('add a0, x32, a1').message).toMatch(/no register x32/);
    expect(firstError('add a0, loop, a1').message).toMatch(/expected a register/);
    expect(firstError('beq a0, a1, a2').message).toMatch(/branch target/);
  });

  test('immediates that do not fit point at the number', () => {
    let src = '        addi a0, a0, 2048';
    let e = firstError(src);
    expect([e.line, e.column, e.length]).toEqual([1, at(src, '2048'), 4]);
    expect(e.message).toMatch(/does not fit in 12 bits/);
    src = 'nop\nlw a0, 5000(a1)';
    e = firstError(src);
    expect([e.line, e.column]).toEqual([2, at(src, '5000') - 4]);
    expect(firstError('slli a0, a0, 32').message).toMatch(/0–31/);
    expect(firstError('lui a0, 0x100000').message).toMatch(/20 bits/);
    expect(firstError('li a0, 0x100000000').message).toMatch(/32 bits/);
    expect(firstError('.byte 256').message).toMatch(/does not fit in a byte/);
    expect(firstError('.half 70000').message).toMatch(/halfword/);
    expect(firstError('.word 0x100000000').message).toMatch(/word/);
  });

  test('branches out of range, and targets that are not word aligned', () => {
    const src = 'top: beq a0, a1, far\n.space 5000\nfar: nop';
    const e = firstError(src);
    expect(e.line).toBe(1);
    expect(e.message).toMatch(/out of range/);
    expect(firstError('j . + 2').message).toMatch(/multiple of 4/);
    expect(firstError('beq a0, a1, . + 6').message).toMatch(/multiple of 4/);
    expect(firstError('jal . + 2000000').message).toMatch(/range/);
  });

  test('symbols: undefined, duplicate, register names, predefined names, circular constants', () => {
    let e = firstError('nop\n  j nowhere');
    expect([e.line, e.column]).toEqual([2, 5]);
    expect(e.message).toMatch(/undefined symbol 'nowhere'/);
    expect(firstError('Loop: nop\n j loop').message).toMatch(/did you mean 'Loop'/);
    expect(firstError('a: nop\na: nop').message).toMatch(/already defined on line 1/);
    expect(firstError('a0: nop').message).toMatch(/register/);
    expect(firstError('LEDS: nop').message).toMatch(/predefined/);
    expect(firstError('.equ HEX, 5').message).toMatch(/predefined/);
    expect(firstError('.equ A, B\n.equ B, A\nnop').message).toMatch(/itself|cannot be evaluated/);
    expect(firstError('li a0, a1').message).toMatch(/register/);
  });

  test('directives', () => {
    expect(firstError('.foo 1').message).toMatch(/unknown directive/);
    expect(firstError('.string 5').message).toMatch(/string in double quotes/);
    expect(firstError('.word "ab"').message).toMatch(/numbers, not a string/);
    expect(firstError('.align 13').message).toMatch(/exponent/);
    expect(firstError('.balign 3').message).toMatch(/power of two/);
    expect(firstError('.org 0x20000').message).toMatch(/outside RAM/);
    expect(firstError('.org later\nlater: nop').message).toMatch(/first pass/);
    expect(firstError('.string "abc').message).toMatch(/unterminated/);
  });

  test('alignment and memory layout', () => {
    const e = firstError('.byte 1\nnop');
    expect(e.line).toBe(2);
    expect(e.message).toMatch(/multiple of 4/);
    expect(firstError('nop\n.org 0\nnop').message).toMatch(/overlaps.*line 1/);
    expect(firstError('.org 0xfffc\nnop\nnop').message).toMatch(/past the end of RAM/);
    // A small RAM.
    expect(assemble('.space 100\nnop', { ramSize: 64 }).ok).toBe(false);
    // Misaligned data is a warning, not an error.
    const p = assemble('.byte 1\n.word 2');
    expect(p.ok).toBe(true);
    expect(p.diagnostics[0]).toMatchObject({ severity: 'warning', line: 2 });
    expect(p.diagnostics[0]!.message).toMatch(/not 4-byte aligned/);
  });

  test('errors on several lines are all reported, in order', () => {
    const p = assemble('add a0, a1\nnop\nfoo\nbeq a0, a1, nowhere');
    expect(p.diagnostics.map((d) => d.line)).toEqual([1, 3, 4]);
  });

  test('an error in an unused constant is still reported', () => {
    expect(firstError('.equ BAD, nowhere\nnop').message).toMatch(/undefined symbol/);
  });
});
