/**
 * A top-k sparse autoencoder. Encode x into m feature activations, keep only the k largest, and decode them back.
 * Wenc is d × m (column j reads feature j), Wdec is m × d (row j is feature j's direction).
 */
export function topkSae(x: number[], Wenc: number[][], benc: number[], Wdec: number[][], bdec: number[], k: number): { features: number[]; reconstruction: number[] } {
  const m = benc.length;
  const centred = x.map((v, i) => v - bdec[i]!);
  const pre = Array.from({ length: m }, (_, j) => Math.max(0, centred.reduce((a, v, i) => a + v * Wenc[i]![j]!, benc[j]!)));
  const keep = new Set(pre.map((_, j) => j).sort((a, b) => pre[b]! - pre[a]! || a - b).slice(0, k));
  const features = pre.map((v, j) => (keep.has(j) ? v : 0));
  const reconstruction = bdec.map((b, i) => features.reduce((a, f, j) => a + f * Wdec[j]![i]!, b));
  return { features, reconstruction };
}
