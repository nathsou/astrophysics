<!--
  An RNN unrolled through time: the same cell (same weights) at every step, the state flowing
  forward, gradients flowing back — and, with truncation, stopping at chunk boundaries.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  const TEXT = 'To be, or';
  const N = TEXT.length - 1;
  let view = $state<'forward' | 'backward' | 'truncated'>('forward');
  let t = $state(4);
  const chunk = 4;

  const W = 70, X0 = 100;
  const cx = (i: number) => X0 + i * W;
  const show = (c: string) => (c === ' ' ? '␣' : c);
  // In the backward view, the gradient of the loss at step t reaches every earlier step (fading);
  // with truncation it stops at the start of t's chunk.
  const reach = (i: number) => {
    if (view === 'forward') return i <= t ? 1 : 0;
    if (i > t) return 0;
    if (view === 'truncated' && Math.floor(i / chunk) !== Math.floor(t / chunk)) return 0;
    return 0.85 ** (t - i);
  };
</script>

<Widget
  title="One cell, unrolled through time"
  subtitle="The network reads “{TEXT}” one character at a time, predicting the next. Every box is the same cell with the same weights; only the state h changes."
  onreset={() => {
    view = 'forward';
    t = 4;
  }}
>
  {#snippet controls()}
    <Segmented
      label="View"
      size="sm"
      options={[{ value: 'forward', label: 'Forward' }, { value: 'backward', label: 'Backward (BPTT)' }, { value: 'truncated', label: 'Truncated BPTT' }] as { value: typeof view; label: string }[]}
      bind:value={view}
    />
    <div class="ctl"><Slider label="step t" min={0} max={N - 1} step={1} value={t} oninput={(v) => (t = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <svg viewBox="0 0 {cx(N) + 60} 230" role="img" aria-label="Unrolled recurrent network, {view} view, at step {t}">
    <defs>
      <marker id="rnn-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--ink-2)" /></marker>
      <marker id="rnn-grad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--series-2)" /></marker>
    </defs>
    {#if view === 'truncated'}
      {#each { length: Math.ceil(N / chunk) } as _, k (k)}
        <rect x={cx(k * chunk) - 32} y="6" width={Math.min(chunk, N - k * chunk) * W - 6} height="218" rx="8" class="chunk" class:cur={Math.floor(t / chunk) === k} />
        <text x={cx(k * chunk) - 26} y="20" class="clab">chunk {k + 1}</text>
      {/each}
    {/if}
    <text x="4" y="46" class="rowlab">predict</text>
    <text x="4" y="126" class="rowlab">state</text>
    <text x="4" y="206" class="rowlab">read</text>
    {#each { length: N } as _, i (i)}
      {@const a = reach(i)}
      <!-- input -->
      <text x={cx(i)} y="206" text-anchor="middle" class="ch">{show(TEXT[i]!)}</text>
      <line x1={cx(i)} y1="192" x2={cx(i)} y2="148" class="arrow" marker-end="url(#rnn-arrow)" opacity={view === 'forward' ? (i <= t ? 1 : 0.25) : 0.4} />
      <!-- cell -->
      <rect x={cx(i) - 24} y="104" width="48" height="40" rx="7" class="cell" style:fill={view === 'forward' ? (i <= t ? 'color-mix(in srgb, var(--series-1) 35%, var(--surface))' : 'var(--surface)') : `color-mix(in srgb, var(--series-2) ${(a * 60).toFixed(0)}%, var(--surface))`} />
      <text x={cx(i)} y="129" text-anchor="middle" class="h">h<tspan dy="3" font-size="9">{i + 1}</tspan></text>
      <!-- output -->
      <line x1={cx(i)} y1="102" x2={cx(i)} y2="60" class="arrow" marker-end="url(#rnn-arrow)" opacity={view === 'forward' ? (i <= t ? 1 : 0.25) : 0.4} />
      <text x={cx(i)} y="46" text-anchor="middle" class="ch pred" opacity={view === 'forward' ? (i <= t ? 1 : 0.3) : 0.5}>{show(TEXT[i + 1]!)}</text>
      <!-- recurrence -->
      {#if i < N - 1}
        {@const cut = view === 'truncated' && (i + 1) % chunk === 0}
        <line x1={cx(i) + 26} y1="118" x2={cx(i + 1) - 28} y2="118" class="arrow" marker-end="url(#rnn-arrow)" opacity={view === 'forward' ? (i < t ? 1 : 0.25) : 0.5} />
        {#if view !== 'forward' && i < t && reach(i) > 0}
          <line x1={cx(i + 1) - 26} y1="134" x2={cx(i) + 28} y2="134" class="grad" marker-end="url(#rnn-grad)" opacity={Math.max(0.15, reach(i))} />
        {/if}
        {#if cut}<text x={(cx(i) + cx(i + 1)) / 2} y="100" text-anchor="middle" class="cut">✂ no gradient</text>{/if}
      {/if}
    {/each}
    {#if view !== 'forward'}
      <text x={cx(t) + 14} y="33" text-anchor="start" class="loss">← loss at step {t + 1}</text>
    {/if}
  </svg>

  <p class="note ui">
    {#if view === 'forward'}
      Step {t + 1}: the cell combines the character “{show(TEXT[t]!)}” with the state carried from step {t}, producing h<sub>{t + 1}</sub>, a summary of everything read so far, and from it a prediction of the next character (“{show(TEXT[t + 1]!)}”).
    {:else if view === 'backward'}
      Backpropagation through time: the loss at step {t + 1} sends gradient back to every earlier step, through the same weights each time. The fading shows the gradient typically shrinking at each step — the problem the next widget measures.
    {:else}
      Truncated BPTT: the state still flows across chunk boundaries (forward arrows), but gradients stop there. Each training step then costs a fixed amount, however long the text — at the price of never learning dependencies longer than a chunk directly.
    {/if}
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 12rem;
  }
  svg {
    width: 100%;
    max-width: 44rem;
    display: block;
    margin: 0 auto;
  }
  .cell {
    stroke: var(--ink-2);
    stroke-width: 1.2;
  }
  .h {
    font: italic 600 14px var(--font-serif, Georgia, serif);
    fill: var(--ink);
  }
  .ch {
    font: 600 16px var(--font-mono);
    fill: var(--ink);
  }
  .pred {
    fill: var(--ink-2);
  }
  .rowlab {
    font: 10px var(--font-ui);
    fill: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .arrow {
    stroke: var(--ink-2);
    stroke-width: 1.3;
  }
  .grad {
    stroke: var(--series-2);
    stroke-width: 2;
  }
  .chunk {
    fill: none;
    stroke: var(--border);
    stroke-dasharray: 4 3;
  }
  .chunk.cur {
    stroke: var(--series-2);
  }
  .clab {
    font: 10px var(--font-ui);
    fill: var(--ink-3);
  }
  .cut {
    font: 600 9px var(--font-ui);
    fill: var(--critical);
  }
  .loss {
    font: 600 11px var(--font-ui);
    fill: var(--series-2);
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
