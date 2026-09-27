/**
 * Penalties that discourage a model from repeating itself, applied to the logits before the softmax.
 * Both return a new array; `history` holds the ids generated so far (prompt included).
 */

/**
 * CTRL's repetition penalty (Keskar et al., 2019): for each token that occurs in the history, divide its
 * logit by θ if it is positive and multiply it by θ if it is negative. With θ > 1 the token always
 * becomes less likely; θ = 1 changes nothing.
 */
export function repetitionPenalty(logits: ArrayLike<number>, history: number[], theta: number): Float64Array {
  // TODO
  return Float64Array.from(logits);
}

/**
 * OpenAI's frequency and presence penalties: subtract `frequency` × (number of occurrences) and, once,
 * `presence` from the logit of every token that occurs in the history.
 */
export function frequencyPresencePenalty(logits: ArrayLike<number>, history: number[], frequency: number, presence: number): Float64Array {
  // TODO
  return Float64Array.from(logits);
}
