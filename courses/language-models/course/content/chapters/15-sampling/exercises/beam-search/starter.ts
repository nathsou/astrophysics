export interface Hypothesis {
  ids: number[];
  /** Sum of log-probabilities of the tokens after the prompt. */
  logp: number;
}

/**
 * Beam search for `steps` steps with beam width `width`, starting from `prompt`. `logprobs(ids)` returns
 * log P(next token | ids) for every token. A hypothesis ending in `eos` is finished: it is no longer
 * extended but stays in the beam. Returns the final beam, most probable first.
 */
export function beamSearch(logprobs: (ids: number[]) => number[], prompt: number[], width: number, steps: number, eos = -1): Hypothesis[] {
  let beam: Hypothesis[] = [{ ids: [...prompt], logp: 0 }];
  // TODO
  return beam;
}
