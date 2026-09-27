<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { rnn, CONFIG, BASELINES } from '../trainer.svelte';
  import type { Cell } from '../model';

  onMount(() => {
    void rnn.load();
    return () => rnn.pause();
  });

  const bits = (nats: number) => nats / Math.LN2;
  const last = $derived(rnn.history.at(-1));
  let sample = $state('');
  let sampling = $state(false);
</script>

<Widget
  title="Train a character-level recurrent network"
  subtitle="{CONFIG.H} hidden units, trained on your GPU with truncated backpropagation through time: {CONFIG.B} parallel streams through the text, {CONFIG.T} characters per chunk, {CONFIG.steps.toLocaleString('en-GB')} steps of Adam. Dashed lines: Kneser–Ney (Chapter 2) and the GPU-trained MLP (Chapter 8)."
  onreset={() => rnn.setCell(rnn.cell)}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (rnn.running ? rnn.pause() : rnn.start())} disabled={rnn.status !== 'ready' || rnn.step >= CONFIG.steps}>
      {rnn.running ? 'Pause' : rnn.step ? (rnn.step >= CONFIG.steps ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented
      label="Cell"
      size="sm"
      options={[{ value: 'rnn', label: 'Vanilla RNN' }, { value: 'lstm', label: 'LSTM' }] as { value: Cell; label: string }[]}
      value={rnn.cell}
      onchange={(v) => rnn.setCell(v)}
    />
  {/snippet}

  {#if rnn.status === 'unsupported'}
    <p class="muted">This browser does not expose WebGPU, which this trainer needs. For reference: a 256-unit LSTM reaches about 2.24 bits per character in 2,000 steps, and a vanilla RNN about 2.32. The PyTorch lab below reproduces both.</p>
  {:else if rnn.status !== 'ready'}
    <p class="muted">Loading TinyShakespeare and compiling kernels…</p>
  {:else}
    <div class="stats">
      <span>{rnn.cell === 'lstm' ? 'LSTM' : 'RNN'}, parameters <strong class="num">{rnn.numParameters.toLocaleString('en-GB')}</strong></span>
      <span>step <strong class="num">{rnn.step.toLocaleString('en-GB')}</strong> / {CONFIG.steps.toLocaleString('en-GB')}</span>
      <span><strong class="num">{Number.isFinite(rnn.msPerStep) ? rnn.msPerStep.toFixed(1) : '…'}</strong> ms/step</span>
      <span>validation <strong class="num">{last ? `${bits(last.val).toFixed(3)} bits/char` : '—'}</strong></span>
    </div>
    <Legend
      items={[
        { label: 'Training (moving average)', color: 'var(--series-1)' },
        { label: 'Validation (whole split)', color: 'var(--series-2)' },
        { label: 'Kneser–Ney 2.22 · GPU MLP 2.43', color: 'var(--ink-3)', dashed: true },
      ]}
    />
    <Plot label="Recurrent network loss in bits per character" height={240} x={{ domain: [0, CONFIG.steps], label: 'Adam steps', ticks: 5 }} y={{ domain: [1.5, 6.2], label: 'bits / char', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#each [BASELINES.kneserNey, BASELINES.mlpGpu] as b (b)}
          <line x1="0" x2={sx(CONFIG.steps)} y1={sy(b)} y2={sy(b)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {/each}
        {#if rnn.history.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + rnn.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.train)))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + rnn.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.val)))}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const h = rnn.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
        <div class="num">step {h.step}: train {bits(h.train).toFixed(3)} · val {bits(h.val).toFixed(3)} bits/char</div>
      {/snippet}
    </Plot>
    <div class="sample">
      <Button
        size="sm"
        disabled={sampling}
        onclick={async () => {
          sampling = true;
          sample = await rnn.sample('ROMEO:\n', 300);
          sampling = false;
        }}>Sample 300 characters</Button
      >
      {#if sample}<pre class="out">ROMEO:<br />{sample}</pre>{/if}
    </div>
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
  .sample {
    margin-top: 0.8rem;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    white-space: pre-wrap;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
  }
</style>
