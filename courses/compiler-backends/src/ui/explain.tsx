// Turns token metadata into tooltip content: what an opcode does, what a
// register is for, why an instruction exists, how an immediate is encoded.

import type { ReactNode } from 'react';
import type { Info } from '../compiler/listing';
import { makeTarget } from '../compiler/target/registry';
import type { Target, TargetName } from '../compiler/target/target';
import { GLOSSARY } from '../content/glossary';

const targets = new Map<string, Target>();
export function targetFor(name: string): Target | undefined {
  if (name === 'wasm') return undefined;
  let t = targets.get(name);
  if (!t) { t = makeTarget(name as TargetName); targets.set(name, t); }
  return t;
}

const IR_OPS: Record<string, [string, string]> = {
  add: ['add a, b', 'Integer addition, wrapping modulo 2⁶⁴ (no overflow trap).'],
  sub: ['sub a, b', 'Integer subtraction, wrapping.'],
  mul: ['mul a, b', 'Low 64 bits of the product.'],
  sdiv: ['sdiv a, b', 'Signed division rounding toward zero. Division by zero is undefined behaviour in Kiln (targets differ: RISC-V returns −1, AArch64 returns 0, x86 traps).'],
  srem: ['srem a, b', 'Signed remainder; the result has the sign of the dividend.'],
  and: ['and a, b', 'Bitwise AND.'], or: ['or a, b', 'Bitwise OR.'], xor: ['xor a, b', 'Bitwise exclusive OR. xor x, −1 is bitwise NOT.'],
  shl: ['shl a, n', 'Shift left by n mod 64.'], ashr: ['ashr a, n', 'Arithmetic shift right (sign-filling) by n mod 64.'], lshr: ['lshr a, n', 'Logical shift right (zero-filling).'],
  icmp: ['icmp pred a, b', 'Compare two integers, producing an i1 (a boolean). Predicates: eq, ne, slt, sle, sgt, sge (s = signed).'],
  zext: ['zext c', 'Zero-extend an i1 to an i64: false → 0, true → 1.'],
  select: ['select c, a, b', 'c ? a : b without branching. Produced by if-conversion; lowered to csel (AArch64), cmov (x86) or a branch-free bit trick (RISC-V).'],
  alloca: ['alloca bytes', 'Reserve a stack slot in the current frame; the result is its address. Hoisted to the entry block so the frame size is static.'],
  load: ['load p', 'Read 8 bytes from memory at address p.'],
  store: ['store v, p', 'Write the 8-byte value v to memory at address p.'],
  gaddr: ['gaddr @g', 'The address of a global variable. Its final value is unknown until link time, so the backend emits relocations.'],
  call: ['call @f(args…)', 'Call a function. The backend lowers this according to the calling convention.'],
  phi: ['phi [v₁, b₁], [v₂, b₂], …', 'SSA join: take the value vᵢ if control arrived from predecessor bᵢ. All phis at the top of a block execute simultaneously.'],
  param: ['param i', 'The i-th incoming argument.'],
  br: ['br target', 'Unconditional branch — a terminator.'],
  condbr: ['condbr c, t, f', 'Two-way branch on an i1 — a terminator.'],
  ret: ['ret v', 'Return v to the caller — a terminator.'],
};
const PREDS: Record<string, string> = { eq: 'equal', ne: 'not equal', slt: 'signed less than', sle: 'signed less or equal', sgt: 'signed greater than', sge: 'signed greater or equal' };

