/**
 * Forward-mode automatic differentiation with dual numbers: a + b·ε, where ε² = 0.
 * Carrying (value, derivative) pairs through a computation yields f'(x) alongside f(x).
 */
export class Dual {
  readonly v: number; // value
  readonly d: number; // derivative (tangent)

  constructor(v: number, d: number) {
    this.v = v;
    this.d = d;
  }

  add(o: Dual): Dual {
    return new Dual(this.v + o.v, this.d + o.d);
  }

  mul(o: Dual): Dual {
    // TODO: (a + bε)(c + dε) = ac + (ad + bc)ε
    return new Dual(this.v * o.v, 0);
  }

  sin(): Dual {
    // TODO: chain rule
    return new Dual(Math.sin(this.v), 0);
  }

  exp(): Dual {
    // TODO
    return new Dual(Math.exp(this.v), 0);
  }
}

/** f′(x): evaluate f on x + 1·ε and read off the ε coefficient. */
export function derivative(f: (x: Dual) => Dual, x: number): number {
  // TODO
  return 0;
}
