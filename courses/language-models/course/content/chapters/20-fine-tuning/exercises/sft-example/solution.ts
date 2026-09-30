/**
 * Build one supervised fine-tuning example from token ids: the prompt (instruction) and the response, which ends
 * with the end-of-text id `eot`. Returns the model's inputs and targets for next-token prediction, of equal
 * length, cut to `context`. Targets inside the prompt are −100, the value cross-entropy ignores.
 */
export function sftExample(prompt: number[], response: number[], eot: number, context: number): { input: number[]; target: number[] } {
  const ids = [...prompt, ...response, eot];
  const input = ids.slice(0, -1).slice(0, context);
  // target[t] = ids[t + 1], but only once t + 1 is inside the response.
  const target = input.map((_, t) => (t + 1 >= prompt.length ? ids[t + 1]! : -100));
  return { input, target };
}
