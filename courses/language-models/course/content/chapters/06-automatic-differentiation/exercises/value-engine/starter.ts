/**
 * A scalar automatic-differentiation engine (in the spirit of Karpathy's micrograd).
 * Each Value remembers the Values it was computed from and how to pass gradients back to them.
 */
export class Value {
  data: number;
  grad = 0;
  readonly prev: Value[];
  readonly op: string;
  /** Adds this node's contribution to its parents' .grad, given this.grad. */
  backwardFn: () => void = () => {};

  constructor(data: number, prev: Value[] = [], op = '') {
    this.data = data;
    this.prev = prev;
    this.op = op;
  }

  add(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data + o.data, [this, o], '+');
    out.backwardFn = () => {
      this.grad += out.grad;
      o.grad += out.grad;
    };
    return out;
  }

  mul(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data * o.data, [this, o], '*');
    // TODO: d(out)/d(this) = o.data, d(out)/d(o) = this.data — remember to multiply by out.grad and ACCUMULATE.
    return out;
  }

  tanh(): Value {
    const t = Math.tanh(this.data);
    const out = new Value(t, [this], 'tanh');
    // TODO: d tanh(x)/dx = 1 − tanh(x)²
    return out;
  }

  exp(): Value {
    const out = new Value(Math.exp(this.data), [this], 'exp');
    // TODO
    return out;
  }

  pow(p: number): Value {
    const out = new Value(this.data ** p, [this], `^${p}`);
    // TODO
    return out;
  }

  neg(): Value {
    return this.mul(-1);
  }

  sub(other: Value | number): Value {
    return this.add(other instanceof Value ? other.neg() : -other);
  }

  /** Set this.grad = 1 and propagate gradients to every node it depends on. */
  backward(): void {
    // TODO: build a topological order (every node after the nodes it was computed from),
    // then call backwardFn on each node in REVERSE order.
  }
}
