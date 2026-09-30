<!--
  Where the memory goes when training a large model: weights, gradients and Adam's state per GPU, for a model size
  and a choice of data, tensor and pipeline parallelism and ZeRO stage, against an 80 GB GPU. Activations are
  estimated separately. Uses the learner's memoryPerGpu().
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(params: number, o: { dp: number; tp: number; pp: number; zero: 0 | 1 | 2 | 3 }) {
    const local = params / (o.tp * o.pp);
    const shard = (s: number) => (o.zero >= s ? o.dp : 1);
    return { weights: (2 * local) / shard(3), grads: (2 * local) / shard(2), optimiser: (12 * local) / shard(1) };
  }
  const memory = $derived(impl.get('eff.memory', reference));
  const mine = $derived(impl.isMine('eff.memory'));

  const SIZES = [1, 7, 70, 405];
  let size = $state(70);
  let logDp = $state(3);
  let tp = $state(1);
  let pp = $state(1);
  let zero = $state<0 | 1 | 2 | 3>(0);
  let recompute = $state<'yes' | 'no'>('yes');
  const dp = $derived(2 ** logDp);
  const P = $derived(size * 1e9);

  const m = $derived.by(() => {
    try {
      return memory(P, { dp, tp, pp, zero });
    } catch {
      return reference(P, { dp, tp, pp, zero });
    }
  });
  // Activations for one sequence of 4,096 tokens, very roughly: per layer ≈ 34·T·C bytes, or 2·T·C with full
  // recomputation (keeping only each layer's input); the model's width and depth follow its size.
  const shape = $derived(({ 1: [2048, 24], 7: [4096, 32], 70: [8192, 80], 405: [16384, 126] } as Record<number, [number, number]>)[size]!);
  const acts = $derived(((recompute === 'yes' ? 2 : 34) * 4096 * shape[0] * shape[1]) / (tp * pp));
  const parts = $derived([
    { label: 'weights', v: m.weights, c: 'var(--series-1)' },
    { label: 'gradients', v: m.grads, c: 'var(--series-2)' },
    { label: 'optimiser state', v: m.optimiser, c: 'var(--series-3)' },
    { label: 'activations', v: acts, c: 'var(--series-5)' },
  ]);
  const total = $derived(parts.reduce((a, p) => a + p.v, 0));
  const scale = $derived(Math.max(total, 80e9) * 1.05);
  const gb = (b: number) => (b >= 1e11 ? `${(b / 1e9).toFixed(0)} GB` : `${(b / 1e9).toFixed(1)} GB`);
</script>

<Widget
  title="Fitting a model on GPUs"
  subtitle="Per-GPU memory for training with bf16 mixed precision and Adam (16 bytes per parameter), split across GPUs. The dashed line is an 80 GB GPU."
  onreset={() => {
    size = 70;
    logDp = 3;
    tp = pp = 1;
    zero = 0;
    recompute = 'yes';
  }}
>
  {#snippet controls()}
    <Segmented label="Parameters" size="sm" options={SIZES.map((s) => ({ value: s, label: `${s} B` }))} bind:value={size} />
    <Segmented label="ZeRO stage" size="sm" options={[0, 1, 2, 3].map((z) => ({ value: z, label: `${z}` }))} bind:value={zero} />
    <div class="sl"><Slider label="Data-parallel GPUs" min={0} max={10} step={1} value={logDp} oninput={(v) => (logDp = v)} format={() => `${dp}`} /></div>
    <Segmented label="Tensor-parallel" size="sm" options={[1, 2, 4, 8].map((v) => ({ value: v, label: `${v}` }))} bind:value={tp} />
    <Segmented label="Pipeline stages" size="sm" options={[1, 2, 4, 8, 16].map((v) => ({ value: v, label: `${v}` }))} bind:value={pp} />
    <Segmented label="Activations" size="sm" options={[{ value: 'yes', label: 'recomputed' }, { value: 'no', label: 'stored' }]} bind:value={recompute} />
  {/snippet}

  {#if mine}<p class="mine ui">Using your memoryPerGpu().</p>{/if}
  <p class="cfg ui">{size} B parameters · ZeRO stage {zero} · {dp} data-parallel × {tp} tensor-parallel × {pp} pipeline stages · activations {recompute === 'yes' ? 'recomputed' : 'stored'} (one 4,096-token sequence)</p>
  <div class="bar" role="img" aria-label="Memory per GPU">
    {#each parts as p (p.label)}<div class="seg" style:width="{(p.v / scale) * 100}%" style:background={p.c} title="{p.label}: {gb(p.v)}"></div>{/each}
    <div class="limit" style:left="{(80e9 / scale) * 100}%"></div>
  </div>
  <div class="legend ui">{#each parts as p (p.label)}<span><i style:background={p.c}></i>{p.label} {gb(p.v)}</span>{/each}</div>
  <p class="note ui" class:bad={total > 80e9}>
    <strong class="num">{gb(total)}</strong> per GPU on {(dp * tp * pp).toLocaleString('en-GB')} GPUs — {total > 80e9 ? 'does not fit on an 80 GB GPU' : 'fits on an 80 GB GPU'}.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 10rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .cfg {
    font-size: 0.75rem;
    color: var(--ink-3);
    margin: 0 0 0.4rem;
  }
  .bar {
    position: relative;
    display: flex;
    height: 2rem;
    background: var(--surface-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .seg {
    height: 100%;
    transition: width 150ms;
  }
  .limit {
    position: absolute;
    top: -2px;
    bottom: -2px;
    border-left: 2px dashed var(--ink);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-size: 0.75rem;
    color: var(--ink-2);
    margin-top: 0.4rem;
  }
  .legend i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.3rem;
    vertical-align: -1px;
  }
  .note {
    font-size: 0.85rem;
    color: var(--good);
    margin: 0.5rem 0 0;
  }
  .note.bad {
    color: var(--critical);
  }
</style>
