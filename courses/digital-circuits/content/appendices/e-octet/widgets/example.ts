/** The worked example of Appendix E: add 5 + 4 + 3 + 2 + 1 and show the total on the LEDs. */
export const SUM_SOURCE = `; Add 5 + 4 + 3 + 2 + 1 and show the total on the LEDs.
        LDI  R0, 0          ; R0 = the running total
        LDI  R1, 5          ; R1 = the number to add next
        LDI  R2, 1          ; R2 = the constant 1 (Octet has no DEC)
loop:   ADD  R0, R1         ; total = total + R1
        SUB  R1, R2         ; R1 = R1 - 1; Z is set when it reaches 0
        JNZ  loop           ; not zero yet: go round again
        ST   [LEDS], R0     ; 15 = 0000 1111 on the LEDs
        HLT                 ; stop the clock
`;

/** A program with two deliberate mistakes, for the assembler box. */
export const BROKEN_SOURCE = `        LDI  R0, 5
        DEC  R0             ; Octet has no DEC
        LDI  R4, 1          ; only R0 to R3 exist
        JMP  nowhere
`;

export interface Idiom {
  task: string;
  code: string;
  note: string;
  /** Extra lines the snippet needs to assemble on its own (labels it jumps to). */
  support?: string;
}

/** Common things Octet has no instruction for, and how to say them. Every one is assembled in the tests. */
export const IDIOMS: Idiom[] = [
  { task: 'Do nothing', code: 'NOP', note: 'An alias for MOV R0, R0: byte 0x10, four cycles.' },
  { task: 'Clear R0', code: 'LDI R0, 0', note: 'Leaves the flags alone. XOR R0, R0 also clears it, and sets Z.' },
  { task: 'Subtract one from R0', code: 'LDI R3, 1\nSUB R0, R3', note: 'There is no DEC. Keep a 1 in a spare register.' },
  { task: 'Negate R0', code: 'NOT R0\nINC R0', note: 'Two’s complement: invert, then add one.' },
  { task: 'Double R0', code: 'SHL R0', note: 'Sets the flags exactly as ADD R0, R0 would, so C is the bit that fell off.' },
  { task: 'Jump if R0 < 10, unsigned', code: 'LDI R3, 10\nCMP R0, R3\nJC less', note: 'After CMP, C means a < b unsigned. JLT would compare as signed.', support: 'less: HLT' },
  { task: 'Copy a byte from 0x80 to 0x81', code: 'LD R0, [0x80]\nST [0x81], R0', note: 'Memory to memory goes through a register.' },
  { task: 'Read the byte a pointer points to, then advance it', code: 'LDR R0, [R1]\nINC R1', note: 'INC changes the flags, so test flags before it, not after.' },
  { task: 'Call a subroutine', code: 'CALL f\nHLT', note: 'CALL pushes the return address; RET pops it into PC.', support: 'f: RET' },
  { task: 'Wait for button 0', code: 'LDI R1, 1\nwait: LD R0, [BUTTONS]\nAND R0, R1\nJZ wait', note: 'Bit 0 of BUTTONS is BTN0, 1 while pressed.' },
];
