/**
 * A reference interpreter for the equation semantics of the fitter, independent of the fitted
 * bits: what the design means, not what the device does. Chapter 27 and the tests compare a fitted
 * device against it.
 *
 * A combinational output follows its expression, settled over the outputs it reads (the equations
 * must not form a loop). A registered output `Q` holds a value, initially `init`; at a rising edge
 * of the clock it becomes its expression evaluated on the levels just before the edge. Don't-care
 * sets are ignored (the interpreter evaluates the expression as written).
 */
import { evalExpr, type Expr } from '../twolevel/expr';
import { asExpr, type CpldDesign } from './design';

export type Levels = Record<string, 0 | 1>;

export class EquationModel {
  private readonly exprs = new Map<string, Expr>();
  /** Register contents by output name. */
  readonly state: Levels = {};

  constructor(readonly design: CpldDesign) {
    for (const o of design.outputs) {
      this.exprs.set(o.name, asExpr(o.expr, `Equation for ${o.name}`));
      if (o.registered) this.state[o.name] = o.init ? 1 : 0;
    }
  }

  reset(): void {
    for (const o of this.design.outputs) if (o.registered) this.state[o.name] = o.init ? 1 : 0;
  }

  /** The levels of all inputs and outputs for the given input levels (missing inputs read 0). */
  evaluate(inputs: Record<string, number>): Levels {
    const levels: Levels = {};
    for (const i of this.design.inputs) {
      const name = typeof i === 'string' ? i : i.name;
      levels[name] = inputs[name] ? 1 : 0;
    }
    for (const o of this.design.outputs) levels[o.name] = o.registered ? this.state[o.name]! : 0;
    for (let iter = 0; iter <= this.design.outputs.length + 1; iter++) {
      let changed = false;
      for (const o of this.design.outputs) {
        if (o.registered) continue;
        const v = evalExpr(this.exprs.get(o.name)!, (name) => levels[name] ?? 0);
        if (levels[o.name] !== v) {
          levels[o.name] = v;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return levels;
  }

  /** A rising clock edge with the given (held) inputs. Returns the levels after the edge. */
  clock(inputs: Record<string, number>): Levels {
    const before = this.evaluate(inputs);
    const next: Levels = {};
    for (const o of this.design.outputs) if (o.registered) next[o.name] = evalExpr(this.exprs.get(o.name)!, (name) => before[name] ?? 0);
    Object.assign(this.state, next);
    return this.evaluate(inputs);
  }
}
