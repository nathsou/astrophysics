<!--
  The Breit–Wigner shape and the detector. Three views of one line:
    theory   the natural line shape for a chosen width Γ, the Gaussian resolution of a detector, and what the detector records (their convolution);
             with the complex amplitude 1/(E − M + iΓ/2) drawn as a phasor on its circle.
    gun      a toy particle gun: 20,000 decays of a parent whose mass follows the Breit–Wigner, each through `kinematics.twoBodyDecay`, the
             daughters' momenta smeared, the pair mass from `kinematics.pairMass`. Both functions go through their hooks, so the reader's
             code from the exercises runs here when "use my code" is on.
    data     the real CMS dimuon sample (2011, CC0) around the J/ψ or the Z, with the smeared Breit–Wigner scaled to it.

    ::breit-wigner-lab{n="3.2" caption="…" particle="z" mode="theory"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { loadDimuon, dimuonMasses } from '$lib/hep/data';
  import { hook } from '$lib/hep/hooks';
  import { twoBodyDecay, pairMass, fromMass, mass } from '$lib/hep/kinematics';
  import { breitWigner, exponential, normal, rng } from '$lib/hep/random';
  import { particle } from '$lib/hep/particles';
  import { applyMine, listMine } from '$lib/code/apply';
  import { bw, bwAmplitude, fitLineshape, fwhm, smeared } from './lineshape';
  import { formatWidth } from './decay';

  let { particle: particleId = 'z', mode: mode0 = 'theory', n, caption, title = 'The Breit–Wigner line and the detector' }: { particle?: string; mode?: string; n?: string | number; caption?: string; title?: string } = $props();

  const LINES = [
    { id: 'z', label: 'Z', pdg: 23, daughter: 13, dlabel: 'μ⁺μ⁻', window: [70, 112] as [number, number], bins: 42 },
    { id: 'jpsi', label: 'J/ψ', pdg: 443, daughter: 13, dlabel: 'μ⁺μ⁻', window: [2.8, 3.4] as [number, number], bins: 60 },
    { id: 'upsilon', label: 'Υ(1S)', pdg: 553, daughter: 13, dlabel: 'μ⁺μ⁻', window: [9, 10] as [number, number], bins: 50 },
    { id: 'rho', label: 'ρ⁰', pdg: 113, daughter: 211, dlabel: 'π⁺π⁻', window: [0.3, 1.3] as [number, number], bins: 50 },
  ];

  let mode = $state(untrack(() => mode0));
  let lineId = $state(untrack(() => particleId));
  const line = $derived(LINES.find((l) => l.id === lineId) ?? LINES[0]!);
  const info = $derived(particle(line.pdg));
  const M = $derived(info.mass);
  const gamma0 = $derived(info.width);
  const md = $derived(particle(line.daughter).mass);

  let gScale = $state(0); // log10 of Γ / Γ_table
  let logSigma = $state(-1.5); // log10 of the mass resolution in GeV
  let probe = $state(1.5); // (E − M) in units of Γ/2
  let seed = $state(3);
  const gamma = $derived(gamma0 * 10 ** gScale);
  const sigma = $derived(10 ** logSigma);

  // when the line changes, put the resolution at a sensible place for it
  function pickLine(id: string) {
    lineId = id;
    gScale = 0;
    const p = LINES.find((l) => l.id === id)!;
    logSigma = Math.log10(Math.max(1e-3, 0.013 * particle(p.pdg).mass));
    if (mode === 'data' && !['z', 'jpsi'].includes(id)) mode = 'theory';
  }
  onMount(() => pickLine(lineId));

  // ── theory ──
  const half = $derived(3.2 * Math.max(gamma, 2.4 * sigma));
  const xdom = $derived<[number, number]>([M - half, M + half]);
  const pts = 241;
  const xs = $derived(Array.from({ length: pts }, (_, i) => xdom[0] + ((xdom[1] - xdom[0]) * i) / (pts - 1)));
  const natural = $derived(xs.map((x) => bw(x, M, gamma)));
  const recorded = $derived(xs.map((x) => smeared(x, M, gamma, sigma)));
  const ymax = $derived(Math.max(...natural) * 1.08);
  const measuredFwhm = $derived(fwhm((x) => smeared(x, M, gamma, sigma), M - 4 * half, M + 4 * half, 6000));
  /** The amplitude in units where its peak value 2/Γ is 1 (at E = M it points straight down, −i). */
  const amp = $derived.by((): [number, number] => {
    const a = bwAmplitude(M + (probe * gamma) / 2, M, gamma);
    return [(a[0] * gamma) / 2, (a[1] * gamma) / 2];
  });

  // ── gun ──
  let mine = $state<{ hook: string }[]>([]);
  let useMine = $state(true);
  let note = $state('');
  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'kinematics.twoBodyDecay' || m.hook === 'kinematics.pairMass');
  });
  const NGUN = 20000;
  const gun = $derived.by(() => {
    if (mode !== 'gun') return { counts: [] as number[], edges: [] as number[], bad: 0, used: '' };
    let used = 'the library';
    if (useMine && mine.some((x) => x)) {
      const a = applyMine();
      used = a.active.filter((h) => h.startsWith('kinematics.')).length ? `your code (${a.active.filter((h) => h.startsWith('kinematics.')).join(', ')})` : 'the library';
    } else applyMine();
    const decay = hook('kinematics.twoBodyDecay', twoBodyDecay);
    const pm = hook('kinematics.pairMass', pairMass);
    const r = rng(seed);
    const sp = Math.min(0.4, (Math.SQRT2 * sigma) / M); // relative momentum resolution that gives a mass resolution of σ
    const lo = Math.max(2 * md * 1.0001, M - 30 * gamma), hi = M + 30 * gamma;
    const nb = 80;
    const counts = new Array<number>(nb).fill(0);
    let bad = 0;
    for (let i = 0; i < NGUN; i++) {
      const m = breitWigner(r, M, gamma, lo, hi);
      const p = exponential(r, M / 3);
      const c = 2 * r() - 1, s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * r();
      const parent = fromMass(m, p * s * Math.cos(ph), p * s * Math.sin(ph), p * c);
      const [a, b] = decay(r, parent, md, md);
      const f1 = 1 + sp * normal(r), f2 = 1 + sp * normal(r);
      const a2 = fromMass(md, a.px * f1, a.py * f1, a.pz * f1);
      const b2 = fromMass(md, b.px * f2, b.py * f2, b.pz * f2);
      const v = pm(a2, b2);
      if (!Number.isFinite(v)) { bad++; continue; }
      const k = Math.floor(((v - xdom[0]) / (xdom[1] - xdom[0])) * nb);
      if (k >= 0 && k < nb) counts[k]!++;
    }
    return { counts, edges: Array.from({ length: nb + 1 }, (_, i) => xdom[0] + ((xdom[1] - xdom[0]) * i) / nb), bad, used };
  });

  // ── data ──
  let masses = $state<Float64Array | null>(null);
  let failed = $state('');
  onMount(async () => {
    try {
      masses = dimuonMasses(await loadDimuon(base));
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });
  const dataHist = $derived.by(() => {
    if (!masses) return null;
    const [lo, hi] = line.window;
    const counts = new Array<number>(line.bins).fill(0);
    for (let i = 0; i < masses.length; i++) {
      const v = masses[i]!;
      if (v >= lo && v < hi) counts[Math.floor(((v - lo) / (hi - lo)) * line.bins)]!++;
    }
    return { edges: Array.from({ length: line.bins + 1 }, (_, i) => lo + ((hi - lo) * i) / line.bins), counts };
  });
  // the model for the sliders: A and the background from a least-squares fit, the peak position scanned
  const dataFit = $derived.by(() => {
    if (!dataHist || !['z', 'jpsi'].includes(line.id)) return null;
    return fitLineshape(dataHist.edges, dataHist.counts, gamma, { mass: [M - 0.02 * M, M + 0.005 * M], sigma: [sigma, sigma], nMass: 30, nSigma: 1 });
  });
  let bestSigma = $state<{ sigma: number; mass: number; chi2: number; dof: number } | null>(null);
  function fitSigma() {
    if (!dataHist) return;
    const f = fitLineshape(dataHist.edges, dataHist.counts, gamma, { mass: [M - 0.02 * M, M + 0.005 * M], sigma: [line.id === 'z' ? 0.3 : 0.004, line.id === 'z' ? 6 : 0.2], nMass: 25, nSigma: 45 });
    bestSigma = { sigma: f.sigma, mass: f.mass, chi2: f.chi2, dof: f.dof };
    logSigma = Math.log10(f.sigma);
  }

  const fmtG = (g: number) => formatWidth(g);
  const fmtM = (v: number) => (v >= 10 ? v.toFixed(v >= 100 ? 0 : 1) : v.toFixed(3));
  const fmtMass = (v: number) => {
    const d = xdom[1] - xdom[0];
    return v.toFixed(d > 20 ? 0 : d > 2 ? 1 : d > 0.2 ? 2 : d > 0.02 ? 3 : d > 0.002 ? 4 : 5);
  };
  const stepPath = (edges: number[], counts: number[], sx: (v: number) => number, sy: (v: number) => number) => {
    let d = '';
    counts.forEach((c, i) => {
      d += `${i ? 'L' : 'M'}${sx(edges[i]!)} ${sy(c)}L${sx(edges[i + 1]!)} ${sy(c)}`;
    });
    return d;
  };
</script>

<Widget {title} {n} {caption} kind={mode === 'data' ? 'Real data' : mode === 'gun' ? 'Simulation' : 'Explore'} subtitle={mode === 'data' ? 'CMS dimuon events, 2011 (CC0), with a fitted line shape' : mode === 'gun' ? 'A toy particle gun: Breit–Wigner masses, two-body decays, smeared momenta' : 'A line of width Γ seen through a detector of resolution σ'}>
  {#snippet controls()}
    <Segmented label="Mode" size="sm" bind:value={mode} options={[{ value: 'theory', label: 'Theory' }, { value: 'gun', label: 'Particle gun' }, { value: 'data', label: 'Real data' }]} />
    <Segmented label="Particle" size="sm" value={lineId} onchange={pickLine} options={LINES.filter((l) => mode !== 'data' || ['z', 'jpsi'].includes(l.id)).map((l) => ({ value: l.id, label: l.label }))} />
    <Slider bind:value={gScale} min={-3} max={3} step={0.05} label="Natural width Γ" format={() => `${fmtG(gamma)}${Math.abs(gScale) < 0.03 ? ' (table)' : ''}`} />
    <Slider bind:value={logSigma} min={-4} max={0.8} step={0.02} label={mode === 'gun' ? 'Mass resolution σ (from momentum smearing)' : 'Detector resolution σ'} format={() => (sigma < 0.1 ? `${(sigma * 1000).toPrecision(2)} MeV` : `${sigma.toPrecision(2)} GeV`)} />
  {/snippet}

  {#if mode === 'theory'}
    <div class="grid">
      <div>
        <Plot
          label="Natural Breit–Wigner line of width Γ and the broader line a detector of resolution σ records"
          x={{ domain: xdom, label: `invariant mass [GeV], M = ${M} GeV`, format: fmtMass, ticks: 6 }}
          y={{ domain: [0, ymax], label: 'probability density [1/GeV]', ticks: 4 }}
          height={290}
        >
          {#snippet marks({ sx, sy })}
            <path d={natural.map((v, i) => `${i ? 'L' : 'M'}${sx(xs[i]!)} ${sy(v)}`).join('')} fill="none" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="6 4" />
            <path d={recorded.map((v, i) => `${i ? 'L' : 'M'}${sx(xs[i]!)} ${sy(v)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
            <line x1={sx(M - gamma / 2)} x2={sx(M + gamma / 2)} y1={sy(bw(M, M, gamma) / 2)} y2={sy(bw(M, M, gamma) / 2)} stroke="var(--series-2)" stroke-width="3" />
            <line x1={sx(M - measuredFwhm / 2)} x2={sx(M + measuredFwhm / 2)} y1={sy(Math.max(...recorded) / 2)} y2={sy(Math.max(...recorded) / 2)} stroke="var(--series-1)" stroke-width="3" />
            <line x1={sx(M + (probe * gamma) / 2)} x2={sx(M + (probe * gamma) / 2)} y1="0" y2={sy(0)} stroke="var(--ink-3)" stroke-dasharray="2 3" />
          {/snippet}
        </Plot>
        <div class="legend ui">
          <span><i class="dash"></i>natural line: FWHM = Γ = {fmtG(gamma)}</span>
          <span><i class="solid"></i>recorded by the detector: FWHM = {measuredFwhm >= 0.1 ? `${measuredFwhm.toPrecision(3)} GeV` : `${(measuredFwhm * 1000).toPrecision(3)} MeV`}</span>
        </div>
      </div>
      <div class="argand">
        <svg viewBox="-110 -110 220 220" role="img" aria-label="The Breit–Wigner amplitude in the complex plane: as the energy sweeps through the mass, its tip goes once around a circle">
          <line x1="-100" x2="100" y1="0" y2="0" stroke="var(--line-strong)" />
          <line x1="0" x2="0" y1="-100" y2="100" stroke="var(--line-strong)" />
          <circle cx="0" cy="45" r="45" fill="none" stroke="var(--series-1)" stroke-width="1.6" />
          <line x1="0" y1="0" x2={amp[0] * 90} y2={-amp[1] * 90} stroke="var(--sig-high)" stroke-width="2.6" />
          <circle cx={amp[0] * 90} cy={-amp[1] * 90} r="4.5" fill="var(--sig-high)" />
          <text x="98" y="-5" text-anchor="end" font-size="10" fill="var(--mute)">Re</text>
          <text x="5" y="-98" font-size="10" fill="var(--mute)">Im</text>
        </svg>
        <div class="ui small">
          The amplitude 1/(E − M + iΓ/2) drawn as an arrow (scaled so that its longest length is 1). Its tip travels once round a circle as E sweeps from far below M to far above it; the rate is the arrow's length squared, and the arrow's direction turns through 180° in all.
        </div>
        <Slider bind:value={probe} min={-8} max={8} step={0.05} label="Energy E − M [units of Γ/2]" format={(v) => v.toFixed(2)} />
        <div class="ui small">|A|² relative to the peak: <strong>{(amp[0] ** 2 + amp[1] ** 2).toFixed(3)}</strong>; phase of the amplitude relative to its value at E = M: <strong>{((Math.atan2(amp[1], amp[0]) + Math.PI / 2) * 180 / Math.PI).toFixed(0)}°</strong></div>
      </div>
    </div>
  {:else if mode === 'gun'}
    <Plot
      label="Histogram of the invariant mass of 20,000 simulated decays to a pair, with the smeared Breit–Wigner for comparison"
      x={{ domain: xdom, label: `invariant mass of the ${line.dlabel} pair [GeV]`, format: fmtMass, ticks: 6 }}
      y={{ domain: [0, Math.max(1, ...gun.counts) * 1.15], label: 'events per bin', ticks: 5 }}
      height={290}
    >
      {#snippet marks({ sx, sy })}
        {#if gun.counts.length}
          <path d={stepPath(gun.edges, gun.counts, sx, sy)} fill="none" stroke="var(--series-1)" stroke-width="1.8" />
          <path d={xs.map((x, i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(recorded[i]! * NGUN * (xdom[1] - xdom[0]) / 80)}`).join('')} fill="none" stroke="var(--series-2)" stroke-width="1.8" stroke-dasharray="6 4" />
        {/if}
      {/snippet}
    </Plot>
    <div class="legend ui">
      <span><i class="solid"></i>simulated events (seed {seed})</span>
      <span><i class="dash"></i>Breit–Wigner ⊗ Gaussian expectation</span>
      <span>computed with {gun.used}{gun.bad ? `; ${gun.bad} events gave NaN and were dropped` : ''}</span>
    </div>
    <div class="row ui">
      <Button onclick={() => (seed += 1)}>New seed</Button>
      {#if mine.length}<label class="ui chk"><input type="checkbox" bind:checked={useMine} /> use my code</label>{/if}
    </div>
  {:else}
    {#if failed}
      <p class="ui">{failed}</p>
    {:else if !dataHist}
      <p class="ui">Loading 100,000 events…</p>
    {:else}
      <Plot
        label="Histogram of the invariant mass of real CMS muon pairs near the {line.label} peak with a fitted Breit–Wigner convolved with a Gaussian"
        x={{ domain: line.window, label: 'invariant mass of the muon pair [GeV]', ticks: 6 }}
        y={{ domain: [0, Math.max(1, ...dataHist.counts) * 1.15], label: 'events per bin', ticks: 5 }}
        height={300}
      >
        {#snippet marks({ sx, sy })}
          <path d={stepPath(dataHist.edges, dataHist.counts, sx, sy)} fill="none" stroke="var(--fg)" stroke-width="1.6" />
          {#each dataHist.counts as c, i}
            {@const x = (dataHist.edges[i]! + dataHist.edges[i + 1]!) / 2}
            <line x1={sx(x)} x2={sx(x)} y1={sy(Math.max(0, c - Math.sqrt(c)))} y2={sy(c + Math.sqrt(c))} stroke="var(--fg)" stroke-width="1" opacity="0.6" />
          {/each}
          {#if dataFit}
            {@const wbin = (line.window[1] - line.window[0]) / line.bins}
            <path d={Array.from({ length: 300 }, (_, i) => { const x = line.window[0] + ((line.window[1] - line.window[0]) * i) / 299; return `${i ? 'L' : 'M'}${sx(x)} ${sy(dataFit.signal * smeared(x, dataFit.mass, gamma, sigma) * wbin + dataFit.background * wbin)}`; }).join('')} fill="none" stroke="var(--series-2)" stroke-width="2.2" />
          {/if}
        {/snippet}
      </Plot>
      <div class="legend ui" aria-live="polite">
        <span><i class="solid" style="border-top-color:var(--fg)"></i>CMS data, {dataHist.counts.reduce((a, b) => a + b, 0).toLocaleString('en-GB')} events in the window</span>
        <span><i class="solid" style="border-top-color:var(--series-2)"></i>line of width Γ = {fmtG(gamma)} and σ = {sigma < 0.1 ? `${(sigma * 1000).toPrecision(3)} MeV` : `${sigma.toPrecision(3)} GeV`} (peak position fitted: {dataFit ? dataFit.mass.toFixed(3) : ''} GeV; table mass {M} GeV)</span>
        {#if dataFit}<span>χ²/dof = {(dataFit.chi2 / dataFit.dof).toFixed(1)}. A large value means the simple shape is not the whole story (radiation, a non-Gaussian tail, background).</span>{/if}
      </div>
      <div class="row ui">
        <Button onclick={fitSigma}>Fit the resolution σ</Button>
        {#if bestSigma}<span class="ui small">Best σ = <strong>{bestSigma.sigma < 0.1 ? `${(bestSigma.sigma * 1000).toPrecision(3)} MeV` : `${bestSigma.sigma.toPrecision(3)} GeV`}</strong> for Γ = {fmtG(gamma)}; peak at {bestSigma.mass.toFixed(3)} GeV.</span>{/if}
      </div>
    {/if}
  {/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .argand svg {
    width: 100%;
    max-width: 15rem;
    display: block;
    margin: 0 auto;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.1rem;
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .legend i {
    display: inline-block;
    width: 1.3rem;
    height: 0;
    vertical-align: middle;
    margin-right: 0.3rem;
    border-top: 3px solid var(--series-1);
  }
  .legend i.dash {
    border-top: 3px dashed var(--series-2);
  }
  .legend i.solid {
    border-top-color: var(--series-1);
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
    margin: 0.4rem 0 0.2rem;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 0.6rem;
  }
  .chk {
    font-size: 0.82rem;
  }
</style>
