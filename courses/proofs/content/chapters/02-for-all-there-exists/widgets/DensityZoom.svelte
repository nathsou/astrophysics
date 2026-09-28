<!--
  The proof that ℚ is dense, as a picture: for a < b, pick n with 1/n < b − a; the grid of
  fractions k/n has spacing smaller than the gap, so one of them must land inside (a, b).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  let a = $state(Math.SQRT2);
  let logGap = $state(-1.2);
  const gap = $derived(10 ** logGap);
  const b = $derived(a + gap);
  const n = $derived(Math.floor(1 / gap) + 1);
  const m = $derived(Math.floor(n * a) + 1);
  // View window: a little either side of [a, b].
  const lo = $derived(a - 1.2 * gap);
  const hi = $derived(b + 1.2 * gap);
  const W = 640;
  const X = (x: number) => ((x - lo) / (hi - lo)) * (W - 40) + 20;
  const ticks = $derived.by(() => {
    const out: number[] = [];
    for (let k = Math.ceil(lo * n); k <= Math.floor(hi * n) && out.length < 200; k++) out.push(k);
    return out;
  });
  const presets = [
    { name: '√2', v: Math.SQRT2 },
    { name: 'π', v: Math.PI },
    { name: 'e', v: Math.E },
  ];
</script>

<Widget title="A rational in every gap" subtitle="Choose a and the width of the gap (a, b). The fractions with denominator n = ⌊1/(b − a)⌋ + 1 are spaced more finely than the gap, so one of them must fall inside it." onreset={() => ((a = Math.SQRT2), (logGap = -1.2))}>
  {#snippet controls()}
    <label class="ctl">a
      {#each presets as p (p.name)}<button class:on={Math.abs(a - p.v) < 1e-12} onclick={() => (a = p.v)}>{p.name}</button>{/each}
    </label>
    <label class="ctl">gap b − a = <strong class="num">{gap.toPrecision(3)}</strong>
      <input type="range" min="-6" max="-0.3" step="0.01" bind:value={logGap} aria-label="Gap size (log scale)" />
    </label>
  {/snippet}
  <svg viewBox="0 0 {W} 110" width="100%" role="img" aria-label="Number line near a, with fractions k/{n} marked">
    <rect x={X(a)} y="30" width={X(b) - X(a)} height="40" class="gap" />
    <line x1="10" x2={W - 10} y1="50" y2="50" class="axis" />
    {#each ticks as k (k)}
      <line x1={X(k / n)} x2={X(k / n)} y1="42" y2="58" class="tick" class:hit={k === m} />
    {/each}
    <circle cx={X(m / n)} cy="50" r="6" class="hitdot" />
    <line x1={X(a)} x2={X(a)} y1="22" y2="78" class="end" />
    <line x1={X(b)} x2={X(b)} y1="22" y2="78" class="end" />
    <text x={X(a)} y="16" class="lab">a</text>
    <text x={X(b)} y="16" class="lab">b</text>
    <text x={X(m / n)} y="98" class="lab hitlab">m/n</text>
  </svg>
  <p class="read ui">
    <Tex tex={`n = ${n},\\quad m = \\lfloor na \\rfloor + 1 = ${m},\\quad a \\approx ${a.toFixed(8)} < \\tfrac{m}{n} = \\tfrac{${m}}{${n}} \\approx ${(m / n).toFixed(8)} < b \\approx ${b.toFixed(8)}`} />
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }
  .ctl button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 5px;
    padding: 0.1rem 0.55rem;
    cursor: pointer;
  }
  .ctl button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .ctl input {
    width: 12rem;
  }
  .gap {
    fill: var(--accent-soft);
  }
  .axis {
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }
  .tick {
    stroke: var(--ink-2);
    stroke-width: 1;
  }
  .tick.hit {
    stroke: var(--byrne-red);
    stroke-width: 2;
  }
  .hitdot {
    fill: var(--byrne-red);
  }
  .end {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .lab {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 15px;
    fill: var(--ink);
    text-anchor: middle;
  }
  .hitlab {
    fill: var(--byrne-red);
  }
  .read {
    text-align: center;
    overflow-x: auto;
    margin: 0.3rem 0 0;
  }
</style>
