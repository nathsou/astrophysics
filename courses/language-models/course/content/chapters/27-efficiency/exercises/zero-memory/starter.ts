/**
 * Bytes per GPU for the weights, gradients and optimiser state of a model with `params` parameters, trained with
 * bf16 mixed precision and Adam, sharded across `dp` data-parallel GPUs with ZeRO stage 0–3, and split `tp`-way by
 * tensor parallelism and `pp`-way by pipeline parallelism. (Activations are not counted.)
 */
export function memoryPerGpu(params: number, opts: { dp: number; tp: number; pp: number; zero: 0 | 1 | 2 | 3 }): { weights: number; grads: number; optimiser: number } {
  // TODO
  return { weights: 0, grads: 0, optimiser: 0 };
}
