/**
 * A top-k sparse autoencoder. Encode x into m feature activations, keep only the k largest, and decode them back.
 * Wenc is d × m (column j reads feature j), Wdec is m × d (row j is feature j's direction).
 */
export function topkSae(x: number[], Wenc: number[][], benc: number[], Wdec: number[][], bdec: number[], k: number): { features: number[]; reconstruction: number[] } {
  // TODO
  return { features: benc.map(() => 0), reconstruction: [...bdec] };
}
