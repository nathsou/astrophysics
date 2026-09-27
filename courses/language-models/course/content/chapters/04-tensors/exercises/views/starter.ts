/** A tensor view: a shape, strides and an offset into some flat buffer. */
export interface View {
  shape: number[];
  strides: number[];
  offset: number;
}

/** Swap dimensions a and b — without touching any data. */
export function transpose(v: View, a: number, b: number): View {
  // TODO
  return v;
}

/** Elements [start, end) of dimension `dim` — also without touching data. */
export function slice(v: View, dim: number, start: number, end: number): View {
  // TODO: shrink the size, move the offset.
  return v;
}

/**
 * True if the view visits the buffer in plain row-major order with no gaps, i.e. its strides equal
 * the contiguous strides of its shape. (Dimensions of size 1 may have any stride.)
 */
export function isContiguous(v: View): boolean {
  // TODO
  return true;
}
