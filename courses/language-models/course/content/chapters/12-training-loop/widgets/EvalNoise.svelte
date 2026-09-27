<!--
  How much validation data do you need? Resample the model's per-token losses: the loss measured on
  K tokens scatters around the true value with standard deviation σ/√K (Appendix C).
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { run } from '../dashboard.svelte';

  let losses = $state.raw<Float32Array | null>(null);
  let step = $state(0);
  let K = $state(2000);
  let busy = $state(false);
  const DRAWS = 600, BINS = 40;

  async function measure() {
    busy = true;
    const nats = await run.valLosses();
    losses = nats.map((v) => v / Math.LN2);
    step = run.step;
    busy = false;
  }
  const stats = $derived.by(() => {
    if (!losses) return null;
    const n = losses.length;
    let m = 0;
    for (const v of losses) m += v / n;
    let v2 = 0;
    for (const v of losses) v2 += (v - m) ** 2 / n;
    return { n, mean: m, sd: Math.sqrt(v2) };
  });
  const estimates = $derived.by(() => {
    if (!losses) return [];
    const rng = mulberry32(K);
    // Keep the work bounded at large K (at most a few million random draws).
    return Array.from({ length: Math.max(100, Math.min(DRAWS, Math.floor(4e6 / K))) }, () => {
      let s = 0;
      for (let i = 0; i < K; i++) s += losses![Math.floor(rng() * losses!.length)]!;
      return s / K;
    });
  });
  const se = $derived(stats ? stats.sd / Math.sqrt(K) : 0);
  const lo = $derived(stats ? stats.mean - 4.5 * se : 0), hi = $derived(stats ? stats.mean + 4.5 * se : 1);
  const hist = $derived.by(() => {
    const c = new Array<number>(BINS).fill(0);
    for (const e of estimates) {
      const b = Math.floor(((e - lo) / (hi - lo)) * BINS);
      if (b >= 0 && b < BINS) c[b]!++;
    }
    return c;
  });
  const needed = (delta: number) => (stats ? Math.ceil((8 * stats.sd ** 2) / delta ** 2) : 0);
</script>

<Widget
  title="How many tokens does an evaluation need?"
  subtitle="Score the current model on every validation token, then pretend you had only K of them: draw K at random, hundreds of times, and look at how the estimates scatter."
>
  {#snippet controls()}
    <Button variant="primary" onclick={measure} disabled={busy || run.status !== 'ready'}>{losses ? 'Re-score with current weights' : 'Score the validation split'}</Button>
    {#if losses}<div class="ctl"><Slider label="tokens per estimate K" min={10} max={100000} step={1} log value={K} oninput={(v) => (K = Math.round(v))} format={(v) => Math.round(v).toLocaleString('en-GB')} /></div>{/if}
  {/snippet}

  {#if !losses || !stats}
    <p class="muted">Train the dashboard’s model for a while first (the effect is clearest on a trained model), then score the validation split.</p>
  {:else}
    <p class="facts num ui">
      {stats.n.toLocaleString('en-GB')} validation tokens (model at step {step.toLocaleString('en-GB')}): mean loss <strong>{stats.mean.toFixed(3)} bits</strong>, but single tokens vary enormously — standard deviation σ = <strong>{stats.sd.toFixed(2)} bits</strong>.
    </p>
    <Plot label="Distribution of loss estimates from K tokens" height={200} x={{ domain: [lo, hi], label: `loss estimated from ${K.toLocaleString('en-GB')} tokens (bits/char)`, ticks: 6 }} y={{ domain: [0, Math.max(...hist) * 1.15 || 1], ticks: 3, label: 'draws' }}>
      {#snippet marks({ sx, sy })}
        {#each hist as h, i (i)}
          <rect x={sx(lo + ((hi - lo) * i) / BINS) + 1} width={Math.max(0.5, sx(lo + ((hi - lo) * (i + 1)) / BINS) - sx(lo + ((hi - lo) * i) / BINS) - 2)} y={sy(h)} height={Math.max(0, sy(0) - sy(h))} fill="var(--series-1)" rx="1.5" />
        {/each}
        <line x1={sx(stats!.mean)} x2={sx(stats!.mean)} y1={sy(0)} y2="0" stroke="var(--ink)" stroke-dasharray="4 3" />
      {/snippet}
    </Plot>
    <p class="note num ui">
      Standard error σ/√K = <strong>{se.toFixed(4)} bits</strong>. To tell apart two models whose losses differ by 0.01 bits with two-standard-error confidence, you need about <strong>{needed(0.01).toLocaleString('en-GB')}</strong> tokens each; for 0.1 bits, about {needed(0.1).toLocaleString('en-GB')}. (Scoring both models on the <em>same</em> tokens helps a lot: the per-token differences vary much less than the losses themselves.)
    </p>
  {/if}
</Widget>

<style>
  .ctl {
    flex: 0 1 16rem;
  }
  .muted {
    color: var(--ink-3);
  }
  .facts,
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .note {
    margin: 0.6rem 0 0;
  }
</style>
