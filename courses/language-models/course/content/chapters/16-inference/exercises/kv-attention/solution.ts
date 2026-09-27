/**
 * One attention head during generation. Each step brings the new token's query, key and value; the
 * keys and values of all earlier tokens are kept, so they never have to be recomputed.
 */
export class HeadCache {
  readonly keys: Float32Array[] = [];
  readonly values: Float32Array[] = [];

  /** Append k and v, then return the attention output for q over every cached position. */
  step(q: Float32Array, k: Float32Array, v: Float32Array): Float32Array {
    this.keys.push(k);
    this.values.push(v);
    const scale = 1 / Math.sqrt(q.length);
    const s = this.keys.map((key) => key.reduce((a, x, i) => a + x * q[i]!, 0) * scale);
    const m = Math.max(...s);
    const e = s.map((x) => Math.exp(x - m));
    const z = e.reduce((a, b) => a + b, 0);
    const out = new Float32Array(v.length);
    this.values.forEach((val, j) => val.forEach((x, i) => (out[i]! += (e[j]! / z) * x)));
    return out;
  }
}
