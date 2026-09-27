/** Row-major (C-order) strides: how far to move in the flat buffer per step along each dimension. */
export function contiguousStrides(shape: number[]): number[] {
  // TODO: the last dimension has stride 1; each earlier stride is the next stride × the next size.
  return shape.map(() => 1);
}

/** The flat-buffer position of a multi-dimensional index: offset + Σ index[k] · strides[k]. */
export function offsetOf(index: number[], strides: number[], offset = 0): number {
  // TODO
  return offset;
}
