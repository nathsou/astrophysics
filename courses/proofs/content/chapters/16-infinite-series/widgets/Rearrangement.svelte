<!--
  Riemann's rearrangement theorem: the terms of 1 − 1/2 + 1/3 − 1/4 + ⋯ (sum ln 2) can be
  reordered to add up to any number you like. Greedy rule: add unused positive terms while below
  the target, unused negative terms while above.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let target = $state(1.5);
  let terms = $state(400);

  const run = $derived.by(() => {
    let p = 1; // next odd denominator
    let q = 2; // next even denominator
    let s = 0;
    const sums: number[] = [];
    const used: string[] = [];
    for (let i = 0; i < terms; i++) {
      if (s <= target) {
        s += 1 / p;
        if (used.length < 14) used.push(`+1/${p}`);
        p += 2;
      } else {
        s -= 1 / q;
        if (used.length < 14) used.push(`−1/${q}`);
        q += 2;
      }
      sums.push(s);
    }
    return { sums, used };
  });
  const natural = $derived.by(() => {
    let s = 0;
    return Array.from({ length: terms }, (_, i) => (s += (i % 2 === 0 ? 1 : -1) / (i + 1)));
  });

  const W = 620;
  const H = 240;
  const lo = $derived(Math.min(-0.2, target - 0.6, ...run.sums.slice(0, 50)));
  const hi = $derived(Math.max(1.8, target + 0.6, ...run.sums.slice(0, 50)));
  const X = (i: number) => 30 + (i / (terms - 1)) * (W - 45);
  const Y = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - 25);
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
</script>

<Widget title="Rearranging a series" subtitle="Blue: 1 − ½ + ⅓ − ¼ + ⋯ in its usual order, converging to ln 2 ≈ 0.693. Red: the same terms, each used exactly once, reordered to converge to your target." onreset={() => ((target = 1.5), (terms = 400))}>
  {#snippet controls()}
    <label class="ctl">target = <strong class="num">{target.toFixed(2)}</strong> <input type="range" min="-2" max="3" step="0.01" bind:value={target} /></label>
    <label class="ctl">terms <input type="range" min="50" max="3000" step="50" bind:value={terms} /> <strong class="num">{terms}</strong></label>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Partial sums of the alternating harmonic series in two orders">
    <line x1="30" x2={W - 15} y1={Y(target)} y2={Y(target)} class="tgt" />
    <line x1="30" x2={W - 15} y1={Y(Math.LN2)} y2={Y(Math.LN2)} class="ln2" />
    <path d={path(natural)} class="nat" />
    <path d={path(run.sums)} class="re" />
    <text x="26" y={Y(target) + 4} class="lab">{target.toFixed(2)}</text>
    <text x="26" y={Y(Math.LN2) + 4} class="lab">ln 2</text>
  </svg>
  <p class="read num">Order used: {run.used.join(' ')} … &nbsp; Sum after {terms} terms: <strong>{run.sums.at(-1)!.toFixed(4)}</strong></p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .tgt {
    stroke: var(--byrne-red);
    stroke-dasharray: 5 4;
  }
  .ln2 {
    stroke: var(--byrne-blue);
    stroke-dasharray: 5 4;
  }
  .nat {
    fill: none;
    stroke: var(--byrne-blue);
    stroke-width: 1.2;
  }
  .re {
    fill: none;
    stroke: var(--byrne-red);
    stroke-width: 1.2;
  }
  .lab {
    font-size: 10px;
    fill: var(--ink-2);
    text-anchor: end;
    font-family: var(--font-ui);
  }
  .read {
    font-size: 0.8rem;
    margin: 0.2rem 0 0;
    color: var(--ink-2);
  }
</style>
