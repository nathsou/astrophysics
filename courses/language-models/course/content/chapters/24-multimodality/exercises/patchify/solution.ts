/**
 * Split an H × W image with C channels (a flat array, row by row, channels interleaved) into P × P patches,
 * in raster order, each flattened to P·P·C numbers — the “words” a vision transformer reads.
 * H and W are multiples of P.
 */
export function patchify(image: Float32Array, H: number, W: number, C: number, P: number): Float32Array[] {
  const patches: Float32Array[] = [];
  for (let py = 0; py < H / P; py++) {
    for (let px = 0; px < W / P; px++) {
      const out = new Float32Array(P * P * C);
      let k = 0;
      for (let y = 0; y < P; y++) {
        for (let x = 0; x < P; x++) {
          const at = ((py * P + y) * W + (px * P + x)) * C;
          for (let c = 0; c < C; c++) out[k++] = image[at + c]!;
        }
      }
      patches.push(out);
    }
  }
  return patches;
}
