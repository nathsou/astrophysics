<!--
  How well a tracker measures momentum: the bend of a track against the measurement error (left), and σ(pT)/pT against pT (right).

    ::pt-resolution{n="5.5" caption="…"}

  The curves are Gluckstern's formulae (measurement term ∝ pT σ/(B L²) √(720/(N+4)), scattering term ∝ √(x/X0)/(B L)); the dots are a
  Monte Carlo: tracks with Gaussian position errors and scattering, fitted with the circle fit (the library's, or the reader's
  when "use my code" is on). Props: seed.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { circleFit } from '../../hep/reco/fit.ts';
  import { hook } from '../../hep/hooks.ts';
  import { rng as makeRng } from '../../hep/random/index.ts';
  import { crossoverPt, glucksternMeasurement, glucksternScattering, glucksternTotal, monteCarloResolution, ptFromRadiusMm, sagittaOf, simulateTrack, type TrackerSetup } from './trackMc.ts';
  import { savedFor, useMine } from './mine.ts';

  let { n: figNo, caption, seed: seed0 = 1, title = 'Momentum resolution of a tracker' }: { n?: string | number; caption?: string; seed?: number; title?: string } = $props();

  let B = $state(2);
  let L = $state(1);
  let N = $state(10);
  let sigmaUm = $state(50);
  let x0pct = $state(1);
  let logPt = $state(Math.log10(100));
  let seed = $state(untrack(() => seed0));
  let mineAvailable = $state(false);
  let useMineOn = $state(false);
  let mineNote = $state('');
  let version = $state(0);

  onMount(() => {
    mineAvailable = savedFor(['reco.circleFit']).length > 0;
    return () => {
      useMine(['reco.circleFit'], false);
    };
  });

  function toggleMine(on: boolean) {
    const r = useMine(['reco.circleFit'], on);
    mineNote = r.errors['reco.circleFit'] ? `Your code failed to load (${r.errors['reco.circleFit']}); the library's circle fit is used.` : on ? 'The fits use your circleFit.' : '';
    version++;
  }

  const pT = $derived(10 ** logPt);
  const setup = $derived<TrackerSetup>({ B, L, n: Math.round(N), sigma: sigmaUm * 1e-6, x0: x0pct / 100 });

  const grid = Array.from({ length: 41 }, (_, i) => 10 ** (-0.3 + (i * 3.3) / 40));
  const curves = $derived({
    meas: grid.map((p) => glucksternMeasurement(p, setup)),
    ms: grid.map((p) => glucksternScattering(p, setup, p / Math.hypot(p, 0.1057))),
    total: grid.map((p) => glucksternTotal(p, setup, p / Math.hypot(p, 0.1057))),
  });
  const MC_PTS = [1, 3, 10, 30, 100, 300, 1000];
  const mc = $derived.by(() => {
    void version;
    return MC_PTS.map((p) => {
      const r = monteCarloResolution(setup, p, 250, seed * 100 + p);
      return { x: p, y: r.sigma68 };
    });
  });
  const mcPoints = $derived(mc.filter((p) => p.y > 0 && p.y < 0.6).map((p) => ({ x: p.x, y: p.y, color: 'var(--series-2)' })));

  // the picture of one track
  const pic = $derived.by(() => {
    void version;
    const r = makeRng(seed);
    const exact = simulateTrack({ ...setup, sigma: 0, n: 80, x0: 0 }, pT, r, { scatter: false });
    const last = exact.points.at(-1)!;
    const ang = Math.atan2(last.y, last.x);
    const dev = (p: { x: number; y: number }) => -Math.sin(ang) * p.x + Math.cos(ang) * p.y; // perpendicular distance from the chord
    const along = (p: { x: number; y: number }) => Math.cos(ang) * p.x + Math.sin(ang) * p.y;
    const t = simulateTrack(setup, pT, r);
    const fit = hook('reco.circleFit', circleFit)(t.points);
    const pFit = ptFromRadiusMm(fit.R, B);
    return {
      curve: { x: exact.points.map(along), y: exact.points.map(dev) },
      pts: t.points.map((p) => ({ x: along(p), y: dev(p), yerr: p.sigma })),
      pFit,
      sigmaMm: sigmaUm / 1000,
    };
  });
  const yDom = $derived.by((): [number, number] => {
    const ys = [...pic.curve.y, ...pic.pts.map((p) => p.y - p.yerr), ...pic.pts.map((p) => p.y + p.yerr)];
    const lo = Math.min(...ys, 0), hi = Math.max(...ys, 0);
    const pad = 0.12 * (hi - lo || 1);
    return [lo - pad, hi + pad];
  });
  const sag = $derived(sagittaOf(pT, B, L) * 1000); // mm
  const Rm = $derived(pT / (0.299792458 * B)); // m
  const relMeas = $derived(glucksternMeasurement(pT, setup));
  const relMs = $derived(glucksternScattering(pT, setup, pT / Math.hypot(pT, 0.1057)));
  const cross = $derived(crossoverPt(setup));
  const pct = (v: number) => (v < 0.1 ? (100 * v).toFixed(2) : (100 * v).toFixed(1)) + ' %';
