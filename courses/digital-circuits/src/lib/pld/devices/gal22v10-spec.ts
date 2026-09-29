/**
 * The design as its author wrote it: a reference simulation of a `GalDesign` straight from its
 * equations, with no fuses. Comparing it with `Gal22v10` running the fitted fuse map shows that the
 * fit preserved the behaviour (the property the tests check, and what Chapter 26's "spec vs chip"
 * display uses).
 *
 * Semantics: every name is the level on its pin. Combinational outputs settle to a fixed point
 * (feedback allowed). A registered output holds its pin level; on a clock edge it takes the value
 * of its equation, evaluated on the levels just before the edge, unless SP (then the register is set to
 * 1) or AR (register reset to 0) is true; AR also acts at once, without a clock. The register holds the pin
 * level for an active-high output and its complement for an active-low one, so AR and SP set the pin
 * levels to 0 and 1 for active-high outputs and to 1 and 0 for active-low ones; pass the fit to
 * get the polarities right (the fitter keeps registered outputs active high unless asked
 * otherwise, so the two views agree by default). At power-up every register is 0.
 */
import { evalExpr, parseExpr, type Expr } from '../twolevel/expr';
import type { GalDesign, GalFit } from './gal22v10-fit';

type Level = 0 | 1;

function ex(e: string | Expr): Expr {
  return typeof e === 'string' ? parseExpr(e) : e;
}

export class GalSpecModel {
  private readonly outputs: { name: string; expr: Expr; oe?: Expr; registered: boolean; activeHigh: boolean }[];
  private readonly ar?: Expr;
  private readonly sp?: Expr;
  /** Pin level of each registered output. */
  readonly regs = new Map<string, Level>();

  constructor(design: GalDesign, fit?: GalFit) {
    this.outputs = design.outputs.map((o) => ({
      name: o.name,
      expr: ex(o.expr),
      oe: o.oe !== undefined ? ex(o.oe) : undefined,
      registered: !!o.registered,
      activeHigh: fit ? fit.outputs.find((f) => f.name === o.name)!.polarity === 'high' : true,
    }));
    this.ar = design.ar !== undefined ? ex(design.ar) : undefined;
    this.sp = design.sp !== undefined ? ex(design.sp) : undefined;
    this.powerUp();
  }

  powerUp(): void {
    for (const o of this.outputs) if (o.registered) this.regs.set(o.name, o.activeHigh ? 0 : 1);
  }

  /** Settle: the level of every output for the given input levels (AR applied first if true). */
  evaluate(inputs: Record<string, number>): Record<string, Level> & { driven?: never } {
    const env: Record<string, Level> = {};
    for (const [k, v] of Object.entries(inputs)) env[k] = v ? 1 : 0;
    const look = (name: string) => env[name] ?? 0;
    for (const o of this.outputs) if (o.registered) env[o.name] = this.regs.get(o.name)!;
    for (let iter = 0; iter < 64; iter++) {
      // AR is asynchronous.
      if (this.ar && evalExpr(this.ar, look)) {
        for (const o of this.outputs) if (o.registered) {
          const v: Level = o.activeHigh ? 0 : 1;
          this.regs.set(o.name, v);
          env[o.name] = v;
        }
      }
      let changed = false;
      for (const o of this.outputs) {
        if (o.registered) continue;
        const v = evalExpr(o.expr, look);
        if (env[o.name] !== v) {
          env[o.name] = v;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return env as Record<string, Level> & { driven?: never };
  }

  /** Whether an output's enable is true for these inputs (always true without one). */
  enabled(name: string, inputs: Record<string, number>): boolean {
    const o = this.outputs.find((x) => x.name === name)!;
    if (!o.oe) return true;
    const env = this.evaluate(inputs);
    return !!evalExpr(o.oe, (n) => env[n] ?? 0);
  }

  /** A rising clock edge with the inputs held. */
  clock(inputs: Record<string, number>): void {
    const env = this.evaluate(inputs);
    const look = (name: string) => env[name] ?? 0;
    const ar = !!this.ar && !!evalExpr(this.ar, look);
    const sp = !!this.sp && !!evalExpr(this.sp, look);
    const next = new Map<string, Level>();
    for (const o of this.outputs) {
      if (!o.registered) continue;
      // The register holds f (active high) or its complement (active low); SP sets the register to 1.
      let q: Level;
      if (ar) q = 0;
      else if (sp) q = 1;
      else {
        const f = evalExpr(o.expr, look);
        q = (o.activeHigh ? f : 1 - f) as Level;
      }
      next.set(o.name, (o.activeHigh ? q : 1 - q) as Level);
    }
    for (const [k, v] of next) this.regs.set(k, v);
  }
}
