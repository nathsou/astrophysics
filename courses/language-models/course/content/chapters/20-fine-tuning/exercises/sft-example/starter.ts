/**
 * Build one supervised fine-tuning example from token ids: the prompt (instruction) and the response, which ends
 * with the end-of-text id `eot`. Returns the model's inputs and targets for next-token prediction, of equal
 * length, cut to `context`. Targets inside the prompt are −100, the value cross-entropy ignores.
 */
export function sftExample(prompt: number[], response: number[], eot: number, context: number): { input: number[]; target: number[] } {
  // TODO
  return { input: [], target: [] };
}
