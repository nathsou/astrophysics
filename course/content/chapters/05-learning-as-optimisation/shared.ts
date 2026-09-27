/** TinyShakespeare as character ids with the course's 90/10 split (shared by Chapter 5's widgets). */
import { CharVocab } from '@lm/core/tokenise';
import { Tensor, nn } from '@lm/core/tensor';
import { loadCorpus } from '$lib/data/corpus';

export interface Chars {
  vocab: CharVocab;
  train: Int32Array;
  val: Int32Array;
}

let p: Promise<Chars> | undefined;

export function chars(): Promise<Chars> {
  p ??= loadCorpus('shakespeare').then((text) => {
    const vocab = CharVocab.fromText(text);
    const ids = Int32Array.from(vocab.encode(text));
    const split = Math.floor(ids.length * 0.9);
    return { vocab, train: ids.subarray(0, split), val: ids.subarray(split) };
  });
  return p;
}

/**
 * One SGD step of the neural bigram model, using the course library's autograd.
 * W is (V×V) row-major; row x holds the logits for the character after x.
 * Loss = mean cross-entropy + λ·mean(W²). Updates W in place and returns the data loss (nats).
 */
export function referenceStep(W: Float32Array, V: number, xs: Int32Array, ys: Int32Array, lr: number, lambda: number): number {
  const w = new Tensor(W, [V, V], undefined, 0, true);
  const logits = nn.embedding(w, xs);
  const data = nn.crossEntropy(logits, ys);
  const loss = lambda > 0 ? data.add(w.mul(w).mean().mul(lambda)) : data;
  loss.backward();
  const g = w.grad!.toFloat32Array();
  for (let i = 0; i < W.length; i++) W[i]! -= lr * g[i]!;
  return data.item();
}

export type StepFn = typeof referenceStep;
