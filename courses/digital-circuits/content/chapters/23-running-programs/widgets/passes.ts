/**
 * The two passes of the assembler, as a table for a figure. The real assembler (`src/lib/sim/cpu/octet/assembler.ts`)
 * does its work in two loops over the source; this module runs it and then reconstructs, line by line, what each pass
 * knew: after pass 1 every line has an address and every label a value, but an operand that names a label defined
 * further down is still a hole; pass 2 fills the holes from the symbol table.
 */
import { OCTET_IO, assemble, type OctetProgram } from '$lib/sim/cpu/octet';

/** The program the figure starts with: one forward reference (pause) and two backward ones (loop, wait). */
export const PASSES_SOURCE = `; count down from 3, showing each value on the LEDs
        LDI  R1, 3
        LDI  R2, 1
loop:   ST   [LEDS], R1
        CALL pause          ; pause is defined further down
        SUB  R1, R2
        JNZ  loop           ; loop is defined above
        HLT
pause:  LDI  R3, 0
wait:   INC  R3
        JNZ  wait
        RET
`;

export interface PassRow {
  line: number;
  source: string;
  /** Labels defined on this line. */
  labels: string[];
  /** Address of the line's first byte, or of the next byte for a line that only has a label. */
  address?: number;
  /** The bytes the line produces. */
  bytes: number[];
  /** Indexes in `bytes` that pass 1 cannot know: the operand names a label defined further down. */
  holes: number[];
  /** The forward references: the label and its final value. */
  refs: { name: string; address: number }[];
}

export interface SymbolEntry {
  name: string;
  address: number;
  /** The line that defines it. */
  line: number;
}

export interface TwoPass {
  ok: boolean;
  program: OctetProgram;
  rows: PassRow[];
  symbols: SymbolEntry[];
}

const LABEL = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/;

/** The label definitions at the start of a line (there may be more than one). */
function labelsOn(text: string): string[] {
  const out: string[] = [];
  let rest = text.replace(/;.*$/, '');
  for (;;) {
    const m = LABEL.exec(rest);
    if (!m || m[1]!.startsWith('.')) break;
    out.push(m[1]!);
    rest = rest.slice(m[0].length);
  }
  return out;
}

export function twoPass(source: string): TwoPass {
  const program = assemble(source);
  const lines = source.split('\n');
  const io = new Set(Object.keys(OCTET_IO));
  const defLine = new Map<string, number>();
  const rowsLabels = lines.map((l, i) => {
    const ls = labelsOn(l).filter((n) => n in program.symbols);
    for (const n of ls) defLine.set(n, i + 1);
    return ls;
  });
  const rows: PassRow[] = lines.map((text, i) => {
    const l = program.listing[i];
    const labels = rowsLabels[i]!;
    const bytes = l?.bytes ?? [];
    const line = i + 1;
    const address = bytes.length ? l!.address : labels.length ? program.symbols[labels[0]!] : undefined;
    const holes: number[] = [];
    const refs: PassRow['refs'] = [];
    const isInstruction = bytes.length === 2 && l!.address !== undefined && program.instructionStart[l!.address] === 1;
    if (isInstruction) {
      // Look for names in the operand text: everything after the mnemonic.
      let rest = text.replace(/;.*$/, '');
      for (const _ of labels) rest = rest.replace(LABEL, '');
      rest = rest.trim().replace(/^\S+/, '');
      for (const name of rest.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        if (io.has(name) || /^[rR][0-3]$/.test(name)) continue;
        const at = defLine.get(name);
        // A label defined on a later line has not been seen yet when pass 1 reaches this line.
        if (at !== undefined && at > line && !refs.some((r) => r.name === name)) refs.push({ name, address: program.symbols[name]! });
      }
      if (refs.length) holes.push(1);
    }
    return { line, source: text, labels, address, bytes, holes, refs };
  });
  const symbols: SymbolEntry[] = [];
  for (const r of rows) for (const name of r.labels) symbols.push({ name, address: program.symbols[name]!, line: r.line });
  return { ok: program.ok, program, rows, symbols };
}
