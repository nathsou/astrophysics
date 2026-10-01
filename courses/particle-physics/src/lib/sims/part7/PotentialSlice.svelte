<!--
  The Higgs potential along the radial direction (Chapters 26 and 30), as a function of h, the distance of the field from its
  vacuum value: with φ = (v + h)/√2 and μ² = λv²,

      V(h) = ½ m_H² h² + κ λ v h³ + ¼ λ h⁴,        κ = 1 in the Standard Model.

  The three terms are the Higgs mass, the Higgs boson's coupling to itself (the trilinear coupling, which is κ times its Standard Model value),
  and its quartic coupling. Switch on "show the pieces" to see them added up. With the slider (Chapter 30) the trilinear coupling is scaled by κ_λ
  while m_H, v and the quartic term are kept: the shape away from the minimum changes, which is what a measurement of the trilinear coupling would
  tell us. THE REGION FAR FROM h = 0 IS NOT MEASURED. The left-hand valley is the mirror image h → −2v − h of the vacuum in the Standard Model (the
  same point of the circle of the Mexican hat, seen through the real slice) and is the same state.

    ::potential-slice{n="26.3" caption="…"}               Chapter 26: the Standard Model only
    ::potential-slice{n="30.3" slider=true caption="…"}    Chapter 30: with the κ_λ slider

  Props: `slider` (show κ_λ), `kappa` (initial value), `n`, `caption`, `title`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { V_EW_GEV, M_HIGGS_GEV, lambdaFromMass } from '$lib/hep/fields';

  let {
    slider = false,
    kappa: k0 = 1,
    n,
    caption,
    title = 'The potential seen from the vacuum',
  }: { slider?: boolean; kappa?: number; n?: string | number; caption?: string; title?: string } = $props();

  const v = V_EW_GEV;
  const mH = M_HIGGS_GEV;
  const lambda = lambdaFromMass(mH, v);
  const UNIT = 1e8; // GeV⁴

  let kappa = $state(untrack(() => k0));
  let pieces = $state(false);

  const H_MIN = -2.15 * v;
  const H_MAX = 1.05 * v;
  const N = 260;
  const hs = Array.from({ length: N + 1 }, (_, i) => H_MIN + ((H_MAX - H_MIN) * i) / N);
  const mass = (h: number) => (0.5 * mH * mH * h * h) / UNIT;
  const cubic = (h: number, kap: number) => (kap * lambda * v * h ** 3) / UNIT;
  const quartic = (h: number) => (0.25 * lambda * h ** 4) / UNIT;
  const total = (h: number, kap: number) => mass(h) + cubic(h, kap) + quartic(h);

  const path = (f: (h: number) => number, sx: (x: number) => number, sy: (y: number) => number) =>
    hs.map((h, i) => `${i ? 'L' : 'M'}${sx(h).toFixed(1)},${sy(f(h)).toFixed(1)}`).join('');

  const curve = $derived(hs.map((h) => total(h, kappa)));
  const lowest = $derived(Math.min(...curve));
  const other = $derived.by(() => {
    // the deepest point on the left of the hill, to compare with V(0) = 0
    let best = Infinity;
    let at = 0;
    for (let i = 0; i < hs.length; i++) if (hs[i]! < -0.9 * v && curve[i]! < best) { best = curve[i]!; at = hs[i]!; }
    return { v: best, h: at };
  });
  const yHi = 8;
  const yLo = $derived(Math.min(-1, Math.floor(lowest - 0.5)));
  const trilinear = $derived((3 * kappa * mH * mH) / v);
  const stable = $derived(other.v >= -1e-3);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    {#if slider}<Slider bind:value={kappa} min={-2} max={4} step={0.05} labelHtml={'<span style="text-transform:none;font-variant:normal">Trilinear coupling, κ<sub>λ</sub> (Standard Model: 1)</span>'} format={(x) => x.toFixed(2)} />{/if}
    <Toggle bind:checked={pieces} label="Show the pieces (mass, cubic, quartic)" />
  {/snippet}

  <Plot x={{ domain: [H_MIN, H_MAX], label: 'h = the Higgs field minus its vacuum value [GeV]', tickValues: [-400, -200, 0, 200] }} y={{ domain: [yLo, yHi], label: 'V(h) [10⁸ GeV⁴]' }} height={300} label="The Higgs potential V(h) along the real direction">
    {#snippet marks({ sx, sy })}
      <line x1={sx(0)} x2={sx(0)} y1={sy(yHi)} y2={sy(yLo)} stroke="var(--series-1)" stroke-dasharray="3 4" opacity="0.6" />
      <text x={sx(0) + 6} y={sy(yHi) + 14} class="lbl" fill="var(--series-1)">vacuum, h = 0</text>
      <line x1={sx(-v)} x2={sx(-v)} y1={sy(yHi)} y2={sy(yLo)} stroke="var(--mute)" stroke-dasharray="3 4" opacity="0.6" />
      <text x={sx(-v) + 6} y={sy(yHi) + 14} class="lbl" fill="var(--mute)">φ = 0, the top of the hat</text>
      {#if pieces}
        <path d={path(mass, sx, sy)} fill="none" stroke="var(--series-2)" stroke-width="1.4" stroke-dasharray="5 3" />
        <path d={path((h) => cubic(h, kappa), sx, sy)} fill="none" stroke="var(--series-4)" stroke-width="1.4" stroke-dasharray="5 3" />
        <path d={path(quartic, sx, sy)} fill="none" stroke="var(--series-5)" stroke-width="1.4" stroke-dasharray="5 3" />
        <text x={sx(H_MAX) - 6} y={sy(Math.min(yHi - 0.5, mass(H_MAX * 0.9))) - 4} class="lbl" text-anchor="end" fill="var(--series-2)">½ m<tspan baseline-shift="sub" font-size="0.75em">H</tspan>² h²</text>
        <text x={sx(H_MAX * 0.55)} y={sy(Math.min(yHi - 1, cubic(H_MAX * 0.55, kappa))) - 6} class="lbl" fill="var(--series-4)">κ_λ λ v h³</text>
        <text x={sx(H_MIN * 0.97)} y={sy(Math.min(yHi - 1, quartic(H_MIN * 0.93))) + 14} class="lbl" fill="var(--series-5)">¼ λ h⁴</text>
      {/if}
      <path d={path((h) => total(h, kappa), sx, sy)} fill="none" stroke="var(--p-higgs)" stroke-width="2.4" />
      <circle cx={sx(0)} cy={sy(0)} r="4.5" fill="var(--sig-high)" />
    {/snippet}
  </Plot>

  <div class="readout ui" aria-live="polite">
    <div class="card"><span class="k">Curvature at the vacuum</span><strong class="v">m<sub>H</sub> = {mH.toFixed(1)} GeV</strong><span class="s">V″(0) = m<sub>H</sub>²: the Higgs mass sets the parabola at the bottom.</span></div>
    <div class="card"><span class="k">Trilinear coupling 3κ m<sub>H</sub>²/v</span><strong class="v">{trilinear.toFixed(0)} GeV</strong><span class="s">{kappa === 1 ? 'The Standard Model value, fixed by the Higgs mass and v.' : `${kappa.toFixed(2)} times the Standard Model value (191 GeV).`}</span></div>
    {#if slider}
      <div class="card" class:warn={!stable}>
        <span class="k">Second valley</span>
        <strong class="v">{stable ? 'not lower than the vacuum' : 'deeper than the vacuum'}</strong>
        <span class="s">{stable ? 'At h ≈ ' + other.h.toFixed(0) + ' GeV the potential is ' + other.v.toFixed(2) + ' × 10⁸ GeV⁴ (the Standard Model has a mirror copy of the vacuum there).' : 'In this toy the state we live in would not be the lowest. Nothing measured says this: only the region near h = 0 is probed.'}</span>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .card.warn {
    border-color: var(--bad);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
</style>
