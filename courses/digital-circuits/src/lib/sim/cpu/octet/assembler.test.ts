import { describe, expect, test } from 'vitest';
import { assemble, assembleOrThrow } from './assembler';

const bytes = (src: string, from = 0, to?: number) => {
  const p = assembleOrThrow(src);
  return [...p.image.slice(from, to ?? from + p.size)];
};

/** The first error as `line:column message`. */
const firstError = (src: string) => {
  const p = assemble(src);
  expect(p.ok).toBe(false);
  const d = p.diagnostics.find((x) => x.severity === 'error')!;
  return `${d.line}:${d.column} ${d.message}`;
};

describe('Octet assembler: instructions', () => {
  test('every instruction form', () => {
    const src = `
      HLT
      MOV R1, R2
      LDI R3, 42
      LDI R0, #0x2A
      LD R2, [0x80]
      ST [0x81], R1
      LDR R0, [R3]
      STR [R3], R0
      PUSH R2
      POP R1
      CALL 0x40
      RET
      ADD R0, R1
      SUB R1, R2
      AND R2, R3
      OR R3, R0
      XOR R0, R0
      CMP R1, R0
      SHL R0
      SHR R1
      NOT R2
      INC R3
      JMP 0x10
      JZ 0x11
      JNZ 0x12
      JC 0x13
      JNC 0x14
      JN 0x15
      JNN 0x16
      JV 0x17
      JNV 0x18
      JLT 0x19
      JGE 0x1A
      JLS 0x1B
      JHI 0x1C
      JLE 0x1D
      JGT 0x1E
      JNEVER 0x1F
      NOP
    `;
    expect(bytes(src)).toEqual([
      0x00, 0x16, 0x2c, 42, 0x20, 0x2a, 0x38, 0x80, 0x44, 0x81, 0x53, 0x6c, 0x78, 0x75, 0x72, 0x40, 0x73,
      0x81, 0x96, 0xab, 0xbc, 0xc0, 0xd4, 0xe0, 0xe5, 0xea, 0xef,
      0xf0, 0x10, 0xf2, 0x11, 0xf3, 0x12, 0xf4, 0x13, 0xf5, 0x14, 0xf6, 0x15, 0xf7, 0x16, 0xf8, 0x17,
      0xf9, 0x18, 0xfa, 0x19, 0xfb, 0x1a, 0xfc, 0x1b, 0xfd, 0x1c, 0xfe, 0x1d, 0xff, 0x1e, 0xf1, 0x1f,
      0x10,
    ]);
  });

  test('case-insensitive mnemonics and registers; aliases', () => {
    expect(bytes('add r0, R1\nJeq 5\njne 6\njlo 7\njhs 8\nnop')).toEqual([0x81, 0xf2, 5, 0xf3, 6, 0xf4, 7, 0xf5, 8, 0x10]);
  });

  test('negative immediates are two’s complement', () => {
    expect(bytes('LDI R0, -1\nLDI R1, -128\nLDI R2, 255')).toEqual([0x20, 0xff, 0x24, 0x80, 0x28, 0xff]);
  });
});

describe('Octet assembler: labels, expressions and directives', () => {
  test('forward and backward labels', () => {
    const src = `
start:  LDI R0, 0
loop:   INC R0
        JNZ loop
        JMP end
end:    HLT
        JMP start`;
    expect(bytes(src)).toEqual([0x20, 0, 0xe3, 0xf3, 0x02, 0xf0, 0x07, 0x00, 0xf0, 0x00]);
  });

  test('expressions: + −, parentheses, characters, dot, binary, constants defined later', () => {
    const src = `
        .equ TWICE, BASE + BASE
        LDI R0, TWICE - (1 + 2)
        LDI R1, 'A' + 1
        LDI R2, 0b1010_0101
        JMP .
        LDI R3, -(3 - 5)
        .equ BASE, 10`;
    expect(bytes(src)).toEqual([0x20, 17, 0x24, 66, 0x28, 0xa5, 0xf0, 6, 0x2c, 2]);
  });

  test('.org, .byte, .string, .ascii, .space and symbols', () => {
    const src = `
        JMP main
        .org 0x10
data:   .byte 1, 2, 'x', "ab", data
msg:    .string "Hi\\n"
raw:    .ascii "ok"
buf:    .space 3, 0xAA
main:   LD R0, [data + 1]
        ST [LEDS], R0`;
    const p = assembleOrThrow(src);
    expect([...p.image.slice(0, 2)]).toEqual([0xf0, 0x1f]);
    expect([...p.image.slice(0x10, 0x23)]).toEqual([
      1, 2, 0x78, 0x61, 0x62, 0x10, 0x48, 0x69, 10, 0, 0x6f, 0x6b, 0xaa, 0xaa, 0xaa, 0x30, 0x11, 0x40, 0xf8,
    ]);
    expect(p.symbols).toMatchObject({ data: 0x10, msg: 0x16, raw: 0x1a, buf: 0x1c, main: 0x1f, LEDS: 0xf8 });
    expect(p.size).toBe(2 + 19);
    expect(p.lineOf[0x1f]).toBe(8);
    expect(p.instructionStart[0x1f]).toBe(1);
    expect(p.instructionStart[0x20]).toBe(0);
  });

  test('comments and blank lines; the listing', () => {
    const p = assembleOrThrow('; header\n\nstart: LDI R0, 1 ; one\n  HLT');
    expect(p.listing[2]).toEqual({ line: 3, address: 0, bytes: [0x20, 1], source: 'start: LDI R0, 1 ; one' });
    expect(p.listing[0]!.bytes).toEqual([]);
    expect(p.labels.get(0)).toEqual(['start']);
  });

  test('a comment character inside a string is not a comment', () => {
    expect(bytes('.string "a;b"')).toEqual([0x61, 0x3b, 0x62, 0]);
  });
});

