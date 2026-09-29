/** P(A ≻ B) under the Bradley–Terry model, given the two rewards. */
export function preferProbability(rA: number, rB: number): number {
  return 1 / (1 + Math.exp(-(rA - rB)));
}

/** The reward model's loss for one comparison: −log P(chosen ≻ rejected), computed stably. */
export function btLoss(rChosen: number, rRejected: number): number {
  const d = rChosen - rRejected;
  // log(1 + e^−d) without overflow for very negative d.
  return d >= 0 ? Math.log1p(Math.exp(-d)) : -d + Math.log1p(Math.exp(d));
}
