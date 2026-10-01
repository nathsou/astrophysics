<!--
  A virtual e⁺e⁻ collider (Chapter 16 flagship).

    ::ee-collider{n="16.1" caption="…"}

  Tab 1 (Measure): choose a final state and √s; the collider runs for an integrated luminosity, the number of events is
  Poisson(σL), and the events come from `hep/gen` (hard process only: the angles, not the showers). It shows the counts, σ
  against the closed form 4πα²/3s, the cos θ distribution against (3/8)(1 + cos²θ) and the forward–backward asymmetry. Tab 2
  (Scan): the R ratio from pseudo-data, against the leading-order curve for a chosen number of colours.
  The "data" are simulated by the course's generator (photon exchange, α(0), perfect detector); the Z is a switch.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import {
    FINAL_LABEL,
    chi2OfColours,
    cosShape,
    energyGrid,
    histogramCos,
    measure,
    rModel,
    scanR,
    sigmaPb,
    sigmaPointPb,
    type FinalState,
  } from './collider';

  let { n, caption, title = 'A virtual e⁺e⁻ collider', tab: firstTab = 'measure' }: { n?: string | number; caption?: string; title?: string; tab?: 'measure' | 'scan' } = $props();

  let tab = $state<'measure' | 'scan'>(untrack(() => firstTab));
  let final = $state<FinalState>('mumu');
  let z = $state(false);
  let logE = $state(Math.log10(10));
  let logL = $state(Math.log10(20)); // pb⁻¹
  let seed = $state(4);
  // scan
  let muPairs = $state(3000);
  let nColours = $state(3);
  let qcd = $state(false);

  const sqrtS = $derived(10 ** logE);
  const lumi = $derived(10 ** logL);
  const fmtNum = (v: number, d = 3) => (v === 0 ? '0' : Math.abs(v) >= 1e4 ? v.toExponential(2) : Math.abs(v) < 1e-2 ? v.toFixed(4) : v.toPrecision(d));
  const fmtPb = (v: number) => (v >= 1000 ? `${(v / 1000).toPrecision(4)} nb` : `${v.toPrecision(4)} pb`);

  const meas = $derived(measure(final, z, sqrtS, lumi, seed));
  const bins = 20;
  const hist = $derived(histogramCos(meas.cosTheta, bins));
  const shape = $derived(cosShape(final, z, sqrtS, meas.afb));
  const expectedPerBin = (c: number) => meas.nShown * shape(c) * (2 / bins);
  const yMax = $derived(Math.max(5, ...hist.counts.map((c) => c + Math.sqrt(c)), ...Array.from({ length: 41 }, (_, i) => expectedPerBin(-1 + i / 20))) * 1.1);
  const pull = $derived((meas.sigmaMeasPb - meas.sigmaTheoryPb) / meas.sigmaErrPb);

  // σ against √s
  const eGrid = energyGrid(2, 200, 80);
  const sigmaCurve = $derived(eGrid.map((e) => ({ e, s: sigmaPb(final, z, e) })));
  const pointCurve = eGrid.map((e) => ({ e, s: sigmaPointPb(e) }));
  const sigLo = $derived(Math.min(...sigmaCurve.map((p) => p.s), ...pointCurve.map((p) => p.s)) * 0.6);
  const sigHi = $derived(Math.max(...sigmaCurve.map((p) => p.s), ...pointCurve.map((p) => p.s)) * 1.6);
  const pathOf = (pts: { e: number; s: number }[], sx: (v: number) => number, sy: (v: number) => number) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.e).toFixed(1)},${sy(Math.max(p.s, 1e-300)).toFixed(1)}`).join('');

  // the scan
  const scanE = energyGrid(1.5, 14, 36);
  const points = $derived(scanR(scanE, muPairs, seed, qcd));
  const fit = $derived(chi2OfColours(points, nColours, qcd));
  const modelCurve = $derived(energyGrid(1.5, 14, 160).map((e) => ({ e, s: rModel(e, nColours, qcd) })));
  const guides = [
    { y: 2, label: 'uds: 2' },
    { y: 10 / 3, label: '+c: 10/3' },
    { y: 11 / 3, label: '+b: 11/3' },
  ];
  const noColour = [2 / 3, 10 / 9, 11 / 9];
  const chiBad = $derived(fit.chi2 / fit.ndf > 2);
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Segmented
      label="What to show"
      size="sm"
      bind:value={tab}
      options={[
        { value: 'measure', label: 'Measure at one energy' },
        { value: 'scan', label: 'Scan for R' },
      ]}
    />
    {#if tab === 'measure'}
      <Segmented
        label="Final state"
        size="sm"
        bind:value={final}
        options={[
          { value: 'mumu', label: 'μ⁺μ⁻' },
          { value: 'hadrons', label: 'quarks (hadrons)' },
          { value: 'bhabha', label: 'e⁺e⁻ (Bhabha)' },
        ]}
      />
      <Slider bind:value={logE} min={Math.log10(2)} max={Math.log10(200)} step={0.01} label="Collision energy √s" format={(v) => `${(10 ** v).toPrecision(3)} GeV`} />
      <Slider bind:value={logL} min={-1} max={4} step={0.05} label="Integrated luminosity" format={(v) => `${(10 ** v).toPrecision(3)} pb⁻¹`} />
      <Toggle bind:checked={z} label="Add the Z boson (Chapter 23)" />
    {:else}
      <Slider bind:value={muPairs} min={100} max={100000} step={100} label="μ⁺μ⁻ pairs collected at each energy" format={(v) => v.toFixed(0)} />
      <Slider bind:value={nColours} min={1} max={6} step={1} label="Number of colours in the model curve" format={(v) => v.toFixed(0)} />
      <Toggle bind:checked={qcd} label="Gluon radiation, 1 + αs/π (Chapter 18)" />
    {/if}
    <Button size="sm" onclick={() => (seed = seed + 1)}>Run again (seed {seed})</Button>
  {/snippet}

  {#if tab === 'measure'}
    <div class="grid">
      <div>
        <p class="cap ui">Angle of the outgoing {final === 'mumu' ? 'μ⁻' : final === 'hadrons' ? 'quark' : 'e⁻'} to the e⁻ beam, {meas.nShown.toLocaleString()} events</p>
        <Plot
          height={260}
          label="Histogram of cos θ for the simulated events with the expected curve"
          x={{ domain: [-1, 1], label: 'cos θ', ticks: 8, format: (v) => v.toFixed(2).replace(/\.?0+$/, '') }}
          y={{ domain: [0, yMax], label: 'events per bin', ticks: 5 }}
        >
          {#snippet marks({ sx, sy })}
            {#each hist.counts as c, i}
              {@const xc = (hist.edges[i]! + hist.edges[i + 1]!) / 2}
              <rect x={sx(hist.edges[i]!) + 1} y={sy(c)} width={Math.max(0, sx(hist.edges[i + 1]!) - sx(hist.edges[i]!) - 2)} height={Math.max(0, sy(0) - sy(c))} fill="var(--series-1)" opacity="0.35" />
              <line x1={sx(xc)} x2={sx(xc)} y1={sy(c + Math.sqrt(c))} y2={sy(Math.max(0, c - Math.sqrt(c)))} stroke="var(--series-1)" stroke-width="1.4" />
            {/each}
            <path
              d={Array.from({ length: 121 }, (_, i) => {
                const c = -0.9999 + (1.9998 * i) / 120;
                return `${i ? 'L' : 'M'}${sx(c).toFixed(1)},${sy(expectedPerBin(c)).toFixed(1)}`;
              }).join('')}
              fill="none"
              stroke="var(--series-7)"
              stroke-width="2"
            />
          {/snippet}
        </Plot>
        <p class="note ui">
          Line: {final === 'bhabha' ? 'the Bhabha formula, with its t-channel spike at cos θ = 1' : '(3/8)(1 + cos²θ)' + (z ? ' + (A_FB term from the fit)' : '')}, scaled to the number of events. Bars: counts with √N error bars.
        </p>
      </div>
      <div>
        <p class="cap ui">Cross-section against √s ({FINAL_LABEL[final]}{z ? ', γ + Z' : ', photon only'})</p>
        <Plot
          height={260}
          label="Cross-section against centre-of-mass energy on logarithmic axes, with the measured point"
          x={{ type: 'log', domain: [2, 200], label: '√s [GeV]', tickValues: [2, 5, 10, 20, 50, 100, 200] }}
          y={{ type: 'log', domain: [sigLo, sigHi], label: 'σ [pb]' }}
        >
          {#snippet marks({ sx, sy })}
            <path d={pathOf(pointCurve, sx, sy)} fill="none" stroke="var(--ink-3)" stroke-width="1.2" stroke-dasharray="5 4" />
            <path d={pathOf(sigmaCurve, sx, sy)} fill="none" stroke="var(--series-2)" stroke-width="2" />
            <line x1={sx(sqrtS)} x2={sx(sqrtS)} y1={sy(Math.max(meas.sigmaMeasPb - meas.sigmaErrPb, sigLo))} y2={sy(meas.sigmaMeasPb + meas.sigmaErrPb)} stroke="var(--series-1)" stroke-width="2" />
            <circle cx={sx(sqrtS)} cy={sy(Math.max(meas.sigmaMeasPb, sigLo))} r="5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="1.5" />
          {/snippet}
        </Plot>
        <p class="note ui">Dashed: the point cross-section 4πα²/3s = 86.8 nb/s[GeV²], for reference. Solid: the generator's cross-section for this final state. Dot: this run.</p>
      </div>
    </div>
    <dl class="readout ui" aria-live="polite">
      <div><dt>collisions in the run</dt><dd>{meas.nObserved.toLocaleString()}</dd></div>
      <div><dt>σ measured = N/L</dt><dd>{fmtPb(meas.sigmaMeasPb)} ± {fmtPb(meas.sigmaErrPb)}</dd></div>
      <div><dt>σ theory</dt><dd>{fmtPb(meas.sigmaTheoryPb)}</dd></div>
      <div><dt>pull</dt><dd>{fmtNum(pull, 2)} σ</dd></div>
      <div><dt>A<sub>FB</sub> from the events</dt><dd>{fmtNum(meas.afb, 3)} ± {fmtNum(meas.afbErr, 2)}</dd></div>
    </dl>
    {#if z}
      <p class="note ui">With the Z switched on, the cross-section leaves the 1/s line as √s nears 91 GeV and the angular distribution becomes lopsided (A<sub>FB</sub> ≠ 0). Chapter 23 explains both. The generator uses α(0) in the photon exchange.</p>
    {/if}
  {:else}
    <p class="cap ui">R = σ(e⁺e⁻ → hadrons) / σ(e⁺e⁻ → μ⁺μ⁻), pseudo-data from the generator (three colours built in), {muPairs.toLocaleString()} μ⁺μ⁻ pairs per point</p>
    <Plot
      height={330}
      label="The R ratio against centre-of-mass energy: pseudo-data with error bars, the model curve for the chosen number of colours, and the plateau values for three colours"
      x={{ type: 'log', domain: [1.5, 14], label: '√s [GeV]', tickValues: [2, 3, 4, 5, 7, 10, 14] }}
      y={{ domain: [0, 5], label: 'R', ticks: 5 }}
    >
      {#snippet marks({ sx, sy, width })}
        {#each guides as g}
          <line x1="0" x2={width} y1={sy(g.y)} y2={sy(g.y)} stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="2 5" />
          <text x={width - 4} y={sy(g.y) - 4} text-anchor="end" class="gl">{g.label}</text>
        {/each}
        {#each noColour as y}
          <line x1="0" x2={width} y1={sy(y)} y2={sy(y)} stroke="var(--series-8)" stroke-width="1" stroke-dasharray="7 4" />
        {/each}
        <text x="6" y={sy(2 / 3) - 4} class="gl">without colour: 2/3, 10/9, 11/9</text>
        <path d={modelCurve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.e).toFixed(1)},${sy(p.s).toFixed(1)}`).join('')} fill="none" stroke="var(--series-2)" stroke-width="2.2" />
        {#each points as p}
          <line x1={sx(p.sqrtS)} x2={sx(p.sqrtS)} y1={sy(p.r - p.err)} y2={sy(p.r + p.err)} stroke="var(--series-1)" stroke-width="1.5" />
          <circle cx={sx(p.sqrtS)} cy={sy(p.r)} r="3.2" fill="var(--series-1)" />
        {/each}
      {/snippet}
    </Plot>
    <dl class="readout ui" aria-live="polite">
      <div><dt>model</dt><dd>N<sub>c</sub> = {nColours}</dd></div>
      <div><dt>χ² / points</dt><dd class:bad={chiBad}>{fit.chi2.toFixed(1)} / {fit.ndf}</dd></div>
      <div><dt>verdict</dt><dd>{chiBad ? 'the curve misses the points' : 'the curve describes the points'}</dd></div>
    </dl>
    <p class="note ui">
      The steps are the openings of the charm and bottom channels. In this model they sit at twice the quark mass from the particle table (about 2.5 and 8.4 GeV) and are smoothed by the threshold factor; in real data the quarks appear as mesons, so the charm step is near 3.7–4 GeV and the bottom step near 10.5–11 GeV, and the narrow J/ψ and Υ resonances, which this leading-order model does not contain, stand on top of them. Try N<sub>c</sub> = 1, 2, 4 and watch the χ².
    </p>
  {/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cap {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    margin: 0.7rem 0 0;
    font-size: 0.85rem;
  }
  .readout div {
    display: flex;
    flex-direction: column;
  }
  dt {
    font-size: 0.72rem;
    color: var(--ink-3);
    text-transform: none;
    letter-spacing: 0;
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
  dd.bad {
    color: var(--bad);
    font-weight: 600;
  }
  .gl {
    font-size: 10.5px;
    fill: var(--ink-3);
  }
</style>
