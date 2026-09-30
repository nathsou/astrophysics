/**
 * The RV32I assembler: two passes over the source (see `common/asm.ts`), accepting the syntax of
 * the GNU assembler for the base ISA.
 *
 * ```
 * label:  mnemonic operand, operand   # comment      (also ; and //)
 * ```
 *
 * - **Registers:** `x0`–`x31` and the ABI names (`zero ra sp gp tp t0–t6 s0/fp s1–s11 a0–a7`).
 * - **Operands:** registers; immediates and addresses as expressions (numbers, characters, symbols,
 *   `+`, `-`, parentheses, `.` for the address of the current statement, `%hi(x)` and `%lo(x)`);
 *   memory as `imm(reg)`, `(reg)` or `%lo(sym)(reg)`.
 * - **Numbers** are read as 32-bit values, so `0xFFFFFF08` and `-248` are the same 12-bit
 *   immediate: `sw t0, LEDS(zero)` needs no `lui`. Branch and jump targets are addresses (a label,
 *   or `. + 8`); the offset is worked out for you and checked (range, and 4-byte alignment because
 *   there is no C extension).
 * - **Pseudo-instructions:** nop li la lla mv not neg seqz snez sltz sgtz beqz bnez blez bgez bltz
 *   bgtz bgt ble bgtu bleu j jal jr jalr ret call tail, `lw rd, symbol` and `sw rs, symbol, rt`
 *   (and the other loads and stores). `li` with a value that is not known on the first pass
 *   (a constant or label defined further down) is always two instructions.
 * - **Directives:** `.org addr`, `.word`, `.half`, `.byte` (numbers, characters and, for `.byte`,
 *   strings), `.string`/`.asciz` (with a zero byte), `.ascii`, `.space n[, v]`/`.zero n`,
 *   `.align n` (to 2ⁿ bytes), `.balign n`, `.p2align n`, `.equ name, value`/`.set`. `.text`, `.data`,
 *   `.rodata`, `.bss`, `.globl` and `.global` are accepted and ignored: there is one flat image.
 * - The board's I/O register names (`LEDS`, `HEX`, `CONSOLE`, `TIMER`, …), `RAM_TOP` and `IO_BASE`
 *   are predefined (see `board.ts`). `_start`, if defined, is where the PC starts.
 *
 * The program must fit in RAM; emitting past it, or twice into the same byte, is an error.
 * Instructions must start on a multiple of 4.
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
import { RV32_MEMORY, rv32Symbols } from './board';
import { EncodeError, encode, fitsImm12, hi20, instructionByMnemonic, int32, lo12, parseRegister, type Rv32Fields } from './spec';

export interface ListingLine {
  /** 1-based source line. */
  line: number;
  /** Address of the first byte emitted by this line, if it emitted any. */
  address?: number;
  bytes: number[];
  source: string;
}

export interface Rv32Program {
  /** True when there are no errors. */
  ok: boolean;
  /** The memory image from address 0 to the last byte emitted (rounded up to a whole word). */
  image: Uint8Array;
  /** Number of bytes emitted: code and data, including `.space`, but not the padding of `.align` or the gaps `.org` leaves. */
  size: number;
  /** Number of instruction words emitted (after pseudo-instructions expand). */
  instructions: number;
  /** Where the PC starts: `_start` if defined, else 0. */
  entry: number;
  /** Every label and constant (including the predefined names). */
  symbols: Record<string, number>;
  /** Labels only, address → names (for the disassembler). */
  labels: Map<number, string[]>;
  /** For each address of the image, the 1-based source line that emitted it (0 if none). */
  lineOf: Uint16Array;
  /** For each address of the image, 1 if an instruction starts there. */
  instructionStart: Uint8Array;
  listing: ListingLine[];
  diagnostics: Diagnostic[];
}

export interface Rv32AssembleOptions {
  /** RAM size in bytes (default 64 KiB): the program must fit. */
  ramSize?: number;
}

type Operand =
  | { kind: 'reg'; n: number; tok: Token }
  | { kind: 'mem'; offset?: Expr; base: number; tok: Token; baseTok: Token }
  | { kind: 'expr'; expr: Expr; tok: Token };

type ImmMode =
  /** The value itself. */
  | 'value'
  /** A branch or jump: target − address of this instruction. */
  | 'branch'
  /** `li`: the upper 20 bits / the low 12 bits of a 32-bit value. */
  | 'hi'
  | 'lo'
  /** PC-relative pairs (auipc + …): the upper 20 bits and the low 12 bits of target − pc of the auipc. */
  | 'pchi'
  | 'pclo';

