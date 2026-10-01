<!--
  Decay lengths of heavy-flavour hadrons (Chapter 24). A hadron of mass m, momentum p and lifetime τ travels βγcτ = (p/m) cτ on average before it decays, with an exponential
  distribution. Left: the ladder of cτ from the particle table. Right: for the chosen hadron and momentum, the distribution of the flight distance, and the fraction that
  decays farther than three times the track impact-parameter resolution. Lifetimes are the table's (PDG 2024).

    ::displaced-vertex{n="24.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { FLYERS, ctauMm, meanDecayLengthMm } from './flavour';

  let { n, caption, title = 'How far does it fly?' }: { n?: string | number; caption?: string; title?: string } = $props();

  let pdg = $state(511);
  let p = $state(50);
  let res = $state(20); // µm, impact-parameter resolution
  const ladder = FLYERS.map((f) => ({ ...f, ctau: ctauMm(f.pdg) })).sort((a, b) => a.ctau - b.ctau);
  const mean = $derived(meanDecayLengthMm(pdg, p));
  const bg = $derived(p / particle(pdg).mass);
  const frac = $derived(Math.exp(-(3 * res * 1e-3) / mean));
  const curve = $derived(Array.from({ length: 120 }, (_, i) => {
    const L = (i / 119) * 5 * mean;
    return { L, d: Math.exp(-L / mean) / mean };
  }));
  const fmtLen = (mm: number) => (mm < 1 ? `${(mm * 1000).toFixed(0)} µm` : mm < 1000 ? `${mm.toFixed(mm < 10 ? 2 : 1)} mm` : `${(mm / 1000).toFixed(mm < 1e4 ? 2 : 1)} m`);
  const opts = FLYERS.filter((f) => [511, 521, 531, 5122, 421, 411, 15, 310].includes(f.pdg)).map((f) => ({ value: f.pdg, label: f.label }));
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { pdg = 511; p = 50; res = 20; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented label="Particle" size="sm" bind:value={pdg} options={opts} />
      <Slider bind:value={p} min={2} max={500} step={1} log label="Momentum, GeV" format={(v) => v.toFixed(0)} />
      <Slider bind:value={res} min={5} max={100} step={1} label="Impact-parameter resolution, µm" format={(v) => v.toFixed(0)} />
    </div>
  {/snippet}
  <div class="grid">
    <section aria-label="The ladder of cτ">
      <h5 class="ui">cτ of each particle (the distance light travels in one lifetime)</h5>
      <Plot
        x={{ type: 'log', domain: [10, 1e9], label: 'cτ [µm]', tickValues: [10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9], format: (v) => (v >= 1e9 ? `${v / 1e9} km` : v >= 1e6 ? `${v / 1e6} m` : v >= 1e3 ? `${v / 1e3} mm` : `${v} µm`) }}
        y={{ domain: [0, ladder.length + 1], label: '', tickValues: [] }}
        height={300}
        crosshair={false}
        margin={{ top: 8, right: 14, bottom: 42, left: 14 }}
        label="Distance light travels in one lifetime, on a logarithmic axis, for heavy-flavour hadrons, the tau lepton and some long-lived light particles"
      >
        {#snippet marks({ sx, sy })}
          <rect x={sx(10)} width={Math.max(0, sx(res * 3) - sx(10))} y="0" height={sy(0)} fill="var(--bad)" opacity="0.1" />
          <line x1={sx(res * 3)} x2={sx(res * 3)} y1="0" y2={sy(0)} stroke="var(--bad)" stroke-dasharray="4 3" />
          <text x={sx(res * 3) + 4} y="16" class="lbl" fill="var(--bad)">3 × resolution: invisible displacement</text>
          {#each ladder as f, i}
            {@const y = sy(i + 0.5)}
            <line x1={sx(10)} x2={sx(f.ctau * 1000)} y1={y} y2={y} stroke={f.pdg === pdg ? 'var(--accent)' : 'var(--series-1)'} stroke-width={f.pdg === pdg ? 5 : 3} opacity={f.pdg === pdg ? 1 : 0.55} />
            <text x={f.ctau * 1000 > 5e6 ? sx(f.ctau * 1000) - 5 : sx(f.ctau * 1000) + 5} text-anchor={f.ctau * 1000 > 5e6 ? 'end' : 'start'} y={y + 4} class="lbl">{f.label} {fmtLen(f.ctau)}</text>
          {/each}
        {/snippet}
      </Plot>
    </section>
    <section aria-label="Flight distance distribution">
      <h5 class="ui">Flight distance of a {FLYERS.find((f) => f.pdg === pdg)?.label} of {p.toFixed(0)} GeV</h5>
      <Plot x={{ domain: [0, 5 * mean], label: 'decay distance [mm]', format: (v) => Number(v.toPrecision(3)).toString() }} y={{ domain: [0, 1 / mean], label: 'probability density', tickValues: [] }} height={220} crosshair={false} margin={{ top: 8, right: 14, bottom: 42, left: 14 }} label="Exponential distribution of the decay distance with its mean marked">
        {#snippet marks({ sx, sy })}
          <path d={`M${sx(0)},${sy(0)}` + curve.map((c) => `L${sx(c.L)},${sy(c.d)}`).join('') + `L${sx(5 * mean)},${sy(0)}Z`} fill="var(--series-1)" opacity="0.25" />
          <path d={curve.map((c, i) => `${i ? 'L' : 'M'}${sx(c.L)},${sy(c.d)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <line x1={sx(mean)} x2={sx(mean)} y1={sy(0)} y2={sy(1 / (Math.E * mean))} stroke="var(--ink-2)" stroke-dasharray="4 3" />
          <text x={sx(mean) + 5} y={sy(0.6 / mean)} class="lbl">mean {fmtLen(mean)}</text>
          {#if 3 * res * 1e-3 < 5 * mean}<line x1={sx(3 * res * 1e-3)} x2={sx(3 * res * 1e-3)} y1={sy(0)} y2={sy(1 / mean)} stroke="var(--bad)" stroke-dasharray="3 3" />{/if}
        {/snippet}
      </Plot>
      <table class="ui tab" aria-live="polite">
        <tbody>
          <tr><th scope="row">Lifetime τ</th><td>{particle(pdg).lifetime.toExponential(3)} s</td></tr>
          <tr><th scope="row">cτ</th><td>{fmtLen(ctauMm(pdg))}</td></tr>
          <tr><th scope="row">βγ = p/m</th><td>{bg.toFixed(1)}</td></tr>
          <tr><th scope="row">Mean flight βγcτ</th><td><strong>{fmtLen(mean)}</strong></td></tr>
          <tr><th scope="row">Decays beyond 3 × resolution ({(3 * res).toFixed(0)} µm)</th><td>{(100 * frac).toFixed(1)} %</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .tab {
    border-collapse: collapse;
    font-size: 0.84rem;
    margin-top: 0.4rem;
  }
  .tab th,
  .tab td {
    padding: 0.15rem 1rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  .tab td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
</style>
