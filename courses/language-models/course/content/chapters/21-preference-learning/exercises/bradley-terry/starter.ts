/** P(A ≻ B) under the Bradley–Terry model, given the two rewards. */
export function preferProbability(rA: number, rB: number): number {
  // TODO
  return 0.5;
}

/** The reward model's loss for one comparison: −log P(chosen ≻ rejected), computed stably. */
export function btLoss(rChosen: number, rRejected: number): number {
  // TODO
  return 0;
}
