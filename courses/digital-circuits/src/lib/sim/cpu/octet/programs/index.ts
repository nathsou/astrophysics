/**
 * The course's Octet programs (Chapter 23 and 24 demos, and the two challenges), as source text.
 * Each is assembled and run with expected results in `programs.test.ts`.
 */
import blink from './blink.asm?raw';
import count from './count.asm?raw';
import multiply from './multiply.asm?raw';
import fibonacci from './fibonacci.asm?raw';
import hello from './hello.asm?raw';
import reaction from './reaction.asm?raw';
import sort from './sort.asm?raw';
import pong from './pong.asm?raw';
import life from './life.asm?raw';

export interface OctetProgramSource {
  id: string;
  title: string;
  summary: string;
  /** Runs to HLT on its own (the rest loop for ever or wait for input). */
  halts: boolean;
  source: string;
}

export const OCTET_PROGRAMS: OctetProgramSource[] = [
  { id: 'blink', title: 'Blink', summary: 'Alternate the two halves of the LEDs.', halts: false, source: blink },
  { id: 'count', title: 'Count', summary: 'Count 0–255 on the LEDs and the hex display.', halts: true, source: count },
  { id: 'multiply', title: 'Multiply', summary: '8 × 8 → 16-bit multiplication by shift-and-add.', halts: true, source: multiply },
  { id: 'fibonacci', title: 'Fibonacci', summary: 'The Fibonacci numbers that fit in a byte.', halts: true, source: fibonacci },
  { id: 'hello', title: 'Hello, world', summary: 'Print "HELLO, WORLD" on the console.', halts: true, source: hello },
  { id: 'sort', title: 'Sort', summary: 'Bubble-sort 8 bytes.', halts: true, source: sort },
  { id: 'reaction', title: 'Reaction timer', summary: 'Random wait, then time a button press.', halts: false, source: reaction },
  { id: 'pong', title: 'Pong', summary: 'One-player Pong on the 8 × 8 matrix (challenge).', halts: false, source: pong },
  { id: 'life', title: 'Game of Life', summary: "Conway's Life on the 8 × 8 matrix, on a torus (challenge).", halts: false, source: life },
];

export function octetProgram(id: string): OctetProgramSource {
  const p = OCTET_PROGRAMS.find((x) => x.id === id);
  if (!p) throw new Error(`no Octet program '${id}'`);
  return p;
}
