<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { mlp, BASELINES, DEFAULT_CONFIG, type Act, type Init } from '../trainer.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  onMount(() => {
    void mlp.load();
  });

  const bits = (nats: number) => nats / Math.LN2;
  const last = $derived(mlp.history.at(-1));
  const ymax = $derived(Math.min(8, Math.max(4.8, ...mlp.history.map((h) => bits(h.val)))) + 0.2);
</script>

<Widget
  title="Train an MLP language model"
  subtitle="Bengio’s architecture on TinyShakespeare, trained with SGD by the course library in your browser. Changing the architecture restarts training. The dashed lines are Chapter 2’s models."
  onreset={() => mlp.reconfigure({ ...DEFAULT_CONFIG })}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (mlp.running ? mlp.pause() : mlp.start())} disabled={!mlp.ready || mlp.diverged}>
      {mlp.running ? 'Pause' : mlp.step ? 'Resume' : 'Train'}
    </Button>
    {#if !compact}
      <div class="grp">
        <span class="lbl">Context n</span>
        <Segmented label="Context" size="sm" options={[3, 8, 16].map((v) => ({ value: v, label: String(v) }))} value={mlp.config.n} onchange={(v) => mlp.reconfigure({ n: v })} />
      </div>
      <div class="grp">
        <span class="lbl">Hidden units</span>
        <Segmented label="Hidden units" size="sm" options={[32, 128, 512].map((v) => ({ value: v, label: String(v) }))} value={mlp.config.h} onchange={(v) => mlp.reconfigure({ h: v })} />
      </div>
      <div class="grp">
        <span class="lbl">Initialisation</span>
        <Segmented label="Initialisation" size="sm" options={[{ value: 'kaiming', label: 'Scaled' }, { value: 'naive', label: 'Naïve N(0, 1)' }] as { value: Init; label: string }[]} value={mlp.config.init} onchange={(v) => mlp.reconfigure({ init: v })} />
      </div>
      <div class="grp">
        <span class="lbl">Non-linearity</span>
        <Segmented label="Non-linearity" size="sm" options={[{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'ReLU' }, { value: 'none', label: 'none' }] as { value: Act; label: string }[]} value={mlp.config.act} onchange={(v) => mlp.reconfigure({ act: v })} />
      </div>
      <Toggle checked={mlp.config.norm} onchange={(v) => mlp.reconfigure({ norm: v })} label="LayerNorm" />
      <div class="ctl"><Slider label="learning rate" min={0.005} max={2} step={0.005} log value={mlp.config.lr} oninput={(v) => (mlp.config.lr = v)} format={(v) => v.toFixed(3)} /></div>
    {/if}
  {/snippet}

  {#if !mlp.ready}
    <p class="muted">Loading TinyShakespeare…</p>
  {:else}
    <div class="stats">
      <span>step <strong class="num">{mlp.step.toLocaleString('en-GB')}</strong></span>
      <span>parameters <strong class="num">{mlp.numParameters.toLocaleString('en-GB')}</strong></span>
      <span>initial loss <strong class="num">{mlp.initialLoss.toFixed(2)} nats</strong> (uniform: {Math.log(mlp.V).toFixed(2)})</span>
      <span>validation <strong class="num">{last ? `${bits(last.val).toFixed(3)} bits/char` : '—'}</strong></span>
      {#if mlp.diverged}<span class="bad">diverged — lower the learning rate and reset</span>{/if}
    </div>
    <Legend
      items={[
        { label: 'Training (moving average)', color: 'var(--series-1)' },
        { label: 'Validation', color: 'var(--series-2)' },
        { label: 'Chapter 2: bigram / Kneser–Ney 6-gram', color: 'var(--ink-3)', dashed: true },
      ]}
    />
    <Plot
      label="MLP training and validation loss in bits per character"
      height={compact ? 200 : 260}
      x={{ domain: [0, Math.max(1000, mlp.step)], label: 'SGD steps', nice: true, ticks: 5 }}
      y={{ domain: [2, ymax], label: 'bits / char', ticks: 5 }}
    >
      {#snippet marks({ sx, sy })}
        {#each [BASELINES.bigram, BASELINES.kneserNey] as b (b)}
          <line x1="0" x2={sx(Math.max(1000, mlp.step))} y1={sy(b)} y2={sy(b)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {/each}
        {#if mlp.history.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + mlp.history.map((h) => `${sx(h.step)},${sy(Math.min(ymax, bits(h.train)))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + mlp.history.map((h) => `${sx(h.step)},${sy(Math.min(ymax, bits(h.val)))}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const h = mlp.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
        <div class="num">step {h.step}: train {bits(h.train).toFixed(3)} · val {bits(h.val).toFixed(3)} bits/char</div>
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .ctl {
    flex: 0 1 10rem;
  }
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
  .bad {
    color: var(--critical);
    font-weight: 600;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
