<!--
  Rotary position embeddings: a query at position m and a key at position n, each rotated pair by pair
  (fast for the first pairs, slow for the last). Their score depends only on m − n. Uses the learner's
  rope() once their exercise passes.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(x: Float32Array, pos: number, base = 10000): Float32Array {
    const d = x.length, half = d / 2, out = new Float32Array(d);
    for (let i = 0; i < half; i++) {
      const t = pos * base ** ((-2 * i) / d), c = Math.cos(t), s = Math.sin(t);
      out[i] = x[i]! * c - x[i + half]! * s;
      out[i + half] = x[i]! * s + x[i + half]! * c;
    }
    return out;
  }
  const rope = $derived(impl.get('arch.rope', reference));
  const mine = $derived(impl.isMine('arch.rope'));

  const d = 64;
  const rng = mulberry32(7);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  // A query and a key that are similar (as they are when a head looks for something specific).
  const k0 = Float32Array.from({ length: d }, gauss);
  const q0 = k0.map((v) => v + 0.5 * gauss());

  let m = $state(40);
  let n = $state(30);
  const safe = (x: Float32Array, p: number) => {
    try {
      return rope(x, p);
    } catch {
      return reference(x, p);
    }
  };
  const q = $derived(safe(q0, m));
  const k = $derived(safe(k0, n));
  const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, v, i) => s + v * b[i]!, 0) / Math.sqrt(d);
  const score = $derived(dot(q, k));
  // Score against offset, for k at a fixed position (only the offset matters).
  const curve = $derived(Array.from({ length: 257 }, (_, o) => [o, dot(safe(q0, o + 100), safe(k0, 100))] as const));
  const PAIRS = [0, 4, 12, 28];
  const angle = (x: Float32Array, i: number) => Math.atan2(x[i + d / 2]!, x[i]!);
</script>

<Widget
  title="Rotating queries and keys"
  subtitle="RoPE splits a head’s 64 coordinates into 32 pairs and rotates each pair by an angle proportional to the position: the first pairs spin fast, the last barely move. Move the query and key positions; the score changes only when their distance does."
  onreset={() => {
    m = 40;
    n = 30;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Query position m" min={0} max={400} step={1} value={m} oninput={(v) => (m = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    <div class="sl"><Slider label="Key position n" min={0} max={400} step={1} value={n} oninput={(v) => (n = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your rope().</p>{/if}
  <div class="two">
    <div>
      <div class="dials">
        {#each PAIRS as i (i)}
          <figure class="dial">
            <svg viewBox="-50 -50 100 100" role="img" aria-label="Pair {i}">
              <circle r="40" fill="none" stroke="var(--rule)" />
              <line x2={40 * Math.cos(angle(q, i))} y2={-40 * Math.sin(angle(q, i))} stroke="var(--series-1)" stroke-width="3" />
              <line x2={34 * Math.cos(angle(k, i))} y2={-34 * Math.sin(angle(k, i))} stroke="var(--series-2)" stroke-width="3" />
            </svg>
            <figcaption class="ui">pair {i}: {(10000 ** ((-2 * i) / d)).toPrecision(2)} rad / position</figcaption>
          </figure>
        {/each}
      </div>
      <p class="stats ui"><span class="q">query</span> at {m}, <span class="k">key</span> at {n}: offset <strong class="num">{m - n}</strong>, score q·k/√d = <strong class="num">{score.toFixed(3)}</strong></p>
    </div>
    <Plot label="Score against offset" height={220} x={{ domain: [0, 256], label: 'offset m − n', ticks: 5 }} y={{ domain: [-2, Math.max(4, ...curve.map((c) => c[1])) * 1.05], label: 'score', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--series-1)" d={'M' + curve.map(([o, s]) => `${sx(o)},${sy(s)}`).join('L')} />
        {#if m - n >= 0 && m - n <= 256}<circle cx={sx(m - n)} cy={sy(score)} r="5" fill="var(--series-2)" />{/if}
      {/snippet}
    </Plot>
  </div>
  <p class="note ui">The curve is the same wherever the pair sits in the sequence: move both sliders together and the dot stays put. Nearby positions score highest, and the score tends to shrink and oscillate with distance, a mild built-in preference for recent tokens.</p>
</Widget>

<style>
  .sl {
    flex: 1 1 12rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .dials {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .dial {
    margin: 0;
    text-align: center;
  }
  .dial svg {
    width: 100%;
    max-width: 90px;
  }
  .dial figcaption {
    font-size: 0.66rem;
    color: var(--ink-3);
  }
  .stats {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .q {
    color: var(--series-1);
    font-weight: 600;
  }
  .k {
    color: var(--series-2);
    font-weight: 600;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