describe('Octet assembler: errors carry line and column', () => {
  test.each([
    ['FOO R0', '1:1 unknown instruction \'FOO\''],
    ['  DEC R0', '1:3 unknown instruction \'DEC\': Octet has no DEC: use SUB with a register that holds 1, or NOT, INC, NOT'],
    ['ADD R0', "1:7 ADD takes 2 operands (ADD Rd, Rs) but 1 was given"],
    ['RET R0', '1:5 RET takes no operands (RET) but 1 was given'],
    ['ADD R0, R4', '1:9 there is no register R4: Octet has R0–R3'],
    ['MOV R0, 5', '1:9 MOV copies a register; to load a number use LDI'],
    ['LD R0, 5', '1:8 expected a memory address in brackets, e.g. [0x80] or [label], but found \'5\''],
    ['LD R0, [R1]', '1:9 LD takes a fixed address; to use the address in a register use LDR'],
    ['LDR R0, [0x80]', '1:9 LDR takes an address in a register, e.g. [R1]; for a fixed address use LD'],
    ['LDI R0, [5]', '1:9 LDI loads a constant; to load from memory use LD or LDR'],
    ['JMP R1', '1:5 JMP takes an address (a label or a number), not a register'],
    ['LDI R0, 256', '1:9 value 256 does not fit in a byte (−128 to 255)'],
    ['JMP 300', '1:5 address 300 is outside memory (0–255)'],
    ['JMP nowhere', "1:5 undefined symbol 'nowhere'"],
    ['Loop: JMP loop', "1:11 undefined symbol 'loop' (did you mean 'Loop'? symbols are case-sensitive)"],
    ['x: HLT\nx: HLT', "2:1 'x' is already defined on line 1"],
    ['LEDS: HLT', "1:1 'LEDS' is a predefined I/O address"],
    ['R1: HLT', "1:1 'R1' is a register, not a value, so it cannot be a label"],
    ['LDI R0, SP', '1:9 SP cannot be used as an operand: only PUSH, POP, CALL, RET and jumps change it'],
    ['LDI R0, 12ab', "1:9 '12ab' is not a valid number"],
    ['.string "abc', '1:9 unterminated string (expected a closing ")'],
    ['.org later\nlater: HLT', '1:6 the address in .org must be known on the first pass: it cannot use labels defined further down'],
    ['.org 0xF0\nHLT', '2:1 address 0xF0 is in the I/O region (0xF0–0xFF): programs and data must fit in 0x00–0xEF'],
    ['HLT\n.org 0\nHLT', '3:1 overlaps the byte at 0x00 already assembled from line 1'],
    ['.equ A, B\n.equ B, A\nHLT', "1:9 constant 'B' (line 2) cannot be evaluated: 'A' is defined in terms of itself"],
    ['.foo 1', "1:1 unknown directive '.foo'"],
    ['ADD R0 R1', "1:8 unexpected 'R1' at the end of the statement"],
    ['LDI R0, (1 + 2', "1:15 expected ')' but found the end of the line"],
    ['LDI R0, @', "1:9 unexpected character '@'"],
    ['.string 5', '1:9 .string expects a string in double quotes, e.g. "HELLO"'],
  ])('%s', (src, expected) => {
    expect(firstError(src)).toBe(expected);
  });

  test('collects errors from several lines', () => {
    const p = assemble('FOO\nADD R0\nHLT\nJMP x');
    expect(p.diagnostics.map((d) => d.line)).toEqual([1, 2, 4]);
  });

  test('an error in an unused constant is still reported', () => {
    expect(firstError('.equ X, missing\nHLT')).toBe("1:9 undefined symbol 'missing'");
  });
});
