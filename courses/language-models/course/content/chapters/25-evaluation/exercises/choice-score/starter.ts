/**
 * A multiple-choice item scored by likelihood: each option has the total log-probability the model gives its
 * tokens after the question, and its number of tokens. Return the index of the option the model picks.
 * `mean` normalises by length, so that long options are not penalised for having more tokens.
 */
export function pickOption(options: { logprob: number; tokens: number }[], mode: 'sum' | 'mean'): number {
  // TODO
  return 0;
}
