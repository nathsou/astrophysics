<!--
  Resolution and form factors. A beam of electrons of energy E scatters elastically from a proton through an angle θ; the momentum transferred
  is Q, and the length the scattering resolves is ħc/Q. The cross-section is that of a point charge (Mott) multiplied by |F(Q)|², the square of the
  form factor of the charge distribution. Choose the charge distribution and its radius and watch |F|² fall once ħc/Q becomes smaller than the radius.

  The form-factor curves are calculations for assumed shapes (exact formulas in `hep/scattering`). The "dipole" is an empirical shape often
  used to summarise electron-scattering data. The picture of the proton at the right is a SCHEMATIC of what each resolution would show:
  the thresholds are illustrative, the transition is gradual, and Chapter 13 shows the real measurements (deep inelastic scattering at SLAC).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { FORM_FACTOR_SHAPES, formFactor, resolutionFm, elasticQ2, dipoleLambda2, type FormFactorShape } from '$lib/hep/scattering';
  import { particle } from '$lib/hep/particles';

  let { n, caption, title = 'What the resolution shows: form factors and the proton' }: { n?: string | number; caption?: string; title?: string } = $props();

  const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const fmtPow = (v: number) => (v === 1 ? '1' : `10${String(Math.round(Math.log10(v))).split('').map((c) => SUP[c]).join('')}`);
  const Mp = particle(2212).mass;
  let shape = $state<FormFactorShape>('exponential');
  let rms = $state(0.84);
  let logE = $state(Math.log10(0.5));
  let angle = $state(60);

  const E = $derived(10 ** logE);
  const Q2 = $derived(elasticQ2(E, (angle * Math.PI) / 180, Mp));
  const Q = $derived(Math.sqrt(Q2));
  const lam = $derived(resolutionFm(Q));
  const F2 = $derived(formFactor(shape, Q, rms) ** 2);
  const xs = Array.from({ length: 160 }, (_, i) => 0.03 * (12 / 0.03) ** (i / 159));
  const curve = $derived(xs.map((q) => ({ q, f2: Math.max(1e-10, formFactor(shape, q, rms) ** 2) })));

  // the schematic: what a probe of resolution λ would show of a proton of radius R
  const R = $derived(rms);
  const regime = $derived(lam > 2.2 * R ? 'point' : lam > 0.2 ? 'blob' : 'partons');
  const name = $derived(regime === 'point' ? 'a point' : regime === 'blob' ? 'a smooth blob' : 'three hard points in a fog');
  const PS = 95; // pixels per fm in the schematic
  const blobR = $derived(Math.max(6, Math.hypot(R, lam * 0.5) * PS));
  const quarks = [
    [-0.36, 0.2], [0.34, 0.26], [0.02, -0.4],
  ] as const;
</script>