const WASM_OPS: Record<string, string> = {
  block: 'Structured block. A `br` targeting it jumps to its END (forward).',
  loop: 'Structured loop. A `br` targeting it jumps to its START (backward) — the only way to go back in Wasm.',
  if: 'Pops an i32; runs the first arm if non-zero, else the `else` arm.',
  br: 'Branch to the N-th enclosing label (0 = innermost): the end of a block, or the start of a loop.',
  return: 'Return from the function with the value on top of the stack.',
  'local.get': 'Push a local variable. Wasm has unlimited locals; the engine allocates registers for them.',
  'local.set': 'Pop the top of the stack into a local.',
  'local.tee': 'Store into a local and keep the value on the stack.',
  'global.get': 'Push a global (here: the shadow-stack pointer).',
  'global.set': 'Pop into a global.',
  'i64.load': 'Pop an i32 address, push the 8 bytes at that address in linear memory.',
  'i64.store': 'Pop a value and an address; store 8 bytes.',
  'i64.const': 'Push a 64-bit constant (encoded as signed LEB128).',
  'i32.const': 'Push a 32-bit constant.',
  'i32.wrap_i64': 'Truncate an i64 to i32 (addresses in memory32 are 32 bits).',
  'i64.extend_i32_u': 'Zero-extend i32 to i64 (comparisons produce i32).',
  select: 'Pop c, b, a; push c ? a : b.',
  call: 'Call a function by index; arguments come from the stack.',
  drop: 'Discard the top of the stack.',
  unreachable: 'Trap if executed. Here it marks the end of a function that always returns earlier, satisfying the validator.',
};

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="kv">
      {rows.map(([k, v], i) => (
        <span key={i} style={{ display: 'contents' }}>
          <span>{k}</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

function immForms(v: bigint) {
  const u = BigInt.asUintN(64, v);
  const rows: [string, ReactNode][] = [['decimal', v.toString()], ['hex', '0x' + u.toString(16)]];
  if (v >= -2048n && v <= 2047n) rows.push(['RISC-V', 'fits a 12-bit immediate']);
  else if (v >= -(1n << 31n) && v < 1n << 31n) rows.push(['RISC-V', 'needs lui (+ addi)']);
  else rows.push(['RISC-V', 'needs a multi-instruction sequence']);
  if (v >= -(1n << 31n) && v < 1n << 31n) rows.push(['x86-64', v >= -128n && v <= 127n ? 'imm8' : 'imm32']);
  else rows.push(['x86-64', 'movabs (imm64)']);
  return rows;
}

export function explain(info: Info, why?: string, ctxTarget?: string): ReactNode {
  const whyEl = why ? <div className="tip-why"><b>why</b>{why}</div> : null;
  switch (info.kind) {
    case 'irop': {
      const d = IR_OPS[info.op];
      return (
        <>
          <div className="tip-title">{info.op}{info.pred ? ` ${info.pred}` : ''} <span className="tip-sub">KIR instruction</span></div>
          {d && <div className="tip-syn">{d[0]}</div>}
          <div className="tip-body">{info.pred && info.op === 'icmp' ? `${PREDS[info.pred]}. ` : ''}{d?.[1]}</div>
          {whyEl}
        </>
      );
    }
    case 'value':
      return (
        <>
          <div className="tip-title">{info.name} <span className="tip-sub">{info.type ?? 'i64'} SSA value</span></div>
          <div className="tip-body">{info.def}. SSA: assigned exactly once, and its definition dominates every use.</div>
          {info.note && <div className="tip-why"><b>note</b>{info.note}</div>}
        </>
      );
    case 'block':
      return (
        <>
          <div className="tip-title">{info.name} <span className="tip-sub">basic block</span></div>
          <div className="tip-body">A straight-line sequence of instructions: entered only at the top, left only through its terminator.</div>
          <Kv rows={[['predecessors', info.preds?.join(', ') || '—'], ['successors', info.succs?.join(', ') || '—']]} />
        </>
      );
    case 'sym':
      return (
        <>
          <div className="tip-title">{info.name} <span className="tip-sub">symbol</span></div>
          <div className="tip-body">{info.what ? `A ${info.what}. ` : ''}Symbols are names whose addresses are fixed only when the program is linked; references to them become relocations in the object file.</div>
        </>
      );
    case 'reg': {
      const t = targetFor(info.target);
      const r = t?.regs[info.reg];
      if (!r) return <div className="tip-title">register {info.reg}</div>;
      const saved = r.calleeSaved ? 'callee-saved' : r.callerSaved ? 'caller-saved' : 'reserved';
      return (
        <>
          <div className="tip-title">{r.name} <span className="tip-sub">{r.arch !== r.name ? `${r.arch} · ` : ''}{t!.label} register</span></div>
          <div className="tip-body">{r.role}</div>
          <Kv rows={[['convention', saved], ['allocatable', r.allocatable ? 'yes' : 'no']]} />
          {whyEl}
        </>
      );
    }
    case 'vreg':
      return (
        <>
          <div className="tip-title">{info.name} <span className="tip-sub">virtual register</span></div>
          <div className="tip-body">An unlimited supply of virtual registers exists until register allocation maps each one to a physical register or a stack slot.</div>
          {info.assigned && <Kv rows={[['allocated to', info.assigned]]} />}
          {info.note && <div className="tip-why"><b>note</b>{info.note}</div>}
        </>
      );
    case 'mop': {
      if (info.target === 'wasm') {
        return (
          <>
            <div className="tip-title">{info.op} <span className="tip-sub">WebAssembly</span></div>
            <div className="tip-body">{WASM_OPS[info.op] ?? 'WebAssembly instruction.'}</div>
            {info.note && <div className="tip-why"><b>why</b>{info.note}</div>}
          </>
        );
      }
      const t = targetFor(info.target);
      const d = t?.opInfo(info.op);
      return (
        <>
          <div className="tip-title">{info.op} <span className="tip-sub">{t?.label}{d?.ext ? ` · ${d.ext} extension` : ''}{d?.fmt && d.fmt !== 'pseudo' ? ` · ${d.fmt}-type` : ''}</span></div>
          {d?.syntax && <div className="tip-syn">{d.syntax}</div>}
          <div className="tip-body">{d?.desc ?? 'Target instruction.'}</div>
          {d && (
            <Kv rows={[
              ...(d.expands ? [['expands to', d.expands] as [string, ReactNode]] : []),
              ['class', d.cls],
              ...(d.lat !== undefined ? [['latency', `${d.lat} cycle${d.lat === 1 ? '' : 's'} (model)`] as [string, ReactNode]] : []),
              ...(info.tag ? [['inserted by', info.tag] as [string, ReactNode]] : []),
            ]} />
          )}
          {info.note && <div className="tip-why"><b>why</b>{info.note}</div>}
        </>
      );
    }
    case 'imm':
      return (
        <>
          <div className="tip-title">{info.value} <span className="tip-sub">immediate</span></div>
          <div className="tip-body">A constant encoded directly in the instruction.{info.note ? ` ${info.note}.` : ''}</div>
          <Kv rows={immForms(BigInt(info.value))} />
        </>
      );
    case 'frame':
      return (
        <>
          <div className="tip-title">%stack.{info.slot} <span className="tip-sub">frame index</span></div>
          <div className="tip-body">An abstract stack object. Its offset from the stack pointer is unknown until frame lowering has decided the layout (after register allocation, which may add spill slots).</div>
          {info.desc && <Kv rows={[['object', info.desc]]} />}
        </>
      );
    case 'term': {
      const g = GLOSSARY[info.term];
      return (
        <>
          <div className="tip-title" style={{ fontFamily: 'var(--sans)' }}>{g?.term ?? info.term}</div>
          <div className="tip-body">{g?.def ?? ''}</div>
        </>
      );
    }
    case 'text':
      return (
        <>
          <div className="tip-title" style={{ fontFamily: 'var(--sans)' }}>{info.title}</div>
          <div className="tip-body">{info.body}</div>
        </>
      );
  }
  void ctxTarget;
}
