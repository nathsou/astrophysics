/**
 * Octet, one clock cycle at a time.
 *
 * The reference interpreter (`OctetMachine`) executes a whole instruction per call and only counts the
 * cycles the hardware would take. This module is the same machine seen at the pace of the clock: the
 * multi-cycle, single-bus datapath of Chapter 22, with its internal registers (MAR, IR, A, B and T) and
 * one register transfer per cycle, exactly the steps listed in `spec.ts`.
 *
 * `MicroCpu` does not keep a second copy of the machine. It works *on* an `OctetMachine` (its registers,
 * flags, memory and devices), adding only the hidden registers, so whole instructions (`machine.step()`,
 * fast) and single cycles (`cpu.cycle()`, slow) can be mixed freely at instruction boundaries. The tests
 * run every demo program and hundreds of random programs both ways and require identical states.
 */
import { DECODE_TABLE, FETCH_STEPS, OCTET_CONDITIONS, OctetMachine, type OctetInstruction } from '$lib/sim/cpu/octet';

export type Phase = 'fetch' | 'decode' | 'execute';

/** A register or unit that a transfer starts from or ends at. */
export type Node = 'PC' | 'MAR' | 'IR' | 'A' | 'B' | 'T' | 'SP' | 'R0' | 'R1' | 'R2' | 'R3' | 'MEM' | 'ALU' | 'FLAGS' | 'CTRL';

/** What happened in one clock cycle. */
export interface CycleInfo {
  phase: Phase;
  /** 0-based position of the cycle within its instruction. */
  index: number;
  /** Number of cycles this instruction takes. */
  of: number;
  /** The register transfer, with the actual registers named ("R1 ← R2", "MAR ← PC"). */
  text: string;
  /** The registers and units the transfer writes. */
  writes: Node[];
  /** Where the value on the bus came from and went to (for highlighting). */
  from?: Node;
  to?: Node;
  /** The byte on the bus, if the transfer moved one. */
  value?: number;
  /** A memory or device access this cycle. */
  access?: { kind: 'read' | 'write'; address: number };
  /** Address of the instruction this cycle belongs to. */
  instructionAddress: number;
  /** True for the last cycle of an instruction. */
  last: boolean;
}

interface Op {
  phase: Phase;
  text: string;
  writes: Node[];
  from?: Node;
  to?: Node;
  run(): { value?: number; access?: CycleInfo['access'] } | void;
}

// ---- The ALU, as the hardware computes it (spec.ts, "Flags").

export interface AluResult {
  r: number;
  z: boolean;
  c: boolean;
  n: boolean;
  v: boolean;
}

/** ADD (8), SUB (9), AND (A), OR (B), XOR (C), CMP (D): the result and all four flags. */
export function alu(op: number, a: number, b: number): AluResult {
  let r: number;
  let c = false;
  let v = false;
  switch (op) {
    case 0x8:
      r = (a + b) & 0xff;
      c = a + b > 0xff;
      v = (~(a ^ b) & (a ^ r) & 0x80) !== 0;
      break;
    case 0x9:
    case 0xd:
      r = (a - b) & 0xff;
      c = a < b;
      v = ((a ^ b) & (a ^ r) & 0x80) !== 0;
      break;
    case 0xa:
      r = a & b;
      break;
    case 0xb:
      r = a | b;
      break;
    default:
      r = a ^ b;
  }
  return { r, z: r === 0, c, n: (r & 0x80) !== 0, v };
}

/** SHL (0), SHR (1), NOT (2), INC (3). */
export function unary(sub: number, a: number): AluResult {
  let r: number;
  let c = false;
  let v = false;
  switch (sub) {
    case 0:
      r = (a << 1) & 0xff;
      c = (a & 0x80) !== 0;
      v = ((a ^ r) & 0x80) !== 0;
      break;
    case 1:
      r = a >> 1;
      c = (a & 1) !== 0;
      break;
    case 2:
      r = ~a & 0xff;
      break;
    default:
      r = (a + 1) & 0xff;
      c = a === 0xff;
      v = a === 0x7f;
  }
  return { r, z: r === 0, c, n: (r & 0x80) !== 0, v };
}

const reg = (n: number): Node => `R${n & 3}` as Node;

/** The text of a step with the register fields filled in: `Rd ← Rs` becomes `R1 ← R2`. */
export function instantiate(step: string, ir: number): string {
  return step.replace(/\bRd\b/g, `R${(ir >> 2) & 3}`).replace(/\bRs\b/g, `R${ir & 3}`);
}

export class MicroCpu {
  readonly machine: OctetMachine;
  /** Memory address register. */
  mar = 0;
  /** Instruction register. */
  ir = 0;
  /** ALU operand latches. */
  a = 0;
  b = 0;
  /** Temporary (CALL keeps the target here while it pushes the return address). */
  t = 0;
  /** Cycles done so far in the current instruction (0 at an instruction boundary). */
  done = 0;
  /** The cycle that ran last. */
  last: CycleInfo | null = null;

