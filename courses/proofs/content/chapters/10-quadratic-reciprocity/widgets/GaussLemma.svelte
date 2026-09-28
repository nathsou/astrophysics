<!--
  Gauss's lemma: (a/p) = (−1)^μ, where μ counts how many of a, 2a, …, ((p−1)/2)·a have their least
  positive remainder mod p in the upper half, above p/2.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { jacobi, primesUpTo } from '$lib/nt';

  let p = $state(13);
  let a = $state(5);
  const primes = primesUpTo(60).filter((x) => x > 2);
  const half = $derived((p - 1) / 2);
  const items = $derived(Array.from({ length: half }, (_, i) => (a * (i + 1)) % p));
  const mu = $derived(items.filter((r) => r > p / 2).length);
  const legendre = $derived(a % p === 0 ? 0 : jacobi(BigInt(a), BigInt(p)));
  const W = 620;
  const X = (r: number) => 20 + (r / p) * (W - 40);
</script>

<Widget title="Gauss’s lemma" subtitle="Multiply a by 1, 2, …, (p − 1)/2 and reduce modulo p. Count the results that land above p/2. Their parity decides whether a is a square." onreset={() => ((p = 13), (a = 5))}>
  {#snippet controls()}
    <label class="ctl">p <select bind:value={p}>{#each primes as q (q)}<option value={q}>{q}</option>{/each}</select></label>
    <label class="ctl">a <input type="range" min="1" max={p - 1} bind:value={a} /> <strong>{a}</strong></label>
  {/snippet}
  <svg viewBox="0 0 {W} 90" width="100%" role="img" aria-label="Remainders of multiples of {a} modulo {p}">
    <rect x={X(p / 2)} y="20" width={X(p) - X(p / 2)} height="40" class="upper" />
    <line x1={X(0)} x2={X(p)} y1="40" y2="40" class="axis" />
    {#each Array.from({ length: p + 1 }, (_, i) => i) as t (t)}
      <line x1={X(t)} x2={X(t)} y1="36" y2="44" class="tick" />
    {/each}
    <line x1={X(p / 2)} x2={X(p / 2)} y1="16" y2="64" class="mid" />
    <text x={X(p / 2)} y="12" class="lab">p/2</text>
    <text x={X(0)} y="78" class="lab">0</text>
    <text x={X(p)} y="78" class="lab">{p}</text>
    {#each items as r, i (i)}
      <g class="dot" class:up={r > p / 2} style:transform="translate({X(r)}px, 40px)">
        <circle r="9" />
        <text y="4">{i + 1}</text>
      </g>
    {/each}
  </svg>
  <p class="read num">
    k·{a} mod {p} for k = 1…{half}: {items.join(', ')} → μ = <strong>{mu}</strong> in the upper half, so (−1)<sup>μ</sup> = {mu % 2 ? '−1' : '+1'}.
    Check: {a} {legendre === 1 ? 'is' : 'is not'} a square modulo {p}{legendre === 1 ? ` (${a} ≡ ${Array.from({ length: p }, (_, x) => x).find((x) => (x * x) % p === a % p)}²)` : ''}.
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select {
    font: inherit;
    padding: 0.1rem 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .upper {
    fill: color-mix(in srgb, var(--byrne-red) 12%, transparent);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .tick {
    stroke: var(--ink-3);
  }
  .mid {
    stroke: var(--byrne-red);
    stroke-dasharray: 4 3;
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .dot {
    transition: transform 0.4s ease;
  }
  .dot circle {
    fill: var(--byrne-blue);
    stroke: var(--byrne-ink);
  }
  .dot.up circle {
    fill: var(--byrne-red);
  }
  .dot text {
    font-size: 10px;
    fill: white;
    text-anchor: middle;
    font-family: var(--font-ui);
    font-weight: 700;
  }
  .read {
    font-size: 0.85rem;
    margin: 0.3rem 0 0;
  }
</style>
