<!--
  Superposition in two dimensions: n sparse features stored as n directions in a plane. Each point is a sum of
  the few features active in one example. With few features active at once, a top-1 sparse autoencoder whose
  decoder rows are the directions (the learner's topkSae) recovers which feature fired; as features co-occur,
  they interfere.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(x: number[], Wenc: number[][], benc: number[], Wdec: number[][], bdec: number[], k: number) {
    const m = benc.length;
    const c = x.map((v, i) => v - bdec[i]!);
    const pre = Array.from({ length: m }, (_, j) => Math.max(0, c.reduce((a, v, i) => a + v * Wenc[i]![j]!, benc[j]!)));
    const keep = new Set(pre.map((_, j) => j).sort((a, b) => pre[b]! - pre[a]! || a - b).slice(0, k));
    const features = pre.map((v, j) => (keep.has(j) ? v : 0));
    return { features, reconstruction: bdec.map((b, i) => features.reduce((a, f, j) => a + f * Wdec[j]![i]!, b)) };
  }
  const sae = $derived(impl.get('interp.sae', reference));
  const mine = $derived(impl.isMine('interp.sae'));

  let n = $state(5);
  let density = $state(0.05);
  const dirs = $derived(Array.from({ length: n }, (_, j) => [Math.cos((2 * Math.PI * j) / n + 0.3), Math.sin((2 * Math.PI * j) / n + 0.3)]));
  const points = $derived.by(() => {
    const rng = mulberry32(26);
    const out: { x: number[]; active: number[]; top: number }[] = [];
    while (out.length < 300) {
      const active = dirs.map((_, j) => j).filter(() => rng() < density);
      if (!active.length) continue;
      const x = [0, 0];
      let top = -1, best = 0;
      for (const j of active) {
        const a = 0.4 + 0.6 * rng();
        if (a > best) (best = a), (top = j);
        x[0]! += a * dirs[j]![0]!;
        x[1]! += a * dirs[j]![1]!;
      }
      out.push({ x, active, top });
    }
    return out;
  });
  const decoded = $derived(points.map((p) => {
    const Wenc = [dirs.map((d) => d[0]!), dirs.map((d) => d[1]!)];
    let r: { features: number[] };
    try {
      r = sae(p.x, Wenc, dirs.map(() => 0), dirs, [0, 0], 1);
    } catch {
      r = reference(p.x, Wenc, dirs.map(() => 0), dirs, [0, 0], 1);
    }
    const j = r.features.findIndex((f) => f > 0);
    return { ...p, pick: j, ok: j === p.top };
  }));
  const acc = $derived(decoded.filter((d) => d.ok).length / decoded.length);
  const multi = $derived(decoded.filter((d) => d.active.length > 1).length);
  const S = 110;
</script>

<Widget
  title="More features than dimensions"
  subtitle="Each example activates a few of n features, each stored as a direction in a plane; the point is their sum. When features rarely co-occur, reading off the nearest direction (a top-1 sparse autoencoder) says which one fired. When they often co-occur, sums land between directions and the reading goes wrong."
  onreset={() => {
    n = 5;
    density = 0.05;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Features n" min={2} max={10} step={1} value={n} oninput={(v) => (n = v)} format={(v) => v.toFixed(0)} /></div>
    <div class="sl"><Slider label="P(feature active)" min={0.01} max={0.5} step={0.01} value={density} oninput={(v) => (density = v)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your topkSae().</p>{/if}
  <div class="row">
    <svg viewBox="{-S} {-S} {2 * S} {2 * S}" class="plane" role="img" aria-label="Examples as points in the plane">
      {#each dirs as d, j (j)}
        <line x1="0" y1="0" x2={d[0]! * S * 0.9} y2={-d[1]! * S * 0.9} stroke="var(--series-{(j % 8) + 1})" stroke-width="2" />
      {/each}
      {#each decoded as p, i (i)}
        <circle cx={p.x[0]! * S * 0.6} cy={-p.x[1]! * S * 0.6} r="2.3" fill={p.pick >= 0 ? `var(--series-${(p.pick % 8) + 1})` : 'var(--ink-3)'} stroke={p.active.length > 1 ? 'var(--ink)' : 'none'} stroke-width="0.6" opacity="0.8" />
      {/each}
    </svg>
    <div class="facts ui">
      <p>{n} features in 2 dimensions</p>
      <p><strong class="num">{multi}</strong> of 300 examples have more than one feature active (outlined)</p>
      <p>strongest active feature read off correctly: <strong class="num">{(acc * 100).toFixed(0)}%</strong></p>
      <p class="muted">Colour: the feature the autoencoder reads off.</p>
    </div>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: center;
  }
  .plane {
    width: 240px;
    height: 240px;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .facts {
    font-size: 0.82rem;
    color: var(--ink-2);
    flex: 1 1 12rem;
  }
  .facts p {
    margin: 0.25rem 0;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
