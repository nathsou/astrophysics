// Helpers shared between target descriptions.

import { Const, Instr, type Func, type Value } from '../ir/ir';
import type { MFunc, MInstr, MOperand, MBlock } from '../codegen/mir';
import { tok, type Tok } from '../listing';
import type { Target } from './target';

/** Insert `call @sym(args)` in place of instruction i (IR-level libcall legalization). */
export function toLibcall(fn: Func, i: Instr, sym: string, note: string) {
  i.op = 'call';
  i.sym = sym;
  i.note = note;
}

/** Insert a new IR instruction before `before`, returning it. */
export function insertIR(fn: Func, before: Instr, op: Instr['op'], args: Value[], extra: Partial<Instr> = {}): Instr {
  const n = fn.newInstr(op, extra.type ?? 'i64', args, { line: before.line, ...extra });
  n.block = before.block;
  before.block.insertBefore(n, before);
  return n;
}

export const k64 = (v: bigint | number) => new Const(BigInt(v));

export function blockLabelDefault(f: MFunc, b: MBlock) {
  return `.L${f.name}_${b.name.replace(/[^A-Za-z0-9_.]/g, '_')}`;
}

export function regTok(t: Target, r: number): Tok {
  return tok(t.regs[r].name, 'preg', `r:${t.name}:${r}`, { kind: 'reg', target: t.name, reg: r });
}

export function vregTok(f: MFunc, id: number): Tok {
  const a = f.assignment?.get(id);
  return tok(f.vregName(id), 'vreg', `v:${f.name}:${id}`, {
    kind: 'vreg',
    name: f.vregName(id),
    assigned: a !== undefined ? f.target.regs[a].name : undefined,
  });
}

export function frameTok(f: MFunc, fi: number): Tok {
  const o = f.frame.objects[fi];
  return tok(`%stack.${fi}${o ? '.' + o.name : ''}`, 'frame', `f:${f.name}:${fi}`, { kind: 'frame', slot: fi, desc: o ? `${o.kind} object '${o.name}', ${o.size} bytes` : undefined });
}

export function immTok(v: bigint, note?: string): Tok {
  return tok(v.toString(), 'imm', undefined, { kind: 'imm', value: v.toString(), note });
}

export function blockTok(f: MFunc, t: Target, b: MBlock): Tok {
  return tok(t.blockLabel(f, b), 'label', `mb:${f.name}:${b.id}`, { kind: 'block', name: b.name, preds: b.preds.map((p) => p.name), succs: b.succs.map((s) => s.name) });
}

export function opTok(t: Target, mi: MInstr, name = mi.op): Tok {
  return tok(name, 'kw', undefined, { kind: 'mop', target: t.name, op: mi.op, note: mi.note, tag: mi.tag });
}

export function joinOps(parts: Tok[][]): Tok[] {
  const out: Tok[] = [];
  parts.forEach((p, k) => {
    if (k) out.push(tok(', ', 'punct'));
    out.push(...p);
  });
  return out;
}

export const PHI_COPY_INFO = {
  COPY: { syntax: 'COPY dst, src', desc: 'Target-independent register copy. Coalescing tries to assign dst and src the same register so the copy disappears; survivors become a real move instruction.', cls: 'move' as const, lat: 1 },
  PHI: { syntax: 'PHI dst, [v1, bb1], [v2, bb2], ...', desc: 'SSA phi in machine IR. Eliminated before register allocation by inserting copies on incoming edges (SSA destruction).', cls: 'pseudo' as const, lat: 0 },
};

/** Generic operand list printer; memory printing is supplied by the target. */
export function genericOperands(t: Target, f: MFunc, ops: MOperand[]): Tok[] {
  return joinOps(ops.map((o) => t.formatOperand(o, f)));
}
