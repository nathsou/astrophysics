<!--
  A tree reduction in workgroup memory: at each step the first half of the active threads add in
  the second half, so n values are summed in log2(n) parallel steps.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { mulberry32 } from '@lm/core';

  const uid = $props.id();
  const N = 16;
  const cw = 38, ch = 26, rowGap = 50;
  let seed = $state(3);
  let shown = $state(4);

  const rows = $derived.by(() => {
    const rng = mulberry32(seed);
    let part = Array.from({ length: N }, () => 1 + Math.floor(rng() * 9));
    const out = [{ stride: 0, values: part }];
    for (let stride = N / 2; stride >= 1; stride /= 2) {
      part = part.map((v, i) => (i < stride ? v + part[i + stride]! : v));
      out.push({ stride, values: part });
    }
    return out;
  });
  const total = $derived(rows[0]!.values.reduce((a, b) => a + b, 0));
  const W = N * cw;
  const H = $derived(rows.length * (ch + rowGap));
</script>

<Widget
  title="Summing 16 numbers in 4 steps"
  subtitle="Each row is workgroup memory after one step. Coloured cells are written by an active thread; arrows show which value it added in."
  onreset={() => {
    seed = 3;
    shown = 4;
  }}
>
  {#snippet controls()}
    <Button onclick={() => (shown = Math.max(0, shown - 1))} disabled={shown === 0}>◀ Step</Button>
    <Button onclick={() => (shown = Math.min(4, shown + 1))} disabled={shown === 4}>Step ▶</Button>
    <Button onclick={() => (seed = (seed * 7919 + 1) % 100000)}>New numbers</Button>
  {/snippet}

  <svg viewBox="-70 -4 {W + 76} {H}" role="img" aria-label="Tree reduction: after four halving steps, cell 0 holds the total {total}">
    <defs>
      <marker id="head-{uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" fill="var(--series-2)" />
      </marker>
    </defs>
    {#each rows as row, s (s)}
      {@const y = s * (ch + rowGap)}
      {#if s <= shown}
        <text x={-10} y={y + ch / 2 + 4} class="rl" text-anchor="end">{s === 0 ? 'load' : `stride ${row.stride}`}</text>
        {#each row.values as v, i (i)}
          {@const active = s > 0 && i < row.stride}
          {@const stale = s > 0 && i >= row.stride * 2}
          <rect x={i * cw} y={y} width={cw - 4} height={ch} rx="4" class:active class:stale class="cellr" />
          <text x={i * cw + (cw - 4) / 2} y={y + ch / 2 + 4} text-anchor="middle" class="v" class:active class:stale>{v}</text>
          {#if active}
            {@const py = y - rowGap}
            {@const cx = (k: number) => k * cw + (cw - 4) / 2}
            <line class="down" x1={cx(i)} y1={py + 2} x2={cx(i)} y2={y - 3} />
            <line class="arrow" x1={cx(i + row.stride)} y1={py + 2} x2={cx(i) + 3} y2={y - 4} marker-end="url(#head-{uid})" />
          {/if}
        {/each}
      {/if}
    {/each}
  </svg>

  <p class="note ui">
    {#if shown === 4}
      Thread 0 now holds the total, <strong>{total}</strong>, after log₂16 = 4 steps; a single thread would need 15 additions in a row. With 256 threads per workgroup the tree has 8 levels.
    {:else}
      Between steps every thread waits at <code>workgroupBarrier()</code> — otherwise a thread could read a neighbour’s cell before the neighbour has written it.
    {/if}
  </p>
</Widget>

<style>
  svg {
    width: 100%;
    max-width: 44rem;
    display: block;
    margin: 0 auto;
  }
  .cellr {
    fill: var(--surface-2);
    stroke: var(--border);
  }
  .cellr.active {
    fill: var(--series-1);
    stroke: none;
  }
  .cellr.stale {
    opacity: 0.35;
  }
  .v {
    font: 600 12px var(--font-mono);
    fill: var(--ink);
  }
  .v.active {
    fill: var(--on-accent);
  }
  .v.stale {
    opacity: 0.4;
  }
  .rl {
    font: 11px var(--font-ui);
    fill: var(--ink-2);
  }
  .arrow {
    stroke: var(--series-2);
    stroke-width: 1.2;
    opacity: 0.85;
  }
  .down {
    stroke: var(--ink-3);
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
