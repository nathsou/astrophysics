<!--
  Geiger and Marsden rebuilt. Alpha particles are fired at a thin foil; a detector (Geiger and Marsden used a zinc-sulphide screen and a
  microscope, and counted flashes by eye) records how many land at each angle. Here the counts come from `hep/scattering`: the number of alphas
  that scatter through more than 10° is Poisson, and each one's angle is drawn by `scattering.sampleRutherfordAngle`, which is the hook the reader
  fills in Chapter 4's exercise. With "use my code" on, the reader's sampler makes the counts.

  A simulation of single Rutherford scattering by an infinitely heavy nucleus in a thin foil. Not modelled: multiple scattering in the foil, atomic
  screening (which matters below about a tenth of a degree), nuclear recoil and nuclear forces.

    ::geiger-marsden{n="4.3" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import {
    GOLD, SILVER, closestApproachFm, fireAlphas, fitAnglePower, gaussianPerSr, nucleiPerFm2, ringSolidAngle, rutherfordDiffXsecFm2, type Foil,
  } from '$lib/hep/scattering';
  import { applyMine, listMine } from '$lib/code/apply';
  import { sci } from '$lib/sims/part1/decay';

  let { n, caption, title = 'Geiger and Marsden, rebuilt' }: { n?: string | number; caption?: string; title?: string } = $props();

  const FOILS: Record<string, Foil> = { gold: GOLD, silver: SILVER };
  const DEG = Math.PI / 180;
  const EDGES = Array.from({ length: 15 }, (_, i) => (10 + 10 * i) * DEG); // 10° … 150°
  const MID = EDGES.slice(0, -1).map((e, i) => (e + EDGES[i + 1]!) / 2);
  const OMEGA = EDGES.slice(0, -1).map((e, i) => ringSolidAngle(e, EDGES[i + 1]!));
  const THETA_MIN = EDGES[0]!;

  let foilId = $state('gold');
  let T = $state(5.5);
  let logN = $state(8.3);
  let seed = $state(1);
  let showFit = $state(true);
  let showPudding = $state(false);
  let puddingDeg = $state(2);
  let useMine = $state(true);
  let mine = $state<{ hook: string }[]>([]);
  let note = $state('');

  let counts = $state<number[]>(EDGES.slice(1).map(() => 0));
  let fired = $state(0);
  let running = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let batch = 0;

  const foil = $derived(FOILS[foilId]!);
  const target = $derived(10 ** logN);
  const nt = $derived(nucleiPerFm2(foil));

  onMount(() => {
    mine = listMine().filter((m) => m.hook === 'scattering.sampleRutherfordAngle');
    fire(true);
    return () => clearTimeout(timer);
  });

  function sampler() {
    if (useMine && mine.length) {
      const a = applyMine();
      const err = a.errors['scattering.sampleRutherfordAngle'];
      note = err ? `Your sampler failed to load (${err}); using the library's.` : a.active.includes('scattering.sampleRutherfordAngle') ? 'Angles drawn by your sampler.' : 'Angles drawn by the library sampler.';
    } else {
      applyMine();
      note = 'Angles drawn by the library sampler (importance sampling).';
    }
  }

  function reset() {
    clearTimeout(timer);
    running = false;
    counts = EDGES.slice(1).map(() => 0);
    fired = 0;
    batch = 0;
  }
  function step(total: number, size: number) {
    const r = rng(seed * 7919 + batch++);
    const todo = Math.min(size, total - fired);
    const run = fireAlphas(r, foil, T, todo, THETA_MIN, EDGES);
    counts = counts.map((c, i) => c + run.counts[i]!);
    fired += todo;
  }
  function fire(instant = false) {
    reset();
    sampler();
    const total = target;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduced) {
      step(total, total);
      return;
    }
    running = true;
    const size = total / 40;
    const tick = () => {
      step(total, size);
      if (fired >= total - 1) {
        running = false;
        return;
      }
      timer = setTimeout(tick, 70);
    };
    tick();
  }
  // the settings changed: start again (the counts belong to one setting)
  let first = true;
  $effect(() => {
    foilId; T; logN; seed; useMine;
    if (first) {
      first = false;
      return;
    }
    untrack(() => fire(true));
  });

  const dens = $derived(counts.map((c, i) => c / OMEGA[i]!)); // counts per steradian
  const err = $derived(counts.map((c, i) => Math.sqrt(Math.max(c, 1)) / OMEGA[i]!));
  const fit = $derived(counts.reduce((a, b) => a + b, 0) > 20 ? fitAnglePower(EDGES, counts) : null);
  const d = $derived(closestApproachFm(foil.z, foil.Z, T));
  /** Expected counts per steradian from Rutherford's formula with no fitting. */
  const pred = (th: number) => fired * nt * rutherfordDiffXsecFm2(th, foil.z, foil.Z, T);
  const zFit = $derived(fit ? foil.Z * Math.sqrt(fit.K4 / (fired * nt * (d / 4) ** 2)) : null);
  const zErr = $derived(zFit !== null && counts.reduce((a, b) => a + b, 0) > 0 ? zFit / (2 * Math.sqrt(counts.reduce((a, b) => a + b, 0))) : null);

  const yLo = $derived(Math.max(1e-3, Math.min(pred(150 * DEG) || 1, ...dens.filter((x) => x > 0)) / 3));
  const yHi = $derived(Math.max(1, pred(10 * DEG), ...dens) * 4);
  const fmtN = (x: number) => (x >= 1e4 ? sci(x, 2) : x.toLocaleString('en-GB'));
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const fracBack = $derived(fired > 0 ? counts.slice(8).reduce((a, b) => a + b, 0) / fired : 0); // bins at 90° and above
  // schematic ring: marker size from the log of the counts
  const ringSize = (c: number) => (c > 0 ? 3 + 2.4 * Math.log10(c + 1) : 2);