  private ops: Op[] = [];
  private start = 0;
  private total = 0;

  constructor(machine: OctetMachine = new OctetMachine()) {
    this.machine = machine;
  }

  get atBoundary(): boolean {
    return this.done === 0;
  }

  /** Forget the hidden registers (after a reset or a load). */
  reset(): void {
    this.mar = this.ir = this.a = this.b = this.t = 0;
    this.done = 0;
    this.last = null;
    this.ops = [];
  }

  /** Cycles in the instruction being executed (after decode), or 0 before it is known. */
  get length(): number {
    return this.ops.length;
  }

  /** Run one clock cycle. Returns null if the machine is halted at an instruction boundary. */
  cycle(): CycleInfo | null {
    const m = this.machine;
    if (this.done === 0) {
      if (m.halted) return null;
      this.start = m.pc;
      this.total = DECODE_TABLE[m.peek(m.pc)]!.cycles;
      this.ops = this.fetchOps();
    }
    const op = this.ops[this.done]!;
    const res = op.run() ?? {};
    const index = this.done;
    this.done++;
    m.cycles++;
    // The decode cycle appends the execute cycles, so the length is known from then on.
    const last = this.done === this.ops.length;
    const info: CycleInfo = {
      phase: op.phase,
      index,
      of: this.total,
      text: op.text,
      writes: op.writes,
      from: op.from,
      to: op.to,
      value: res.value,
      access: res.access,
      instructionAddress: this.start,
      last,
    };
    if (last) {
      this.done = 0;
      m.steps++;
    }
    this.last = info;
    return info;
  }

  /** Run the rest of the current instruction (one whole instruction if at a boundary). */
  finishInstruction(): number {
    let n = 0;
    do {
      if (!this.cycle()) break;
      n++;
    } while (this.done !== 0);
    return n;
  }

  // ---- The micro-operations.

  private fetchOps(): Op[] {
    const m = this.machine;
    return [
      {
        phase: 'fetch',
        text: FETCH_STEPS[0],
        writes: ['MAR'],
        from: 'PC',
        to: 'MAR',
        run: () => {
          this.mar = m.pc;
          return { value: this.mar };
        },
      },
      {
        phase: 'fetch',
        text: FETCH_STEPS[1],
        writes: ['IR', 'PC'],
        from: 'MEM',
        to: 'IR',
        run: () => {
          this.ir = m.read(this.mar);
          m.pc = (m.pc + 1) & 0xff;
          return { value: this.ir, access: { kind: 'read', address: this.mar } };
        },
      },
      {
        phase: 'decode',
        text: 'decode IR',
        writes: ['CTRL'],
        from: 'IR',
        to: 'CTRL',
        run: () => {
          this.ops.push(...this.executeOps(DECODE_TABLE[this.ir]!, this.ir));
          return { value: this.ir };
        },
      },
    ];
  }

