<!--
  At every moment there are two opposite points on the equator with exactly the same temperature.
  Drag the temperature profile (or randomise it); g(θ) = T(θ) − T(θ + 180°) changes sign between θ
  and θ + 180°, so by the intermediate value theorem it vanishes somewhere.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let coeffs = $state<number[]>([0.8, 0.3, -0.5, 0.6, 0.2, -0.3]);
  let phase = $state<number[]>([0.3, 1.2, 2.2, 0.7, 2.9, 1.6]);
  let theta = $state(40);

  const T = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    let s = 15;
    coeffs.forEach((c, k) => (s += 8 * c * Math.cos((k + 1) * t + phase[k]!)));
    return s;
  };
  const g = (deg: number) => T(deg) - T(deg + 180);
  const zeros = $derived.by(() => {
    const out: number[] = [];
    let prev = g(0);
    for (let d = 0.5; d <= 180; d += 0.5) {
      const cur = g(d);
      if (Math.sign(cur) !== Math.sign(prev) || cur === 0) {
        let [lo, hi] = [d - 0.5, d];
        for (let i = 0; i < 40; i++) {
          const m = (lo + hi) / 2;
          if (Math.sign(g(m)) === Math.sign(g(lo))) lo = m;
          else hi = m;
        }
        out.push((lo + hi) / 2);
      }
      prev = cur;
    }
    return out;
  });
  function randomise() {
    coeffs = coeffs.map(() => Math.random() * 2 - 1);
    phase = phase.map(() => Math.random() * 6.28);
  }

  const R = 110;
  const C = 140;
  const colour = (temp: number) => `hsl(${Math.max(0, Math.min(240, 240 - (temp + 5) * 6))} 75% 55%)`;
  const P = (deg: number, r = R) => [C + r * Math.cos((deg * Math.PI) / 180), C - r * Math.sin((deg * Math.PI) / 180)] as const;
  const W2 = 320;
  const GX = (d: number) => 10 + (d / 360) * (W2 - 20);
  const gMax = $derived(Math.max(...Array.from({ length: 73 }, (_, i) => Math.abs(g(i * 5)))) || 1);
  const GY = (v: number) => 100 - (v / gMax) * 80;
  const gPath = $derived(
    Array.from({ length: 181 }, (_, i) => i * 2)
      .map((d, i) => `${i ? 'L' : 'M'}${GX(d).toFixed(1)},${GY(g(d)).toFixed(1)}`)
      .join(''),
  );
</script>

<Widget title="Opposite points, same temperature" subtitle="A temperature profile around the equator. Drag the pointer: the two ends of the diameter show T(θ) and T(θ + 180°). Their difference g changes sign, so somewhere it is zero." onreset={() => (theta = 40)}>
  {#snippet controls()}
    <label class="ctl">θ = <strong class="num">{theta.toFixed(0)}°</strong> <input type="range" min="0" max="360" bind:value={theta} /></label>
    <button onclick={randomise}>New weather</button>
    {#if zeros.length}<button onclick={() => (theta = zeros[0]!)}>Jump to a solution</button>{/if}
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {2 * C} {2 * C + 6}" width="100%" style:max-width="{2 * C}px" role="img" aria-label="Temperature around a circle">
      {#each Array.from({ length: 120 }, (_, i) => i * 3) as d (d)}
        {@const [x1, y1] = P(d)}
        {@const [x2, y2] = P(d + 3)}
        <line {x1} {y1} {x2} {y2} stroke={colour(T(d))} stroke-width="16" />
      {/each}
      {#each zeros as z (z)}
        {@const [x1, y1] = P(z, R + 14)}
        {@const [x2, y2] = P(z + 180, R + 14)}
        <line {x1} {y1} {x2} {y2} class="sol" />
      {/each}
      {#if true}
        {@const [x1, y1] = P(theta)}
        {@const [x2, y2] = P(theta + 180)}
        <line {x1} {y1} {x2} {y2} class="diam" />
        <circle cx={x1} cy={y1} r="9" class="end" />
        <circle cx={x2} cy={y2} r="9" class="end" />
        <text x={C} y={2 * C - 2} class="lab">T(θ) = {T(theta).toFixed(1)}°, T(θ + 180°) = {T(theta + 180).toFixed(1)}°</text>
      {/if}
    </svg>
    <svg viewBox="0 0 {W2} 200" width="100%" style:max-width="{W2}px" role="img" aria-label="Graph of the difference g">
      <line x1="10" x2={W2 - 10} y1={GY(0)} y2={GY(0)} class="axis" />
      <path d={gPath} class="gline" />
      <line x1={GX(theta % 360)} x2={GX(theta % 360)} y1="15" y2="185" class="cursor" />
      {#each zeros as z (z)}<circle cx={GX(z)} cy={GY(0)} r="4" class="zero" /><circle cx={GX(z + 180)} cy={GY(0)} r="4" class="zero" />{/each}
      <text x={W2 - 10} y="195" class="lab small">θ from 0° to 360°: g(θ) = T(θ) − T(θ + 180°)</text>
    </svg>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .ctl input {
    width: 14rem;
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
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: center;
  }
  .diam {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .sol {
    stroke: var(--ink-3);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .end {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .lab {
    font-size: 12px;
    text-anchor: middle;
    fill: var(--ink);
    font-family: var(--font-ui);
  }
  .lab.small {
    font-size: 9.5px;
    text-anchor: end;
    fill: var(--ink-2);
  }
  .axis {
    stroke: var(--ink-3);
  }
  .gline {
    fill: none;
    stroke: var(--byrne-blue);
    stroke-width: 2;
  }
  .cursor {
    stroke: var(--ink);
    stroke-dasharray: 3 3;
  }
  .zero {
    fill: var(--byrne-red);
  }
</style>
