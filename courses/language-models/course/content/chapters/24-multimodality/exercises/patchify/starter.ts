/**
 * Split an H × W image with C channels (a flat array, row by row, channels interleaved) into P × P patches,
 * in raster order, each flattened to P·P·C numbers — the “words” a vision transformer reads.
 * H and W are multiples of P.
 */
export function patchify(image: Float32Array, H: number, W: number, C: number, P: number): Float32Array[] {
  // TODO
  return [];
}
