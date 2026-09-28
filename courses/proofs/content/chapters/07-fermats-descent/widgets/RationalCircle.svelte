<!--
  Rational points on the unit circle: the line through (−1, 0) with rational slope t meets the
  circle again at ((1 − t²)/(1 + t²), 2t/(1 + t²)). Clearing denominators gives Pythagorean triples.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';
  import { gcd } from '$lib/nt';

  let p = $state(1);
  let q = $state(2);
  let showAll = $state(true);
  const t = $derived(p / q);
  const pt = $derived({ x: (1 - t * t) / (1 + t * t), y: (2 * t) / (1 + t * t) });
  // With t = p/q: x = (q² − p²)/(q² + p²), y = 2pq/(q² + p²).
  const triple = $derived.by(() => {
    let a = q * q - p * p;
    let b = 2 * p * q;
    let c = q * q + p * p;
    const g = Number(gcd(BigInt(a), gcd(BigInt(b), BigInt(c))));
    return { a: Math.abs(a / g), b: b / g, c: c / g, g };
  });

  const S = 300;
  const X = (x: number) => S / 2 + x * (S / 2 - 20);
  const Y = (y: number) => S / 2 - y * (S / 2 - 20);
  // Many rational points: slopes p/q with small q, all quadrants by symmetry.
  const cloud = (() => {
    const out: [number, number][] = [];
    for (let qq = 1; qq <= 24; qq++)
      for (let pp = -10 * qq; pp <= 10 * qq; pp++) {
        if (Number(gcd(BigInt(Math.abs(pp)), BigInt(qq))) !== 1) continue;
        const tt = pp / qq;
        out.push([(1 - tt * tt) / (1 + tt * tt), (2 * tt) / (1 + tt * tt)]);
      }
    return out;
  })();
  // The line through (−1, 0) with slope t, drawn across the view.
  const lineEnd = $derived({ x: 1.25, y: t * (1.25 + 1) });
</script>

<Widget title="Rational points on the circle" subtitle="Draw a line through (−1, 0) with a rational slope t = p/q. It meets the circle again at a point with rational coordinates — and every rational point arises this way." onreset={() => ((p = 1), (q = 2))}>
  {#snippet controls()}
    <label class="ctl">p <input type="range" min="-12" max="12" bind:value={p} /> <strong class="num">{p}</strong></label>
    <label class="ctl">q <input type="range" min="1" max="12" bind:value={q} /> <strong class="num">{q}</strong></label>
    <label class="ctl"><input type="checkbox" bind:checked={showAll} /> show many rational points</label>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {S} {S}" width="100%" style:max-width="{S}px" role="img" aria-label="Unit circle with a line of slope {p}/{q} through (−1, 0)">
      <line x1="0" x2={S} y1={Y(0)} y2={Y(0)} class="axis" />
      <line y1="0" y2={S} x1={X(0)} x2={X(0)} class="axis" />
      <circle cx={X(0)} cy={Y(0)} r={S / 2 - 20} class="circle" />
      {#if showAll}
        {#each cloud as c, i (i)}<circle cx={X(c[0])} cy={Y(c[1])} r="1.6" class="dot" />{/each}
      {/if}
      <line x1={X(-1)} y1={Y(0)} x2={X(lineEnd.x)} y2={Y(lineEnd.y)} class="line" />
      <circle cx={X(-1)} cy={Y(0)} r="5" class="anchor" />
      <circle cx={X(pt.x)} cy={Y(pt.y)} r="6" class="hit" />
    </svg>
    <div class="info">
      <p><Tex tex={`t = \\tfrac{${p}}{${q}}`} /></p>
      <p><Tex tex={`\\left(\\tfrac{${q * q - p * p}}{${q * q + p * p}},\\; \\tfrac{${2 * p * q}}{${q * q + p * p}}\\right)`} /></p>
      <p class="small">is on the circle, because</p>
      <p><Tex tex={`${q * q - p * p < 0 ? `(${q * q - p * p})` : q * q - p * p}^2 + ${2 * p * q < 0 ? `(${2 * p * q})` : 2 * p * q}^2 = ${q * q + p * p}^2`} /></p>
      <p class="triple num">Pythagorean triple: <strong>({triple.a}, {Math.abs(triple.b)}, {triple.c})</strong>{#if triple.g > 1} <span class="small">(divided by {triple.g})</span>{/if}</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .ctl input[type='range'] {
    width: 8rem;
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
  }
  .axis {
    stroke: var(--rule-strong);
  }
  .circle {
    fill: none;
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  .dot {
    fill: var(--byrne-blue);
    opacity: 0.55;
  }
  .line {
    stroke: var(--byrne-red);
    stroke-width: 2;
  }
  .anchor {
    fill: var(--byrne-ink);
  }
  .hit {
    fill: var(--byrne-yellow);
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  .info p {
    margin: 0.3rem 0;
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .triple {
    font-size: 0.9rem;
    margin-top: 0.6rem !important;
  }
</style>
