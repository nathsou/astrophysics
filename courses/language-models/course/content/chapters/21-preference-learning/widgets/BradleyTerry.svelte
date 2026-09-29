<!--
  Learning rewards from comparisons. Six responses have hidden true rewards; a simulated rater compares random
  pairs and prefers A to B with probability σ(r_A − r_B). Gradient descent on the Bradley–Terry loss recovers
  the rewards — up to a constant, since only differences are ever observed. Uses the learner's
  preferProbability().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  const reference = (rA: number, rB: number) => 1 / (1 + Math.exp(-(rA - rB)));
  const prob = $derived(impl.get('pref.prob', reference));
  const mine = $derived(impl.isMine('pref.prob'));

  const TRUE = [2.1, 1.2, 0.6, -0.2, -1.0, -2.7];
  const NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];
  let rng = mulberry32(21);
  let comparisons = $state<[number, number][]>([]); // [winner, loser]
  let fitted = $state<number[]>(TRUE.map(() => 0));

  function compare(n: number) {
    const add: [number, number][] = [];
    for (let t = 0; t < n; t++) {
      const i = Math.floor(rng() * 6);
      let j = Math.floor(rng() * 5);
      if (j >= i) j++;
      add.push(rng() < reference(TRUE[i]!, TRUE[j]!) ? [i, j] : [j, i]);
    }
    comparisons = [...comparisons, ...add];
    fit();
  }
  function fit() {
    // Full-batch gradient descent on the mean Bradley–Terry loss, with a little L2 to keep a fixed scale.
    const r = TRUE.map(() => 0);
    const N = comparisons.length;
    for (let it = 0; it < 300; it++) {
      const g = r.map((v) => 0.01 * v);
      for (const [w, l] of comparisons) {
        let p: number;
        try {
          p = prob(r[w]!, r[l]!);
        } catch {
          p = reference(r[w]!, r[l]!);
        }
        // d/dr_w of −log σ(r_w − r_l) is −(1 − σ).
        g[w]! -= (1 - p) / N;
        g[l]! += (1 - p) / N;
      }
      for (let k = 0; k < r.length; k++) r[k]! -= 4 * g[k]!;
    }
    // Only differences are identified: centre both on zero to compare.
    const m = r.reduce((a, b) => a + b, 0) / r.length;
    fitted = r.map((v) => v - m);
  }
  const trueMean = TRUE.reduce((a, b) => a + b, 0) / TRUE.length;
  const centred = TRUE.map((v) => v - trueMean);
  const scale = 3.2;
  const agree = $derived.by(() => {
    if (!comparisons.length) return null;
    let right = 0, total = 0;
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++, total++) right += Number(Math.sign(fitted[i]! - fitted[j]!) === Math.sign(TRUE[i]! - TRUE[j]!));
    return `${right} of ${total}`;
  });
  function reset() {
    rng = mulberry32(21);
    comparisons = [];
    fitted = TRUE.map(() => 0);
  }
</script>

<Widget
  title="Rewards from comparisons"
  subtitle="Six responses with hidden rewards. A rater compares random pairs, preferring the better one with probability σ(difference) — sometimes getting it ‘wrong’. Fitting the Bradley–Terry model to the comparisons recovers the rewards."
  onreset={reset}
>
  {#snippet controls()}
    <Button size="sm" onclick={() => compare(5)}>+5 comparisons</Button>
    <Button size="sm" onclick={() => compare(50)}>+50</Button>
    <Button size="sm" onclick={() => compare(500)}>+500</Button>
  {/snippet}

  {#if mine}<p class="mine ui">Using your preferProbability().</p>{/if}
  <div class="chart">
    <div class="zero"></div>
    {#each NAMES as n, i (n)}
      <div class="item">
        <div class="bars">
          <div class="bar truth" style:height="{(Math.abs(centred[i]!) / scale) * 50}%" style:bottom={centred[i]! >= 0 ? '50%' : `${50 - (Math.abs(centred[i]!) / scale) * 50}%`}></div>
          <div class="bar fit" style:height="{(Math.min(scale, Math.abs(fitted[i]!)) / scale) * 50}%" style:bottom={fitted[i]! >= 0 ? '50%' : `${50 - (Math.min(scale, Math.abs(fitted[i]!)) / scale) * 50}%`}></div>
        </div>
        <span class="lbl ui">{n}</span>
      </div>
    {/each}
  </div>
  <div class="legend ui"><span><i class="sw truth"></i>true reward (centred)</span><span><i class="sw fit"></i>fitted from comparisons</span></div>
  <p class="note ui">
    <strong class="num">{comparisons.length}</strong> comparisons{#if comparisons.length}; the last: {NAMES[comparisons.at(-1)![0]]} preferred to {NAMES[comparisons.at(-1)![1]]}{/if}.
    {#if agree}Fitted rewards order <strong class="num">{agree}</strong> pairs correctly.{/if}
    Adding the same constant to every reward changes no prediction, so the fit is shown centred on zero.
  </p>
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .chart {
    position: relative;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .zero {
    position: absolute;
    left: 0;
    right: 0;
    top: 90px;
    border-top: 1px solid var(--rule);
  }
  .item {
    text-align: center;
  }
  .bars {
    position: relative;
    height: 180px;
  }
  .bar {
    position: absolute;
    width: 34%;
    border-radius: 2px;
    transition: height 250ms, bottom 250ms;
  }
  .truth {
    left: 14%;
    background: var(--ink-3);
    opacity: 0.45;
  }
  .fit {
    left: 52%;
    background: var(--series-1);
  }
  .lbl {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .sw {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.3rem;
    vertical-align: -1px;
  }
  .sw.truth {
    background: var(--ink-3);
    opacity: 0.45;
  }
  .sw.fit {
    background: var(--series-1);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
