<!--
  Mirror: Wu's experiment and its mirror image, side by side (Chapter 22).

  Polarised ⁶⁰Co nuclei decay by β⁻ emission. What was observed (Wu et al. 1957): more electrons were emitted opposite to the direction of
  the nuclear spin than along it, and the effect vanished as the crystal warmed and the nuclei lost their polarisation. The figure draws
  that as a cartoon: W(θ) ∝ 1 + a cosθ with a = A·P·β, A = −1 for ⁶⁰Co. Below each picture, a histogram of the simulated electrons in cosθ.
  The mirror image is the same electrons reflected in a plane perpendicular to the spin axis: the spin (an axial vector, a sense of
  rotation) stays up, the electrons (polar vectors) have their component along the axis reversed.

  Everything is a schematic and seeded; it is not Wu's data.   ::mirror{n="22.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng } from '$lib/hep/random';
  import { sampleCosTheta, wuAsymmetry } from './weak';

  let { n, caption, title = 'Wu’s experiment and its mirror image' }: { n?: string | number; caption?: string; title?: string } = $props();

  let kind = $state<'weak' | 'em'>('weak');
  let temp = $state(0.01); // kelvin, schematic
  let count = $state(2000);
  let seed = $state(7);

  // Schematic polarisation: near 1 at the lowest temperatures, falling as the crystal warms. Not the measured curve.
  const P = $derived(Math.tanh(0.02 / temp) * 0.9 + 0.0);
  const beta = 0.8;
  const A = $derived(kind === 'weak' ? -1 : 0);
  const a = $derived(wuAsymmetry(A, P, beta));

  const sample = $derived.by(() => {
    const r = rng(seed);
    const out: { c: number; phi: number }[] = [];
    for (let i = 0; i < count; i++) out.push({ c: sampleCosTheta(r, a), phi: 2 * Math.PI * r() });
    return out;
  });

  const NB = 10;
  function hist(flip: boolean): number[] {
    const h = new Array<number>(NB).fill(0);
    for (const s of sample) {
      const c = flip ? -s.c : s.c;
      h[Math.min(NB - 1, Math.floor(((c + 1) / 2) * NB))]!++;
    }
    return h;
  }
  const hReal = $derived(hist(false));
  const hMirror = $derived(hist(true));
  const hMax = $derived(Math.max(1, ...hReal, ...hMirror));
  const up = (h: number[]) => h.slice(NB / 2).reduce((x, y) => x + y, 0);
  const down = (h: number[]) => h.slice(0, NB / 2).reduce((x, y) => x + y, 0);
  const asym = (h: number[]) => (up(h) - down(h)) / Math.max(1, up(h) + down(h));
  const err = $derived(1 / Math.sqrt(Math.max(1, count)));
  const aReal = $derived(asym(hReal));
  const aMirror = $derived(asym(hMirror));

  // drawing
  const W = 250, H = 215;
  const cx = W / 2, cy = 112;
  const shown = $derived(sample.slice(0, 90));
  function arrows(flip: boolean) {
    return shown.map((s) => {
      const c = flip ? -s.c : s.c;
      const sx = Math.sqrt(1 - c * c) * Math.cos(s.phi);
      const len = 52 + 26 * Math.abs(sx);
      return { x2: cx + sx * len, y2: cy - c * len, x1: cx + sx * 14, y1: cy - c * 14 };
    });
  }
  const aReal2 = $derived(arrows(false));
  const aMirror2 = $derived(arrows(true));
  const uid = $props.id();
  const fmt = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { kind = 'weak'; temp = 0.01; count = 2000; seed = 7; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented
        label="Which interaction emits the particles"
        size="sm"
        bind:value={kind}
        options={[
          { value: 'weak', label: '⁶⁰Co β decay (weak): A = −1' },
          { value: 'em', label: 'a parity-respecting control: A = 0' },
        ]}
      />
      <Slider bind:value={temp} min={0.01} max={1} step={0.01} log label="Crystal temperature (schematic), K" format={(v) => v.toFixed(2)} />
      <Slider bind:value={count} min={50} max={20000} step={50} log label="Decays counted" format={(v) => Math.round(v).toLocaleString('en-GB')} />
      <Button size="sm" onclick={() => (seed = seed + 1)}>New random sample (seed {seed})</Button>
    </div>
  {/snippet}

  <div class="pair">
    {#each [{ key: 'real', head: 'Nature', arr: aReal2, h: hReal, asymV: aReal }, { key: 'mirror', head: 'Its mirror image', arr: aMirror2, h: hMirror, asymV: aMirror }] as p (p.key)}
      <section class="pane" aria-label={p.head}>
        <h5 class="ui">{p.head}</h5>
        <svg viewBox="0 0 {W} {H}" role="img" aria-label="{p.head}: polarised nuclei with the spin pointing up; {p.asymV < -0.02 ? 'more electrons leave downwards, against the spin' : p.asymV > 0.02 ? 'more electrons leave upwards, along the spin' : 'equal numbers leave up and down'}">
          <defs>
            <marker id="ah-{uid}-{p.key}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--p-electron)" /></marker>
            <marker id="sp-{uid}-{p.key}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--ink)" /></marker>
          </defs>
          <!-- coil: a current loop whose sense of circulation sets the spin direction -->
          <ellipse {cx} {cy} rx="34" ry="9" fill="none" stroke="var(--ink-3)" stroke-width="2" stroke-dasharray="5 3" />
          <path d="M {cx + 34} {cy} a 34 9 0 0 1 -8 7.5" fill="none" stroke="var(--ink-3)" stroke-width="2.4" marker-end="url(#sp-{uid}-{p.key})" />
          {#each p.arr as v}
            <line x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2} stroke="var(--p-electron)" stroke-width="1" opacity="0.55" marker-end="url(#ah-{uid}-{p.key})" />
          {/each}
          <circle {cx} {cy} r="7" fill="var(--ink)" />
          <line x1={cx} y1={cy - 8} x2={cx} y2={cy - 46} stroke="var(--ink)" stroke-width="4" marker-end="url(#sp-{uid}-{p.key})" />
          <text x={cx + 8} y={cy - 38} class="lbl">spin</text>
          {#if p.key === 'real'}
            <line x1="14" x2={W - 14} y1={H - 6} y2={H - 6} stroke="var(--ink-2)" stroke-width="3" />
            <text x={W - 16} y={H - 12} text-anchor="end" class="lbl">mirror, below</text>
          {/if}
        </svg>
        <svg viewBox="0 0 {W} 90" class="hist" role="img" aria-label="Histogram of cosθ for {p.head}">
          {#each p.h as v, i}
            {@const w = (W - 30) / NB}
            <rect x={15 + i * w + 1} y={70 - (v / hMax) * 60} width={w - 2} height={(v / hMax) * 60} fill="var(--p-electron)" opacity="0.75" />
          {/each}
          <line x1="15" x2={W - 15} y1="70" y2="70" stroke="var(--axis)" />
          <text x="15" y="84" class="lbl">cosθ = −1 (against the spin)</text>
          <text x={W - 15} y="84" text-anchor="end" class="lbl">+1 (along)</text>
        </svg>
        <p class="ui read">Electrons along the spin minus against, over the total: <strong>{fmt(p.asymV)}</strong> ± {err.toFixed(3)}</p>
      </section>
    {/each}
  </div>

  <div class="out ui" aria-live="polite">
    {#if kind === 'em' || Math.abs(aReal) < 2 * err}
      <p>The two pictures cannot be told apart: each shows an asymmetry consistent with zero (the statistical uncertainty is ±{err.toFixed(3)}). A mirror image of this experiment would be a possible experiment.</p>
    {:else}
      <p>
        In Nature, electrons leave preferentially <strong>{aReal < 0 ? 'against' : 'along'}</strong> the spin ({Math.abs(aReal / err).toFixed(1)} standard deviations from equal numbers).
        In the mirror image they leave preferentially <strong>{aMirror < 0 ? 'against' : 'along'}</strong> it. If the mirror image were a possible experiment as well, both would show the same asymmetry. Wu's group found that only the first happens.
      </p>
    {/if}
    <p class="sub">Model: W(θ) ∝ 1 + a cosθ with a = A·P·β = {a.toFixed(2)} (A = {A}, P = {P.toFixed(2)}, β = {beta}). A schematic with seeded random numbers, not the measured data; P(T) is a stand-in curve.</p>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 640px) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: block;
  }
  .hist {
    margin-top: 0.3rem;
  }
  .lbl {
    font-size: 10.5px;
    fill: var(--ink-2);
    font-family: var(--font-ui);
  }
  .read,
  .sub {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .out p {
    margin: 0.6rem 0 0;
    font-size: 0.86rem;
    line-height: 1.5;
  }
</style>