  private executeOps(spec: OctetInstruction, ir: number): Op[] {
    const m = this.machine;
    const d = (ir >> 2) & 3;
    const s = ir & 3;
    const rd = reg(d);
    const rs = reg(s);
    const text = (k: number) => instantiate(spec.steps[k]!, ir);
    const op = (k: number, writes: Node[], from: Node | undefined, to: Node | undefined, run: Op['run']): Op => ({ phase: 'execute', text: text(k), writes, from, to, run });
    const read = (addr: number) => ({ value: m.read(addr), access: { kind: 'read' as const, address: addr } });
    const write = (addr: number, v: number) => {
      m.write(addr, v);
      return { value: v, access: { kind: 'write' as const, address: addr } };
    };
    const setFlags = (x: AluResult) => {
      m.z = x.z;
      m.c = x.c;
      m.n = x.n;
      m.v = x.v;
    };
    const pcToMar = (k: number) =>
      op(k, ['MAR'], 'PC', 'MAR', () => {
        this.mar = m.pc;
        return { value: this.mar };
      });

    switch (spec.mnemonic) {
      case 'HLT':
        return [
          op(0, ['CTRL'], undefined, 'CTRL', () => {
            m.halted = true;
          }),
        ];
      case 'MOV':
        return [
          op(0, [rd], rs, rd, () => {
            m.r[d] = m.r[s]!;
            return { value: m.r[d] };
          }),
        ];
      case 'LDI':
        return [
          pcToMar(0),
          op(1, [rd, 'PC'], 'MEM', rd, () => {
            const r = read(this.mar);
            m.r[d] = r.value;
            m.pc = (m.pc + 1) & 0xff;
            return r;
          }),
        ];
      case 'LD':
        return [
          pcToMar(0),
          op(1, ['MAR', 'PC'], 'MEM', 'MAR', () => {
            const r = read(this.mar);
            this.mar = r.value;
            m.pc = (m.pc + 1) & 0xff;
            return r;
          }),
          op(2, [rd], 'MEM', rd, () => {
            const r = read(this.mar);
            m.r[d] = r.value;
            return r;
          }),
        ];
      case 'ST':
        return [
          pcToMar(0),
          op(1, ['MAR', 'PC'], 'MEM', 'MAR', () => {
            const r = read(this.mar);
            this.mar = r.value;
            m.pc = (m.pc + 1) & 0xff;
            return r;
          }),
          op(2, ['MEM'], rd, 'MEM', () => write(this.mar, m.r[d]!)),
        ];
      case 'LDR':
        return [
          op(0, ['MAR'], rs, 'MAR', () => {
            this.mar = m.r[s]!;
            return { value: this.mar };
          }),
          op(1, [rd], 'MEM', rd, () => {
            const r = read(this.mar);
            m.r[d] = r.value;
            return r;
          }),
        ];
      case 'STR':
        return [
          op(0, ['MAR'], rd, 'MAR', () => {
            this.mar = m.r[d]!;
            return { value: this.mar };
          }),
          op(1, ['MEM'], rs, 'MEM', () => write(this.mar, m.r[s]!)),
        ];
      case 'PUSH':
        return [
          op(0, ['SP'], 'SP', 'SP', () => {
            m.sp = (m.sp - 1) & 0xff;
            return { value: m.sp };
          }),
          op(1, ['MAR'], 'SP', 'MAR', () => {
            this.mar = m.sp;
            return { value: this.mar };
          }),
          op(2, ['MEM'], rd, 'MEM', () => write(this.mar, m.r[d]!)),
        ];
      case 'POP':
        return [
          op(0, ['MAR'], 'SP', 'MAR', () => {
            this.mar = m.sp;
            return { value: this.mar };
          }),
          op(1, [rd, 'SP'], 'MEM', rd, () => {
            const r = read(this.mar);
            m.r[d] = r.value;
            m.sp = (m.sp + 1) & 0xff;
            return r;
          }),
        ];
      case 'CALL':
        return [
          op(0, ['MAR', 'SP'], 'PC', 'MAR', () => {
            this.mar = m.pc;
            m.sp = (m.sp - 1) & 0xff;
            return { value: this.mar };
          }),
          op(1, ['T', 'PC'], 'MEM', 'T', () => {
            const r = read(this.mar);
            this.t = r.value;
            m.pc = (m.pc + 1) & 0xff;
            return r;
          }),
          op(2, ['MAR'], 'SP', 'MAR', () => {
            this.mar = m.sp;
            return { value: this.mar };
          }),
          op(3, ['MEM'], 'PC', 'MEM', () => write(this.mar, m.pc)),
          op(4, ['PC'], 'T', 'PC', () => {
            m.pc = this.t;
            return { value: m.pc };
          }),
        ];
      case 'RET':
        return [
          op(0, ['MAR'], 'SP', 'MAR', () => {
            this.mar = m.sp;
            return { value: this.mar };
          }),
          op(1, ['PC', 'SP'], 'MEM', 'PC', () => {
            const r = read(this.mar);
            m.pc = r.value;
            m.sp = (m.sp + 1) & 0xff;
            return r;
          }),
        ];
    }
    if (spec.group === 'alu') {
      const code = spec.opcode;
      const cmp = spec.mnemonic === 'CMP';
      return [
        op(0, ['A'], rd, 'A', () => {
          this.a = m.r[d]!;
          return { value: this.a };
        }),
        op(1, ['B'], rs, 'B', () => {
          this.b = m.r[s]!;
          return { value: this.b };
        }),
        op(2, cmp ? ['FLAGS'] : [rd, 'FLAGS'], 'ALU', cmp ? 'FLAGS' : rd, () => {
          const x = alu(code, this.a, this.b);
          setFlags(x);
          if (!cmp) m.r[d] = x.r;
          return { value: x.r };
        }),
      ];
    }
    if (spec.group === 'unary') {
      const sub = spec.fixed;
      return [
        op(0, ['A'], rd, 'A', () => {
          this.a = m.r[d]!;
          return { value: this.a };
        }),
        op(1, [rd, 'FLAGS'], 'ALU', rd, () => {
          const x = unary(sub, this.a);
          setFlags(x);
          m.r[d] = x.r;
          return { value: x.r };
        }),
      ];
    }
    // Jumps: the condition is the low nibble of the first byte.
    const cond = OCTET_CONDITIONS[ir & 0xf]!;
    return [
      pcToMar(0),
      op(1, ['PC'], 'MEM', 'PC', () => {
        if (cond.test(m)) {
          const r = read(this.mar);
          m.pc = r.value;
          return r;
        }
        m.pc = (m.pc + 1) & 0xff;
        return { value: m.pc };
      }),
    ];
  }
}
