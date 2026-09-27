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
  const out = Float64Array.from(logits);
  // Dividing a negative logit would move it towards 0 and make the token *more* likely.
  for (const t of new Set(history)) out[t] = out[t]! > 0 ? out[t]! / theta : out[t]! * theta;
  return out;
}

/**
 * OpenAI's frequency and presence penalties: subtract `frequency` × (number of occurrences) and, once,
 * `presence` from the logit of every token that occurs in the history.
 */
export function frequencyPresencePenalty(logits: ArrayLike<number>, history: number[], frequency: number, presence: number): Float64Array {
  const out = Float64Array.from(logits);
  const counts = new Map<number, number>();
  for (const t of history) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, c] of counts) out[t] = out[t]! - frequency * c - presence;
  return out;
}
