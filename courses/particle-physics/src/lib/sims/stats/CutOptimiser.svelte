<!--
  Cut optimiser (Chapter 29). A toy signal (a narrow mass peak, and a discriminant that tends to be high) sits on a large background. Each cut throws away
  background and signal; the figure of merit is the expected significance, Z = √(2((s + b) ln(1 + s/b) − s)). Move the three cuts and watch Z rise and
  fall. The optimum, found by `selectionOptimiser`, is one button away: it is a compromise, not "as tight as possible".

    ::cut-optimiser{n="29.2" caption="…"}

  Props: `n`, `caption`, `seed` (toy events), `uncertainty` (relative background uncertainty used in Z).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { Hist1D, evaluateSelection, scanCut, selectionOptimiser, type CutValue } from '$lib/hep/analysis';
  import { DEFAULT_CUT_TOY, generateSamples } from './samples';
  import { fmtZ, sig } from './common';

  let { seed = DEFAULT_CUT_TOY.seed, uncertainty = 0, n, caption, title = 'Cut optimiser' }: { seed?: number; uncertainty?: number; n?: string | number; caption?: string; title?: string } = $props();

  const samples = $derived(generateSamples({ ...DEFAULT_CUT_TOY, seed }));
  const S = $derived(samples.sig);
  const B = $derived(samples.bkg);
  const opts = $derived({ bkgRelUnc: uncertainty, minBkgEvents: 5 });

  let mLo = $state(100);
  let mHi = $state(160);
  let dMin = $state(0);
  const cuts = $derived<CutValue[]>([
    { column: 'm', kind: 'min', value: mLo },
    { column: 'm', kind: 'max', value: mHi },
    { column: 'd', kind: 'min', value: dMin },
  ]);
  const sel = $derived(evaluateSelection(S, B, cuts, opts));
  const none = $derived(evaluateSelection(S, B, [], opts));

  let optimum = $state<ReturnType<typeof selectionOptimiser> | null>(null);
  let finding = $state(false);
  function findOptimum() {
    finding = true;
    // One frame to show the state, then the (fast) search.
    setTimeout(() => {
      optimum = selectionOptimiser(S, B, [{ column: 'm', kind: 'window' }, { column: 'd', kind: 'min' }], { ...opts, nCandidates: 50, nStarts: 2 });
      finding = false;
    }, 20);
  }
  onMount(findOptimum);
  function jump() {
    if (!optimum) return;
    mLo = Math.round(optimum.cuts[0]!.value * 10) / 10;
    mHi = Math.round(optimum.cuts[1]!.value * 10) / 10;
    dMin = Math.round(optimum.cuts[2]!.value * 100) / 100;
  }
  function reset() {
    mLo = 100;
    mHi = 160;
    dMin = 0;
  }

  // Scatter: a subsample of the simulated events.
  const NS = 500, NB = 1100;
  const pts = $derived.by(() => {
    const out: { m: number; d: number; s: boolean }[] = [];
    const sm = S.columns.m!, sd = S.columns.d!, bm = B.columns.m!, bd = B.columns.d!;
    for (let i = 0; i < Math.min(NS, S.n); i++) out.push({ m: sm[i]!, d: sd[i]!, s: true });
    for (let i = 0; i < Math.min(NB, B.n); i++) out.push({ m: bm[i]!, d: bd[i]!, s: false });
    return out;
  });

  // Mass spectra after the d cut (expected events per 1 GeV).
  const edges = Array.from({ length: 61 }, (_, i) => 100 + i);
  const spectra = $derived.by(() => {
    const hs = new Hist1D(edges), hb = new Hist1D(edges);
    const sm = S.columns.m!, sd = S.columns.d!, bm = B.columns.m!, bd = B.columns.d!;
    for (let i = 0; i < S.n; i++) if (sd[i]! >= dMin) hs.fill(sm[i]!, S.weight);
    for (let i = 0; i < B.n; i++) if (bd[i]! >= dMin) hb.fill(bm[i]!, B.weight);
    const tot = hb.clone().add(hs);
    return { bkg: Array.from(hb.counts), tot: Array.from(tot.counts) };
  });

  // Z against the discriminant cut, with the others held.
  const dGrid = Array.from({ length: 41 }, (_, i) => i * 0.025);
  const dScan = $derived(scanCut(S, B, cuts, 2, dGrid, opts));
  const zMax = $derived(Math.max(1, ...dScan.map((p) => (Number.isFinite(p.z) ? p.z : 0)), optimum?.z ?? 0, sel.z) * 1.15);
  const ratio = $derived(optimum && optimum.z > 0 ? sel.z / optimum.z : 0);
  const yMax = $derived(Math.max(...spectra.tot) * 1.15);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={mLo} min={100} max={125} step={0.1} label="Mass window: lower edge" format={(v) => `${v.toFixed(1)} GeV`} />
    <Slider bind:value={mHi} min={125} max={160} step={0.1} label="Mass window: upper edge" format={(v) => `${v.toFixed(1)} GeV`} />
    <Slider bind:value={dMin} min={0} max={0.99} step={0.01} label="Discriminant d ≥" format={(v) => v.toFixed(2)} />
    <div class="buttons ui">
      <Button onclick={jump} disabled={!optimum}>{finding ? 'Searching…' : 'Jump to the optimum'}</Button>
      <Button variant="ghost" onclick={reset}>No cuts</Button>
    </div>
  {/snippet}

  <div class="grid">
    <div class="pane">
      <h5 class="ui">Simulated events: mass against discriminant</h5>
      <Plot x={{ domain: [100, 160], label: 'Mass [GeV]' }} y={{ domain: [0, 1], label: 'Discriminant d' }} height={290} crosshair={false} label="Scatter plot of simulated signal and background events with the selected rectangle">
        {#snippet marks({ sx, sy })}
          {#each pts as p}
            {@const inside = p.m >= mLo && p.m <= mHi && p.d >= dMin}
            <circle cx={sx(p.m)} cy={sy(p.d)} r={p.s ? 2.2 : 1.6} fill={p.s ? 'var(--sig-high)' : 'var(--series-8)'} opacity={inside ? (p.s ? 0.95 : 0.55) : 0.16} />
          {/each}
          <rect x={sx(mLo)} y={sy(1)} width={Math.max(0, sx(mHi) - sx(mLo))} height={Math.max(0, sy(dMin) - sy(1))} fill="var(--track)" fill-opacity="0.08" stroke="var(--track)" stroke-width="1.5" />
        {/snippet}
      </Plot>
      <p class="ui legend"><span class="dot" style:background="var(--sig-high)"></span>signal <span class="dot" style:background="var(--series-8)"></span>background (a sample of the simulated events; the rectangle is your selection)</p>
    </div>
    <div class="pane">
      <h5 class="ui">Mass spectrum after the d cut (expected events per GeV)</h5>
      <HepHist
        series={[
          { edges, counts: spectra.bkg, label: 'background', fill: true, color: 'var(--series-8)' },
          { edges, counts: spectra.tot, label: 'background + signal', color: 'var(--sig-high)' },
        ]}
        x={{ domain: [100, 160], label: 'Mass [GeV]' }}
        y={{ domain: [0, yMax], label: 'Events per GeV' }}
        markers={[{ x: mLo, label: '', color: 'var(--track)' }, { x: mHi, label: '', color: 'var(--track)' }]}
        height={290}
        label="Expected mass spectrum after the discriminant cut, with the window edges marked"
      />
    </div>
  </div>

  <div class="grid lower">
    <div class="pane">
      <h5 class="ui">Significance against the discriminant cut (other cuts as set)</h5>
      <Plot x={{ domain: [0, 1], label: 'Discriminant cut d ≥' }} y={{ domain: [0, zMax], label: 'Expected significance Z [σ]' }} height={210} label="Expected significance as a function of the discriminant cut">
        {#snippet marks({ sx, sy })}
          <path d={dScan.filter((p) => Number.isFinite(p.z)).map((p, i) => `${i ? 'L' : 'M'}${sx(p.value)},${sy(p.z)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2" />
          {#if optimum}<line x1="0" x2={sx(1)} y1={sy(optimum.z)} y2={sy(optimum.z)} stroke="var(--ok)" stroke-dasharray="4 3" /><text x="6" y={sy(optimum.z) - 4} class="lbl" fill="var(--ok)">best found by the optimiser: {optimum.z.toFixed(2)}σ</text>{/if}
          <line x1={sx(dMin)} x2={sx(dMin)} y1={sy(0)} y2={sy(Math.max(0, Math.min(zMax, sel.z)))} stroke="var(--sig-high)" stroke-width="1.5" />
          <circle cx={sx(dMin)} cy={sy(Math.max(0, Math.min(zMax, sel.z)))} r="5" fill="var(--sig-high)" stroke="var(--panel)" stroke-width="1.5" />
        {/snippet}
      </Plot>
    </div>
    <div class="pane readout ui" aria-live="polite">
      <div class="card hot">
        <span class="k">Expected significance</span>
        <strong class="v">{fmtZ(sel.z)}</strong>
        <span class="s">{none.z > 0 ? `${sig(sel.z / none.z, 2)}× the ${fmtZ(none.z)} with no cuts` : ''}{#if optimum} · {(100 * ratio).toFixed(0)} % of the optimum{/if}</span>
      </div>
      <table>
        <tbody>
          <tr><th scope="row">Signal s</th><td>{sig(sel.s, 3)} of {sig(none.s, 3)}</td><td>{(100 * sel.effS).toFixed(0)} % kept</td></tr>
          <tr><th scope="row">Background b</th><td>{sig(sel.b, 3)} of {sig(none.b, 3)}</td><td>{(100 * sel.effB).toFixed(2)} % kept</td></tr>
          <tr><th scope="row">s/√b</th><td>{sel.b > 0 ? sig(sel.s / Math.sqrt(sel.b), 3) : '∞'}</td><td>the rule of thumb</td></tr>
          <tr><th scope="row">Simulated events left</th><td>{sel.nSig} signal, {sel.nBkg} background</td><td>{sel.nBkg < 5 ? 'too few: noisy' : ''}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  .lower {
    margin-top: 0.9rem;
    align-items: start;
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
    gap: 0.5rem;
    align-items: center;
  }
  .legend {
    margin: 0.3rem 0 0;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .dot {
    display: inline-block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    margin: 0 0.25rem 0 0.4rem;
    vertical-align: middle;
  }
  .legend .dot:first-child {
    margin-left: 0;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-bottom: 0.6rem;
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
    font-size: 1.25rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 0.15rem 0.5rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  td:nth-child(2) {
    color: var(--fg);
    font-family: var(--font-mono);
  }
</style>
