<!--
  An image as a sequence: a 224 × 224 picture cut into P × P patches, which a vision transformer reads in
  raster order as if they were tokens. Uses the learner's patchify() to build the sequence shown below.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(image: Float32Array, H: number, W: number, C: number, P: number): Float32Array[] {
    const patches: Float32Array[] = [];
    for (let py = 0; py < H / P; py++)
      for (let px = 0; px < W / P; px++) {
        const out = new Float32Array(P * P * C);
        let k = 0;
        for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) for (let c = 0; c < C; c++) out[k++] = image[((py * P + y) * W + px * P + x) * C + c]!;
        patches.push(out);
      }
    return patches;
  }
  const patchify = $derived(impl.get('mm.patchify', reference));
  const mine = $derived(impl.isMine('mm.patchify'));

  const S = 224;
  let P = $state(32);
  let pixels: Float32Array | null = null;
  let hover = $state<number | null>(null);
  let src = $state<HTMLCanvasElement>();
  let seq = $state<HTMLCanvasElement>();

  // A small scene, drawn once: sky, sun, hill, house and tree.
  function draw(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#8ec5f0');
    g.addColorStop(1, '#dff0fb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.arc(176, 46, 24, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#6aa84f';
    ctx.beginPath();
    ctx.ellipse(112, 250, 190, 96, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#e8d8c3';
    ctx.fillRect(40, 120, 70, 56);
    ctx.fillStyle = '#b5523b';
    ctx.beginPath();
    ctx.moveTo(32, 122);
    ctx.lineTo(75, 88);
    ctx.lineTo(118, 122);
    ctx.fill();
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(66, 146, 18, 30);
    ctx.fillRect(160, 120, 10, 50);
    ctx.fillStyle = '#3d7a33';
    ctx.beginPath();
    ctx.arc(165, 110, 26, 0, 2 * Math.PI);
    ctx.fill();
  }

  $effect(() => {
    if (!src) return;
    const ctx = src.getContext('2d')!;
    draw(ctx);
    const d = ctx.getImageData(0, 0, S, S).data;
    const rgb = new Float32Array(S * S * 3);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = d[i * 4 + c]! / 255;
    pixels = rgb;
    render();
  });

  function render() {
    if (!pixels || !seq || !src) return;
    let patches: Float32Array[];
    try {
      patches = patchify(pixels, S, S, 3, P);
    } catch {
      patches = reference(pixels, S, S, 3, P);
    }
    // The sequence: patches side by side in reading order, wrapping to the canvas width.
    const tile = Math.max(6, Math.min(28, Math.floor(560 / Math.sqrt(patches.length * 3))));
    const gap = 2;
    const perRow = Math.floor((seq.clientWidth || 600) / (tile + gap));
    const rows = Math.ceil(patches.length / perRow);
    seq.width = perRow * (tile + gap);
    seq.height = rows * (tile + gap);
    const ctx = seq.getContext('2d')!;
    ctx.clearRect(0, 0, seq.width, seq.height);
    const img = ctx.createImageData(P, P);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = P;
    const tctx = tmp.getContext('2d')!;
    patches.forEach((p, n) => {
      for (let k = 0; k < P * P; k++) {
        for (let c = 0; c < 3; c++) img.data[k * 4 + c] = Math.round((p[k * 3 + c] ?? 0) * 255);
        img.data[k * 4 + 3] = 255;
      }
      tctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, (n % perRow) * (tile + gap), Math.floor(n / perRow) * (tile + gap), tile, tile);
      if (n === hover) {
        ctx.strokeStyle = '#d33';
        ctx.lineWidth = 2;
        ctx.strokeRect((n % perRow) * (tile + gap), Math.floor(n / perRow) * (tile + gap), tile, tile);
      }
    });
  }
  $effect(() => {
    void P;
    void hover;
    void patchify;
    render();
  });

  const n = $derived((S / P) ** 2);
  function move(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * (S / P));
    const y = Math.floor(((e.clientY - r.top) / r.height) * (S / P));
    hover = y * (S / P) + x;
  }
</script>

<Widget
  title="An image as a sequence of patches"
  subtitle="A vision transformer cuts the image into squares, flattens each into a vector and projects it to the model’s width: from then on, a patch is a token. Hover over the image to find a patch in the sequence."
  onreset={() => (P = 32)}
>
  {#snippet controls()}
    <Segmented label="Patch size" size="sm" options={[8, 14, 16, 28, 32, 56].map((v) => ({ value: v, label: `${v}` }))} bind:value={P} />
  {/snippet}

  {#if mine}<p class="mine ui">Using your patchify().</p>{/if}
  <div class="layout">
    <div class="imgwrap" onpointermove={move} onpointerleave={() => (hover = null)} role="presentation">
      <canvas bind:this={src} width={S} height={S}></canvas>
      <svg viewBox="0 0 {S} {S}" class="grid" aria-hidden="true">
        {#each Array.from({ length: S / P - 1 }, (_, i) => (i + 1) * P) as v (v)}
          <line x1={v} x2={v} y1="0" y2={S} />
          <line y1={v} y2={v} x1="0" x2={S} />
        {/each}
        {#if hover !== null}<rect x={(hover % (S / P)) * P} y={Math.floor(hover / (S / P)) * P} width={P} height={P} class="hl" />{/if}
      </svg>
    </div>
    <div class="facts ui">
      <p><strong class="num">{n.toLocaleString('en-GB')}</strong> patches = tokens</p>
      <p>each <span class="num">{P} × {P} × 3 = {(P * P * 3).toLocaleString('en-GB')}</span> numbers</p>
      <p><strong class="num">{(n * n).toLocaleString('en-GB')}</strong> attention scores per head per layer</p>
      {#if hover !== null}<p class="muted">patch {hover + 1} of {n}</p>{/if}
    </div>
  </div>
  <p class="seqlabel ui">What the model reads: the {n.toLocaleString('en-GB')} patches in reading order, one after another (wrapped to fit the page).</p>
  <canvas class="seq" bind:this={seq}></canvas>
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: center;
  }
  .imgwrap {
    position: relative;
    width: 224px;
    height: 224px;
    cursor: crosshair;
  }
  .imgwrap canvas,
  .grid {
    position: absolute;
    inset: 0;
    width: 224px;
    height: 224px;
    border-radius: 4px;
  }
  .grid line {
    stroke: #fff;
    stroke-width: 1;
    opacity: 0.8;
  }
  .hl {
    fill: none;
    stroke: #d33;
    stroke-width: 2;
  }
  .facts {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .facts p {
    margin: 0.2rem 0;
  }
  .muted {
    color: var(--ink-3);
  }
  .seqlabel {
    font-size: 0.75rem;
    color: var(--ink-3);
    margin: 0.8rem 0 0.3rem;
  }
  .seq {
    display: block;
    max-width: 100%;
  }
</style>
