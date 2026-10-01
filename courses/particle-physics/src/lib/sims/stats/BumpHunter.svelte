<!--
  The bump hunter: the flagship figure of Chapter 28. A falling background spectrum with an optional injected signal is scanned
  with windows of several widths; the most significant bump is reported with its *local* p-value. Then thousands of signal-free
  pseudo-experiments (run here, in the browser, from a fixed seed) are scanned in the same way, and the distribution of their largest
  local significance shows how often fluctuations alone fake a bump somewhere: the look-elsewhere effect. The fraction of those
  experiments at least as extreme as the data is the *global* p-value.

    ::bump-hunter{n="28.1" caption="…"}
    ::bump-hunter{signal=0 seed=2 toys=2000}

  Props: `signal` initial injected events (0–500), `width` initial width σ in GeV, `mass` initial position in GeV, `seed` data seed,
  `toys` number of pseudo-experiments (default 2000), `n` figure number, `caption`.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { maxLocalZ, poissonSample, poissonTail, pToZ, scanWindows, bestWindow, erf } from '$lib/hep/analysis';
  import { rng as makeRng } from '$lib/hep/random';
  import { chunked, fmtP, fmtZ, sig } from './common';

  let {
    signal: signal0 = 0,
    width: width0 = 2,
    mass: mass0 = 131,
    seed: seed0 = 2,
    toys: nToys = 2000,
    n,
    caption,
    title = 'Bump hunter: how often do fluctuations fake a signal?',
  }: { signal?: number; width?: number; mass?: number; seed?: number; toys?: number; n?: string | number; caption?: string; title?: string } = $props();

  const LO = 100, HI = 160, NB = 60;
  const WIDTHS = [2, 3, 4, 6, 8, 12]; // in bins of 1 GeV
  const TOTAL = 20000, SLOPE = -0.03;
  const edges = Array.from({ length: NB + 1 }, (_, i) => LO + i);
  // The background: N · exp(−0.03 (m − 100)) normalised over 100–160 GeV.
  const norm = (TOTAL * -SLOPE) / (1 - Math.exp(SLOPE * (HI - LO)));
  const bkg = Array.from({ length: NB }, (_, i) => (norm / -SLOPE) * (Math.exp(SLOPE * i) - Math.exp(SLOPE * (i + 1))));

  const TOY_SEED0 = 7001;
  let injected = $state(untrack(() => signal0));
  let sigma = $state(untrack(() => width0));
  let position = $state(untrack(() => mass0));
  let dataSeed = $state(untrack(() => seed0));
  let toySeed = $state(TOY_SEED0);
  let showTruth = $state(false);

  // Data: the background counts depend only on the seed; the signal events are the first `injected` of a fixed list of unit normals, so moving a slider moves the same events.
  const bkgCounts = $derived.by(() => {
    const r = makeRng(dataSeed);
    return bkg.map((e) => poissonSample(r, e));
  });
  const unit = $derived.by(() => {
    const r = makeRng(dataSeed * 7919 + 13);
    return Array.from({ length: 500 }, () => {
      let u: number, v: number, s: number;
      do {
        u = 2 * r() - 1;
        v = 2 * r() - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      return u * Math.sqrt((-2 * Math.log(s)) / s);
    });
  });
  const counts = $derived.by(() => {
    const c = bkgCounts.slice();
    for (let k = 0; k < injected; k++) {
      const m = position + sigma * unit[k]!;
      const i = Math.floor(m - LO);
      if (i >= 0 && i < NB) c[i]!++;
    }
    return c;
  });
  const truthCurve = $derived.by(() => {
    // Expected signal shape added to the background, for the "show the truth" overlay.
    const out = bkg.slice();
    for (let i = 0; i < NB; i++) out[i]! += (injected * (erf((edges[i + 1]! - position) / (sigma * Math.SQRT2)) - erf((edges[i]! - position) / (sigma * Math.SQRT2)))) / 2;
    return out;
  });

  const windows = $derived(scanWindows(counts, bkg, WIDTHS, edges));
  const best = $derived(bestWindow(windows));
  // A window fixed in advance: the signal position ± 2σ, rounded out to whole bins. This is the local p-value of a search that knew where to look.
  const fixedWindow = $derived.by(() => {
    const a = Math.max(0, Math.floor(position - 2 * sigma - LO));
    const b = Math.min(NB, Math.ceil(position + 2 * sigma - LO));
    if (b - a < 1) return null;
    let obs = 0, exp = 0;
    for (let i = a; i < b; i++) {
      obs += counts[i]!;
      exp += bkg[i]!;
    }
    const p = obs > exp ? poissonTail(obs, exp) : 1;
    return { lo: LO + a, hi: LO + b, z: p < 1 ? Math.max(0, pToZ(p)) : 0, p, observed: obs, expected: exp };
  });

  // Pseudo-experiments: signal-free, scanned with the same windows.
  let maxZ = $state<number[]>([]);
  let done = $state(0);
  let running = $state(false);
  let token = 0;

  async function runToys() {
    const my = ++token;
    running = true;
    done = 0;
    maxZ = [];
    const r = makeRng(toySeed);
    const out: number[] = [];
    const toy = new Array<number>(NB);
    await chunked(
      nToys,
      100,
      () => {
        for (let i = 0; i < NB; i++) toy[i] = poissonSample(r, bkg[i]!);
        out.push(maxLocalZ(toy, bkg, WIDTHS).z);
      },
      (d) => {
        if (my !== token) return;
        done = d;
        maxZ = out.slice();
      },
      () => my !== token,
    );
    if (my === token) running = false;
  }
  onMount(() => {
    void runToys();
    return () => {
      token++;
    };
  });
  // Re-run if the toy seed changes.
  let lastToySeed = TOY_SEED0;
  $effect(() => {
    if (toySeed !== lastToySeed) {
      lastToySeed = toySeed;
      void runToys();
    }
  });

  const zObs = $derived(best ? best.z : 0);
  const nAtLeast = $derived(maxZ.filter((z) => z >= zObs - 1e-9).length);
  const pGlobal = $derived(maxZ.length ? Math.max(nAtLeast, 0.5) / maxZ.length : NaN);
  const pGlobalText = $derived(!maxZ.length ? '…' : nAtLeast === 0 ? `< ${fmtP(1 / maxZ.length)}` : fmtP(nAtLeast / maxZ.length));
  const zGlobal = $derived(maxZ.length ? pToZ(pGlobal) : NaN);
  const sortedZ = $derived(maxZ.slice().sort((a, b) => a - b));
  const pct = (q: number) => (sortedZ.length ? sortedZ[Math.min(sortedZ.length - 1, Math.floor(q * sortedZ.length))]! : NaN);
  const trials = $derived(best && maxZ.length && best.pLocal > 0 ? pGlobal / best.pLocal : NaN);

  // Plot data.
  const zEdges = Array.from({ length: 41 }, (_, i) => i * 0.15);
  const zHist = $derived.by(() => {
    const c = new Array<number>(40).fill(0);
    for (const z of maxZ) {
      const k = Math.floor(z / 0.15);
      if (k >= 0 && k < 40) c[k]!++;
    }
    return c;
  });
  const dataSeries = $derived([
    { edges, counts: bkg, label: 'expected background', color: 'var(--series-8)' },
    ...(showTruth && injected > 0 ? [{ edges, counts: truthCurve, label: 'background + injected signal (truth)', color: 'var(--series-3)' }] : []),
    { edges, counts, label: 'data', points: true, errors: true, color: 'var(--series-1)' },
  ]);
  const markers = $derived(best && best.z > 0 ? [{ x: best.lo, label: `best window ${best.lo}–${best.hi} GeV`, color: 'var(--series-5)', at: 0.96 }, { x: best.hi, label: '', color: 'var(--series-5)' }] : []);
  const zMarkers = $derived([
    ...(best ? [{ x: Math.min(5.9, zObs), label: `this data: ${zObs.toFixed(1)}σ`, color: 'var(--series-5)', at: 0.92 }] : []),
    ...(fixedWindow ? [{ x: Math.min(5.9, fixedWindow.z), label: `fixed window: ${fixedWindow.z.toFixed(1)}σ`, color: 'var(--series-3)', at: 0.7 }] : []),
  ]);
  const yMax = $derived(Math.max(10, ...bkg.map((b) => b), ...counts) * 1.12);

  function reroll() {
    dataSeed = dataSeed + 1;
  }
  function rerunToys() {
    toySeed = toySeed + 1;
  }
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={injected} min={0} max={500} step={5} label="Injected signal [events]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={sigma} min={0.8} max={6} step={0.1} label="Signal width σ [GeV]" format={(v) => v.toFixed(1)} />
    <Slider bind:value={position} min={105} max={155} step={0.5} label="Signal position [GeV]" format={(v) => v.toFixed(1)} />
    <div class="buttons ui">
      <Button onclick={reroll} title="Draw new background fluctuations (next seed)">Re-roll data <span class="seed">seed {dataSeed}</span></Button>
      <Button onclick={rerunToys} disabled={running} title="Re-run the signal-free pseudo-experiments with a new seed">Re-run toys <span class="seed">seed {toySeed}</span></Button>
      <Toggle bind:checked={showTruth} label="Show the injected signal" />
    </div>
  {/snippet}

  <div class="grid">
    <div class="pane">
      <h5 class="ui">The data, and the most significant bump</h5>
      <HepHist
        series={dataSeries}
        x={{ domain: [LO, HI], label: 'Mass [GeV]' }}
        y={{ domain: [0, yMax], label: 'Events per GeV' }}
        {markers}
        height={280}
        label="Simulated mass spectrum with a falling background, data points and the best window"
      />
    </div>
    <div class="pane">
      <h5 class="ui">The largest local significance in {maxZ.length.toLocaleString('en-GB')} signal-free experiments</h5>
      <HepHist
        series={[{ edges: zEdges, counts: zHist, label: 'signal-free experiments', fill: true, color: 'var(--series-8)' }]}
        x={{ domain: [0, 6], label: 'Largest local significance found anywhere [σ]' }}
        y={{ domain: [0, Math.max(10, ...zHist) * 1.25], label: 'Experiments' }}
        markers={zMarkers}
        height={280}
        label="Distribution of the largest local significance in background-only pseudo-experiments, with this data marked"
      />
      {#if running}<p class="ui progress" role="status">Running pseudo-experiments: {done.toLocaleString('en-GB')} / {nToys.toLocaleString('en-GB')}</p>{/if}
    </div>
  </div>

  <div class="readout ui" aria-live="polite">
    <div class="card">
      <span class="k">Best bump, anywhere</span>
      {#if best && best.z > 0}
        <strong class="v">{fmtZ(best.z)} local</strong>
        <span class="s">{best.lo}–{best.hi} GeV: {best.observed.toFixed(0)} events seen, {sig(best.expected, 4)} expected. Local p = {fmtP(best.pLocal)}.</span>
      {:else}
        <strong class="v">no excess</strong>
      {/if}
    </div>
    <div class="card">
      <span class="k">Window fixed in advance{#if fixedWindow}: {fixedWindow.lo}–{fixedWindow.hi} GeV{/if}</span>
      {#if fixedWindow}
        <strong class="v">{fmtZ(fixedWindow.z)}</strong>
        <span class="s">p = {fmtP(fixedWindow.p)}: a search that knew the position (the slider) needs no look-elsewhere correction.</span>
      {/if}
    </div>
    <div class="card hot">
      <span class="k">Global p-value (look-elsewhere)</span>
      <strong class="v">{pGlobalText}{#if maxZ.length} &nbsp;= {fmtZ(zGlobal)}{/if}</strong>
      <span class="s">{nAtLeast} of {maxZ.length.toLocaleString('en-GB')} signal-free experiments had a bump at least this significant somewhere.{#if Number.isFinite(trials)}{' '}Trials factor ≈ {sig(trials, 2)}.{/if}</span>
    </div>
  </div>
  {#if maxZ.length > 100}
    <p class="ui note">
      Half of all signal-free experiments contain a bump of {fmtZ(pct(0.5), 1)} or more; one in twenty reaches {fmtZ(pct(0.95), 1)}; one in a hundred {fmtZ(pct(0.99), 1)}. A local
      excess is only evidence when it stands out from <em>that</em> distribution, not from zero.
    </p>
  {/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .progress {
    margin: 0.3rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  @media (max-width: 820px) {
    .readout {
      grid-template-columns: minmax(0, 1fr);
    }
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
    font-size: 1.05rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .note {
    margin: 0.7rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
</style>
