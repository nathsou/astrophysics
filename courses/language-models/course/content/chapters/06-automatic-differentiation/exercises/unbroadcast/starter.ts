/**
 * Gradients of broadcast operations must be "un-broadcast": if x (shape `shape`) was stretched to
 * `gradShape` in the forward pass, its gradient is the sum of the incoming gradient over every
 * stretched (or added leading) dimension.
 * Example: bias of shape [3] added to activations [2, 3] → dBias = sum of the [2, 3] gradient over dim 0.
 */
export function unbroadcast(grad: Float32Array, gradShape: number[], shape: number[]): Float32Array {
  // TODO
  return grad;
}
