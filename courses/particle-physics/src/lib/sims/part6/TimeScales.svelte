<!--
  Time scales of the top quark (Chapter 25). The top's lifetime ħ/Γ_t (Γ_t at leading order from `topWidth` of `hep/sm`, which scales as m_t³) against the time the strong
  force needs to dress a quark into hadrons, about ħ/Λ_QCD, and against other lifetimes from the particle table. Slide the top mass: the heavier it is, the sooner it decays.

    ::time-scales{n="25.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { topWidth, M_T, GAMMA_W, GAMMA_Z } from '$lib/hep/sm';
  import { HBAR_GEV_S } from '$lib/hep/units';

  let { n, caption, title = 'Does the top quark hadronise?' }: { n?: string | number; caption?: string; title?: string } = $props();

  let mt = $state(172.57);
  let lam = $state(0.2);
  const width = $derived(topWidth({ mt, qcd: false }));
  const tauTop = $derived(HBAR_GEV_S / width);
  const tauHad = $derived(HBAR_GEV_S / lam);
  const ratio = $derived(tauHad / tauTop);
  // the mass at which the top lifetime equals the hadronisation time
  const crossing = $derived.by(() => {
    let lo = 82, hi = 400;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (topWidth({ mt: mid }) > lam) hi = mid;
      else lo = mid;
    }
    return 0.5 * (lo + hi);
  });
  const rows = $derived([
    { label: 'top quark, ħ/Γ_t', t: tauTop, colour: 'var(--accent)', bold: true },
    { label: 'W boson, ħ/Γ_W', t: HBAR_GEV_S / GAMMA_W, colour: 'var(--series-5)' },
    { label: 'Z boson, ħ/Γ_Z', t: HBAR_GEV_S / GAMMA_Z, colour: 'var(--series-5)' },
    { label: 'light crossing a proton (1 fm / c)', t: 1e-15 / 299792458, colour: 'var(--ink-3)' },
    { label: 'hadronisation, ħ/Λ_QCD', t: tauHad, colour: 'var(--bad)', bold: true },
    { label: 'ρ meson (strong decay)', t: particle(113).lifetime, colour: 'var(--series-3)' },
    { label: 'π⁰', t: particle(111).lifetime, colour: 'var(--series-3)' },
    { label: 'B⁰ (b quark)', t: particle(511).lifetime, colour: 'var(--series-1)' },
    { label: 'D⁰ (c quark)', t: particle(421).lifetime, colour: 'var(--series-1)' },
    { label: 'τ lepton', t: particle(15).lifetime, colour: 'var(--series-8)' },
    { label: 'K_S⁰', t: particle(310).lifetime, colour: 'var(--series-8)' },
    { label: 'muon', t: particle(13).lifetime, colour: 'var(--series-8)' },
  ].sort((a, b) => a.t - b.t));
  const fmt = (t: number) => t.toExponential(1).replace('e-', ' × 10⁻').replace('e+', ' × 10');
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { mt = 172.57; lam = 0.2; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={mt} min={90} max={300} step={0.5} label="Top-quark mass, GeV" format={(v) => v.toFixed(1)} />
      <Slider bind:value={lam} min={0.1} max={0.5} step={0.01} label="Λ_QCD, GeV (the hadronisation scale)" format={(v) => v.toFixed(2)} />
    </div>
  {/snippet}
  <Plot
    x={{ type: 'log', domain: [1e-26, 1e-5], label: 'time [s]', tickValues: [1e-25, 1e-22, 1e-19, 1e-16, 1e-13, 1e-10, 1e-7], format: (v) => `10${String(Math.round(Math.log10(v))).replace(/./g, (c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? c))}` }}
    y={{ domain: [0, rows.length], label: '', tickValues: [] }}
    height={340}
    crosshair={false}
    margin={{ top: 8, right: 14, bottom: 42, left: 14 }}
    label="Lifetimes and time scales on a logarithmic axis, from 10 to the minus 26 to 10 to the minus 5 seconds: the top quark, W and Z live for a few times 10 to the minus 25 seconds, shorter than the 10 to the minus 24 seconds the strong force needs to form hadrons"
  >
    {#snippet marks({ sx, sy })}
      {#each rows as r, i}
        {@const y = sy(i + 0.5)}
        <line x1={sx(1e-26)} x2={sx(r.t)} y1={y} y2={y} stroke={r.colour} stroke-width={r.bold ? 6 : 3} opacity={r.bold ? 1 : 0.6} />
        <circle cx={sx(r.t)} cy={y} r={r.bold ? 5 : 3.5} fill={r.colour} />
        {@const over = sx(r.t) + 9 > sx(1e-5) - 150}
        <text x={over ? sx(r.t) - 8 : sx(r.t) + 9} y={over ? y - 8 : y + 4} text-anchor={over ? 'end' : 'start'} class="lbl">{r.label}: {fmt(r.t)} s</text>
      {/each}
    {/snippet}
  </Plot>
  <p class="ui note" aria-live="polite">
    At m<sub>t</sub> = {mt.toFixed(1)} GeV the leading-order width is Γ<sub>t</sub> = {width.toFixed(2)} GeV and the lifetime {fmt(tauTop)} s. The strong force needs about ħ/Λ<sub>QCD</sub> = {fmt(tauHad)} s to dress a quark: the top
    decays <strong>{ratio.toFixed(1)} times</strong> {ratio > 1 ? 'faster' : 'slower'} than it can hadronise. The two times are equal at m<sub>t</sub> = {crossing.toFixed(0)} GeV for this Λ<sub>QCD</sub>: a quark heavier than that decays before it forms hadrons.
    The b quark, whose weak decay takes 10⁻¹² s, hadronises long before it decays.
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
