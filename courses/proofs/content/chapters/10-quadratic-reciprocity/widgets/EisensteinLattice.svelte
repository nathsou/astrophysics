<!--
  Eisenstein's lattice-point proof of quadratic reciprocity. In the rectangle 1 ≤ x ≤ (p−1)/2,
  1 ≤ y ≤ (q−1)/2, the diagonal y = qx/p passes through no lattice point. Points below it number
  Σ ⌊kq/p⌋, points above it Σ ⌊jp/q⌋, and together they fill the rectangle.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { primesUpTo, jacobi } from '$lib/nt';

  let p = $state(11);
  let q = $state(7);
  const primes = primesUpTo(47).filter((x) => x > 2);
  const P = $derived((p - 1) / 2);
  const Q = $derived((q - 1) / 2);
  const below = $derived(Array.from({ length: P }, (_, i) => Math.floor(((i + 1) * q) / p)).reduce((s, v) => s + v, 0));
  const above = $derived(Array.from({ length: Q }, (_, j) => Math.floor(((j + 1) * p) / q)).reduce((s, v) => s + v, 0));
  const S = 380;
  const step = $derived((S - 50) / Math.max(P, Q, 1));
  const H = $derived((Q + 0.5) * step + 60);
  const X = (x: number) => 30 + x * step;
  const Y = (y: number) => H - 30 - y * step;
  const lp = $derived(p === q ? 0 : jacobi(BigInt(p), BigInt(q)));
  const lq = $derived(p === q ? 0 : jacobi(BigInt(q), BigInt(p)));
</script>

<Widget title="Eisenstein’s lattice" subtitle="Lattice points in a (p − 1)/2 × (q − 1)/2 rectangle, split by the line from the origin to (p/2, q/2). No point lies on the line." onreset={() => ((p = 11), (q = 7))}>
  {#snippet controls()}
    <label class="ctl">p <select bind:value={p}>{#each primes as x (x)}<option value={x}>{x}</option>{/each}</select></label>
    <label class="ctl">q <select bind:value={q}>{#each primes as x (x)}<option value={x}>{x}</option>{/each}</select></label>
  {/snippet}
  {#if p === q}
    <p class="warn">Choose two different primes.</p>
  {:else}
    <div class="wrap">
      <svg viewBox="0 0 {S} {H}" width="100%" style:max-width="{S}px" role="img" aria-label="Lattice points split by a diagonal">
        <rect x={X(0)} y={Y(Q + 0.5)} width={(P + 0.5) * step} height={(Q + 0.5) * step} class="frame" />
        <line x1={X(0)} y1={Y(0)} x2={X(p / 2)} y2={Y(q / 2)} class="diag" />
        {#each Array.from({ length: P }, (_, i) => i + 1) as x (x)}
          {#each Array.from({ length: Q }, (_, j) => j + 1) as y (y)}
            <circle cx={X(x)} cy={Y(y)} r={Math.max(2.5, Math.min(6, step / 4))} class:below={y < (q * x) / p} class:above={y > (q * x) / p} />
          {/each}
        {/each}
        <text x={X((P + 0.5) / 2)} y={H - 8} class="lab">x from 1 to (p−1)/2 = {P}</text>
        <text x="8" y={Y(Q) + 4} class="lab left">y ≤ {Q}</text>
      </svg>
      <div class="info num">
        <p><span class="sw below"></span> below the line: Σ ⌊kq/p⌋ = <strong>{below}</strong></p>
        <p><span class="sw above"></span> above the line: Σ ⌊jp/q⌋ = <strong>{above}</strong></p>
        <p>total: {below} + {above} = {below + above} = {P} × {Q}</p>
        <p class="res">
          (−1)<sup>{below}</sup> · (−1)<sup>{above}</sup> = (−1)<sup>{P}·{Q}</sup> = <strong>{(P * Q) % 2 ? '−1' : '+1'}</strong><br />
          and indeed ({q}/{p})·({p}/{q}) = ({lq > 0 ? '+1' : '−1'})·({lp > 0 ? '+1' : '−1'}) = <strong>{lp * lq > 0 ? '+1' : '−1'}</strong>
        </p>
      </div>
    </div>
  {/if}
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
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: center;
    justify-content: center;
  }
  .frame {
    fill: none;
    stroke: var(--rule-strong);
    stroke-dasharray: 4 3;
  }
  .diag {
    stroke: var(--byrne-ink);
    stroke-width: 2;
  }
  circle {
    stroke: var(--byrne-ink);
    stroke-width: 0.8;
  }
  circle.below {
    fill: var(--byrne-blue);
  }
  circle.above {
    fill: var(--byrne-yellow);
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .lab.left {
    text-anchor: start;
  }
  .info {
    font-size: 0.85rem;
    max-width: 19rem;
  }
  .info p {
    margin: 0.3rem 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .sw {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1px solid var(--byrne-ink);
  }
  .sw.below {
    background: var(--byrne-blue);
  }
  .sw.above {
    background: var(--byrne-yellow);
  }
  .res {
    display: block !important;
    margin-top: 0.6rem !important;
    padding-top: 0.4rem;
    border-top: 1px solid var(--rule);
  }
  .warn {
    color: var(--maybe);
  }
</style>
