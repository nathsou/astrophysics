/**
 * The DPO loss for one preference pair (Rafailov et al., 2023). Inputs are summed log-probabilities of the
 * chosen and rejected responses under the policy being trained and under the frozen reference model.
 * Returns the loss and the implicit rewards β·(log π − log π_ref) of both responses.
 */
export function dpoLoss(policyChosen: number, policyRejected: number, refChosen: number, refRejected: number, beta: number): { loss: number; rewardChosen: number; rewardRejected: number } {
  const rewardChosen = beta * (policyChosen - refChosen);
  const rewardRejected = beta * (policyRejected - refRejected);
  const m = rewardChosen - rewardRejected;
  const loss = m >= 0 ? Math.log1p(Math.exp(-m)) : -m + Math.log1p(Math.exp(m)); // −log σ(m)
  return { loss, rewardChosen, rewardRejected };
}
