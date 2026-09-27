/** Shape and stride arithmetic shared by all tensor operations (Chapter 4). */

export type Shape = number[];

export function sizeOf(shape: readonly number[]): number {
  let n = 1;
  for (const d of shape) n *= d;
  return n;
}

/** Row-major (C-order) strides: the last dimension is contiguous. */
export function contiguousStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let s = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = s;
    s *= shape[i]!;
  }
  return strides;
}

/** Resolve a possibly negative dimension index. */
export function normDim(dim: number, ndim: number): number {
  const d = dim < 0 ? dim + ndim : dim;
  if (d < 0 || d >= ndim) throw new RangeError(`dimension ${dim} out of range for a ${ndim}-d tensor`);
  return d;
}

/**
 * NumPy/PyTorch broadcasting: align shapes on the right; each pair of sizes must be equal or one
 * of them 1; the result takes the larger.
 */
export function broadcastShapes(a: readonly number[], b: readonly number[]): Shape {
  const n = Math.max(a.length, b.length);
  const out: Shape = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = a[a.length - n + i] ?? 1;
    const y = b[b.length - n + i] ?? 1;
    if (x !== y && x !== 1 && y !== 1) throw new Error(`shapes [${a}] and [${b}] cannot be broadcast together`);
    out[i] = Math.max(x, y);
  }
  return out;
}

/** Strides for viewing (shape, strides) as `target` by broadcasting: repeated dims get stride 0. */
export function broadcastStrides(shape: readonly number[], strides: readonly number[], target: readonly number[]): number[] {
  const out = new Array<number>(target.length).fill(0);
  const off = target.length - shape.length;
  for (let i = 0; i < shape.length; i++) {
    if (shape[i] === target[off + i]) out[off + i] = strides[i]!;
    else if (shape[i] !== 1) throw new Error(`cannot broadcast [${shape}] to [${target}]`);
  }
  return out;
}

export function sameShape(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/** Resolve a single -1 in a reshape target. */
export function inferShape(shape: readonly number[], size: number): Shape {
  const unknown = shape.indexOf(-1);
  if (unknown < 0) {
    if (sizeOf(shape) !== size) throw new Error(`cannot reshape ${size} elements into [${shape}]`);
    return [...shape];
  }
  const rest = sizeOf(shape.filter((_, i) => i !== unknown));
  if (rest === 0 || size % rest !== 0) throw new Error(`cannot reshape ${size} elements into [${shape}]`);
  const out = [...shape];
  out[unknown] = size / rest;
  return out;
}
