/**
 * The Octet assembler: two passes over the source (see `common/asm.ts`).
 *
 * Syntax, one statement per line:
 *
 * ```
 * label:  MNEMONIC operand, operand   ; comment
 * ```
 *
 * - Mnemonics, register names (R0–R3) and directives are case-insensitive; labels and constants are
 *   case-sensitive (an error suggests the right spelling when only the case differs).
 * - Operands: registers `R0`–`R3`; immediates `42`, `#42`, `0x2A`, `0b101010`, `'*'`; memory
 *   `[addr]` or `[Rn]`; jump targets `label` or an address. Expressions use `+`, `-`, parentheses,
 *   symbols and `.` (the address of the current statement).
 * - Directives: `.org addr`, `.byte v, …` (numbers, characters, strings), `.string "…"` (with a
 *   zero byte), `.ascii "…"`, `.space n[, v]`, `.equ NAME, value`.
 * - The I/O register names of `spec.ts` (`LEDS`, `HEX`, `CONSOLE`, …) are predefined.
 *
 * The program must fit in RAM (0x00–0xEF); emitting into the I/O region, past 0xFF, or twice into
 * the same byte is an error.
 */
import {
  AsmError,
  SymbolTable,
  TokenStream,
  describe,
  errorAt,
  evaluate,
  exprError,
  parseExpr,
  splitLines,
  tokenize,
  type Diagnostic,
  type Expr,
  type Token,
} from '../common/asm';
import {
  OCTET_IO,
  OCTET_MEMORY,
  encodeFirstByte,
  instructionByMnemonic,
  type OctetInstruction,
  type OctetOperand,
} from './spec';

export interface ListingLine {
  /** 1-based source line. */
  line: number;
  /** Address of the first byte emitted by this line, if it emitted any. */
  address?: number;
  bytes: number[];
  source: string;
}

export interface OctetProgram {
  /** True when there are no errors. */
  ok: boolean;
  /** The 256-byte memory image (bytes not emitted are 0). */
  image: Uint8Array;
  /** 1 for every byte the program emitted. */
  used: Uint8Array;
  /** Number of bytes emitted. */
  size: number;
  /** Every label and constant (including the predefined I/O names). */
  symbols: Record<string, number>;
  /** Labels only, address → names (for the disassembler). */
  labels: Map<number, string[]>;
  /** For each address, the 1-based source line that emitted it (0 if none). */
  lineOf: Uint16Array;
  /** For each address, true if an instruction starts there. */
  instructionStart: Uint8Array;
  listing: ListingLine[];
  diagnostics: Diagnostic[];
}

/** Hints for mnemonics people often expect but Octet does not have. */
const MISSING: Record<string, string> = {
  DEC: 'Octet has no DEC: use SUB with a register that holds 1, or NOT, INC, NOT',
  NEG: 'Octet has no NEG: use NOT then INC',
  ADDI: 'Octet has no ADDI: load the constant into a register with LDI, then ADD',
  SUBI: 'Octet has no SUBI: load the constant into a register with LDI, then SUB',
  LOAD: "did you mean LD (fixed address), LDR (address in a register) or LDI (a constant)?",
  STORE: 'did you mean ST (fixed address) or STR (address in a register)?',
  HALT: 'did you mean HLT?',
  JE: 'did you mean JZ (or its alias JEQ)?',
  BEQ: 'did you mean JZ?',
  BNE: 'did you mean JNZ?',
  B: 'did you mean JMP?',
  ROL: 'Octet has no rotate: SHL, then add the carry back with JNC and INC',
  ROR: 'Octet has no rotate instruction',
};

type Operand =
  | { kind: 'reg'; n: number; tok: Token }
  | { kind: 'memreg'; n: number; tok: Token }
  | { kind: 'mem'; expr: Expr; tok: Token }
  | { kind: 'expr'; expr: Expr; tok: Token };

type DataItem = { expr: Expr } | { bytes: number[] };

type Stmt =
  | {
      kind: 'instr';
      line: number;
      addr: number;
      spec: OctetInstruction;
      first: number;
      /** The second byte's expression (immediate or address). */
      operand?: { expr: Expr; role: 'imm' | 'addr' };
    }
  | { kind: 'data'; line: number; addr: number; items: DataItem[]; size: number }
  | { kind: 'space'; line: number; addr: number; count: number; fill?: Expr };

const REGISTER = /^[rR]([0-9]+)$/;

function registerNumber(t: Token): number | undefined {
  if (t.kind !== 'ident') return undefined;
  const m = REGISTER.exec(t.text);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (n > 3) throw errorAt(t, `there is no register ${t.text.toUpperCase()}: Octet has R0–R3`);
  return n;
}

