<!--
  PET in two dimensions: a positron-emitting tracer decays in a phantom; every annihilation makes two photons back to back, a ring of detectors sees both, and the line between
  them passes through the decay. Drawing many lines and adding them up makes an image of where the tracer is. A TOY (see ./medical.ts): no attenuation, scatter, random coincidences or time of flight.

    ::pet-ring{n="33.3" caption="…"}    Props: `seed`, `n`, `caption`, `title`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { simulateLor, backproject, sharpen, type Blob, type Lor } from './medical';
  import { rng as makeRng } from '$lib/hep/random';
  import { sig } from './format';

  let { seed: seed0 = 5, n, caption, title = 'PET: lines of response from back-to-back photons' }: { seed?: number; n?: string | number; caption?: string; title?: string } = $props();

  // A phantom: two hot spots of different strength and a broad warm region.
  const BLOBS: Blob[] = [
    { x: -0.35, y: 0.25, sigma: 0.07, weight: 1 },
    { x: 0.4, y: -0.2, sigma: 0.1, weight: 1.6 },
    { x: 0, y: 0, sigma: 0.45, weight: 1.2 },
  ];
  let count = $state(2000);
  let seed = $state(untrack(() => seed0));
  let filtered = $state(true);
  let showLines = $state(true);

  const lors = $derived.by((): Lor[] => {
    const r = makeRng(seed);
    return Array.from({ length: count }, () => simulateLor(BLOBS, r));
  });
  const NG = 64;
  const image = $derived.by(() => {
    const raw = backproject(lors, NG);
    return filtered ? sharpen(raw, NG, 5, 1) : raw;
  });
  let canvas = $state<HTMLCanvasElement | undefined>();
  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(NG, NG);
    let max = 0;
    for (let i = 0; i < image.length; i++) max = Math.max(max, image[i]!);
    for (let j = 0; j < NG; j++)
      for (let i = 0; i < NG; i++) {
        const v = max > 0 ? image[(NG - 1 - j) * NG + i]! / max : 0;
        const k = (j * NG + i) * 4;
        // a dark-to-amber-to-white colour map that also reads in greyscale (monotonic in lightness)
        img.data[k] = Math.min(255, 255 * Math.min(1, v * 1.6));
        img.data[k + 1] = Math.min(255, 255 * Math.max(0, v * 1.3 - 0.15));
        img.data[k + 2] = Math.min(255, 255 * Math.max(0, v * 1.4 - 0.6));
        img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  });

  const SZ = 280, C = SZ / 2;
  const shown = $derived(lors.slice(0, 60));
  const pt = (a: number) => ({ x: C + (C - 6) * Math.cos(a), y: C - (C - 6) * Math.sin(a) });
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={count} min={50} max={20000} log label="Detected coincidences" format={(v) => sig(v, 3)} />
    <Toggle bind:checked={filtered} label="Sharpen (stand-in for the ramp filter)" />
    <Toggle bind:checked={showLines} label="Draw the first 60 lines" />
    <Button onclick={() => (seed = seed + 1)}>New decays <span class="seed">seed {seed}</span></Button>
  {/snippet}
  <div class="grid">
    <div class="pane">
      <h5 class="ui">The ring of detectors and the lines of response</h5>
      <svg viewBox="0 0 {SZ} {SZ}" role="img" aria-label="A ring of detectors with lines of response drawn between the two detectors that saw each annihilation">
        <circle cx={C} cy={C} r={C - 4} class="ring" />
        {#if showLines}
          {#each shown as l}
            {@const p1 = pt(l.a1)}
            {@const p2 = pt(l.a2)}
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} class="lor" />
          {/each}
        {/if}
        {#each BLOBS as b}
          <circle cx={C + b.x * (C - 6)} cy={C - b.y * (C - 6)} r={Math.max(2, b.sigma * (C - 6) * 1.5)} class="truth" />
        {/each}
      </svg>
      <p class="ui small">Dashed circles: where the tracer really is (two hot spots in a warm background).</p>
    </div>
    <div class="pane">
      <h5 class="ui">The image: every line added up ({count.toLocaleString('en-GB')} lines)</h5>
      <canvas bind:this={canvas} width={NG} height={NG} aria-label="Back-projected image of the phantom"></canvas>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  svg,
  canvas {
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1;
    display: block;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--scope-bg, #0a0f14);
  }
  canvas {
    image-rendering: pixelated;
  }
  .ring {
    fill: none;
    stroke: var(--p-hit);
    stroke-width: 6;
    opacity: 0.6;
  }
  .lor {
    stroke: var(--p-photon);
    stroke-width: 0.7;
    opacity: 0.55;
  }
  .truth {
    fill: none;
    stroke: var(--p-electron);
    stroke-dasharray: 3 3;
  }
  .small {
    margin: 0.3rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
</style>
