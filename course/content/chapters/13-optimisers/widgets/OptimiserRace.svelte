<!--
  Four optimisers on three two-parameter landscapes. Contours are log-spaced; trajectories animate
  step by step. Scale all learning rates together, or add gradient noise to mimic minibatches.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { mulberry32 } from '@lm/core';
  import { SURFACES, adam, momentum, rmsprop, sgd, trajectory, type Vec } from '../optimisers';

  const MAKERS = { SGD: sgd, Momentum: momentum, RMSProp: rmsprop, Adam: adam };
  type Name = keyof typeof MAKERS;
  const NAMES = Object.keys(MAKERS) as Name[];
  const color = (n: Name) => `var(--series-${NAMES.indexOf(n) + 1})`;

  let surfaceKey = $state<keyof typeof SURFACES>('valley');
  let lrScale = $state(1);
  let noise = $state(0);
  let steps = $state(150);
  let shown = $state(150);
  let playing = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  const surface = $derived(SURFACES[surfaceKey]!);

  const paths = $derived(
    Object.fromEntries(NAMES.map((n) => [n, trajectory(surface, MAKERS[n](), surface.lr[n]! * lrScale, steps, noise, mulberry32(7))])) as Record<Name, Vec[]>,
  );

  const W = 460, H = 300;
  const sx = (x: number) => ((x - surface.view.x[0]) / (surface.view.x[1] - surface.view.x[0])) * W;
  const sy = (y: number) => H - ((y - surface.view.y[0]) / (surface.view.y[1] - surface.view.y[0])) * H;
  let canvas = $state<HTMLCanvasElement | undefined>();

  $effect(() => {
    const s = surface;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    const img = g.createImageData(W, H);
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
    let lo = Infinity, hi = -Infinity;
    const vals = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = s.view.x[0] + ((i + 0.5) / W) * (s.view.x[1] - s.view.x[0]);
        const y = s.view.y[1] - ((j + 0.5) / H) * (s.view.y[1] - s.view.y[0]);
        const v = Math.log(1e-3 + s.f(x, y) - Math.min(0, s.f(s.minimum[0], s.minimum[1])));
        vals[j * W + i] = v;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    for (let k = 0; k < W * H; k++) {
      const t = (vals[k]! - lo) / (hi - lo);
      // Light bands for contours: every 1/14 of the log range.
      const band = Math.abs(((t * 14) % 1) - 0.5) < 0.04 ? 0.12 : 0;
      const base = dark ? 30 + 60 * t : 250 - 55 * t;
      const shade = dark ? base + band * 255 : base - band * 255;
      img.data[4 * k] = shade * 0.94;
      img.data[4 * k + 1] = shade * 0.96;
      img.data[4 * k + 2] = shade;
      img.data[4 * k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });

  function play() {
    if (playing) {
      playing = false;
      clearInterval(timer);
      return;
    }
    playing = true;
    shown = 0;
    timer = setInterval(() => {
      shown += Math.max(1, Math.round(steps / 90));
      if (shown >= steps) {
        shown = steps;
        playing = false;
        clearInterval(timer);
      }
    }, 30);
  }
  onDestroy(() => clearInterval(timer));
  $effect(() => {
    void [surfaceKey, lrScale, noise, steps];
    if (!playing) shown = steps;
  });
  const final = (n: Name) => {
    const p = paths[n]!.at(-1)!;
    return surface.f(p[0], p[1]) - surface.f(surface.minimum[0], surface.minimum[1]);
  };
</script>

<Widget
  title="Four optimisers, three landscapes"
  subtitle="Each optimiser starts at the same point (○) with a learning rate tuned for it on this surface. Scale them all together, add noise to the gradients as minibatches would, or watch them run."
  onreset={() => {
    lrScale = 1;
    noise = 0;
    steps = 150;
  }}
>
  {#snippet controls()}
    <Segmented label="Surface" size="sm" options={Object.entries(SURFACES).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={surfaceKey} />
    <Button onclick={play}>{playing ? 'Stop' : 'Animate'}</Button>
  {/snippet}

  <div class="row ui">
    <div class="ctl"><Slider label="learning-rate scale" min={0.25} max={4} step={0.01} log value={lrScale} oninput={(v) => (lrScale = v)} format={(v) => `×${v.toFixed(2)}`} /></div>
    <div class="ctl"><Slider label="gradient noise" min={0} max={5} step={0.05} value={noise} oninput={(v) => (noise = v)} format={(v) => v.toFixed(2)} /></div>
    <div class="ctl"><Slider label="steps" min={10} max={600} step={10} value={steps} oninput={(v) => (steps = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  </div>
  <Legend items={NAMES.map((n) => ({ label: `${n} — ${final(n) < 1e-4 ? 'converged' : Number.isFinite(final(n)) && final(n) < 1e6 ? `f − f* = ${final(n).toExponential(1)}` : 'diverged'}`, color: color(n) }))} />
  <div class="plot" style:aspect-ratio="{W} / {H}">
    <canvas bind:this={canvas} width={W} height={H} aria-hidden="true"></canvas>
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Optimiser trajectories on {surface.label}">
      <circle cx={sx(surface.minimum[0])} cy={sy(surface.minimum[1])} r="5" class="min" />
      {#each NAMES as n (n)}
        {@const pts = paths[n]!.slice(0, shown + 1)}
        <polyline points={pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')} stroke={color(n)} class="traj" />
        {#if pts.length}<circle cx={sx(pts.at(-1)![0])} cy={sy(pts.at(-1)![1])} r="4" fill={color(n)} />{/if}
      {/each}
      <circle cx={sx(surface.start[0])} cy={sy(surface.start[1])} r="6" class="start" />
    </svg>
  </div>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin-bottom: 0.4rem;
  }
  .ctl {
    flex: 0 1 12rem;
  }
  .plot {
    position: relative;
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
  }
  canvas,
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }
  .traj {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .min {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-dasharray: 2 2;
  }
  .start {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
</style>