function reservedName(name: string): string | undefined {
  if (REGISTER.test(name)) return `'${name}' is a register, not a value`;
  const u = name.toUpperCase();
  if (u === 'SP' || u === 'PC')
    return `${u} cannot be used as an operand: only PUSH, POP, CALL, RET and jumps change it`;
  return undefined;
}

const exprOptions = { reserved: reservedName };

function parseOperand(ts: TokenStream): Operand {
  const t = ts.peek();
  if (ts.accept('[')) {
    const inner = ts.peek();
    const n = registerNumber(inner);
    if (n !== undefined) {
      ts.next();
      ts.expect(']', "']'");
      return { kind: 'memreg', n, tok: inner };
    }
    const expr = parseExpr(ts, exprOptions);
    ts.expect(']', "']'");
    return { kind: 'mem', expr, tok: t };
  }
  const n = registerNumber(t);
  if (n !== undefined) {
    ts.next();
    return { kind: 'reg', n, tok: t };
  }
  if (t.kind === 'ident' && (t.text.toUpperCase() === 'SP' || t.text.toUpperCase() === 'PC'))
    throw errorAt(t, reservedName(t.text)!);
  ts.accept('#');
  return { kind: 'expr', expr: parseExpr(ts, exprOptions), tok: t };
}

function operandTok(o: Operand): Token {
  return o.tok;
}

/** Check that an actual operand fits the expected kind; return the register number or expression. */
function matchOperand(mn: string, want: OctetOperand, o: Operand): { reg?: number; expr?: Expr } {
  const tok = operandTok(o);
  switch (want) {
    case 'rd':
    case 'rs':
      if (o.kind === 'reg') return { reg: o.n };
      if (o.kind === 'expr' && mn === 'MOV')
        throw errorAt(tok, 'MOV copies a register; to load a number use LDI');
      throw errorAt(tok, `expected a register (R0–R3) but found ${describe(tok)}`);
    case '[rd]':
    case '[rs]':
      if (o.kind === 'memreg') return { reg: o.n };
      if (o.kind === 'mem')
        throw errorAt(tok, `${mn} takes an address in a register, e.g. [R1]; for a fixed address use ${mn === 'LDR' ? 'LD' : 'ST'}`);
      throw errorAt(tok, `expected a register in brackets, e.g. [R1], but found ${describe(tok)}`);
    case '[addr]':
      if (o.kind === 'mem') return { expr: o.expr };
      if (o.kind === 'memreg')
        throw errorAt(tok, `${mn} takes a fixed address; to use the address in a register use ${mn === 'LD' ? 'LDR' : 'STR'}`);
      throw errorAt(tok, `expected a memory address in brackets, e.g. [0x80] or [label], but found ${describe(tok)}`);
    case 'imm':
      if (o.kind === 'expr') return { expr: o.expr };
      if (o.kind === 'mem' || o.kind === 'memreg') throw errorAt(tok, 'LDI loads a constant; to load from memory use LD or LDR');
      throw errorAt(tok, 'LDI loads a constant; to copy a register use MOV');
    case 'addr':
      if (o.kind === 'expr') return { expr: o.expr };
      if (o.kind === 'reg') throw errorAt(tok, `${mn} takes an address (a label or a number), not a register`);
      throw errorAt(tok, `${mn} takes an address without brackets, e.g. ${mn} loop`);
  }
}

function inRange(value: number, lo: number, hi: number): boolean {
  return Number.isInteger(value) && value >= lo && value <= hi;
}

