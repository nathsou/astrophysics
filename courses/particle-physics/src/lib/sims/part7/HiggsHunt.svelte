<!--
  The diphoton analysis of Chapter 29 on SIMULATED events: the course's own pipeline (generator → detector → reconstruction → trigger, made once by
  scripts/data/higgs-sim.ts) has produced 100,000 continuum γγ events in the mass window, which stand for 9.9 fb⁻¹ at 8 TeV, and 6,000 H → γγ events. The
  figure builds a data set from them, applies the selection you set, histograms the diphoton mass, fits a Crystal Ball peak on an exponential background with
  the analysis library, and reports the mass, the yield and the local significance with their uncertainties.

    ::higgs-hunt{n="29.3" caption="…"}

  WHAT IS SIMULATED. Leading-order matrix elements; the signal cross-section is multiplied by K = 3.4 (the rough ratio of the higher-order to the leading-order
  gg → H cross-section); the continuum has no K factor; the jets that fake photons are not simulated, so the background is smaller than a real one and the
  significance is flattered. No pile-up. The sample is a pool: a smaller luminosity keeps a random fraction of it, which understates the fluctuations a little.
  Switching on "reveal the truth" shows which events are signal, which a real data set can never do.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { significance, pToZ } from '$lib/hep/analysis';
  import { sig } from '$lib/sims/stats/common';
  import {
    BACKGROUND_LABEL, DEFAULT_GG_CUTS, GG_SELECTED, diphotonCutflow, diphotonStage, drawDataset, fitDiphoton, loadDiphoton, loadRealDiphoton, signalShapeFromSimulation,
    type Background, type DiphotonCuts, type DiphotonSample, type MassFit, type SignalShape,
  } from './higgs';

  let { n, caption, title = 'The diphoton analysis: from simulated collisions to a fitted peak' }: { n?: string | number; caption?: string; title?: string } = $props();

  let sample = $state<DiphotonSample | null>(null);
  let shape = $state<SignalShape | null>(null);
  let failed = $state<string | null>(null);
  let real = $state<{ m: number[]; meta: Record<string, unknown> } | null>(null);

  let mu = $state(1);
  let lumi = $state(1);
  let seed = $state(1);
  let ptFrac1 = $state(DEFAULT_GG_CUTS.ptFrac1);
  let ptFrac2 = $state(DEFAULT_GG_CUTS.ptFrac2);
  let isoTrackMax = $state(DEFAULT_GG_CUTS.isoTrackMax);
  let useTrigger = $state(true);
  let truth = $state(false);
  let source = $state<'sim' | 'real'>('sim');
  let bkgModel = $state<Background>('bern3');

  onMount(async () => {
    try {
      const s = await loadDiphoton(base);
      shape = signalShapeFromSimulation(s, DEFAULT_GG_CUTS);
      sample = s;
      real = await loadRealDiphoton(base);
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const cuts = $derived<DiphotonCuts>({ ...DEFAULT_GG_CUTS, trigger: useTrigger, ptFrac1, ptFrac2, isoTrackMax });
  const flow = $derived(sample ? diphotonCutflow(sample, cuts, mu) : []);
  const drawn = $derived(sample ? drawDataset(sample, { mu, fraction: lumi, seed }) : []);
  const selected = $derived.by(() => {
    if (!sample) return [];
    return drawn.filter((d) => diphotonStage(d.event, cuts) === GG_SELECTED);
  });
  const masses = $derived(source === 'real' && real ? real.m.filter((m) => m >= 105 && m <= 160) : selected.map((d) => d.m));
  const result = $derived.by<MassFit | null>(() => {
    if (!shape || masses.length < 50) return null;
    try {
      return fitDiphoton(masses, shape, [105, 160], 55, bkgModel);
    } catch {
      return null;
    }
  });

  const RANGE: [number, number] = [105, 160];
  const BINS = 55;
  const edges = Array.from({ length: BINS + 1 }, (_, i) => RANGE[0] + ((RANGE[1] - RANGE[0]) * i) / BINS);
  const counts = $derived(result ? Array.from(result.hist.counts) : new Array<number>(BINS).fill(0));
  const truthSig = $derived.by(() => {
    const c = new Array<number>(BINS).fill(0);
    if (source === 'sim') for (const d of selected) if (d.signal && d.m >= RANGE[0] && d.m < RANGE[1]) c[Math.floor(((d.m - RANGE[0]) / (RANGE[1] - RANGE[0])) * BINS)]!++;
    return c;
  });
  const total = $derived(result ? result.background.map((b, i) => b + result.signalCurve[i]!) : []);
  const yMax = $derived(Math.max(10, ...counts) * 1.12);
  const yMin = $derived(Math.max(0, Math.min(...counts) * 0.9 - 5));

  // the window of ±2σ around the fitted mass, for the counting estimate
  const win = $derived.by(() => {
    if (!result || !shape) return null;
    const centre = shape.peak + result.shift.value;
    const lo = centre - 2 * shape.s1, hi = centre + 2 * shape.s1;
    let nObs = 0, b = 0, s = 0;
    for (let i = 0; i < BINS; i++) {
      const c = 0.5 * (edges[i]! + edges[i + 1]!);
      if (c >= lo && c < hi) { nObs += counts[i]!; b += result.background[i]!; s += result.signalCurve[i]!; }
    }
    return { lo, hi, nObs, b, s, zAsimov: s > 0 && b > 0 ? significance(s, b) : 0 };
  });
  const sigFlow = $derived(flow.length ? flow[flow.length - 1]!.signal : 0);
  const bkgFlow = $derived(flow.length ? flow[flow.length - 1]!.background : 0);
  const fmtN = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-GB') : sig(x, 3));
  const resid = $derived(result ? counts.map((c, i) => c - result.background[i]!) : []);
  const residMax = $derived(Math.max(5, ...resid.map((r, i) => Math.abs(r) + Math.sqrt(Math.max(1, counts[i]!)))) * 1.1);
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={mu} min={0} max={3} step={0.1} labelHtml={'<span style="text-transform:none;font-variant:normal">Signal strength μ (1 = the Standard Model, with K = 3.4)</span>'} format={(v) => v.toFixed(1)} />
    <Slider bind:value={lumi} min={0.25} max={1} step={0.05} label="Luminosity (fraction of 9.9 fb⁻¹ at 8 TeV)" format={(v) => `${(v * 9.9).toFixed(1)} fb⁻¹`} />
    <Slider bind:value={ptFrac1} min={0.2} max={0.5} step={0.01} labelHtml={'<span style="text-transform:none;font-variant:normal">Leading photon p<sub>T</sub> / m<sub>γγ</sub> above</span>'} format={(v) => v.toFixed(2)} />
    <Slider bind:value={ptFrac2} min={0.15} max={0.4} step={0.01} labelHtml={'<span style="text-transform:none;font-variant:normal">Second photon p<sub>T</sub> / m<sub>γγ</sub> above</span>'} format={(v) => v.toFixed(2)} />
    <Slider bind:value={isoTrackMax} min={0.02} max={0.5} step={0.01} label="Track isolation below" format={(v) => v.toFixed(2)} />
    <span class="row">
      <Toggle bind:checked={useTrigger} label="Require the trigger" />
      <Toggle bind:checked={truth} label="Reveal the truth (simulation only)" />
      <Segmented
        label="Background function"
        bind:value={bkgModel}
        options={[{ value: 'exp', label: 'Exponential' }, { value: 'bern3', label: 'Bernstein 3' }, { value: 'bern4', label: 'Bernstein 4' }]}
      />
      <Button size="sm" onclick={() => (seed = seed + 1)}>New data set (seed {seed})</Button>
      {#if real}<Button size="sm" onclick={() => (source = source === 'sim' ? 'real' : 'sim')}>Source: {source === 'sim' ? 'simulation' : 'real data'}</Button>{/if}
    </span>
  {/snippet}

  {#if failed}
    <p class="ui err">Could not load the simulated sample: {failed}</p>
  {:else if !sample}
    <p class="ui">Loading the simulated events…</p>
  {:else}
    <div class="ui flow" role="table" aria-label="Cut flow: expected events after each stage of the selection">
      <div class="r h" role="row"><span role="columnheader">Stage</span><span role="columnheader">Signal</span><span role="columnheader">Continuum</span><span role="columnheader">S / B</span></div>
      {#each flow as f, i}
        <div class="r" role="row"><span role="cell">{f.name}</span><span role="cell">{fmtN(f.signal)}</span><span role="cell">{fmtN(f.background)}</span><span role="cell">{i > 0 && f.background > 0 ? sig(f.signal / f.background, 2) : '—'}</span></div>
      {/each}
    </div>

    {#if result}
      <HepHist
        label="Histogram of the diphoton invariant mass from 105 to 160 GeV with the data as points, the fitted background and the fitted signal plus background"
        series={[
          ...(truth && source === 'sim' ? [{ edges, counts: counts.map((c, i) => c), label: 'signal events (truth)', color: 'var(--sig-high)', fill: true }, { edges, counts: counts.map((c, i) => c - truthSig[i]!), label: 'continuum events (truth)', color: 'var(--series-5)', fill: true }] : []),
          { edges, counts: result.background, label: 'fitted background', color: 'var(--series-2)' },
          { edges, counts: total, label: 'fitted signal + background', color: 'var(--series-1)' },
          { edges, counts, label: source === 'real' ? 'real data' : 'simulated data', color: 'var(--fg)', points: true, errors: true },
        ]}
        x={{ domain: RANGE, label: 'm(γγ) [GeV]' }}
        y={{ domain: [yMin, yMax], label: 'events per GeV' }}
        height={300}
      />
      <h5 class="ui sub">Data minus the fitted background</h5>
      <Plot x={{ domain: RANGE, label: 'm(γγ) [GeV]' }} y={{ domain: [-residMax, residMax], label: 'events' }} height={170} label="Data minus the fitted background in each bin, with the fitted signal curve">
        {#snippet marks({ sx, sy })}
          <line x1={sx(RANGE[0])} x2={sx(RANGE[1])} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" />
          <path d={result.signalCurve.map((c, i) => `${i ? 'L' : 'M'}${sx(edges[i]!)},${sy(c)}L${sx(edges[i + 1]!)},${sy(c)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2" />
          {#each resid as r, i}
            {@const cx = sx(0.5 * (edges[i]! + edges[i + 1]!))}
            {@const e = Math.sqrt(Math.max(1, counts[i]!))}
            <line x1={cx} x2={cx} y1={sy(r - e)} y2={sy(r + e)} stroke="var(--fg)" />
            <circle {cx} cy={sy(r)} r="2.4" fill="var(--fg)" />
          {/each}
        {/snippet}
      </Plot>

      <div class="readout ui" aria-live="polite">
        <div class="card hot">
          <span class="k">Mass of the peak, from its shift against the simulation</span>
          <strong class="v">{result.mass.value.toFixed(2)} ± {result.mass.error.toFixed(2)} GeV</strong>
          <span class="s">The shift is {result.shift.value.toFixed(2)} ± {result.shift.error.toFixed(2)} GeV from a simulated peak at {shape ? shape.peak.toFixed(2) : '?'} GeV (the generated mass is {shape ? shape.mH.toFixed(1) : '?'} GeV: the toy detector's photon energy scale is 1.3 % high, and this is built into the template). The peak's shape, a core of {shape ? shape.s1.toFixed(2) : '?'} GeV and a wider part, is fixed from the simulated signal alone; the data here are drawn from the same simulation, so the fit should return {shape ? shape.mH.toFixed(1) : '?'} GeV, within its error.</span>
        </div>
        <div class="card">
          <span class="k">Signal yield</span>
          <strong class="v">{result.signalYield.value.toFixed(0)} ± {result.signalYield.error.toFixed(0)} events</strong>
          <span class="s">{source === 'sim' ? `The data set holds ${selected.filter((d) => d.signal).length} signal events after the selection (known only because this is simulation).` : 'From the real file.'} The expected number at μ = 1 is {fmtN(sigFlow)}.</span>
        </div>
        <div class="card">
          <span class="k">Local significance</span>
          <strong class="v">{result.z0.toFixed(2)}σ <small>(p = {result.p0 < 0.5 ? result.p0.toExponential(1) : '0.5'})</small></strong>
          <span class="s">√q₀ from the likelihood ratio of this fit against the same fit with no signal. Local: the mass is free to float, so the global significance is smaller (Chapter 28).</span>
        </div>
        {#if win}
          <div class="card">
            <span class="k">Counting in m = {win.lo.toFixed(1)} to {win.hi.toFixed(1)} GeV (±2σ)</span>
            <strong class="v">{win.nObs} observed, {fmtN(win.b)} background, {fmtN(win.s)} signal</strong>
            <span class="s">Expected significance for these s and b: {win.zAsimov.toFixed(2)}σ by the Asimov formula. Fit quality with the {BACKGROUND_LABEL[bkgModel]}: χ²/ndf = {result.chi2.toFixed(1)}/{result.ndf}, p = {result.pValueFit.toFixed(2)}.</span>
          </div>
        {/if}
      </div>
      <p class="ui note">Simulated at 8 TeV with leading-order matrix elements, no pile-up, no photon-like jets and no K factor for the continuum: the continuum is smaller than a real one, and the significance is therefore better than a real analysis of the same data would find. The signal is multiplied by K = 3.4. These are the course's numbers, not the experiments'.</p>
    {:else}
      <p class="ui">Too few events pass the selection to fit.</p>
    {/if}
  {/if}
</Widget>

<style>
  .row {
    display: inline-flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .err {
    color: var(--bad);
  }
  .flow {
    display: grid;
    gap: 1px;
    margin-bottom: 0.8rem;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .flow .r {
    display: grid;
    grid-template-columns: minmax(10rem, 3fr) 1fr 1fr 0.7fr;
    gap: 0.5rem;
    padding: 0.15rem 0.4rem;
    background: var(--pn);
  }
  .flow .r.h {
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
  }
  .flow .r span:not(:first-child) {
    text-align: right;
  }
  .sub {
    margin: 0.6rem 0 0.1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
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
  .card.hot {
    border-color: var(--sig-high);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
  }
  .v small {
    font-weight: 400;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-top: 0.6rem;
  }
</style>
