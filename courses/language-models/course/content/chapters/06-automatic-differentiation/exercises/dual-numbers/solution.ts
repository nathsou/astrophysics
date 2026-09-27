export class Dual {
  readonly v: number;
  readonly d: number;

  constructor(v: number, d: number) {
    this.v = v;
    this.d = d;
  }

  add(o: Dual): Dual {
    return new Dual(this.v + o.v, this.d + o.d);
  }

  mul(o: Dual): Dual {
    return new Dual(this.v * o.v, this.v * o.d + this.d * o.v);
  }

  sin(): Dual {
    return new Dual(Math.sin(this.v), Math.cos(this.v) * this.d);
  }

  exp(): Dual {
    const e = Math.exp(this.v);
    return new Dual(e, e * this.d);
  }
}

export function derivative(f: (x: Dual) => Dual, x: number): number {
  return f(new Dual(x, 1)).d;
}
