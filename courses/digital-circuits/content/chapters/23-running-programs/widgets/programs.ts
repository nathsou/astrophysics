/**
 * The programs of Chapter 23 that are written for the chapter (the course's demonstration programs, such as
 * multiply and Fibonacci, live in `src/lib/sim/cpu/octet/programs`). Each one is assembled and run, with the
 * result the text quotes, in `programs.test.ts`.
 */
import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet';

export interface ChapterProgram {
  id: string;
  title: string;
  /** One line under the program picker. */
  summary: string;
  source: string;
  /** The devices the program uses, for the widget's I/O panel. */
  devices: ('leds' | 'switches' | 'buttons' | 'hex' | 'console' | 'matrix')[];
}

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

export const COMPARE_SOURCE = `; Is 0xFF less than 3? It depends on whether you mean 255 or -1.
; Bit 0 of the LEDs: unsigned "less than"; bit 1: signed "less than".
        LDI  R0, 0xFF       ; 255 unsigned, -1 signed
        LDI  R1, 3
        LDI  R2, 0          ; the answer, built up here
        CMP  R0, R1         ; flags of R0 - R1
        JNC  notlo          ; C = 0: R0 is not below R1 (unsigned)
        LDI  R3, 1
        OR   R2, R3         ; unsigned: less
notlo:  CMP  R0, R1         ; OR changed the flags, so compare again
        JGE  notlt          ; N = V: R0 is not below R1 (signed)
        LDI  R3, 2
        OR   R2, R3         ; signed: less
notlt:  ST   [LEDS], R2
        HLT
`;

export const STACK_SOURCE = `; Nested calls: quad calls double twice. Watch the stack at 0xEE and 0xEF.
        LDI  R0, 5
        CALL quad           ; R0 = 4 * R0
        ST   [LEDS], R0     ; 20
        HLT

quad:   CALL double
        CALL double
        RET

double: SHL  R0             ; R0 = 2 * R0
        RET
`;

export const PRINT_DECIMAL_SOURCE = `; Print a byte in decimal on the console: 137 becomes the characters 1, 3, 7.
; Division by 10 is repeated subtraction: how many times does 10 go in?
        LDI  R0, 137
        CALL print_dec
        LDI  R0, 10         ; a new line
        ST   [CONSOLE], R0
        HLT

; print_dec: print R0 as one to three digits. Uses R1, R2 and R3.
print_dec:
        LDI  R2, 0          ; R2 = 1 once a digit has been printed
        LDI  R1, 100
        CALL digit
        LDI  R1, 10
        CALL digit
        LDI  R1, '0'        ; the ones digit is always printed
        ADD  R0, R1
        ST   [CONSOLE], R0
        RET

; digit: divide R0 by R1 by repeated subtraction. Print the quotient as a
; digit (unless it is a leading zero) and leave the remainder in R0.
digit:  LDI  R3, 0          ; the quotient
dloop:  CMP  R0, R1
        JC   ddone          ; R0 < R1: no more will go in
        SUB  R0, R1
        INC  R3
        JMP  dloop
ddone:  OR   R3, R3         ; is the quotient zero?
        JNZ  show
        OR   R2, R2         ; a leading zero: skip it if nothing was printed yet
        JZ   skip
show:   PUSH R0             ; keep the remainder while R0 is used for the character
        LDI  R0, '0'
        ADD  R0, R3
        ST   [CONSOLE], R0
        POP  R0
        LDI  R2, 1
skip:   RET
`;

export const ECHO_SOURCE = `; Echo: whatever you type on the console appears on the LEDs as its ASCII code,
; and is printed back. CONSOLE reads 0 when nothing is waiting: polling.
loop:   LD   R0, [CONSOLE]  ; the next typed character, or 0
        OR   R0, R0
        JZ   loop           ; nothing yet: look again
        ST   [LEDS], R0
        ST   [CONSOLE], R0
        JMP  loop
`;

export const CHAPTER_PROGRAMS: ChapterProgram[] = [
  { id: 'sum', title: 'Sum of 5 to 1', summary: 'A loop that adds 5 + 4 + 3 + 2 + 1.', source: SUM_SOURCE, devices: ['leds'] },
  { id: 'compare', title: 'Signed or unsigned?', summary: 'The same comparison, read two ways.', source: COMPARE_SOURCE, devices: ['leds'] },
  { id: 'stack', title: 'Nested calls', summary: 'CALL and RET, and the stack they use.', source: STACK_SOURCE, devices: ['leds'] },
  { id: 'print-decimal', title: 'Print a number', summary: 'A byte in decimal on the console, by repeated subtraction.', source: PRINT_DECIMAL_SOURCE, devices: ['console'] },
  { id: 'echo', title: 'Echo', summary: 'Poll the console; show what you type.', source: ECHO_SOURCE, devices: ['leds', 'console'] },
];

const DEVICES: Record<string, ChapterProgram['devices']> = {
  blink: ['leds'],
  count: ['leds', 'hex'],
  multiply: ['leds', 'hex'],
  fibonacci: ['hex'],
  hello: ['console'],
  sort: [],
  reaction: ['leds', 'hex', 'buttons'],
  pong: ['matrix', 'buttons'],
  life: ['matrix'],
};

/** Look up a program by id: the chapter's own, or one of the course's demonstration programs. */
export function programById(id: string): ChapterProgram {
  const own = CHAPTER_PROGRAMS.find((p) => p.id === id);
  if (own) return own;
  const shared = OCTET_PROGRAMS.find((p) => p.id === id);
  if (!shared) throw new Error(`no Octet program '${id}'`);
  return { id: shared.id, title: shared.title, summary: shared.summary, source: shared.source, devices: DEVICES[id] ?? ['leds'] };
}
