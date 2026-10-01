<!--
  Rate = σ L, and Poisson counting. Choose a process, a luminosity and a running time: the widget gives the rate and the expected count μ, then
  repeats the experiment many times (seeded) to show that the counts fluctuate about μ with a spread √μ, as the Poisson distribution says.

    ::rate-counts{n="3.4" caption="…"}

  The cross-sections of the W, Z and tt̄ are the leading-order values of this course's generator at 13 TeV (toy parton distributions), not measurements.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { poisson, rng } from '$lib/hep/random';
  import { poissonPmf } from '$lib/hep/analysis';
  import { formatTime } from '$lib/hep/units';
  import { RATE_PROCESSES, integratedPb, rateHz } from './rates';
  import { sci } from './decay';

  let { process: proc0 = 'z', lumi: lumi0 = 1e34, seconds: sec0 = 1, n, caption, title = 'Rate = σ L, and the counts that fluctuate' }: { process?: string; lumi?: number; seconds?: number; n?: string | number; caption?: string; title?: string } = $props();

  let procId = $state(untrack(() => proc0));
  let logL = $state(untrack(() => Math.log10(lumi0)));
  let logT = $state(untrack(() => Math.log10(sec0)));
  let seed = $state(5);
  const NEXP = 2000;

  const proc = $derived(RATE_PROCESSES.find((p) => p.id === procId)!);
  const L = $derived(10 ** logL);
  const T = $derived(10 ** logT);
  const rate = $derived(rateHz(proc.sigmaPb, L));
  const mu = $derived(rate * T);
  const intPb = $derived(integratedPb(L, T));
  const hugeMu = $derived(mu > 1e6);

  const results = $derived.by(() => {
    const r = rng(seed);
    const xs = Array.from({ length: NEXP }, () => poisson(r, mu));
    return xs;
  });
  const mean = $derived(results.reduce((a, b) => a + b, 0) / NEXP);
  const sd = $derived(Math.sqrt(results.reduce((a, b) => a + (b - mean) ** 2, 0) / (NEXP - 1)));

  const view = $derived.by(() => {
    const w = Math.max(6, 4.5 * Math.sqrt(Math.max(mu, 1)));
    const lo = Math.max(0, Math.floor(mu - w)), hi = Math.ceil(mu + w);
    const span = hi - lo + 1;
    const nb = Math.min(span, 60);
    const step = Math.ceil(span / nb);
    const bins: { lo: number; n: number; p: number }[] = [];
    for (let k = lo; k <= hi; k += step) bins.push({ lo: k, n: 0, p: 0 });
    for (const x of results) {
      if (x < lo || x > hi) continue;
      bins[Math.floor((x - lo) / step)]!.n++;
    }
    if (mu < 1e4) for (const b of bins) for (let k = b.lo; k < b.lo + step; k++) b.p += poissonPmf(k, mu);
    else for (const b of bins) { const c = b.lo + step / 2; b.p = (step * Math.exp(-((c - mu) ** 2) / (2 * mu))) / Math.sqrt(2 * Math.PI * mu); }
    return { lo, hi, step, bins };
  });
  const maxY = $derived(Math.max(...view.bins.map((b) => Math.max(b.n / NEXP, b.p))) * 1.15);
  const fmtRate = (hz: number) => (hz >= 1e6 ? `${(hz / 1e6).toPrecision(3)} MHz` : hz >= 1e3 ? `${(hz / 1e3).toPrecision(3)} kHz` : hz >= 1 ? `${hz.toPrecision(3)} Hz` : hz >= 1 / 3600 ? `${(hz * 60).toPrecision(3)} per minute` : `${(hz * 86400).toPrecision(3)} per day`);
  const fmtSigma = (pb: number) => (pb >= 1e9 ? `${(pb / 1e9).toPrecision(3)} mb` : pb >= 1e6 ? `${(pb / 1e6).toPrecision(3)} µb` : pb >= 1e3 ? `${(pb / 1e3).toPrecision(3)} nb` : `${pb.toPrecision(3)} pb`);
  const fmtInt = (pb: number) => (pb >= 1e3 ? `${(pb / 1e3).toPrecision(3)} fb⁻¹` : pb >= 1 ? `${pb.toPrecision(3)} pb⁻¹` : `${(pb * 1e3).toPrecision(3)} nb⁻¹`.replace('nb⁻¹', 'nb⁻¹'));