</script>

<Widget {title} n={figNo} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={B} min={0.5} max={6} step={0.1} label="Field B [T]" />
    <Slider bind:value={L} min={0.3} max={2} step={0.05} label="Lever arm L [m]" />
    <Slider bind:value={N} min={3} max={60} step={1} label="Points N" format={(v) => v.toFixed(0)} />
    <Slider bind:value={sigmaUm} min={5} max={300} step={5} label="Position error σ [μm]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={x0pct} min={0} max={10} step={0.25} label="Material x/X₀ [%]" format={(v) => v.toFixed(2)} />
    <Slider bind:value={logPt} min={-0.3} max={3} step={0.02} label="Track pT [GeV]" format={(v) => (10 ** v).toFixed(10 ** v < 10 ? 1 : 0)} />
    <Button onclick={() => (seed += 1)}>New track (seed {seed})</Button>
    {#if mineAvailable}<Toggle bind:checked={useMineOn} label="use my code (circleFit)" onchange={toggleMine} />{/if}
  {/snippet}
  <div class="grid">
    <div>
      <h5 class="ui">One track of {pT < 10 ? pT.toFixed(1) : pT.toFixed(0)} GeV, seen sideways</h5>
      <LinePlot
        lines={[{ x: pic.curve.x, y: pic.curve.y, label: 'true path', dash: '' }]}
        points={pic.pts.map((p) => ({ x: p.x, y: p.y, yerr: p.yerr, color: 'var(--series-2)' }))}
        x={{ domain: [0, L * 1000 * 1.02], label: 'distance along the chord [mm]' }}
        y={{ domain: yDom, label: 'distance from the chord [mm]', format: (v) => Number(v.toPrecision(2)).toString() }}
        height={250}
        legend={false}
        label="Distance of a simulated track and its measured points from the straight chord, in millimetres, against distance along the chord"
      />
      <p class="ui small">
        Radius <strong>{Rm < 100 ? Rm.toFixed(2) : Rm.toFixed(0)} m</strong>; sagitta over {L} m: <strong>{sag < 10 ? sag.toFixed(2) : sag.toFixed(1)} mm</strong>, against an error of {sigmaUm} μm per point
        ({(sag / (sigmaUm / 1000)).toFixed(1)}×). The circle fit gives pT = <strong>{pic.pFit < 10 ? pic.pFit.toFixed(2) : pic.pFit.toFixed(1)} GeV</strong>.
      </p>
    </div>
    <div>
      <h5 class="ui">σ(pT)/pT against pT</h5>
      <LinePlot
        lines={[
          { x: grid, y: curves.meas, label: 'position error', dash: '6 3' },
          { x: grid, y: curves.ms, label: 'multiple scattering', dash: '2 3' },
          { x: grid, y: curves.total, label: 'both', dash: '' },
        ]}
        points={mcPoints}
        vmarks={[{ value: pT, label: 'this track', color: 'var(--mute)' }]}
        x={{ type: 'log', domain: [0.5, 1000], label: 'pT [GeV]' }}
        y={{ type: 'log', domain: [1e-4, 1], label: 'σ(pT)/pT', format: (v) => (v >= 0.01 ? `${Number((100 * v).toPrecision(2))} %` : `${Number((100 * v).toPrecision(1))} %`) }}
        height={250}
        label="Relative momentum resolution against transverse momentum: the measurement term, the scattering term and their sum, with Monte Carlo points"
      />
      <p class="ui small">
        At this pT: position error {pct(relMeas)}, scattering {pct(relMs)}. The terms are equal at about <strong>{Number.isFinite(cross) ? (cross < 10 ? cross.toFixed(1) : cross.toFixed(0)) : '–'} GeV</strong>. Orange dots: {MC_PTS.length} Monte Carlo runs of 250 tracks each.
      </p>
    </div>
  </div>
  {#if mineNote}<p class="ui small">{mineNote}</p>{/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.2rem;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  .small {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
