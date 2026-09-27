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
  for (let t = 0; t < steps; t++) {
    const candidates: Hypothesis[] = [];
    for (const h of beam) {
      if (h.ids.length > prompt.length && h.ids.at(-1) === eos) {
        candidates.push(h); // finished: competes as it is
        continue;
      }
      const lp = logprobs(h.ids);
      // Only a hypothesis's `width` best tokens can possibly survive the cut below.
      const best = lp.map((_, i) => i).sort((a, b) => lp[b]! - lp[a]!).slice(0, width);
      for (const tok of best) candidates.push({ ids: [...h.ids, tok], logp: h.logp + lp[tok]! });
    }
    beam = candidates.sort((a, b) => b.logp - a.logp).slice(0, width);
  }
  return beam;
}
