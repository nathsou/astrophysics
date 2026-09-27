export function contiguousStrides(shape: number[]): number[] {
  const strides = new Array<number>(shape.length);
  let s = 1;
  for (let k = shape.length - 1; k >= 0; k--) {
    strides[k] = s;
    s *= shape[k]!;
  }
  return strides;
}

export function offsetOf(index: number[], strides: number[], offset = 0): number {
  let o = offset;
  for (let k = 0; k < index.length; k++) o += index[k]! * strides[k]!;
  return o;
}
