<!--
  One analysis, two sources (Chapter 29): the four-lepton analysis `analyse4l` runs unchanged on
    (a) REAL data: 278 four-lepton candidate events recorded by CMS in 2011 and 2012 (CMS Open Data education sample, mirrored on GitHub; see
        static/data/h4l-cms-opendata.manifest.json for the source, the licence and the checksum), and
    (b) SIMULATION: the course's own H → ZZ* → 4ℓ events (generator → detector → reconstruction → trigger, scripts/data/higgs-sim.ts) added to the
        backgrounds that the open-data notebook gives (CMS's own simulation of ZZ, Drell–Yan and tt̄, weighted to the data's luminosity). The course
        has no ZZ* generator in the figure's sample, so the BACKGROUNDS ARE NOT THE COURSE'S: they come from the notebook, and are labelled so.
  Press the source button to swap one for the other: nothing else changes.

    ::four-lepton-swap{n="29.4" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { poissonSample } from '$lib/hep/analysis';
  import { getProcess } from '$lib/hep/gen';
  import { rng as makeRng } from '$lib/hep/random';
  import { pairMass } from '$lib/hep/kinematics';
  import { sig, fmtP } from '$lib/sims/stats/common';
  import {
    DEFAULT_4L_CUTS, countingWindow, histogram4l, load4lSim, loadCmsOpenData, templateFit,
    type Cuts4l, type CmsOpenData, type Event4l,
  } from './higgs';

  let { n, caption, title = 'The four-lepton analysis on real data and on simulation' }: { n?: string | number; caption?: string; title?: string } = $props();

  let cms = $state<CmsOpenData | null>(null);
  let sim = $state<Event4l[] | null>(null);
  let failed = $state<string | null>(null);
  let sigmaLO = $state<{ s8: number; s7: number; generated: number } | null>(null);
  let source = $state<'real' | 'sim'>('real');
  let template = $state<'cms' | 'course'>('cms');
  let seed = $state(1);
  let pt1 = $state(DEFAULT_4L_CUTS.pt1);
  let pt2 = $state(DEFAULT_4L_CUTS.pt2);
  let mZ2Min = $state(DEFAULT_4L_CUTS.mZ2Min);

  const K_H = 3.4;
  const LUMI_7 = 2.3, LUMI_8 = 11.6; // fb⁻¹, as given in the notebook's plot title

  onMount(async () => {
    try {
      const [c, s] = await Promise.all([loadCmsOpenData(base), load4lSim(base)]);
      const proc = getProcess('pp->H->ZZ->4l');
      sigmaLO = { s8: proc.sigma(8000), s7: proc.sigma(7000), generated: Number((s.manifest.sample as { generated: number }).generated) };
      cms = c;
      sim = s.events;
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const cuts = $derived<Cuts4l>({ ...DEFAULT_4L_CUTS, pt1, pt2, mZ2Min });
  const EDGES = Array.from({ length: 38 }, (_, i) => 70 + 3 * i);
  const realHist = $derived(cms ? histogram4l(cms.events, cuts) : null);
  const simHist = $derived(sim ? histogram4l(sim.filter((e) => e.trigger), cuts) : null);
  /** The course's simulated signal, as expected events in the data's luminosity: σ(LO) × K × L per generated event. */
  const courseSignal = $derived.by(() => {
    if (!simHist || !sigmaLO) return new Array<number>(37).fill(0);
    const expected = K_H * (sigmaLO.s8 * LUMI_8 + sigmaLO.s7 * LUMI_7) * 1000;
    const w = expected / sigmaLO.generated;
    return Array.from(simHist.h.counts, (c) => c * w);
  });
  const bkgTotal = $derived(cms ? cms.mc.zz.map((v, i) => v + cms!.mc.dy[i]! + cms!.mc.ttbar[i]!) : []);
  const signalTemplate = $derived(template === 'cms' ? (cms ? cms.mc.hzz : []) : courseSignal);
  const pseudo = $derived.by(() => {
    if (!cms) return [];
    const r = makeRng(seed);
    return bkgTotal.map((b, i) => poissonSample(r, b + courseSignal[i]!));
  });
  const observed = $derived(source === 'real' ? (realHist ? Array.from(realHist.h.counts) : []) : pseudo);
  const sel = $derived(source === 'real' ? realHist?.passed ?? 0 : observed.reduce((a, b) => a + b, 0));

  const WINDOW: [number, number] = [17, 20]; // bins 121 to 130 GeV: the notebook's simulated signal sits here
  const count = $derived(observed.length && cms ? countingWindow(observed, signalTemplate, bkgTotal, WINDOW) : null);
  const fit = $derived(observed.length && signalTemplate.length ? templateFit(observed, signalTemplate, bkgTotal) : null);
  const yMax = $derived(Math.max(8, ...observed, ...bkgTotal.map((b, i) => b + (signalTemplate[i] ?? 0))) * 1.2);

  const stack = $derived.by(() => {
    if (!cms) return [];
    const tt = cms.mc.ttbar;
    const dyTt = tt.map((v, i) => v + cms!.mc.dy[i]!);
    const zzDyTt = dyTt.map((v, i) => v + cms!.mc.zz[i]!);
    const all = zzDyTt.map((v, i) => v + (signalTemplate[i] ?? 0));
    return [
      { edges: EDGES, counts: all, label: template === 'cms' ? 'H (125 GeV), CMS simulation' : 'H (125 GeV), course simulation', color: 'var(--sig-high)', fill: true },
      { edges: EDGES, counts: zzDyTt, label: 'ZZ (CMS simulation)', color: 'var(--series-1)', fill: true },
      { edges: EDGES, counts: dyTt, label: 'Z/γ* + X', color: 'var(--series-3)', fill: true },
      { edges: EDGES, counts: tt, label: 'tt̄', color: 'var(--series-5)', fill: true },
    ];
  });
  const maxDiff = $derived.by(() => {
    if (!cms) return 0;
    let worst = 0;
    cms.events.forEach((e, i) => {
      const t = e.leptons.reduce((a, l) => ({ E: a.E + l.p.E, px: a.px + l.p.px, py: a.py + l.p.py, pz: a.pz + l.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
      const m = Math.sqrt(Math.max(0, (t.E - Math.hypot(t.px, t.py, t.pz)) * (t.E + Math.hypot(t.px, t.py, t.pz))));
      worst = Math.max(worst, Math.abs(m - cms!.published[i]!));
    });
    return worst;
  });
  const nearby = $derived.by(() => {
    if (!realHist || !cms || source !== 'real') return [];
    return realHist.results
      .map((r, i) => ({ r, e: cms!.events[i]! }))
      .filter((x) => x.r.pass && x.r.m4l! >= 121 && x.r.m4l! < 130)
      .sort((a, b) => a.r.m4l! - b.r.m4l!);
  });
  void pairMass;
</script>

<Widget {title} {n} {caption} kind={source === 'real' ? 'Real data' : 'Simulation'}>
  {#snippet controls()}
    <Segmented
      label="Where the events come from"
      bind:value={source}
      options={[{ value: 'real', label: 'Real data (CMS, 2011–12)' }, { value: 'sim', label: 'Simulation (pseudo-data)' }]}
    />
    <Segmented
      label="Signal template for the fit"
      bind:value={template}
      options={[{ value: 'cms', label: 'CMS simulation (notebook)' }, { value: 'course', label: 'Course simulation' }]}
    />
    <Slider bind:value={pt1} min={5} max={30} step={1} label="Hardest lepton pT above (GeV)" format={(v) => v.toFixed(0)} />
    <Slider bind:value={pt2} min={5} max={20} step={1} label="Second lepton pT above (GeV)" format={(v) => v.toFixed(0)} />
    <Slider bind:value={mZ2Min} min={4} max={40} step={1} label="Mass of Z₂ above (GeV)" format={(v) => v.toFixed(0)} />
    {#if source === 'sim'}<Button size="sm" onclick={() => (seed = seed + 1)}>New pseudo-data set (seed {seed})</Button>{/if}
  {/snippet}

  {#if failed}
    <p class="ui err">Could not load the data: {failed}</p>
  {:else if !cms || !sim || !realHist}
    <p class="ui">Loading the real events and the simulation…</p>
  {:else}
    <HepHist
      label="Histogram of the four-lepton invariant mass from 70 to 181 GeV: stacked simulated backgrounds and a 125 GeV Higgs signal, with the selected events as points"
      series={[...stack, { edges: EDGES, counts: observed, label: source === 'real' ? 'real data (CMS)' : 'pseudo-data (simulation)', color: 'var(--fg)', points: true, errors: true }]}
      x={{ domain: [70, 181], label: 'm(4ℓ) [GeV]' }}
      y={{ domain: [0, yMax], label: 'events per 3 GeV' }}
      markers={[{ x: 91.19, label: 'Z', at: 0.7 }, { x: 125.2, label: 'H', at: 0.92 }]}
      height={320}
    />
    <div class="readout ui" aria-live="polite">
      <div class="card">
        <span class="k">{source === 'real' ? 'Real events' : 'Pseudo-events'} in the plot</span>
        <strong class="v">{sel}{source === 'real' ? ` of ${cms.events.length}` : ''}</strong>
        <span class="s">{source === 'real' ? `The file's ${cms.events.length} candidates pass the file's own selection; this analysis then applies its own, on four-vectors, charges and flavours only.` : 'Backgrounds from the notebook plus the course’s simulated Higgs events, Poisson-fluctuated bin by bin.'}</span>
      </div>
      {#if count}
        <div class="card hot">
          <span class="k">Counting, 121 to 130 GeV</span>
          <strong class="v">{count.n} observed; {sig(count.b, 3)} background; {sig(count.s, 3)} signal</strong>
          <span class="s">Poisson p-value {fmtP(count.p)}, {count.z.toFixed(2)}σ. The window was fixed from the simulated signal, not from the data, but the data had been seen when it was chosen: a post-hoc, local value.</span>
        </div>
      {/if}
      {#if fit}
        <div class="card">
          <span class="k">Signal strength μ from the template fit (all bins)</span>
          <strong class="v">μ = {fit.mu.value.toFixed(2)} ± {fit.mu.error.toFixed(2)}</strong>
          <span class="s">Relative to the {template === 'cms' ? 'notebook’s simulated signal' : 'course’s simulated signal'}. Significance of the excess over the background-only fit: {fit.z0.toFixed(2)}σ. The fit goes through <code>fitLikelihood</code>, your Chapter 28 function if you have installed it.</span>
        </div>
      {/if}
      <div class="card">
        <span class="k">Course simulation, expected H → 4ℓ events after this selection</span>
        <strong class="v">{sig(courseSignal.reduce((a, b) => a + b, 0), 3)} vs {sig(cms.mc.hzz.reduce((a, b) => a + b, 0), 3)} (CMS simulation)</strong>
        <span class="s">The course's detector finds four leptons in {sim ? ((100 * sim.length) / (sigmaLO?.generated ?? 1)).toFixed(0) : '?'} % of its H → 4ℓ events, and its normalisation is leading order times K = 3.4: it underestimates the yield that CMS's full simulation gives. Compare the two templates above.</span>
      </div>
    </div>
    {#if source === 'real' && nearby.length}
      <details class="ui events">
        <summary>The {nearby.length} real events between 121 and 130 GeV</summary>
        <table>
          <thead><tr><th>m(4ℓ) [GeV]</th><th>Channel</th><th>Year</th><th>m(Z₁)</th><th>m(Z₂)</th><th>Run : event</th></tr></thead>
          <tbody>
            {#each nearby as x}
              <tr><td>{x.r.m4l!.toFixed(1)}</td><td>{x.r.flavour}</td><td>{x.e.year}</td><td>{x.r.mZ1!.toFixed(1)}</td><td>{x.r.mZ2!.toFixed(1)}</td><td>{x.e.run} : {x.e.eventNumber}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    {/if}
    <p class="ui note">Check: recomputing m(4ℓ) from the four lepton four-vectors in the file reproduces the file's published value to {maxDiff.toFixed(3)} GeV at most. The real events are 278 candidates, a small part of what CMS used; the simulated backgrounds and the signal template are CMS's, from the notebook that accompanies the data.</p>
  {/if}
</Widget>

<style>
  .err {
    color: var(--bad);
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
    font-size: 0.95rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .events {
    margin-top: 0.7rem;
    font-size: 0.82rem;
  }
  .events table {
    border-collapse: collapse;
    margin-top: 0.4rem;
    font-variant-numeric: tabular-nums;
  }
  .events th,
  .events td {
    padding: 0.15rem 0.7rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-top: 0.6rem;
  }
</style>
