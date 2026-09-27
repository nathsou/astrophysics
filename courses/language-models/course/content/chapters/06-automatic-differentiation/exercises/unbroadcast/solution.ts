export function unbroadcast(grad: Float32Array, gradShape: number[], shape: number[]): Float32Array {
  const size = shape.reduce((a, b) => a * b, 1);
  const out = new Float32Array(size);
  const lead = gradShape.length - shape.length;
  // Strides of `shape`, with 0 along broadcast dimensions, aligned to gradShape.
  const strides = new Array<number>(gradShape.length).fill(0);
  let s = 1;
  for (let k = shape.length - 1; k >= 0; k--) {
    strides[k + lead] = shape[k] === 1 && gradShape[k + lead] !== 1 ? 0 : s;
    s *= shape[k]!;
  }
  const idx = new Array<number>(gradShape.length).fill(0);
  for (let i = 0; i < grad.length; i++) {
    let o = 0;
    for (let d = 0; d < idx.length; d++) o += idx[d]! * strides[d]!;
    out[o]! += grad[i]!;
    for (let d = idx.length - 1; d >= 0; d--) {
      if (++idx[d]! < gradShape[d]!) break;
      idx[d] = 0;
    }
  }
  return out;
}
