/**
 * Bytes per GPU for the weights, gradients and optimiser state of a model with `params` parameters, trained with
 * bf16 mixed precision and Adam, sharded across `dp` data-parallel GPUs with ZeRO stage 0–3, and split `tp`-way by
 * tensor parallelism and `pp`-way by pipeline parallelism. (Activations are not counted.)
 */
export function memoryPerGpu(params: number, opts: { dp: number; tp: number; pp: number; zero: 0 | 1 | 2 | 3 }): { weights: number; grads: number; optimiser: number } {
  const local = params / (opts.tp * opts.pp); // this GPU's slice of the model
  const shard = (stage: number) => (opts.zero >= stage ? opts.dp : 1);
  return {
    weights: (2 * local) / shard(3),
    grads: (2 * local) / shard(2),
    optimiser: (12 * local) / shard(1), // float32 master weights, first and second moments
  };
}