<Widget {title} subtitle="The harder the probe, the smaller the distance it resolves, and the faster elastic scattering from an extended target fades" {n} {caption} kind="Explore" onreset={() => { shape = 'exponential'; rms = 0.84; logE = Math.log10(0.5); angle = 60; }}>
  {#snippet controls()}
    <Segmented label="Charge distribution" size="sm" bind:value={shape} options={FORM_FACTOR_SHAPES.map((s) => ({ value: s.id, label: s.label }))} />
    <Slider bind:value={rms} min={0.1} max={2} step={0.01} label="Root-mean-square radius" format={(v) => `${v.toFixed(2)} fm`} />
    <Slider bind:value={logE} min={-1} max={1.3} step={0.01} label="Electron beam energy E" format={() => (E < 1 ? `${(E * 1000).toFixed(0)} MeV` : `${E.toFixed(2)} GeV`)} />
    <Slider bind:value={angle} min={5} max={150} step={1} label="Scattering angle θ" format={(v) => `${v.toFixed(0)}°`} />
  {/snippet}

  <div class="wrap">
    <div>
      <Plot
        label="Squared form factor against the momentum transfer Q on logarithmic axes: equal to one for a point charge and falling once ħc/Q is below the radius"
        x={{ type: 'log', domain: [0.03, 12], label: 'momentum transfer Q [GeV]', tickValues: [0.03, 0.1, 0.3, 1, 3, 10] }}
        y={{ type: 'log', domain: [1e-8, 4], label: '|F(Q)|², relative to a point charge', format: fmtPow }}
        height={300}
      >
        {#snippet marks({ sx, sy })}
          <line x1={sx(0.03)} x2={sx(12)} y1={sy(1)} y2={sy(1)} stroke="var(--ink-3)" stroke-dasharray="5 4" />
          <text x={sx(0.035)} y={sy(1) + 14} font-size="10" fill="var(--ink-2)">point charge: |F|² = 1</text>
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.q)} ${sy(p.f2)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
          <line x1={sx(Q)} x2={sx(Q)} y1="0" y2={sy(1e-8)} stroke="var(--sig-high)" stroke-width="1.6" />
          <circle cx={sx(Q)} cy={sy(Math.max(1e-8, F2))} r="5" fill="var(--sig-high)" />
          <line x1={sx(0.1973 / R)} x2={sx(0.1973 / R)} y1="0" y2={sy(1e-8)} stroke="var(--ink-3)" stroke-dasharray="2 4" />
          <text x={sx(0.1973 / R) + 4} y="14" font-size="10" fill="var(--ink-2)">Q = ħc/R</text>
        {/snippet}
      </Plot>
      <dl class="read ui" aria-live="polite">
        <div><dt>elastic ep, {E < 1 ? `${(E * 1000).toFixed(0)} MeV` : `${E.toFixed(2)} GeV`} through {angle}°: Q</dt><dd>{Q < 1 ? `${(Q * 1000).toFixed(0)} MeV` : `${Q.toFixed(2)} GeV`}</dd></div>
        <div><dt>length resolved, ħc/Q</dt><dd><strong>{lam.toFixed(lam < 0.1 ? 3 : 2)} fm</strong></dd></div>
        <div><dt>|F(Q)|² at this Q</dt><dd>{F2 >= 0.001 ? F2.toFixed(3) : F2.toExponential(1)}</dd></div>
        {#if shape === 'exponential'}<div><dt>dipole Λ² for this radius</dt><dd>{dipoleLambda2(rms).toFixed(3)} GeV²</dd></div>{/if}
      </dl>
    </div>

    <div>
      <svg viewBox="-150 -130 300 260" role="img" aria-label="Schematic of what a probe of this resolution would show of a proton: {name}">
        <rect x="-150" y="-130" width="300" height="260" fill="var(--screen-bg, #0a1018)" rx="6" />
        <defs>
          <radialGradient id="blob"><stop offset="0%" stop-color="var(--p-hadron)" stop-opacity="0.95" /><stop offset="60%" stop-color="var(--p-hadron)" stop-opacity="0.45" /><stop offset="100%" stop-color="var(--p-hadron)" stop-opacity="0" /></radialGradient>
          <radialGradient id="fog"><stop offset="0%" stop-color="var(--p-hadron)" stop-opacity="0.22" /><stop offset="100%" stop-color="var(--p-hadron)" stop-opacity="0" /></radialGradient>
        </defs>
        {#if regime === 'point'}
          <circle r={Math.max(8, lam * PS * 0.45)} fill="url(#blob)" />
          <circle r="2.5" fill="#fff" />
        {:else if regime === 'blob'}
          <circle r={blobR * 1.25} fill="url(#blob)" />
        {:else}
          <circle r={R * PS * 1.25} fill="url(#fog)" />
          {#each quarks as [qx, qy], i}
            <circle cx={qx * R * PS * 1.1} cy={qy * R * PS * 1.1} r="5" fill={['var(--p-electron)', 'var(--p-jet)', 'var(--p-boson)'][i]} />
          {/each}
        {/if}
        <line x1="-130" x2={-130 + PS * lam} y1="108" y2="108" stroke="#fff" stroke-width="2" />
        <text x="-130" y="100" font-size="10" fill="#fff">resolution ħc/Q = {lam.toFixed(2)} fm</text>
        <text x="-142" y="-112" font-size="11" fill="#fff" font-weight="600">SCHEMATIC: a proton seen as {name}</text>
        <text x="142" y="122" font-size="9" fill="#9aa8b8" text-anchor="end">not a measurement; thresholds illustrative</text>
      </svg>
      <p class="ui small">
        {#if regime === 'point'}The probe's wavelength is larger than the proton: it sees an object of no particular size, and scatters as from a point charge (|F|² ≈ 1).{:else if regime === 'blob'}The resolution is comparable with the radius: the charge distribution shows as an extended blob, and the cross-section is suppressed by |F|².{:else}At this resolution elastic scattering is almost absent (|F|² is tiny), but the electron can still strike something inside: Chapter 13 shows that it does, three hard centres, and that they are the quarks.{/if}
      </p>
    </div>
  </div>
</Widget>

<style>
  .wrap {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 820px) {
    .wrap {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    border-radius: 6px;
    display: block;
  }
  .read {
    margin: 0.5rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .read div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.2rem;
    font-size: 0.78rem;
  }
  .read dt {
    color: var(--ink-2);
  }
  .read dd {
    margin: 0;
    font-family: var(--font-mono);
    text-align: right;
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
    margin: 0.5rem 0 0;
  }
</style>
