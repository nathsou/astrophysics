<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { attnLm, LM } from '../lmTrainer.svelte';

  const REF = [
    { label: 'Kneser–Ney', bits: 2.22 },
    { label: 'LSTM (Ch. 9)', bits: 2.24 },
    { label: 'MLP (Ch. 8)', bits: 2.43 },
  ];
  onMount(() => {
    void attnLm.load();
    return () => attnLm.pause();
  });
  const bits = (n: number) => n / Math.LN2;
  const last = $derived(attnLm.history.at(-1));
</script>

<Widget
  title="An attention-only language model"
  subtitle="Character embeddings plus learned position embeddings, then {attnLm.layers === 1 ? 'one layer' : 'layers'} of x ← x + MultiHeadAttention(x) ({LM.heads} heads, width {LM.C}), then a linear read-out. Context {LM.T} characters; {LM.steps.toLocaleString('en-GB')} Adam steps on your GPU."
  onreset={() => attnLm.setLayers(attnLm.layers)}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (attnLm.running ? attnLm.pause() : attnLm.start())} disabled={attnLm.status !== 'ready' || attnLm.step >= LM.steps}>
      {attnLm.running ? 'Pause' : attnLm.step ? (attnLm.step >= LM.steps ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented label="Layers" size="sm" options={[1, 2].map((v) => ({ value: v, label: v === 1 ? '1 layer' : '2 layers' }))} value={attnLm.layers} onchange={(v) => attnLm.setLayers(v)} />
  {/snippet}

  {#if attnLm.status === 'unsupported'}
    <p class="muted">Needs WebGPU. For reference: one layer reaches about 2.9 bits per character, two layers about 2.6.</p>
  {:else if attnLm.status !== 'ready'}
    <p class="muted">Loading TinyShakespeare and compiling kernels…</p>
  {:else}
    <div class="stats">
      <span>parameters <strong class="num">{attnLm.numParameters.toLocaleString('en-GB')}</strong></span>
      <span>step <strong class="num">{attnLm.step.toLocaleString('en-GB')}</strong> / {LM.steps.toLocaleString('en-GB')}</span>
      <span><strong class="num">{Number.isFinite(attnLm.msPerStep) ? attnLm.msPerStep.toFixed(1) : '…'}</strong> ms/step</span>
      <span>validation <strong class="num">{last ? `${bits(last.val).toFixed(3)} bits/char` : '—'}</strong></span>
    </div>
    <Legend items={[{ label: 'Training (moving average)', color: 'var(--series-1)' }, { label: 'Validation', color: 'var(--series-2)' }, { label: 'Kneser–Ney · LSTM · MLP', color: 'var(--ink-3)', dashed: true }]} />
    <Plot label="Attention-only model loss in bits per character" height={220} x={{ domain: [0, LM.steps], label: 'Adam steps', ticks: 5 }} y={{ domain: [1.8, 6.2], label: 'bits / char', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#each REF as r (r.label)}
          <line x1="0" x2={sx(LM.steps)} y1={sy(r.bits)} y2={sy(r.bits)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {/each}
        {#if attnLm.history.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + attnLm.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.train)))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + attnLm.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.val)))}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const h = attnLm.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
        <div class="num">step {h.step}: train {bits(h.train).toFixed(3)} · val {bits(h.val).toFixed(3)} bits/char</div>
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }
  .stats strong {
    color: var(--ink);
  }
  .muted {
    color: var(--ink-3);
  }
</style>