interface ImmSpec {
  expr?: Expr;
  konst?: number;
  mode: ImmMode;
}

/** One real instruction; a pseudo-instruction becomes one or two of them. */
interface Part {
  mnemonic: string;
  rd?: number;
  rs1?: number;
  rs2?: number;
  imm?: ImmSpec;
}

type DataItem = { expr: Expr } | { bytes: number[] };

type Stmt =
  | { kind: 'instr'; line: number; addr: number; parts: Part[] }
  | { kind: 'data'; line: number; addr: number; width: 1 | 2 | 4; items: DataItem[]; size: number }
  | { kind: 'space'; line: number; addr: number; count: number; fill?: Expr; /** Padding from .align: not counted in the size. */ pad?: boolean };

/** Hints for mnemonics people expect from other assemblers. */
const MISSING: Record<string, string> = {
  mul: 'RV32I has no multiply (that is the M extension): see the shift-and-add loop in programs/multiply.asm',
  mulh: 'RV32I has no multiply (that is the M extension)',
  div: 'RV32I has no divide (that is the M extension)',
  rem: 'RV32I has no divide or remainder (that is the M extension)',
  subi: 'there is no subi: use addi with a negative immediate',
  inc: 'there is no inc: use addi rd, rd, 1',
  dec: 'there is no dec: use addi rd, rd, -1',
  mov: 'did you mean mv (copy a register) or li (load a constant)?',
  move: 'did you mean mv (copy a register) or li (load a constant)?',
  ld: 'RV32I has no ld (64-bit): did you mean lw?',
  sd: 'RV32I has no sd (64-bit): did you mean sw?',
  halt: 'did you mean ebreak?',
  hlt: 'did you mean ebreak?',
  push: 'RISC-V has no push: addi sp, sp, -4, then sw rs, 0(sp)',
  pop: 'RISC-V has no pop: lw rd, 0(sp), then addi sp, sp, 4',
  jmp: 'did you mean j?',
  b: 'did you mean j?',
  csrr: 'CSR instructions (Zicsr) are not part of RV32I here; the timer is the memory-mapped TIMER register',
  csrw: 'CSR instructions (Zicsr) are not part of RV32I here',
  rdcycle: 'there are no CSRs here: read the memory-mapped TIMER register',
  mret: 'there is no privileged mode here: traps stop the core',
  wfi: 'there is no wfi here',
};

/** The register-register twin of an immediate instruction, for error hints. */
const REGISTER_FORM: Record<string, string> = {
  addi: 'add',
  andi: 'and',
  ori: 'or',
  xori: 'xor',
  slti: 'slt',
  sltiu: 'sltu',
  slli: 'sll',
  srli: 'srl',
  srai: 'sra',
};

const PSEUDOS = new Set([
  'nop', 'li', 'la', 'lla', 'mv', 'not', 'neg', 'seqz', 'snez', 'sltz', 'sgtz', 'beqz', 'bnez', 'blez', 'bgez', 'bltz', 'bgtz',
  'bgt', 'ble', 'bgtu', 'bleu', 'j', 'jr', 'ret', 'call', 'tail',
]);

const IGNORED_DIRECTIVES = new Set(['.TEXT', '.DATA', '.RODATA', '.BSS', '.GLOBL', '.GLOBAL']);

function reservedName(name: string): string | undefined {
  return parseRegister(name) !== undefined ? `'${name}' is a register, not a value` : undefined;
}

const exprOptions = { reserved: reservedName, functions: ['%hi', '%lo'] };

function funcEnv(name: string, value: number, tok: Token): number {
  const n = int32(value);
  if (Number.isNaN(n)) throw errorAt(tok, `${name}: ${value} does not fit in 32 bits`);
  return name === '%hi' ? hi20(n) : lo12(n);
}

function isRegisterAt(ts: TokenStream, offset: number): boolean {
  const t = ts.peek(offset);
  return t.kind === 'ident' && parseRegister(t.text) !== undefined;
}

function badRegisterName(t: Token): void {
  const m = /^[xX](\d+)$/.exec(t.text);
  if (m && Number(m[1]) > 31) throw errorAt(t, `there is no register ${t.text}: RV32I has x0–x31`);
}

