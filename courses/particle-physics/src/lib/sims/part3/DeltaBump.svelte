<!--
  The Δ(1232) in pion–proton scattering (Chapter 12). The pion beam's kinetic energy on a stationary proton sets √s (hep/kinematics); a
  Breit–Wigner resonance with the table's mass and width gives the cross-section. π⁺p is pure isospin 3/2; π⁻p is one third of it. A MODEL
  CURVE, not data: the peak height is the unitarity limit of a single J = 3/2 partial wave, which it nearly saturates in the real data.

    ::delta-bump{n="12.2" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { twoBodyMomentum } from '$lib/hep/kinematics';
  import { unitarityLimit, GEV2_TO_MB } from '$lib/hep/su3';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  const mp = particle(2212).mass, mpi = particle(211).mass, D = particle(2224);
  const M = D.mass, G = D.width;
  let T = $state(190); // MeV, pion kinetic energy
  const sqrtS = (Tmev: number) => Math.sqrt(mp * mp + mpi * mpi + 2 * mp * (mpi + Tmev / 1000));
  const kStar = (s: number) => twoBodyMomentum(s, mp, mpi);
  // A relativistic Breit–Wigner with a p-wave width, Γ(W) = Γ₀ (k/k₀)³ (M/W), times the unitarity factor 8π/k² of a single J = 3/2 wave:
  // σ(W) = (8π/k²) (M Γ)² / ((W² − M²)² + (M Γ)²). At W = M this is exactly the unitarity limit.
  const kPeak = kStar(M);
  const peak = unitarityLimit(kPeak, 3, 0, 1) * GEV2_TO_MB; // mb
  const bw = (W: number) => {
    const k = kStar(W);
    if (!(k > 0)) return 0;
    const gam = G * (k / kPeak) ** 3 * (M / W);
    const mg2 = (M * gam) ** 2;
    return unitarityLimit(k, 3, 0, 1) * GEV2_TO_MB * (mg2 / ((W * W - M * M) ** 2 + mg2));
  };
  const sigmaPlus = (Tmev: number) => bw(sqrtS(Tmev));
  const sigmaMinus = (Tmev: number) => sigmaPlus(Tmev) / 3; // the I = 1/2 amplitude is neglected
  const grid = Array.from({ length: 140 }, (_, i) => 40 + (i * 460) / 139);
  const path = (f: (t: number) => number, sx: (v: number) => number, sy: (v: number) => number) => grid.map((t, i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(f(t)).toFixed(1)}`).join('');
  const Tpeak = 1000 * ((M * M - mp * mp - mpi * mpi) / (2 * mp) - mpi);
  const s_now = $derived(sqrtS(T));
</script>

<Widget title="The Δ resonance: a bump in π⁺p scattering" {n} {caption} kind="Model" live={false}>
  {#snippet controls()}
    <Slider bind:value={T} min={40} max={500} step={1} label="Kinetic energy of the pion beam on a stationary proton" format={(v) => `${v.toFixed(0)} MeV`} />
  {/snippet}
  <Plot
    height={260}
    label="Model cross-sections for pi plus p and pi minus p against the pion beam energy: a peak near 190 MeV, with the pi minus p curve one third as high."
    x={{ domain: [40, 500], label: 'pion kinetic energy [MeV]', ticks: 9 }}
    y={{ domain: [0, 230], label: 'σ [mb]  (model)', ticks: 5 }}
  >
    {#snippet marks({ sx, sy })}
      <path d={path(sigmaPlus, sx, sy)} class="p3-line" stroke="var(--series-7)" />
      <path d={path(sigmaMinus, sx, sy)} class="p3-line" stroke="var(--series-1)" stroke-dasharray="6 4" />
      <line x1={sx(T)} x2={sx(T)} y1="0" y2="1000" stroke="var(--series-8)" stroke-dasharray="2 3" />
      <text x={sx(Tpeak) + 8} y={sy(peak) + 4} class="p3-tag">Δ: {(M * 1000).toFixed(0)} MeV, Γ = {(G * 1000).toFixed(0)} MeV</text>
    {/snippet}
  </Plot>
  <ul class="ui p3-note" style="list-style:none;padding:0;display:flex;gap:1rem;flex-wrap:wrap">
    <li><span style="color: var(--series-7)">━</span> π⁺ p (pure isospin 3/2)</li>
    <li><span style="color: var(--series-1)">┄</span> π⁻ p (one third of it, I = 1/2 neglected)</li>
  </ul>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>√s at this beam energy</dt><dd>{(s_now * 1000).toFixed(0)} MeV (resonance: {(M * 1000).toFixed(0)} MeV)</dd></div>
    <div><dt>model σ(π⁺p) · σ(π⁻p)</dt><dd>{sigmaPlus(T).toFixed(0)} mb · {sigmaMinus(T).toFixed(0)} mb</dd></div>
    <div><dt>pion energy at the peak</dt><dd>{Tpeak.toFixed(0)} MeV (√s = M)</dd></div>
    <div><dt>peak height from unitarity</dt><dd>8π/k² = {peak.toFixed(0)} mb, k = {(kPeak * 1000).toFixed(0)} MeV/c</dd></div>
  </dl>
  <p class="p3-note ui">This is a model curve, not data. Its three inputs are the particle table's mass and width of the Δ, the kinematics of a pion on a proton at rest, and the largest cross-section one partial wave of angular momentum 3/2 can give; the real π⁺p cross-section peaks at about 200 mb. The π⁻p curve is a third as high by the isospin Clebsch–Gordan coefficients, the ratio 3 : 1 that helped to show the resonance has isospin 3/2.</p>
</Widget>
