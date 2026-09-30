/**
 * The programs of the chapter's boards: the two written for it (`programs/*.asm`), and the course's own, which need
 * only the devices the DCL Octet has (LEDS, SWITCHES, BUTTONS, HEX, CONSOLE, RANDOM).
 */
import { octetProgram } from '$lib/sim/cpu/octet';
import walk from '../programs/walk.asm?raw';
import switches from '../programs/switches.asm?raw';
import rv32Walk from '../programs/rv32-walk.asm?raw';

export interface BoardProgram {
  id: string;
  title: string;
  /** What to expect on the board. */
  note: string;
  source: string;
}

export const OCTET_BOARD_PROGRAMS: BoardProgram[] = [
  { id: 'walk', title: 'Walking light', note: 'A light walks along the LEDs and back; the hex display counts the steps. About 125 clock cycles a step.', source: walk },
  { id: 'switches', title: 'Switches to LEDs', note: 'Flip a switch: the LED follows. Hold a button: the number on the right digits grows.', source: switches },
  { id: 'blink', title: 'Blink (Chapter 23)', note: 'The two halves of the LEDs in turn; each half stays lit for about 10,000 cycles, so choose a fast clock.', source: octetProgram('blink').source },
  { id: 'count', title: 'Count (Chapter 23)', note: 'Counts 0 to 255 on the LEDs and the hex digits, one count per 2,575 cycles, then stops.', source: octetProgram('count').source },
  { id: 'fibonacci', title: 'Fibonacci (Chapter 23)', note: 'The Fibonacci numbers on the hex digits, then HLT: the halted pin lights.', source: octetProgram('fibonacci').source },
  { id: 'multiply', title: 'Multiply (Chapter 23)', note: '13 × 11 = 143: 0x00 on the digits and 0x8F on the LEDs (the low byte), then HLT.', source: octetProgram('multiply').source },
  { id: 'hello', title: 'Hello, world (Chapter 23)', note: 'Prints HELLO, WORLD to the console line under the board, then HLT.', source: octetProgram('hello').source },
];

export const RV32_BOARD_PROGRAMS: BoardProgram[] = [
  { id: 'walk', title: 'Walking light', note: 'The same walk as Octet’s: two clock cycles an instruction, about 40 cycles a step.', source: rv32Walk },
];

export const defaultOctetProgram = OCTET_BOARD_PROGRAMS[0]!;
