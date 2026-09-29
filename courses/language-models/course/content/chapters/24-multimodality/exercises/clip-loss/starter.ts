/**
 * CLIP's symmetric contrastive loss for a batch of N matching (image, text) embedding pairs (already
 * normalised). Image i should match text i and no other text, and text i image i and no other image.
 */
export function clipLoss(images: number[][], texts: number[][], temperature: number): number {
  // TODO
  return 0;
}