</script>

<Widget {title} subtitle="Expected events = σ × ∫L dt; the events actually seen fluctuate by √N" {n} {caption} kind="Simulation" onreset={() => { procId = proc0; logL = Math.log10(lumi0); logT = Math.log10(sec0); seed = 5; }}>
  {#snippet controls()}
    <Segmented label="Process" size="sm" bind:value={procId} options={RATE_PROCESSES.map((p) => ({ value: p.id, label: p.id === 'inel' ? 'inelastic' : p.id === 'w' ? 'W → μν' : p.id === 'z' ? 'Z → μμ' : p.id === 'tt' ? 'tt̄' : 'Higgs' }))} />
    <Slider bind:value={logL} min={30} max={35} step={0.05} label="Luminosity L [cm⁻² s⁻¹]" format={(v) => sci(10 ** v, 2)} />
    <Slider bind:value={logT} min={-3} max={7} step={0.05} label="Running time" format={() => formatTime(T)} />
  {/snippet}

  <div class="cards ui" aria-live="polite">
    <div><span class="k">process</span><strong>{proc.label}</strong><span class="s">σ = {fmtSigma(proc.sigmaPb)} ({proc.source})</span></div>
    <div><span class="k">rate R = σ L</span><strong>{fmtRate(rate)}</strong><span class="s">L = {sci(L, 2)} cm⁻² s⁻¹ = {(L * 1e-36).toPrecision(2)} pb⁻¹ per second</span></div>
    <div><span class="k">expected count μ = R t</span><strong>{mu >= 100 ? mu.toPrecision(3) : mu.toFixed(2)}</strong><span class="s">integrated luminosity {fmtInt(intPb)}; √μ = {Math.sqrt(mu).toPrecision(3)}</span></div>
  </div>

  <Plot
    label="Histogram of the counts in {NEXP} repeated experiments, with the Poisson distribution of mean {mu.toPrecision(3)} as a curve"
    x={{ domain: [view.lo - view.step / 2, view.hi + view.step], label: `events counted in ${formatTime(T)}`, ticks: 7 }}
    y={{ domain: [0, maxY], label: 'fraction of experiments', ticks: 5, format: (v) => v.toPrecision(2) }}
    height={250}
  >
    {#snippet marks({ sx, sy })}
      {#each view.bins as b}
        <rect x={sx(b.lo - 0.5)} y={sy(b.n / NEXP)} width={Math.max(1, sx(b.lo + view.step - 0.5) - sx(b.lo - 0.5) - 1)} height={Math.max(0, sy(0) - sy(b.n / NEXP))} fill="var(--series-1)" opacity="0.7" />
      {/each}
      <path d={view.bins.map((b, i) => `${i ? 'L' : 'M'}${sx(b.lo + view.step / 2 - 0.5)} ${sy(b.p)}`).join('')} fill="none" stroke="var(--sig-high)" stroke-width="2.2" />
    {/snippet}
  </Plot>
  <p class="ui note" aria-live="polite">
    {NEXP.toLocaleString('en-GB')} repeated experiments (seed {seed}): mean {mean.toPrecision(4)}, spread {sd.toPrecision(3)}; Poisson predicts {mu.toPrecision(4)} and √μ = {Math.sqrt(mu).toPrecision(3)}.
    {#if mu < 1}At such a small μ most experiments see no event at all: a count of zero is the most likely outcome.{/if}
    {#if hugeMu}At this μ the relative fluctuation 1/√μ is {(100 / Math.sqrt(mu)).toPrecision(2)} %.{/if}
    <Button size="sm" onclick={() => (seed += 1)}>New seed</Button>
  </p>
</Widget>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.6rem;
    margin-bottom: 0.8rem;
  }
  .cards div {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
    padding: 0.45rem 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .k {
    font-size: 0.7rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  strong {
    font-family: var(--font-mono);
    font-size: 0.98rem;
  }
  .s {
    font-size: 0.74rem;
    color: var(--ink-2);
    line-height: 1.35;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
    line-height: 1.5;
  }
</style>