/** Assemble Octet source code. Never throws: problems are returned as diagnostics. */
export function assemble(source: string): OctetProgram {
  const lines = splitLines(source);
  const diagnostics: Diagnostic[] = [];
  const symbols = new SymbolTable();
  for (const [name, value] of Object.entries(OCTET_IO)) {
    symbols.define({ name, kind: 'label', value, line: 0, column: 0 });
  }
  const stmts: Stmt[] = [];
  const labelsAt = new Map<number, string[]>();
  let pc: number = OCTET_MEMORY.resetPc;

  const report = (line: number, e: unknown, severity: 'error' | 'warning' = 'error') => {
    if (e instanceof AsmError) diagnostics.push({ line, column: e.column, length: e.length, message: e.message, severity });
    else throw e;
  };
  const pass1Value = (expr: Expr, dot: number, what: string): number => {
    const v = evaluate(expr, { dot, lookup: (n, t) => symbols.lookup(n, t, false) });
    if (v === undefined)
      throw exprError(expr, `${what} must be known on the first pass: it cannot use labels defined further down`);
    return v;
  };
  const defineSymbol = (name: string, tok: Token, line: number, kind: 'label' | 'equ', extra: Partial<{ value: number; expr: Expr; dot: number }>) => {
    const reserved = reservedName(name);
    if (reserved) throw errorAt(tok, `${reserved}, so it cannot be a ${kind === 'label' ? 'label' : 'constant'}`);
    const existing = symbols.defs.get(name);
    if (existing && existing.line === 0) throw errorAt(tok, `'${name}' is a predefined I/O address`);
    const err = symbols.define({ name, kind, line, column: tok.column, ...extra });
    if (err) throw errorAt(tok, err);
  };

  // ---- Pass 1: parse, size, and define labels.
  lines.forEach((text, index) => {
    const line = index + 1;
    try {
      const ts = new TokenStream(tokenize(text, { comments: [';'] }));
      // Labels.
      while (ts.peek().kind === 'ident' && ts.isPunct(':', 1) && !ts.peek().text.startsWith('.')) {
        const t = ts.next();
        ts.next();
        defineSymbol(t.text, t, line, 'label', { value: pc });
        const list = labelsAt.get(pc) ?? [];
        list.push(t.text);
        labelsAt.set(pc, list);
      }
      if (ts.atEnd()) return;
      const head = ts.next();
      if (head.kind !== 'ident') throw errorAt(head, `expected an instruction or directive but found ${describe(head)}`);
      const word = head.text.toUpperCase();
      if (word.startsWith('.')) {
        switch (word) {
          case '.ORG': {
            const expr = parseExpr(ts, exprOptions);
            ts.expectEnd();
            const v = pass1Value(expr, pc, 'the address in .org');
            if (!inRange(v, 0, 0xff)) throw exprError(expr, `.org address ${v} is outside memory (0–255)`);
            pc = v;
            return;
          }
          case '.EQU':
          case '.SET': {
            const name = ts.next();
            if (name.kind !== 'ident') throw errorAt(name, `expected a name after ${head.text}`);
            ts.expect(',', "',' after the name");
            const expr = parseExpr(ts, exprOptions);
            ts.expectEnd();
            defineSymbol(name.text, name, line, 'equ', { expr, dot: pc });
            return;
          }
          case '.BYTE':
          case '.DB':
          case '.STRING':
          case '.ASCIZ':
          case '.ASCII': {
            const items: DataItem[] = [];
            const strings = word !== '.BYTE' && word !== '.DB';
            do {
              const t = ts.peek();
              if (t.kind === 'string') {
                ts.next();
                items.push({ bytes: word === '.ASCII' || !strings ? t.bytes! : [...t.bytes!, 0] });
              } else if (strings) {
                throw errorAt(t, `${head.text} expects a string in double quotes, e.g. "HELLO"`);
              } else items.push({ expr: parseExpr(ts, exprOptions) });
            } while (ts.accept(','));
            ts.expectEnd();
            const size = items.reduce((s, it) => s + ('bytes' in it ? it.bytes.length : 1), 0);
            stmts.push({ kind: 'data', line, addr: pc, items, size });
            pc += size;
            return;
          }
          case '.SPACE':
          case '.ZERO': {
            const countExpr = parseExpr(ts, exprOptions);
            let fill: Expr | undefined;
            if (ts.accept(',')) fill = parseExpr(ts, exprOptions);
            ts.expectEnd();
            const count = pass1Value(countExpr, pc, 'the size in .space');
            if (!inRange(count, 0, 256)) throw exprError(countExpr, `.space size ${count} is out of range (0–256)`);
            stmts.push({ kind: 'space', line, addr: pc, count, fill });
            pc += count;
            return;
          }
          default:
            throw errorAt(head, `unknown directive '${head.text}'`);
        }
      }
      // Instructions.
      let spec = instructionByMnemonic(word);
      let operands: Operand[] = [];
      if (!ts.atEnd()) {
        do operands.push(parseOperand(ts));
        while (ts.accept(','));
      }
      ts.expectEnd();
      if (word === 'NOP') {
        if (operands.length) throw errorAt(operandTok(operands[0]!), 'NOP takes no operands');
        spec = instructionByMnemonic('MOV')!;
        operands = [
          { kind: 'reg', n: 0, tok: head },
          { kind: 'reg', n: 0, tok: head },
        ];
      }
      if (!spec) {
        const hint = MISSING[word];
        throw errorAt(head, `unknown instruction '${head.text}'${hint ? `: ${hint}` : ''}`);
      }
      if (operands.length !== spec.operands.length) {
        const n = spec.operands.length;
        const at = operands[n] ? operandTok(operands[n]) : ts.peek();
        throw errorAt(
          at,
          `${spec.mnemonic} takes ${n === 0 ? 'no operands' : n === 1 ? '1 operand' : `${n} operands`} (${spec.syntax}) but ${operands.length} ${operands.length === 1 ? 'was' : 'were'} given`,
        );
      }
      let d = 0;
      let s = 0;
      let operand: { expr: Expr; role: 'imm' | 'addr' } | undefined;
      spec.operands.forEach((want, k) => {
        const m = matchOperand(spec.mnemonic, want, operands[k]!);
        if (want === 'rd' || want === '[rd]') d = m.reg!;
        else if (want === 'rs' || want === '[rs]') s = m.reg!;
        else operand = { expr: m.expr!, role: want === 'imm' ? 'imm' : 'addr' };
      });
      stmts.push({ kind: 'instr', line, addr: pc, spec, first: encodeFirstByte(spec, d, s), operand });
      pc += spec.bytes;
    } catch (e) {
      report(line, e);
    }
  });

  // ---- Pass 2: evaluate and emit.
  const image = new Uint8Array(OCTET_MEMORY.size);
  const used = new Uint8Array(OCTET_MEMORY.size);
  const lineOf = new Uint16Array(OCTET_MEMORY.size);
  const instructionStart = new Uint8Array(OCTET_MEMORY.size);
  const emitted = new Map<number, number[]>();
  let size = 0;
  const final = (expr: Expr, dot: number) =>
    evaluate(expr, { dot, lookup: (n, t) => symbols.lookup(n, t, true) })!;

  for (const st of stmts) {
    const bytes: number[] = [];
    try {
      if (st.kind === 'instr') {
        bytes.push(st.first);
        if (st.operand) {
          const v = final(st.operand.expr, st.addr);
          if (st.operand.role === 'imm') {
            if (!inRange(v, -128, 255)) throw exprError(st.operand.expr, `value ${v} does not fit in a byte (−128 to 255)`);
          } else if (!inRange(v, 0, 255)) throw exprError(st.operand.expr, `address ${v} is outside memory (0–255)`);
          bytes.push(v & 0xff);
        }
      } else if (st.kind === 'data') {
        for (const it of st.items) {
          if ('bytes' in it) bytes.push(...it.bytes);
          else {
            const v = final(it.expr, st.addr + bytes.length);
            if (!inRange(v, -128, 255)) throw exprError(it.expr, `value ${v} does not fit in a byte (−128 to 255)`);
            bytes.push(v & 0xff);
          }
        }
      } else {
        const fill = st.fill ? final(st.fill, st.addr) : 0;
        if (st.fill && !inRange(fill, -128, 255)) throw exprError(st.fill, `fill value ${fill} does not fit in a byte`);
        for (let k = 0; k < st.count; k++) bytes.push(fill & 0xff);
      }
    } catch (e) {
      report(st.line, e);
      continue;
    }
    // Place the bytes.
    const lineText = lines[st.line - 1]!;
    const col = Math.max(1, lineText.search(/\S/) + 1);
    for (let k = 0; k < bytes.length; k++) {
      const a = st.addr + k;
      const where = { line: st.line, column: col, length: Math.max(1, lineText.trim().length), severity: 'error' as const };
      if (a > 0xff) {
        diagnostics.push({ ...where, message: 'the program runs past the end of memory (0xFF)' });
        break;
      }
      if (a >= OCTET_MEMORY.ioBase) {
        diagnostics.push({
          ...where,
          message: `address 0x${a.toString(16).toUpperCase()} is in the I/O region (0xF0–0xFF): programs and data must fit in 0x00–0xEF`,
        });
        break;
      }
      if (used[a]) {
        diagnostics.push({
          ...where,
          message: `overlaps the byte at 0x${a.toString(16).toUpperCase().padStart(2, '0')} already assembled from line ${lineOf[a]}`,
        });
        break;
      }
      image[a] = bytes[k]!;
      used[a] = 1;
      lineOf[a] = st.line;
      size++;
    }
    if (st.kind === 'instr' && st.addr <= 0xff) instructionStart[st.addr] = 1;
    emitted.set(st.line, [...(emitted.get(st.line) ?? []), ...bytes]);
  }

  // Report problems in constants nobody used, and make every constant's value available.
  for (const { line, error } of symbols.checkConstants()) report(line, error);

  const stmtOfLine = new Map(stmts.map((s) => [s.line, s]));
  const listing: ListingLine[] = lines.map((source, i) => ({
    line: i + 1,
    address: stmtOfLine.get(i + 1)?.addr,
    bytes: emitted.get(i + 1) ?? [],
    source,
  }));

  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    image,
    used,
    size,
    symbols: symbols.values(),
    labels: labelsAt,
    lineOf,
    instructionStart,
    listing,
    diagnostics,
  };
}

/** Assemble and throw if there are errors (for tests and built-in programs). */
export function assembleOrThrow(source: string, name = 'program'): OctetProgram {
  const p = assemble(source);
  if (!p.ok) {
    const msg = p.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${name}:${d.line}:${d.column}: ${d.message}`)
      .join('\n');
    throw new Error(`Octet assembly failed:\n${msg}`);
  }
  return p;
}
