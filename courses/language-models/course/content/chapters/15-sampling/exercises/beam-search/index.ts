import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch15/beam-search',
  title: 'Beam search',
  starter,
  solution,
  tests,
  hints: [
    'Each hypothesis is <code>{ ids, logp }</code>. At every step, for each hypothesis not yet finished, call <code>logprobs(ids)</code> and create one extension per candidate token, with <code>logp + logprobs[token]</code>.',
    'Finished hypotheses (whose last token is <code>eos</code>) compete unchanged. Sort all candidates by <code>logp</code>, keep the best <code>width</code>, and repeat. Considering only each hypothesis’s top <code>width</code> tokens is enough, since no more than <code>width</code> extensions can survive.',
  ],
} satisfies ExerciseSpec;
