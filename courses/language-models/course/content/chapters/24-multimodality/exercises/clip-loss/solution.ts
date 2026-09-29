/**
 * CLIP's symmetric contrastive loss for a batch of N matching (image, text) embedding pairs (already
 * normalised). Image i should match text i and no other text, and text i image i and no other image.
 */
export function clipLoss(images: number[][], texts: number[][], temperature: number): number {
  const N = images.length;
  const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k]!, 0);
  const logits = images.map((im) => texts.map((t) => dot(im, t) / temperature));
  // Cross-entropy of picking index `target` from a row of logits.
  const ce = (row: number[], target: number) => {
    const m = Math.max(...row);
    return m + Math.log(row.reduce((s, z) => s + Math.exp(z - m), 0)) - row[target]!;
  };
  let imageToText = 0, textToImage = 0;
  for (let i = 0; i < N; i++) {
    imageToText += ce(logits[i]!, i);
    textToImage += ce(logits.map((row) => row[i]!), i);
  }
  return (imageToText + textToImage) / (2 * N);
}