</script>

<Widget {title} subtitle="Fire alpha particles at a thin foil and count how many land at each angle" {n} {caption} kind="Simulation" onreset={() => { foilId = 'gold'; T = 5.5; logN = 8.3; seed = 1; showFit = true; showPudding = false; }}>
  {#snippet controls()}
    <Segmented label="Foil" size="sm" bind:value={foilId} options={[{ value: 'gold', label: 'gold (Z = 79)' }, { value: 'silver', label: 'silver (Z = 47)' }]} />
    <Slider bind:value={T} min={3} max={9} step={0.1} label="Alpha energy T" format={(v) => `${v.toFixed(1)} MeV`} />
    <Slider bind:value={logN} min={6} max={10} step={0.05} label="Alphas fired" format={() => fmtN(target)} />
    <Toggle bind:checked={showFit} label="Fit the angular law" />
    <Toggle bind:checked={showPudding} label="Thomson's plum pudding" />
    {#if mine.length}<Toggle bind:checked={useMine} label="use my code" />{/if}
  {/snippet}

  <div class="wrap">
    <div class="plot">
      <Plot
        label="Counts per steradian against scattering angle, both axes logarithmic, with Rutherford's prediction and a fit"
        x={{ type: 'log', domain: [8, 170], label: 'scattering angle θ [degrees]', tickValues: [10, 20, 40, 80, 150] }}
        y={{ type: 'log', domain: [yLo, yHi], label: 'alphas per steradian' }}
        height={340}
      >
        {#snippet marks({ sx, sy })}
          <path d={Array.from({ length: 141 }, (_, i) => { const th = 10 + (i * 140) / 140; return `${i ? 'L' : 'M'}${sx(th)} ${sy(Math.max(yLo, pred(th * DEG)))}`; }).join('')} fill="none" stroke="var(--sig-high)" stroke-width="2.2" />
          {#if showFit && fit}
            <path d={Array.from({ length: 141 }, (_, i) => { const th = 10 + i; return `${i ? 'L' : 'M'}${sx(th)} ${sy(Math.max(yLo, fit.K * Math.sin((th * DEG) / 2) ** -fit.p))}`; }).join('')} fill="none" stroke="var(--series-1)" stroke-width="1.6" stroke-dasharray="6 4" />
          {/if}
          {#if showPudding}
            <path d={Array.from({ length: 141 }, (_, i) => { const th = 10 + i; return `${i ? 'L' : 'M'}${sx(th)} ${sy(Math.max(yLo * 0.5, fired * gaussianPerSr(th * DEG, puddingDeg * DEG)))}`; }).join('')} fill="none" stroke="var(--series-7)" stroke-width="2" stroke-dasharray="2 4" />
          {/if}
          {#each dens as v, i}
            {#if counts[i]! > 0}
              <line x1={sx(MID[i]! / DEG)} x2={sx(MID[i]! / DEG)} y1={sy(Math.max(yLo, v - err[i]!))} y2={sy(v + err[i]!)} stroke="var(--fg)" stroke-width="1.4" />
              <circle cx={sx(MID[i]! / DEG)} cy={sy(v)} r="4.2" fill="var(--fg)" stroke="var(--chart-surface)" stroke-width="1.5" />
            {/if}
          {/each}
        {/snippet}
      </Plot>
      <div class="legend ui">
        <span><i class="dot"></i>counts in 10° bins ÷ solid angle, ± √N</span>
        <span><i class="line" style="border-color:var(--sig-high)"></i>Rutherford's formula, no free parameters</span>
        {#if showFit}<span><i class="line dash" style="border-color:var(--series-1)"></i>fit of K sin⁻ᵖ(θ/2)</span>{/if}
        {#if showPudding}<span><i class="line dots" style="border-color:var(--series-7)"></i>plum pudding: a Gaussian of width <input class="mini" type="number" min="0.2" max="20" step="0.2" bind:value={puddingDeg} aria-label="plum-pudding width in degrees" />° (illustrative)</span>{/if}
      </div>
    </div>

    <div class="side">
      <svg viewBox="0 0 300 210" role="img" aria-label="Schematic top view: alphas from the left cross a foil and land on a ring of detectors; the marker size shows the count at each angle (logarithmic)">
        <line x1="10" x2="150" y1="105" y2="105" stroke="var(--sig-high)" stroke-width="2" />
        <circle cx="14" cy="105" r="5" fill="var(--ink-2)" />
        <text x="14" y="124" font-size="9" fill="var(--mute)" text-anchor="middle">source</text>
        <line x1="150" x2="150" y1="92" y2="118" stroke="var(--fg)" stroke-width="3" />
        <text x="150" y="134" font-size="9" fill="var(--mute)" text-anchor="middle">foil</text>
        <path d="M150 105 m-95 0 a95 95 0 0 1 190 0" fill="none" stroke="var(--line-strong)" stroke-dasharray="3 3" transform="rotate(0)" />
        {#each MID as th, i}
          {@const a = th}
          <circle cx={150 + 88 * Math.cos(a)} cy={105 - 88 * Math.sin(a)} r={ringSize(counts[i]!)} fill="var(--series-1)" opacity="0.75" />
        {/each}
        <text x="150" y="176" font-size="9" fill="var(--mute)" text-anchor="middle">detectors at 15°, 25°, … 145°;</text>
        <text x="150" y="188" font-size="9" fill="var(--mute)" text-anchor="middle">circle size grows with the log of the count</text>
        <text x="292" y="204" font-size="9" fill="var(--mute)" text-anchor="end">schematic, not to scale</text>
      </svg>
      <dl class="read ui" aria-live="polite">
        <div><dt>alphas fired</dt><dd>{fmtN(fired)}</dd></div>
        <div><dt>scattered through more than 10°</dt><dd>{total.toLocaleString('en-GB')} ({(total / Math.max(1, fired) * 1e3).toPrecision(2)} per thousand)</dd></div>
        <div><dt>through 90° or more</dt><dd>{counts.slice(8).reduce((a, b) => a + b, 0).toLocaleString('en-GB')} (1 in {fracBack > 0 ? Math.round(1 / fracBack).toLocaleString('en-GB') : '—'})</dd></div>
        <div><dt>closest approach d = zZα ħc/T</dt><dd>{d.toFixed(1)} fm</dd></div>
        {#if fit}
          <div class="hot"><dt>fitted exponent p (Rutherford: 4)</dt><dd>{fit.p.toFixed(2)} ({fit.pLo.toFixed(2)} to {fit.pHi.toFixed(2)})</dd></div>
          <div><dt>nuclear charge implied by the count rate</dt><dd>{zFit!.toFixed(1)} ± {zErr!.toFixed(1)} (foil: {foil.Z})</dd></div>
        {/if}
      </dl>
    </div>
  </div>
  <div class="row ui">
    <Button variant="primary" onclick={() => fire()} disabled={running}>{running ? 'Counting…' : 'Fire again'}</Button>
    <Button onclick={() => (seed += 1)}>New seed ({seed})</Button>
    <span class="small">{note}</span>
  </div>
</Widget>

<style>
  .wrap {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 820px) {
    .wrap {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .side svg {
    width: 100%;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 0.76rem;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .legend i {
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.3rem;
  }
  .legend .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--fg);
  }
  .legend .line {
    width: 1.3rem;
    border-top: 3px solid;
  }
  .legend .dash {
    border-top-style: dashed;
  }
  .legend .dots {
    border-top-style: dotted;
  }
  .mini {
    width: 3.2rem;
    font: inherit;
    font-size: 0.74rem;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
  }
  .read {
    margin: 0.6rem 0 0;
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
  .read .hot dd {
    color: var(--sig-high);
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 0.7rem;
  }
  .small {
    font-size: 0.76rem;
    color: var(--mute);
  }
</style>
