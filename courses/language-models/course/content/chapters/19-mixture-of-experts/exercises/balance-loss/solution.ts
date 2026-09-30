/**
 * The Switch Transformer's load-balancing loss, E · Σₑ fₑ·Pₑ, for a batch. `probs[t]` is token t's router
 * distribution over the E experts; `chosen[t]` lists the experts it was sent to (k of them).
 * fₑ: the share of all routing slots that went to expert e. Pₑ: the mean router probability of e.
 */
export function balanceLoss(probs: number[][], chosen: number[][]): number {
  const E = probs[0]!.length, N = probs.length;
  const f = new Array<number>(E).fill(0), P = new Array<number>(E).fill(0);
  const slots = chosen.reduce((a, c) => a + c.length, 0);
  for (const c of chosen) for (const e of c) f[e]! += 1 / slots;
  for (const p of probs) p.forEach((v, e) => (P[e]! += v / N));
  // fₑ has no gradient (it counts); Pₑ does, so minimising the product pushes probability away from busy experts.
  return E * f.reduce((a, fe, e) => a + fe * P[e]!, 0);
}
