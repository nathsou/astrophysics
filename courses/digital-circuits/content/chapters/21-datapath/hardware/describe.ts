/** Micro-instructions and control lines in register-transfer notation, as the ISA spec writes the steps of instructions. */
import { DRIVERS, type ControlLine, type Fields, ZERO_FIELDS } from './control-word';

const SOURCE_TEXT: Record<string, string> = { Rd: 'Rd', Rs: 'Rs', PC: 'PC', SP: 'SP', ALU: 'ALU', MEM: 'M[MAR]', T: 'T' };
const OP_SYMBOL = ['+', '−', 'AND', 'OR', 'XOR', '?', '>>', 'NOT'];

/** A micro-instruction as a register transfer: `Rd ← A + B; flags`. `source` overrides the name of the bus driver. */
export function describe(f: Fields, o: { source?: string } = {}): string {
  if (f.disp) return 'decode IR';
  if (f.halt) return 'halt';
  const driver = DRIVERS[f.drive]!;
  const b = f.bselA ? 'A' : f.bsel1 ? '1' : 'B';
  const alu = f.aluOp === 7 ? 'NOT A' : f.aluOp === 6 ? 'A >> 1' : `A ${OP_SYMBOL[f.aluOp]} ${b}`;
  const src = o.source ?? (driver === 'none' ? '(nothing)' : driver === 'ALU' ? alu : SOURCE_TEXT[driver]!);
  const parts: string[] = [];
  if (f.ldMar) parts.push(`MAR ← ${src}`);
  if (f.ldIr) parts.push(`IR ← ${src}`);
  if (f.ldA) parts.push(`A ← ${src}`);
  if (f.ldB) parts.push(`B ← ${src}`);
  if (f.ldT) parts.push(`T ← ${src}`);
  if (f.weR) parts.push(`Rd ← ${src}`);
  if (f.pcLd) parts.push(`PC ← ${src}`);
  if (f.memWr) parts.push(`M[MAR] ← ${src}`);
  if (f.cj) parts.push(`if the condition holds: PC ← ${src}, else PC ← PC + 1`);
  if (f.pcInc) parts.push('PC ← PC + 1');
  if (f.spDec) parts.push('SP ← SP − 1');
  if (f.spInc) parts.push('SP ← SP + 1');
  if (f.ldFlags) parts.push(f.weR && driver === 'ALU' ? 'flags' : `flags ← ${alu}`);
  return parts.length ? parts.join('; ') : 'no operation';
}

/** The micro-instruction fields that a set of datapath lines amounts to, and the bus drivers that are on (more than one is a conflict). */
export function fieldsOfLines(on: (n: ControlLine | 'OE_SW') => boolean): { fields: Fields; drivers: string[] } {
  const f: Fields = { ...ZERO_FIELDS };
  const OE: [ControlLine, number, string][] = [
    ['OE_RD', 1, 'Rd'],
    ['OE_RS', 2, 'Rs'],
    ['OE_PC', 3, 'PC'],
    ['OE_SP', 4, 'SP'],
    ['OE_ALU', 5, 'ALU'],
    ['OE_MEM', 6, 'M[MAR]'],
    ['OE_T', 7, 'T'],
  ];
  const drivers: string[] = [];
  for (const [line, code, name] of OE) if (on(line)) (drivers.push(name), (f.drive ||= code));
  if (on('OE_SW')) drivers.push('the panel');
  f.ldMar = +on('LD_MAR');
  f.ldIr = +on('LD_IR');
  f.ldA = +on('LD_A');
  f.ldB = +on('LD_B');
  f.ldT = +on('LD_T');
  f.weR = +on('WE_R');
  f.ldFlags = +on('LD_FLAGS');
  f.pcLd = +on('PC_LD');
  f.pcInc = +on('PC_INC');
  f.spInc = +on('SP_INC');
  f.spDec = +on('SP_DEC');
  f.memWr = +on('MEM_WR');
  f.aluOp = +on('ALU_OP0') | (+on('ALU_OP1') << 1) | (+on('ALU_OP2') << 2);
  f.bselA = +on('BSEL_A');
  f.bsel1 = +on('BSEL_1');
  return { fields: f, drivers };
}
