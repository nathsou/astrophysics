/**
 * An editable microprogram: the routines of the control store, the table that maps each byte to its
 * routine, and what they become in the two ROMs. The microcode editor of Chapter 22 is a view of this,
 * and it is also how the tests change the machine.
 */
import {
  ALU_OPS,
  DRIVERS,
  ROM_SIZE,
  ROUTINES,
  ZERO_FIELDS,
  pack,
  routineOfByte,
  type Fields,
  type Routine,
} from '../../21-datapath/hardware/control-word';
import { describe } from '../../21-datapath/hardware/describe';

export const isEnd = (f: Fields) => f.end === 1;

export { describe };

export interface EditableRoutine {
  name: string;
  /** Mnemonics shown for it. */
  mnemonics: string[];
  steps: { text: string; fields: Fields }[];
  /** Added by the reader (not one of the course's). */
  custom?: boolean;
}

const clone = (r: Routine): EditableRoutine => ({
  name: r.name,
  mnemonics: [...r.mnemonics],
  steps: r.steps.map((s) => ({ text: s.text, fields: { ...s.fields } })),
});

/** The routines of the microprogram that stay put: they hold the fetch and the decode. */
export const FIXED_ROUTINES = 2;

export class Microprogram {
  routines: EditableRoutine[];
  /** For each byte, the name of the routine that runs it. */
  assignment: string[];

  constructor(routines: Routine[] = ROUTINES, assignment?: string[]) {
    this.routines = routines.map(clone);
    this.assignment = assignment ? [...assignment] : Array.from({ length: 256 }, (_, b) => routineOfByte(b));
  }

  clone(): Microprogram {
    const m = new Microprogram([], this.assignment);
    m.routines = this.routines.map((r) => ({ ...r, mnemonics: [...r.mnemonics], steps: r.steps.map((s) => ({ ...s, fields: { ...s.fields } })) }));
    return m;
  }

  /** First ROM address of each routine. */
  starts(): number[] {
    const out: number[] = [];
    let at = 0;
    for (const r of this.routines) {
      out.push(at);
      at += r.steps.length;
    }
    return out;
  }

  get length(): number {
    return this.routines.reduce((n, r) => n + r.steps.length, 0);
  }

  routine(name: string): EditableRoutine | undefined {
    return this.routines.find((r) => r.name === name);
  }

  /** The ROM words. Throws if the program does not fit. */
  words(): number[] {
    if (this.length > ROM_SIZE) throw new Error(`the microprogram has ${this.length} micro-instructions; the ROM holds ${ROM_SIZE}`);
    const words = new Array<number>(ROM_SIZE).fill(0);
    let at = 0;
    for (const r of this.routines) for (const s of r.steps) words[at++] = pack(s.fields);
    return words;
  }

  /** The dispatch ROM: where the routine of each byte starts (a byte with no routine runs the fetch again: an empty routine). */
  dispatch(): number[] {
    const start = new Map(this.routines.map((r, i) => [r.name, this.starts()[i]!]));
    return this.assignment.map((name) => start.get(name) ?? 0);
  }

  /** The address and step of a ROM address. */
  locate(address: number): { routine: number; step: number } | undefined {
    let at = 0;
    for (let i = 0; i < this.routines.length; i++) {
      const n = this.routines[i]!.steps.length;
      if (address < at + n) return { routine: i, step: address - at };
      at += n;
    }
    return undefined;
  }

  setField(routine: number, step: number, name: keyof Fields, value: number): void {
    const s = this.routines[routine]!.steps[step]!;
    s.fields = { ...s.fields, [name]: value };
    s.text = describe(s.fields);
  }

  addStep(routine: number, at?: number): void {
    const r = this.routines[routine]!;
    const f = { ...ZERO_FIELDS };
    r.steps.splice(at ?? r.steps.length, 0, { text: describe(f), fields: f });
  }

  removeStep(routine: number, step: number): void {
    const r = this.routines[routine]!;
    if (r.steps.length > 1) r.steps.splice(step, 1);
  }

  /** Add an empty routine at the end and give it a name; returns its index. */
  addRoutine(name: string, mnemonic = name): number {
    if (this.routine(name)) throw new Error(`there is already a routine ${name}`);
    const f = { ...ZERO_FIELDS, end: 1 };
    this.routines.push({ name, mnemonics: [mnemonic], custom: true, steps: [{ text: describe(f), fields: f }] });
    return this.routines.length - 1;
  }

  removeRoutine(name: string): void {
    const i = this.routines.findIndex((r) => r.name === name);
    if (i < FIXED_ROUTINES) return;
    this.routines.splice(i, 1);
    this.assignment = this.assignment.map((n) => (n === name ? 'HLT' : n));
  }

  /** Make a byte run a routine. */
  assign(byte: number, name: string): void {
    this.assignment[byte & 255] = name;
  }

  /** Things that are wrong with the program as written (it may still run). */
  problems(): string[] {
    const out: string[] = [];
    if (this.length > ROM_SIZE) out.push(`It has ${this.length} micro-instructions and the ROM holds ${ROM_SIZE}.`);
    for (const r of this.routines.slice(FIXED_ROUTINES)) {
      const last = r.steps[r.steps.length - 1]!;
      if (!isEnd(last.fields) && !last.fields.halt) out.push(`${r.name}: the last micro-step does not have END, so the machine runs on into the next routine.`);
      r.steps.slice(0, -1).forEach((s, i) => {
        if (isEnd(s.fields)) out.push(`${r.name}: step ${i + 1} has END, so the steps after it never run.`);
      });
    }
    return out;
  }
}

export { ALU_OPS, DRIVERS };