function parseOperand(ts: TokenStream): Operand {
  const t = ts.peek();
  if (t.kind === 'ident') {
    badRegisterName(t);
    const n = parseRegister(t.text);
    if (n !== undefined) {
      ts.next();
      return { kind: 'reg', n, tok: t };
    }
  }
  // (reg) with no offset.
  if (ts.isPunct('(') && isRegisterAt(ts, 1) && ts.isPunct(')', 2)) {
    ts.next();
    const baseTok = ts.next();
    ts.next();
    return { kind: 'mem', base: parseRegister(baseTok.text)!, tok: t, baseTok };
  }
  const expr = parseExpr(ts, exprOptions);
  if (ts.isPunct('(')) {
    const inner = ts.peek(1);
    if (inner.kind === 'ident') badRegisterName(inner);
    if (isRegisterAt(ts, 1) && ts.isPunct(')', 2)) {
      ts.next();
      const baseTok = ts.next();
      ts.next();
      return { kind: 'mem', offset: expr, base: parseRegister(baseTok.text)!, tok: t, baseTok };
    }
    throw errorAt(ts.peek(), "expected a register in the parentheses, e.g. 8(sp), after the offset");
  }
  return { kind: 'expr', expr, tok: t };
}

const inRange = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;

/** Assemble RV32I source code. Never throws: problems are returned as diagnostics. */
export function assemble(source: string, options: Rv32AssembleOptions = {}): Rv32Program {
  const ramSize = options.ramSize ?? RV32_MEMORY.ramSize;
  const lines = splitLines(source);
  const diagnostics: Diagnostic[] = [];
  const symbols = new SymbolTable(funcEnv);
  for (const [name, value] of Object.entries(rv32Symbols(ramSize))) {
    symbols.define({ name, kind: 'label', value, line: 0, column: 0 });
  }
  const stmts: Stmt[] = [];
  const labelsAt = new Map<number, string[]>();
  let pc: number = RV32_MEMORY.resetPc;

  const report = (line: number, e: unknown, severity: 'error' | 'warning' = 'error') => {
    if (e instanceof AsmError) diagnostics.push({ line, column: e.column, length: e.length, message: e.message, severity });
    else throw e;
  };
  const pass1Eval = (expr: Expr, dot: number): number | undefined =>
    evaluate(expr, { dot, lookup: (n, t) => symbols.lookup(n, t, false), func: funcEnv });
  const pass1Value = (expr: Expr, dot: number, what: string): number => {
    const v = pass1Eval(expr, dot);
    if (v === undefined) throw exprError(expr, `${what} must be known on the first pass: it cannot use labels defined further down`);
    return v;
  };
  const defineSymbol = (name: string, tok: Token, line: number, kind: 'label' | 'equ', extra: Partial<{ value: number; expr: Expr; dot: number }>) => {
    const reserved = reservedName(name);
    if (reserved) throw errorAt(tok, `${reserved}, so it cannot be a ${kind === 'label' ? 'label' : 'constant'}`);
    const existing = symbols.defs.get(name);
    if (existing && existing.line === 0) throw errorAt(tok, `'${name}' is a predefined name (an I/O register or memory boundary)`);
    const err = symbols.define({ name, kind, line, column: tok.column, ...extra });
    if (err) throw errorAt(tok, err);
  };

  // ---- Operand helpers (pass 1).
  const reg = (o: Operand, mn: string): number => {
    if (o.kind === 'reg') return o.n;
    if (o.kind === 'mem') throw errorAt(o.tok, `${mn} expected a register here but found a memory operand`);
    throw errorAt(o.tok, `expected a register (x0–x31, or a name like a0, t1, sp) but found ${describe(o.tok)}`);
  };
  const expr = (o: Operand, mn: string, what: string): Expr => {
    if (o.kind === 'expr') return o.expr;
    if (o.kind === 'reg') {
      const twin = REGISTER_FORM[mn];
      if (twin && what === 'an immediate') throw errorAt(o.tok, `${mn} takes ${what} as its last operand; to combine two registers use ${twin}`);
      throw errorAt(o.tok, `${mn} expected ${what} here but found the register ${o.tok.text}`);
    }
    throw errorAt(o.tok, `${mn} expected ${what} here but found a memory operand`);
  };
  const arity = (mn: string, syntax: string, ops: Operand[], n: number, ts: TokenStream) => {
    if (ops.length !== n) {
      const at = ops[n] ? ops[n]!.tok : ts.peek();
      throw errorAt(at, `${mn} takes ${n === 0 ? 'no operands' : n === 1 ? '1 operand' : `${n} operands`} (${syntax}) but ${ops.length} ${ops.length === 1 ? 'was' : 'were'} given`);
    }
  };
  const value = (e: Expr): ImmSpec => ({ expr: e, mode: 'value' });
  const konst = (n: number): ImmSpec => ({ konst: n, mode: 'value' });

  /** The parts of an instruction or pseudo-instruction from its operands. */
  function build(head: Token, mn: string, ops: Operand[], ts: TokenStream, addr: number): Part[] {
    const a = (syntax: string, n: number) => arity(head.text, syntax, ops, n, ts);
    const branch = (m: string, rs1: number, rs2: number, target: Operand): Part[] => [
      { mnemonic: m, rs1, rs2, imm: { expr: expr(target, m, 'a branch target (a label)'), mode: 'branch' } },
    ];
    switch (mn) {
      // ---- Pseudo-instructions.
      case 'nop':
        a('nop', 0);
        return [{ mnemonic: 'addi', rd: 0, rs1: 0, imm: konst(0) }];
      case 'li': {
        a('li rd, imm', 2);
        const rd = reg(ops[0]!, mn);
        const e = expr(ops[1]!, mn, 'a constant');
        const v = pass1Eval(e, addr);
        if (v !== undefined) {
          const n = int32(v);
          if (Number.isNaN(n)) throw exprError(e, `${v} does not fit in 32 bits`);
          if (fitsImm12(n)) return [{ mnemonic: 'addi', rd, rs1: 0, imm: { expr: e, mode: 'value' } }];
          if ((n & 0xfff) === 0) return [{ mnemonic: 'lui', rd, imm: { expr: e, mode: 'hi' } }];
        }
        return [
          { mnemonic: 'lui', rd, imm: { expr: e, mode: 'hi' } },
          { mnemonic: 'addi', rd, rs1: rd, imm: { expr: e, mode: 'lo' } },
        ];
      }
      case 'la':
      case 'lla': {
        a(`${mn} rd, symbol`, 2);
        const rd = reg(ops[0]!, mn);
        const e = expr(ops[1]!, mn, 'an address (a label)');
        return [
          { mnemonic: 'auipc', rd, imm: { expr: e, mode: 'pchi' } },
          { mnemonic: 'addi', rd, rs1: rd, imm: { expr: e, mode: 'pclo' } },
        ];
      }
      case 'mv':
        a('mv rd, rs', 2);
        return [{ mnemonic: 'addi', rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), imm: konst(0) }];
      case 'not':
        a('not rd, rs', 2);
        return [{ mnemonic: 'xori', rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), imm: konst(-1) }];
      case 'neg':
        a('neg rd, rs', 2);
        return [{ mnemonic: 'sub', rd: reg(ops[0]!, mn), rs1: 0, rs2: reg(ops[1]!, mn) }];
      case 'seqz':
        a('seqz rd, rs', 2);
        return [{ mnemonic: 'sltiu', rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), imm: konst(1) }];
      case 'snez':
        a('snez rd, rs', 2);
        return [{ mnemonic: 'sltu', rd: reg(ops[0]!, mn), rs1: 0, rs2: reg(ops[1]!, mn) }];
      case 'sltz':
        a('sltz rd, rs', 2);
        return [{ mnemonic: 'slt', rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), rs2: 0 }];
      case 'sgtz':
        a('sgtz rd, rs', 2);
        return [{ mnemonic: 'slt', rd: reg(ops[0]!, mn), rs1: 0, rs2: reg(ops[1]!, mn) }];
      case 'beqz':
      case 'bnez':
      case 'blez':
      case 'bgez':
      case 'bltz':
      case 'bgtz': {
        a(`${mn} rs, target`, 2);
        const rs = reg(ops[0]!, mn);
        switch (mn) {
          case 'beqz':
            return branch('beq', rs, 0, ops[1]!);
          case 'bnez':
            return branch('bne', rs, 0, ops[1]!);
          case 'blez':
            return branch('bge', 0, rs, ops[1]!);
          case 'bgez':
            return branch('bge', rs, 0, ops[1]!);
          case 'bltz':
            return branch('blt', rs, 0, ops[1]!);
          default:
            return branch('blt', 0, rs, ops[1]!);
        }
      }
      case 'bgt':
      case 'ble':
      case 'bgtu':
      case 'bleu': {
        a(`${mn} rs, rt, target`, 3);
        const rs = reg(ops[0]!, mn);
        const rt = reg(ops[1]!, mn);
        const real = { bgt: 'blt', ble: 'bge', bgtu: 'bltu', bleu: 'bgeu' }[mn]!;
        return branch(real, rt, rs, ops[2]!);
      }
      case 'j':
        a('j target', 1);
        return [{ mnemonic: 'jal', rd: 0, imm: { expr: expr(ops[0]!, mn, 'a jump target (a label)'), mode: 'branch' } }];
      case 'jr':
        a('jr rs', 1);
        return [{ mnemonic: 'jalr', rd: 0, rs1: reg(ops[0]!, mn), imm: konst(0) }];
      case 'ret':
        a('ret', 0);
        return [{ mnemonic: 'jalr', rd: 0, rs1: 1, imm: konst(0) }];
      case 'call':
      case 'tail': {
        a(`${mn} target`, 1);
        const e = expr(ops[0]!, mn, 'a target (a label)');
        const link = mn === 'call' ? 1 : 6; // ra, or t1 for a tail call
        return [
          { mnemonic: 'auipc', rd: link, imm: { expr: e, mode: 'pchi' } },
          { mnemonic: 'jalr', rd: mn === 'call' ? 1 : 0, rs1: link, imm: { expr: e, mode: 'pclo' } },
        ];
      }
      case 'jal': {
        if (ops.length === 1) return [{ mnemonic: 'jal', rd: 1, imm: { expr: expr(ops[0]!, mn, 'a jump target (a label)'), mode: 'branch' } }];
        a('jal rd, target', 2);
        return [{ mnemonic: 'jal', rd: reg(ops[0]!, mn), imm: { expr: expr(ops[1]!, mn, 'a jump target (a label)'), mode: 'branch' } }];
      }
      case 'jalr': {
        if (ops.length === 1) return [{ mnemonic: 'jalr', rd: 1, rs1: reg(ops[0]!, mn), imm: konst(0) }];
        if (ops.length === 2) {
          const rd = reg(ops[0]!, mn);
          const m = ops[1]!;
          if (m.kind === 'mem') return [{ mnemonic: 'jalr', rd, rs1: m.base, imm: m.offset ? value(m.offset) : konst(0) }];
          if (m.kind === 'reg') return [{ mnemonic: 'jalr', rd, rs1: m.n, imm: konst(0) }];
          throw errorAt(m.tok, 'jalr takes an address like 4(a0) or (a0)');
        }
        a('jalr rd, imm(rs1)', 3);
        return [{ mnemonic: 'jalr', rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), imm: value(expr(ops[2]!, mn, 'an immediate')) }];
      }
      default:
        break;
    }

    // ---- Real instructions.
    const spec = instructionByMnemonic(mn)!;
    switch (spec.kind) {
      case 'r':
        a(spec.syntax, 3);
        if (ops[2]!.kind !== 'reg' && ops[2]!.kind !== 'mem') {
          const imm = instructionByMnemonic(mn + 'i');
          throw errorAt(ops[2]!.tok, `${mn} takes a register as its last operand${imm ? `; to use a constant write ${mn}i` : ''}`);
        }
        return [{ mnemonic: mn, rd: reg(ops[0]!, mn), rs1: reg(ops[1]!, mn), rs2: reg(ops[2]!, mn) }];
      case 'i':
      case 'shift':
        a(spec.syntax, 3);
        return [
          {
            mnemonic: mn,
            rd: reg(ops[0]!, mn),
            rs1: reg(ops[1]!, mn),
            imm: value(expr(ops[2]!, mn, spec.kind === 'shift' ? 'a shift amount' : 'an immediate')),
          },
        ];
      case 'load': {
        if (ops.length === 2 && ops[1]!.kind === 'expr') {
          // lw rd, symbol: auipc rd, …; lw rd, …(rd)
          const rd = reg(ops[0]!, mn);
          const e = ops[1]!.expr;
          return [
            { mnemonic: 'auipc', rd, imm: { expr: e, mode: 'pchi' } },
            { mnemonic: mn, rd, rs1: rd, imm: { expr: e, mode: 'pclo' } },
          ];
        }
        a(spec.syntax, 2);
        const m = ops[1]!;
        if (m.kind !== 'mem') throw errorAt(m.tok, `${mn} takes an address like 8(sp), (a0) or a label, not a register`);
        return [{ mnemonic: mn, rd: reg(ops[0]!, mn), rs1: m.base, imm: m.offset ? value(m.offset) : konst(0) }];
      }
      case 'store': {
        if (ops.length === 3 && ops[1]!.kind === 'expr') {
          // sw rs, symbol, rt: auipc rt, …; sw rs, …(rt)
          const rs = reg(ops[0]!, mn);
          const rt = reg(ops[2]!, mn);
          const e = ops[1]!.expr;
          return [
            { mnemonic: 'auipc', rd: rt, imm: { expr: e, mode: 'pchi' } },
            { mnemonic: mn, rs1: rt, rs2: rs, imm: { expr: e, mode: 'pclo' } },
          ];
        }
        a(spec.syntax, 2);
        const m = ops[1]!;
        if (m.kind !== 'mem') {
          if (m.kind === 'expr') throw errorAt(m.tok, `${mn} takes an address like 8(sp) or (a0); to store to a label use ${mn} rs, label, temp`);
          throw errorAt(m.tok, `${mn} takes an address like 8(sp) or (a0), not a register`);
        }
        return [{ mnemonic: mn, rs1: m.base, rs2: reg(ops[0]!, mn), imm: m.offset ? value(m.offset) : konst(0) }];
      }
      case 'branch':
        a(spec.syntax, 3);
        return branch(mn, reg(ops[0]!, mn), reg(ops[1]!, mn), ops[2]!);
      case 'lui': {
        a(spec.syntax, 2);
        return [{ mnemonic: mn, rd: reg(ops[0]!, mn), imm: value(expr(ops[1]!, mn, 'a 20-bit constant')) }];
      }
      case 'jal':
      case 'jalr':
        return []; // handled above
      case 'fence':
        return [{ mnemonic: 'fence', imm: konst(0xff) }]; // handled before operands are parsed
      case 'none':
        a(spec.mnemonic, 0);
        return [{ mnemonic: mn }];
    }
  }

  // ---- Pass 1: parse, size, and define labels.
  lines.forEach((text, index) => {
    const line = index + 1;
    try {
      const ts = new TokenStream(tokenize(text, { comments: ['#', ';', '//'] }));
      // Labels.
      while (ts.peek().kind === 'ident' && ts.isPunct(':', 1) && !ts.peek().text.startsWith('.') && !ts.peek().text.startsWith('%')) {
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
        if (IGNORED_DIRECTIVES.has(word)) {
          while (!ts.atEnd()) ts.next();
          return;
        }
        switch (word) {
          case '.ORG': {
            const e = parseExpr(ts, exprOptions);
            ts.expectEnd();
            const v = pass1Value(e, pc, 'the address in .org');
            if (!inRange(v, 0, ramSize - 1)) throw exprError(e, `.org address ${v} is outside RAM (0–${ramSize - 1})`);
            pc = v;
            return;
          }
          case '.EQU':
          case '.SET': {
            const name = ts.next();
            if (name.kind !== 'ident') throw errorAt(name, `expected a name after ${head.text}`);
            ts.expect(',', "',' after the name");
            const e = parseExpr(ts, exprOptions);
            ts.expectEnd();
            defineSymbol(name.text, name, line, 'equ', { expr: e, dot: pc });
            return;
          }
          case '.WORD':
          case '.LONG':
          case '.HALF':
          case '.SHORT':
          case '.2BYTE':
          case '.BYTE':
          case '.STRING':
          case '.ASCIZ':
          case '.ASCII': {
            const strings = word === '.STRING' || word === '.ASCIZ' || word === '.ASCII';
            const width: 1 | 2 | 4 = word === '.WORD' || word === '.LONG' ? 4 : word === '.HALF' || word === '.SHORT' || word === '.2BYTE' ? 2 : 1;
            const items: DataItem[] = [];
            do {
              const t = ts.peek();
              if (t.kind === 'string') {
                if (width !== 1) throw errorAt(t, `${head.text} takes numbers, not a string (use .string or .byte)`);
                ts.next();
                items.push({ bytes: word === '.ASCII' || word === '.BYTE' ? t.bytes! : [...t.bytes!, 0] });
              } else if (strings) {
                throw errorAt(t, `${head.text} expects a string in double quotes, e.g. "HELLO"`);
              } else items.push({ expr: parseExpr(ts, exprOptions) });
            } while (ts.accept(','));
            ts.expectEnd();
            const size = items.reduce((s, it) => s + ('bytes' in it ? it.bytes.length : width), 0);
            if (width > 1 && pc % width !== 0) {
              diagnostics.push({
                line,
                column: head.column,
                length: head.length,
                severity: 'warning',
                message: `${head.text} at address 0x${pc.toString(16).toUpperCase()} is not ${width}-byte aligned: a load or store of it would trap (put .align ${width === 4 ? 2 : 1} before it)`,
              });
            }
            stmts.push({ kind: 'data', line, addr: pc, width, items, size });
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
            if (!inRange(count, 0, ramSize)) throw exprError(countExpr, `.space size ${count} is out of range (0–${ramSize})`);
            stmts.push({ kind: 'space', line, addr: pc, count, fill });
            pc += count;
            return;
          }
          case '.ALIGN':
          case '.P2ALIGN':
          case '.BALIGN': {
            const e = parseExpr(ts, exprOptions);
            ts.expectEnd();
            const n = pass1Value(e, pc, `the argument of ${head.text}`);
            const bytes = word === '.BALIGN' ? n : 2 ** n;
            if (!inRange(n, 0, word === '.BALIGN' ? 4096 : 12) || !Number.isInteger(bytes) || bytes < 1 || (bytes & (bytes - 1)) !== 0)
              throw exprError(e, word === '.BALIGN' ? `${head.text} needs a power of two (1, 2, 4, …), not ${n}` : `${head.text} needs an exponent 0–12 (.align 2 aligns to 4 bytes), not ${n}`);
            const pad = (bytes - (pc % bytes)) % bytes;
            if (pad) stmts.push({ kind: 'space', line, addr: pc, count: pad, pad: true });
            pc += pad;
            return;
          }
          default:
            throw errorAt(head, `unknown directive '${head.text}'`);
        }
      }
      // Instructions.
      const mn = head.text.toLowerCase();
      const real = instructionByMnemonic(mn);
      const known = real !== undefined || PSEUDOS.has(mn);
      if (mn === 'fence') {
        // fence [pred, succ]: sets of i, o, r, w (or 0).
        let bits = 0xff;
        if (!ts.atEnd()) {
          const set = (): number => {
            const t = ts.next();
            if (t.kind === 'number' && t.num === 0) return 0;
            if (t.kind === 'ident' && /^[iorw]+$/i.test(t.text)) return [...t.text.toLowerCase()].reduce((m, c) => m | (8 >> 'iorw'.indexOf(c)), 0);
            throw errorAt(t, "expected a set of the letters i, o, r, w (e.g. rw), or 0");
          };
          const pred = set();
          ts.expect(',', "',' between the two sets");
          bits = (pred << 4) | set();
        }
        ts.expectEnd();
        if (pc % 4 !== 0) throw errorAt(head, `this instruction is at address 0x${pc.toString(16).toUpperCase()}, which is not a multiple of 4 (add .align 2)`);
        stmts.push({ kind: 'instr', line, addr: pc, parts: [{ mnemonic: 'fence', imm: konst(bits) }] });
        pc += 4;
        return;
      }
      const ops: Operand[] = [];
      if (known && !ts.atEnd()) {
        do ops.push(parseOperand(ts));
        while (ts.accept(','));
      }
      if (!known) {
        const hint = MISSING[mn];
        throw errorAt(head, `unknown instruction '${head.text}'${hint ? `: ${hint}` : ''}`);
      }
      ts.expectEnd();
      if (pc % 4 !== 0)
        throw errorAt(head, `this instruction is at address 0x${pc.toString(16).toUpperCase()}, which is not a multiple of 4: RV32I instructions are 4 bytes and aligned (add .align 2 after data that is not a whole number of words)`);
      const parts = build(head, mn, ops, ts, pc);
      stmts.push({ kind: 'instr', line, addr: pc, parts });
      pc += 4 * parts.length;
    } catch (e) {
      report(line, e);
    }
  });

  // ---- Pass 2: evaluate and emit.
  const mem = new Uint8Array(ramSize);
  const used = new Uint8Array(ramSize);
  const lineOfAll = new Uint16Array(ramSize);
  const starts = new Uint8Array(ramSize);
  const emitted = new Map<number, number[]>();
  let size = 0;
  let instructions = 0;
  let extent = 0;
  const final = (e: Expr, dot: number) => evaluate(e, { dot, lookup: (n, t) => symbols.lookup(n, t, true), func: funcEnv })!;

  /** The immediate of a part, for the part at `partAddr` of the statement at `addr`. */
  function immediate(part: Part, addr: number, partAddr: number): number | undefined {
    const s = part.imm;
    if (!s) return undefined;
    if (s.expr === undefined) return s.konst ?? 0;
    const v = final(s.expr, addr);
    switch (s.mode) {
      case 'value':
        return v;
      case 'branch': {
        if (!inRange(v, 0, 0xffffffff) && !inRange(v, -0x80000000, -1)) throw exprError(s.expr, `${v} is not a valid address`);
        if ((v >>> 0) & 3) throw exprError(s.expr, `the target 0x${(v >>> 0).toString(16).toUpperCase()} is not a multiple of 4: RV32I has no 2-byte instructions, so a jump there would trap`);
        return (((v >>> 0) - partAddr) | 0);
      }
      case 'hi':
      case 'lo': {
        const n = int32(v);
        if (Number.isNaN(n)) throw exprError(s.expr, `${v} does not fit in 32 bits`);
        return s.mode === 'hi' ? hi20(n) : lo12(n);
      }
      case 'pchi':
      case 'pclo': {
        if (!inRange(v, 0, 0xffffffff) && !inRange(v, -0x80000000, -1)) throw exprError(s.expr, `${v} is not a valid address`);
        // The offset is measured from the auipc, which is the first part of the pair.
        const auipc = s.mode === 'pchi' ? partAddr : partAddr - 4;
        const off = ((v >>> 0) - auipc) | 0;
        return s.mode === 'pchi' ? hi20(off) : lo12(off);
      }
    }
  }

  for (const st of stmts) {
    const bytes: number[] = [];
    try {
      if (st.kind === 'instr') {
        st.parts.forEach((part, k) => {
          const partAddr = st.addr + 4 * k;
          const fields: Rv32Fields = { rd: part.rd, rs1: part.rs1, rs2: part.rs2, imm: immediate(part, st.addr, partAddr) };
          let word: number;
          try {
            word = encode(part.mnemonic, fields);
          } catch (e) {
            if (e instanceof EncodeError) {
              if (part.imm?.expr) throw exprError(part.imm.expr, e.message);
              throw new AsmError(e.message, 1, 1);
            }
            throw e;
          }
          bytes.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
        });
      } else if (st.kind === 'data') {
        for (const it of st.items) {
          if ('bytes' in it) bytes.push(...it.bytes);
          else {
            const v = final(it.expr, st.addr + bytes.length);
            const [lo, hi] = st.width === 4 ? [-0x80000000, 0xffffffff] : st.width === 2 ? [-32768, 65535] : [-128, 255];
            if (!inRange(v, lo, hi)) throw exprError(it.expr, `value ${v} does not fit in ${st.width === 4 ? 'a word' : st.width === 2 ? 'a halfword' : 'a byte'} (${lo} to ${hi})`);
            for (let k = 0; k < st.width; k++) bytes.push((v >> (8 * k)) & 0xff);
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
    let ok = true;
    for (let k = 0; k < bytes.length && ok; k++) {
      const a = st.addr + k;
      const where = { line: st.line, column: col, length: Math.max(1, lineText.trim().length), severity: 'error' as const };
      if (a >= ramSize) {
        diagnostics.push({ ...where, message: `the program runs past the end of RAM (${ramSize} bytes)` });
        ok = false;
      } else if (used[a]) {
        diagnostics.push({ ...where, message: `overlaps the byte at 0x${a.toString(16).toUpperCase()} already assembled from line ${lineOfAll[a]}` });
        ok = false;
      } else {
        mem[a] = bytes[k]!;
        used[a] = 1;
        lineOfAll[a] = st.line;
        if (!(st.kind === 'space' && st.pad)) size++;
        extent = Math.max(extent, a + 1);
      }
    }
    if (st.kind === 'instr' && ok) {
      for (let k = 0; k < st.parts.length; k++) starts[st.addr + 4 * k] = 1;
      instructions += st.parts.length;
    }
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
  const words = Math.ceil(extent / 4) * 4;
  const syms = symbols.values();
  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    image: mem.slice(0, words),
    size,
    instructions,
    entry: syms._start ?? 0,
    symbols: syms,
    labels: labelsAt,
    lineOf: lineOfAll.slice(0, words),
    instructionStart: starts.slice(0, words),
    listing,
    diagnostics,
  };
}

/** Assemble and throw if there are errors (for tests and built-in programs). */
export function assembleOrThrow(source: string, name = 'program', options: Rv32AssembleOptions = {}): Rv32Program {
  const p = assemble(source, options);
  if (!p.ok) {
    const msg = p.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${name}:${d.line}:${d.column}: ${d.message}`)
      .join('\n');
    throw new Error(`RV32I assembly failed:\n${msg}`);
  }
  return p;
}
