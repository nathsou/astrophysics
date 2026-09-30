<!--
  Systematic uncertainties. Left: a counting experiment measures a signal strength μ. The expected background is known only to within a fraction δ; that
  is modelled by a nuisance parameter θ with a Gaussian constraint, b → b(1 + δθ), which the fit adjusts to suit the data. Profiling θ widens the
  likelihood curve of μ, and the width grows as √(σ_stat² + (δ b/s)²): the systematic band.

  Right: the lesson of the luminosity at LEP. The number of light neutrino species measured at the Large Electron–Positron collider was N_ν = 2.9840 ± 0.0082 (the
  LEP electroweak working groups, Phys. Rept. 427 (2006) 257); Janot and Jadach (Phys. Lett. B 803 (2020) 135319) improved the calculation behind the luminosity
  measurement and found N_ν = 2.9963 ± 0.0074. Both are PUBLISHED values, shown as published.

    ::systematics{n="28.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { discovery, fitMu, profileTheta, type CountingModel } from '$lib/hep/analysis';
  import { fmtZ, sig } from './common';

  let { n, caption, title = 'Systematic uncertainties and nuisance parameters' }: { n?: string | number; caption?: string; title?: string } = $props();

  // ── part A: the nuisance parameter ─────────────────────────────────────────────────────────────
  const S = 50, B = 200;
  let relUnc = $state(0.1);
  let observed = $state(250);
  const data = $derived([observed]);
  const mGrid = Array.from({ length: 121 }, (_, i) => -0.4 + i * 0.025);
  function curve(model: CountingModel, d: number[]): { mus: number[]; delta: number[]; mu: number } {
    const best = fitMu({ ...model, signal: [S] }, d);
    // The curve is drawn over negative μ too; the unconditional minimum may sit at μ̂ < 0, so take the smallest value on the grid as the reference as well.
    const vals = mGrid.map((m) => profileTheta(model, d, m).nll);
    const ref = Math.min(best.nll, ...vals);
    return { mus: mGrid, delta: vals.map((v) => 2 * (v - ref)), mu: mGrid[vals.indexOf(Math.min(...vals))]! };
  }
  const stat = $derived(curve({ signal: [S], background: [B] }, data));
  const full = $derived(curve({ signal: [S], background: [B], nuisance: { name: 'background normalisation', relUnc } }, data));
  /** The interval where the curve is below 1, by linear interpolation of the crossings. */
  function interval(c: { mus: number[]; delta: number[] }): { lo: number; hi: number } {
    const k = c.delta.indexOf(Math.min(...c.delta));
    const cross = (from: number, dir: 1 | -1) => {
      for (let i = from; i + dir >= 0 && i + dir < c.delta.length; i += dir) {
        if (c.delta[i + dir]! >= 1) {
          const a = c.delta[i]!, b = c.delta[i + dir]!;
          return c.mus[i]! + ((1 - a) / (b - a)) * (c.mus[i + dir]! - c.mus[i]!);
        }
      }
      return dir > 0 ? c.mus[c.mus.length - 1]! : c.mus[0]!;
    };
    return { lo: cross(k, -1), hi: cross(k, 1) };
  }
  const iStat = $derived(interval(stat));
  const iFull = $derived(interval(full));
  const sStat = $derived((iStat.hi - iStat.lo) / 2);
  const sFull = $derived((iFull.hi - iFull.lo) / 2);
  const sSyst = $derived(Math.sqrt(Math.max(0, sFull * sFull - sStat * sStat)));
  const muHat = $derived(stat.mu);
  const z0Stat = $derived(discovery({ signal: [S], background: [B] }, data).z);
  const z0Full = $derived(discovery({ signal: [S], background: [B], nuisance: { name: 'bkg', relUnc } }, data).z);

  // ── part B: LEP ────────────────────────────────────────────────────────────────────────────────
  const LEP = [
    { key: 'old', label: '2006 combination', value: 2.984, err: 0.0082, colour: 'var(--series-8)', ref: 'Phys. Rept. 427 (2006) 257' },
    { key: 'new', label: 'after the luminosity correction', value: 2.9963, err: 0.0074, colour: 'var(--series-1)', ref: 'Janot & Jadach, Phys. Lett. B 803 (2020) 135319' },
  ];
  let view = $state<'old' | 'new' | 'both'>('old');
  const shown = $derived(LEP.filter((l) => view === 'both' || l.key === view));
  const shift = (LEP[1]!.value - LEP[0]!.value);
</script>

<Widget {title} {n} {caption} kind="Explore">
  <div class="grid">
    <section class="pane" aria-label="A nuisance parameter widens the uncertainty">
      <h5 class="ui">A nuisance parameter widens the uncertainty on μ</h5>
      <div class="ctl">
        <Slider bind:value={relUnc} min={0} max={0.3} step={0.01} label="Background uncertainty δ" format={(v) => `${(100 * v).toFixed(0)} %`} />
        <Slider bind:value={observed} min={170} max={320} step={1} label="Observed events (b = {B}, s = {S} at μ = 1)" format={(v) => v.toFixed(0)} />
      </div>
      <Plot x={{ domain: [-0.4, 2.6], label: 'Signal strength μ' }} y={{ domain: [0, 6], label: 'Δ(−2 ln L)' }} height={270} label="Profile likelihood curves for the signal strength, with and without the background uncertainty">
        {#snippet marks({ sx, sy, width })}
          <rect x={sx(iFull.lo)} width={Math.max(0, sx(iFull.hi) - sx(iFull.lo))} y="0" height={sy(0)} fill="var(--sig-high)" fill-opacity="0.13" />
          <line x1="0" x2={width} y1={sy(1)} y2={sy(1)} stroke="var(--ink-3)" stroke-dasharray="4 3" />
          <text x={width - 4} y={sy(1) - 4} text-anchor="end" class="lbl" fill="var(--ink-3)">Δ = 1: one standard deviation</text>
          <path d={stat.mus.map((m, i) => `${i ? 'L' : 'M'}${sx(m)},${sy(Math.min(6.5, stat.delta[i]!))}`).join('')} fill="none" stroke="var(--series-8)" stroke-width="2" />
          <path d={full.mus.map((m, i) => `${i ? 'L' : 'M'}${sx(m)},${sy(Math.min(6.5, full.delta[i]!))}`).join('')} fill="none" stroke="var(--sig-high)" stroke-width="2.4" />
          <line x1={sx(0)} x2={sx(0)} y1="0" y2={sy(0)} stroke="var(--line-strong)" />
        {/snippet}
      </Plot>
      <p class="ui legend"><span class="sw" style:background="var(--series-8)"></span>statistical only <span class="sw" style:background="var(--sig-high)"></span>with the nuisance parameter</p>
      <div class="readout ui" aria-live="polite">
        <table>
          <tbody>
            <tr><th scope="row">Best fit μ̂</th><td>{muHat.toFixed(2)}</td></tr>
            <tr><th scope="row">Statistical uncertainty</th><td>± {sStat.toFixed(3)}</td></tr>
            <tr><th scope="row">Systematic (added in quadrature)</th><td>± {sSyst.toFixed(3)}</td></tr>
            <tr><th scope="row">Total</th><td><strong>± {sFull.toFixed(3)}</strong></td></tr>
            <tr><th scope="row">Significance of μ &gt; 0</th><td>{fmtZ(z0Stat)} → {fmtZ(z0Full)}</td></tr>
          </tbody>
        </table>
        <p class="sub">The nuisance parameter is constrained by an auxiliary measurement, θ ~ N(0, 1), so a 10 % uncertainty on b = {B} is ±{(0.1 * B).toFixed(0)} events, against a signal of {S}: an uncertainty comparable to the effect.</p>
      </div>
    </section>

    <section class="pane" aria-label="The LEP luminosity lesson">
      <h5 class="ui">When the systematic itself was wrong: light neutrinos at LEP</h5>
      <div class="ctl"><Segmented label="Which value" size="sm" bind:value={view} options={[{ value: 'old', label: '2006' }, { value: 'new', label: '2020 (corrected luminosity)' }, { value: 'both', label: 'Both' }]} /></div>
      <Plot x={{ domain: [2.96, 3.02], label: 'Number of light neutrino species N_ν', format: (v) => v.toFixed(2) }} y={{ domain: [0, 3], label: '', tickValues: [] }} height={230} crosshair={false} margin={{ top: 12, right: 16, bottom: 42, left: 16 }} label="Two published measurements of the number of light neutrino species with their uncertainties, and the integer 3">
        {#snippet marks({ sx, sy, height })}
          <line x1={sx(3)} x2={sx(3)} y1="0" y2={height} stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="5 4" />
          <text x={sx(3) + 5} y="14" class="lbl" fill="var(--ok)">N_ν = 3</text>
          {#each shown as l}
            {@const yy = sy(l.key === 'old' ? 2 : 1)}
            <line x1={sx(l.value - l.err)} x2={sx(l.value + l.err)} y1={yy} y2={yy} stroke={l.colour} stroke-width="3" />
            <line x1={sx(l.value - l.err)} x2={sx(l.value - l.err)} y1={yy - 6} y2={yy + 6} stroke={l.colour} stroke-width="2" />
            <line x1={sx(l.value + l.err)} x2={sx(l.value + l.err)} y1={yy - 6} y2={yy + 6} stroke={l.colour} stroke-width="2" />
            <circle cx={sx(l.value)} cy={yy} r="5.5" fill={l.colour} stroke="var(--panel)" stroke-width="1.5" />
            <text x={sx(l.value)} y={yy - 12} text-anchor="middle" class="lbl" fill="var(--fg)">{l.value.toFixed(4)} ± {l.err.toFixed(4)}</text>
          {/each}
        {/snippet}
      </Plot>
      <ul class="ui refs">
        {#each shown as l}<li><span class="sw" style:background={l.colour}></span><strong>{l.label}:</strong> {l.value.toFixed(4)} ± {l.err.toFixed(4)} <span class="ref">({l.ref})</span></li>{/each}
      </ul>
      <div class="readout ui" aria-live="polite">
        <p class="sub">
          The published central value moved by {shift.toFixed(4)}, which is {(shift / LEP[0]!.err).toFixed(1)} times the old uncertainty. Before, N_ν was {((3 - LEP[0]!.value) / LEP[0]!.err).toFixed(2)} standard
          deviations below 3; after, {((3 - LEP[1]!.value) / LEP[1]!.err).toFixed(2)}. The lesson: a nuisance parameter is only as good as the model of it.
          A normalisation that is slightly wrong moves the result by more than its quoted uncertainty, and no amount of data reduces that.
        </p>
        <p class="sub"><em>Values as published: the LEP electroweak working groups, Phys. Rept. 427 (2006) 257; Janot and Jadach, Phys. Lett. B 803 (2020) 135319.</em></p>
      </div>
    </section>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 1.4rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
    margin-bottom: 0.6rem;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .legend {
    margin: 0.3rem 0 0;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 1.1rem;
    height: 0.28rem;
    margin: 0 0.3rem 0 0.6rem;
    vertical-align: middle;
    border-radius: 2px;
  }
  .legend .sw:first-child {
    margin-left: 0;
  }
  .readout {
    margin-top: 0.6rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.84rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.15rem 0.6rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .sub {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .refs {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .refs li {
    margin: 0.2rem 0;
  }
  .refs .sw {
    margin-left: 0;
  }
  .ref {
    color: var(--mute);
  }
</style>
