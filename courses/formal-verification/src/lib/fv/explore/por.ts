/**
 * Partial-order reduction, in its simplest sound form (chapter 2). A process step that touches no shared state
 * (it reads and writes only the process's own locals) commutes with every step of every other process: taking it
 * now or later leads to the same states. If such a step is also invisible to the invariants (it does not move the
 * process to or from a label an invariant mentions), the explorer can take it alone, without also trying every
 * other process's step first. The cycle proviso keeps this sound: the reduction is used only when the step leads
 * to a state not seen before.
 *
 * Real model checkers (SPIN's partial-order reduction, for example) use finer independence relations; this one only
 * reduces purely local steps, so it helps most on models whose processes compute between their shared accesses.
 */
import type * as A from '../vouch/syntax/ast';
import { forEachSubExpr } from '../vouch/syntax/ast';
import type { SystemRuntime, Instr } from '../vouch/interp/system';

export class LocalSteps {
  private cache = new Map<string, boolean>();
  private visibleLabels = new Set<string>();

  constructor(private rt: SystemRuntime) {
    for (const inv of rt.info.invariants) {
      forEachSubExpr(inv.expr, (e) => {
        if (e.k === 'at') this.visibleLabels.add(e.label);
      });
    }
  }

  /** Is the step of process instance `i` that starts at instruction `pc` local and invisible? */
  reducible(i: number, pc: number): boolean {
    const inst = this.rt.instances[i]!;
    const k = `${inst.proc.decl.name}@${pc}`;
    let r = this.cache.get(k);
    if (r === undefined) {
      r = this.analyse(this.rt.code.get(inst.proc)!, pc);
      this.cache.set(k, r);
    }
    return r;
  }

  private analyse(code: Instr[], pc: number): boolean {
    const start = code[pc];
    if (start?.op === 'label' && this.visibleLabels.has(start.name)) return false;
    const seen = new Set<number>();
    const todo = [pc + 1];
    while (todo.length) {
      const p = todo.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      const ins = code[p];
      if (!ins || ins.op === 'halt') continue;
      switch (ins.op) {
        case 'label':
          if (this.visibleLabels.has(ins.name)) return false;
          continue;
        case 'jmp':
          todo.push(ins.to);
          continue;
        case 'br':
          if (this.touchesShared(ins.cond)) return false;
          todo.push(ins.then, ins.else);
          continue;
        case 'await':
          if (this.touchesShared(ins.cond)) return false;
          todo.push(p + 1);
          continue;
        case 'stmt':
          if (this.stmtTouchesShared(ins.stmt)) return false;
          todo.push(p + 1);
          continue;
      }
    }
    return true;
  }

  private touchesShared(e: A.Expr): boolean {
    let shared = false;
    forEachSubExpr(e, (x) => {
      if (x.k === 'var' && this.rt.checked.refs.get(x)?.kind === 'statevar') shared = true;
      if (x.k === 'at') shared = true;
    });
    return shared;
  }

  private stmtTouchesShared(s: A.Stmt): boolean {
    const exprs: A.Expr[] = [];
    switch (s.k) {
      case 'let':
        if (s.init) exprs.push(s.init);
        break;
      case 'assign':
        exprs.push(s.target, s.value);
        break;
      case 'multi':
        exprs.push(...s.targets, ...s.values);
        break;
      case 'assert':
      case 'assume':
        exprs.push(s.cond);
        break;
      case 'expr':
        exprs.push(s.expr);
        break;
      case 'skip':
        break;
      default:
        return true; // anything else: assume it may touch shared state
    }
    return exprs.some((e) => this.touchesShared(e));
  }
}
