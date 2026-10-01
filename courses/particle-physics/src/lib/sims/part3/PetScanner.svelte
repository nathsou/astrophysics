<!--
  A toy PET scanner (Chapter 9): a water phantom with a tracer in three hot regions, a ring of crystals, lines of response from annihilation
  photons, and the image reconstructed from them by back-projection or by a few iterations of maximum-likelihood expectation-maximisation.
  Simulated in two dimensions with ./pet.ts; everything is seeded.

    ::pet-scanner{n="9.5" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { rng } from '$lib/hep/random';
  import { simulatePet, reconstruct, truthImage, crystalPos, GRID, HALF, RING_R, PHANTOM_R, PHANTOM_DEFAULT } from './pet';

  let { n, caption, seed = 7 }: { n?: string | number; caption?: string; seed?: number } = $props();
  let emitted = $state(60000);
  let iters = $state(12);
  let range = $state(0.1);
  let canvasL: HTMLCanvasElement | undefined = $state();
  let canvasR: HTMLCanvasElement | undefined = $state();
  let mounted = $state(false);
  onMount(() => (mounted = true));

  const res = $derived(simulatePet({ emitted, rangeSigma: range }, rng(seed)));
  const img = $derived(reconstruct(res, iters));
  const truth = truthImage(PHANTOM_DEFAULT);

  const SIZE = 320;
  function draw() {
    if (!canvasL || !canvasR) return;
    const k = SIZE / (2 * HALF);
    const L = canvasL.getContext('2d')!;
    L.clearRect(0, 0, SIZE, SIZE);
    const css = getComputedStyle(canvasL);
    const ink = css.getPropertyValue('--ink-3') || '#888';
    // truth: phantom and hot regions
    L.fillStyle = 'rgba(120,150,190,0.15)';
    L.beginPath(); L.arc(SIZE / 2, SIZE / 2, PHANTOM_R * k, 0, 7); L.fill();
    for (const h of PHANTOM_DEFAULT) {
      L.fillStyle = 'rgba(230,140,50,0.55)';
      L.beginPath(); L.arc(SIZE / 2 + h.x * k, SIZE / 2 - h.y * k, h.r * k, 0, 7); L.fill();
    }
    // the first lines of response, faint, drawn to the ring's shadow (clipped to the view)
    L.strokeStyle = 'rgba(90,140,220,0.22)';
    L.lineWidth = 1;
    for (const c of res.coincidences.slice(0, 160)) {
      const [x0, y0] = crystalPos(c.a, res.nCrystals);
      const [x1, y1] = crystalPos(c.b, res.nCrystals);
      L.beginPath(); L.moveTo(SIZE / 2 + x0 * k, SIZE / 2 - y0 * k); L.lineTo(SIZE / 2 + x1 * k, SIZE / 2 - y1 * k); L.stroke();
    }
    L.strokeStyle = ink.trim() || '#888';
    L.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    // the reconstruction
    const R = canvasR.getContext('2d')!;
    const im = R.createImageData(GRID, GRID);
    let mx = 0;
    for (const v of img) mx = Math.max(mx, v);
    for (let iy = 0; iy < GRID; iy++) for (let ix = 0; ix < GRID; ix++) {
      const v = mx > 0 ? img[iy * GRID + ix]! / mx : 0;
      const o = ((GRID - 1 - iy) * GRID + ix) * 4;
      const g = Math.round(255 * v ** 1.4);
      im.data[o] = g; im.data[o + 1] = Math.round(g * 0.62); im.data[o + 2] = Math.round(g * 0.2); im.data[o + 3] = 255;
    }
    const off = document.createElement('canvas');
    off.width = GRID; off.height = GRID;
    off.getContext('2d')!.putImageData(im, 0, 0);
    R.imageSmoothingEnabled = true;
    R.clearRect(0, 0, SIZE, SIZE);
    R.drawImage(off, 0, 0, SIZE, SIZE);
  }
  $effect(() => {
    void mounted; void res; void img;
    draw();
  });
  const eff = $derived((100 * res.coincidences.length) / res.emitted);
</script>

<Widget title="A PET scan, reconstructed from coincidences" {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={emitted} min={2000} max={100000} step={1000} log label="Decays simulated" format={(v) => Math.round(v).toLocaleString('en-GB')} />
    <Slider bind:value={iters} min={0} max={20} step={1} label="ML-EM iterations (0 = plain back-projection)" format={(v) => String(v)} />
    <Slider bind:value={range} min={0} max={0.6} step={0.05} label="Positron range (rms blur) [cm]" format={(v) => v.toFixed(2)} />
  {/snippet}
  <div class="p3-two">
    <div>
      <h5 class="p3-h">What is in the phantom, and some lines of response</h5>
      <canvas bind:this={canvasL} width={SIZE} height={SIZE} style="width:100%;max-width:{SIZE}px;height:auto" aria-label="Phantom of 10 centimetres radius with three hot regions of tracer, and the first 160 lines of response between pairs of crystals."></canvas>
    </div>
    <div>
      <h5 class="p3-h">Reconstructed image</h5>
      <canvas bind:this={canvasR} width={SIZE} height={SIZE} style="width:100%;max-width:{SIZE}px;height:auto" aria-label="The reconstructed image of the tracer concentration: bright where the hot regions are."></canvas>
    </div>
  </div>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>coincidences detected</dt><dd>{res.coincidences.length.toLocaleString('en-GB')} of {res.emitted.toLocaleString('en-GB')} decays ({eff.toFixed(0)} %)</dd></div>
    <div><dt>ring</dt><dd>{res.nCrystals} crystals at R = {RING_R} cm; phantom R = {PHANTOM_R} cm</dd></div>
    <div><dt>truth</dt><dd>{truth.reduce((a, b) => a + (b > 1 ? 1 : 0), 0)} pixels of hot tracer (6×)</dd></div>
  </dl>
  <p class="p3-note ui">A toy in two dimensions: photons that leave the plane are not simulated, and there is no scatter, no random coincidences and no detector depth. The fraction lost comes from the geometry, from attenuation in water (μ = 0.096 cm⁻¹) and from the angular blur of 0.25° rms between the two photons. Fewer counts give a noisier image, and more ML-EM iterations sharpen it and amplify the noise.</p>
</Widget>
