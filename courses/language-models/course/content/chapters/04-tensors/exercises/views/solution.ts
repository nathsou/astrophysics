export interface View {
  shape: number[];
  strides: number[];
  offset: number;
}

export function transpose(v: View, a: number, b: number): View {
  const shape = [...v.shape];
  const strides = [...v.strides];
  [shape[a], shape[b]] = [shape[b]!, shape[a]!];
  [strides[a], strides[b]] = [strides[b]!, strides[a]!];
  return { shape, strides, offset: v.offset };
}

export function slice(v: View, dim: number, start: number, end: number): View {
  const shape = [...v.shape];
  shape[dim] = end - start;
  return { shape, strides: [...v.strides], offset: v.offset + start * v.strides[dim]! };
}

export function isContiguous(v: View): boolean {
  let expected = 1;
  for (let k = v.shape.length - 1; k >= 0; k--) {
    if (v.shape[k] !== 1 && v.strides[k] !== expected) return false;
    expected *= v.shape[k]!;
  }
  return true;
}
