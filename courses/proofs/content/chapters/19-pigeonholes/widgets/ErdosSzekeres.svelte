<!--
  The Erdős–Szekeres theorem: any n² + 1 distinct numbers contain an increasing or a decreasing
  subsequence of length n + 1. Label each term with (longest increasing run ending there, longest
  decreasing run ending there): the labels are all different, so they can't all fit in an n × n grid.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(3);
  let seq = $state<number[]>([]);
  function shuffle() {
    const m = n * n + 1;
    const a = Array.from({ length: m }, (_, i) => i + 1);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    seq = a;
  }
  $effect(() => {
    void n;
    shuffle();
  });
  const labels = $derived.by(() => {
    const inc: number[] = [];
    const dec: number[] = [];
    seq.forEach((v, i) => {
      inc[i] = 1 + Math.max(0, ...seq.slice(0, i).map((u, j) => (u < v ? inc[j]! : 0)));
      dec[i] = 1 + Math.max(0, ...seq.slice(0, i).map((u, j) => (u > v ? dec[j]! : 0)));
    });
    return seq.map((_, i) => [inc[i]!, dec[i]!] as const);
  });
  const best = $derived.by(() => {
    // Recover one longest monotone subsequence, preferring whichever is ≥ n + 1.
    const target = n + 1;
    const i = labels.findIndex(([a, b]) => a >= target || b >= target);
    if (i < 0) return [] as number[];
    const incMode = labels[i]![0] >= target;
    const chain = [i];
    let need = (incMode ? labels[i]![0] : labels[i]![1]) - 1;
    let cur = i;
    for (let j = i - 1; j >= 0 && need > 0; j--) {
      const ok = incMode ? seq[j]! < seq[cur]! && labels[j]![0] === need : seq[j]! > seq[cur]! && labels[j]![1] === need;
      if (ok) {
        chain.unshift(j);
        cur = j;
        need--;
      }
    }
    return chain;
  });
  const W = 620;
  const H = 200;
  const X = (i: number) => 30 + (i / Math.max(1, seq.length - 1)) * (W - 60);
  const Y = (v: number) => H - 25 - (v / (seq.length + 1)) * (H - 40);
</script>

<Widget title="Monotone subsequences" subtitle="A shuffle of 1 … n² + 1. Each term is labelled (i, d): the longest increasing and decreasing subsequences ending there. No two labels are equal — so some label exceeds n, and a monotone subsequence of length n + 1 appears (highlighted)." onreset={shuffle}>
  {#snippet controls()}
    <label class="ctl">n = <strong>{n}</strong> <input type="range" min="2" max="5" bind:value={n} /></label>
    <button onclick={shuffle}>Shuffle</button>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="A sequence with a long monotone subsequence highlighted">
    {#if best.length > 1}
      <path d={best.map((i, k) => `${k ? 'L' : 'M'}${X(i)},${Y(seq[i]!)}`).join('')} class="chain" />
    {/if}
    {#each seq as v, i (i)}
      <circle cx={X(i)} cy={Y(v)} r="6" class="pt" class:on={best.includes(i)} />
      <text x={X(i)} y={Y(v) - 10} class="lab">{labels[i]![0]},{labels[i]![1]}</text>
      <text x={X(i)} y={H - 8} class="val">{v}</text>
    {/each}
  </svg>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .chain {
    fill: none;
    stroke: var(--byrne-red);
    stroke-width: 2.5;
  }
  .pt {
    fill: var(--byrne-blue);
    stroke: var(--byrne-ink);
  }
  .pt.on {
    fill: var(--byrne-red);
  }
  .lab {
    font-size: 9px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .val {
    font-size: 9px;
    fill: var(--ink-3);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
</style>
