// Reference interpreter for KIR. It defines the semantics every later stage
// must preserve, and is the oracle for differential testing against the
// RISC-V emulator: same program, same output, or something is broken.
//
// Semantics notes (chosen to match what all three targets do in hardware):
//  * integers wrap modulo 2^64
//  * shift amounts are taken modulo 64
//  * sdiv/srem by zero is a runtime error (UB in the source language)

import { Const, type Func, type Instr, type Module, type Value, wrap64 } from './ir';

export interface RunResult {
  output: string;
  exitCode: bigint;
  steps: number;
  error?: string;
  warnings: string[];
}

const MEM_SIZE = 1 << 20;
const GLOBAL_BASE = 0x1000;

export function runModule(m: Module, maxSteps = 5_000_000): RunResult {
  const mem = new DataView(new ArrayBuffer(MEM_SIZE));
  const init = new Uint8Array(MEM_SIZE);
  const warnings: string[] = [];
  const gaddr = new Map<string, number>();
  let top = GLOBAL_BASE;
  for (const g of m.globals) {
    gaddr.set(g.name, top);
    for (let k = 0; k < g.words; k++) {
      mem.setBigInt64(top + 8 * k, g.init[k] ?? 0n, true);
      init.fill(1, top + 8 * k, top + 8 * k + 8);
    }
    top += g.words * 8;
  }
  const funcs = new Map(m.funcs.map((f) => [f.name, f]));
  let sp = MEM_SIZE;
  let steps = 0;
  let output = '';

  const check = (addr: bigint, what: string): number => {
    const a = Number(addr);
    if (!Number.isInteger(a) || a < GLOBAL_BASE || a + 8 > MEM_SIZE || a % 8 !== 0) throw new Error(`invalid ${what} at address 0x${addr.toString(16)}`);
    return a;
  };

  const call = (fn: Func, args: bigint[], depth: number): bigint => {
    if (depth > 10000) throw new Error('stack overflow (recursion too deep)');
    const env = new Map<Value, bigint>();
    fn.params.forEach((p, k) => env.set(p, args[k]));
    const frameBase = sp;
    const val = (v: Value): bigint => {
      if (v instanceof Const) return v.v;
      const r = env.get(v);
      if (r === undefined) throw new Error(`use of undefined value in ${fn.name}`);
      return r;
    };
    let block = fn.entry;
    let prev = block;
    for (;;) {
      // phis are evaluated simultaneously on block entry
      const phis = block.phis;
      if (phis.length) {
        const vals = phis.map((p) => val(p.args[p.blocks.indexOf(prev)]));
        phis.forEach((p, k) => env.set(p, vals[k]));
      }
      for (let k = phis.length; k < block.instrs.length; k++) {
        const i: Instr = block.instrs[k];
        if (++steps > maxSteps) throw new Error(`step limit (${maxSteps}) exceeded — infinite loop?`);
        const a = () => val(i.args[0]);
        const b = () => val(i.args[1]);
        switch (i.op) {
          case 'add': env.set(i, wrap64(a() + b())); break;
          case 'sub': env.set(i, wrap64(a() - b())); break;
          case 'mul': env.set(i, wrap64(a() * b())); break;
          case 'sdiv': {
            const d = b();
            if (d === 0n) throw new Error(`division by zero (line ${i.line})`);
            env.set(i, wrap64(a() / d));
            break;
          }
          case 'srem': {
            const d = b();
            if (d === 0n) throw new Error(`remainder by zero (line ${i.line})`);
            env.set(i, wrap64(a() % d));
            break;
          }
          case 'and': env.set(i, a() & b()); break;
          case 'or': env.set(i, a() | b()); break;
          case 'xor': env.set(i, a() ^ b()); break;
          case 'shl': env.set(i, wrap64(a() << (b() & 63n))); break;
          case 'ashr': env.set(i, a() >> (b() & 63n)); break;
          case 'lshr': env.set(i, wrap64(BigInt.asUintN(64, a()) >> (b() & 63n))); break;
          case 'icmp': {
            const x = a(), y = b();
            const r = { eq: x === y, ne: x !== y, slt: x < y, sle: x <= y, sgt: x > y, sge: x >= y }[i.pred!];
            env.set(i, r ? 1n : 0n);
            break;
          }
          case 'zext': env.set(i, a() & 1n); break;
          case 'select': env.set(i, a() ? b() : val(i.args[2])); break;
          case 'alloca': {
            sp -= i.size!;
            sp &= ~7;
            if (sp < top + 4096) throw new Error('stack overflow');
            env.set(i, BigInt(sp));
            break;
          }
          case 'load': {
            const addr = check(a(), 'load');
            if (!init[addr]) warnings.push(`line ${i.line}: read of uninitialised memory`);
            env.set(i, mem.getBigInt64(addr, true));
            break;
          }
          case 'store': {
            const addr = check(b(), 'store');
            mem.setBigInt64(addr, a(), true);
            init.fill(1, addr, addr + 8);
            break;
          }
          case 'gaddr': env.set(i, BigInt(gaddr.get(i.sym!)!)); break;
          case 'call': {
            const args = i.args.map(val);
            if (i.sym === 'print_int') { output += `${args[0]}\n`; env.set(i, 0n); break; }
            if (i.sym === 'putchar') { output += String.fromCharCode(Number(BigInt.asUintN(8, args[0]))); env.set(i, 0n); break; }
            const f = funcs.get(i.sym!);
            if (!f) throw new Error(`call to unknown function ${i.sym}`);
            const saved = sp;
            env.set(i, call(f, args, depth + 1));
            sp = saved;
            break;
          }
          case 'br':
            prev = block;
            block = i.blocks[0];
            break;
          case 'condbr':
            prev = block;
            block = a() ? i.blocks[0] : i.blocks[1];
            break;
          case 'ret':
            sp = frameBase;
            return i.args.length ? a() : 0n;
          case 'param':
          case 'phi':
            throw new Error(`unexpected ${i.op}`);
        }
        if (i.op === 'br' || i.op === 'condbr') break;
      }
    }
  };

  try {
    const main = funcs.get('main');
    if (!main) throw new Error('no main function');
    const code = call(main, [], 0);
    return { output, exitCode: code, steps, warnings: [...new Set(warnings)].slice(0, 5) };
  } catch (e) {
    return { output, exitCode: -1n, steps, error: (e as Error).message, warnings: [...new Set(warnings)].slice(0, 5) };
  }
}
