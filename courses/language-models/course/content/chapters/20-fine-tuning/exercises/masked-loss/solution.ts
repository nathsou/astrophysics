/**
 * Mean cross-entropy (in nats) over the positions where `mask` is true: logits[t] are the scores for position
 * t's next token, targets[t] the actual next token. Positions with mask false (the prompt) are ignored.
 */
export function maskedLoss(logits: number[][], targets: number[], mask: boolean[]): number {
  let sum = 0, count = 0;
  logits.forEach((z, t) => {
    if (!mask[t]) return;
    const m = Math.max(...z);
    const lse = m + Math.log(z.reduce((a, v) => a + Math.exp(v - m), 0));
    sum += lse - z[targets[t]!]!;
    count++;
  });
  return count ? sum / count : 0;
}
