<!--
  All the masses of the Standard Model on one logarithmic axis (Chapter 26).

    ::mass-spectrum{n="26.3" caption="…"}

  Masses come from `hep/particles`. The neutrinos are a band (the direct limit and the oscillation lower bound for the
  heaviest one), clearly marked as limits, not measurements. The second scale is y = √2 m/v, the Yukawa coupling that would
  give a fermion that mass (for W, Z and H it is only a rescaling of the mass).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { neutrinoBand, spectrumEntries, withYukawa, V_EW_GEV, NEUTRINO_LIMIT_EV, NEUTRINO_HEAVIEST_LOWER_EV, type SpectrumGroup } from '$lib/hep/fields';
  import { fmt, pow10 } from './canvas';

  let { n, caption, title = 'Every mass in the Standard Model, on one axis' }: { n?: string | number; caption?: string; title?: string } = $props();

  const entries = withYukawa(spectrumEntries());
  const band = neutrinoBand();
  const ROW: Record<SpectrumGroup, number> = { quark: 0.55, lepton: 1.55, boson: 2.55 };
  const ROW_NAME: Record<number, string> = { 0.55: 'quarks', 1.55: 'leptons', 2.55: 'bosons' };
  const LO = 1e-11;
  const HI = 1e3;
  const YUK_ROW = 3.55;

  // label placement: [dx, dy, anchor]; alternate above and below within a row, by hand for the crowded W, Z, H
  const place: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
    u: [0, -10, 'middle'], d: [0, 17, 'middle'], s: [0, -10, 'middle'], c: [0, 17, 'middle'], b: [0, -10, 'middle'], t: [0, 17, 'middle'],
    'e-': [0, -10, 'middle'], 'mu-': [0, -10, 'middle'], 'tau-': [0, -10, 'middle'],
    'W+': [-10, 4, 'end'], Z: [-10, 4, 'end'], H: [-10, 4, 'end'],
  };
  // the three bosons are within 0.2 decades of each other: stack their markers vertically, labels to the left
  const stagger: Record<string, number> = { 'W+': -14, Z: 0, H: 14 };
  const label = (id: string, symbol: string) => ({ 'W+': 'W', 'mu-': 'μ', 'tau-': 'τ', 'e-': 'e' })[id] ?? symbol;
  const fmtMass = (gev: number) => (gev >= 1 ? fmt(gev, 4) + ' GeV' : gev >= 1e-3 ? fmt(gev * 1e3, 4) + ' MeV' : gev >= 1e-6 ? fmt(gev * 1e6, 3) + ' keV' : fmt(gev * 1e9, 2) + ' eV');
  const yTicks = [1e-12, 1e-10, 1e-8, 1e-6, 1e-4, 1e-2, 1];
  const mOfY = (y: number) => (y * V_EW_GEV) / Math.SQRT2;
  const tEntry = entries.find((e) => e.id === 't')!;
  const eEntry = entries.find((e) => e.id === 'e-')!;
  const ratio = tEntry.mass / eEntry.mass;
</script>

<Widget {title} {n} {caption} kind="Reference">
  <Plot
    height={330}
    margin={{ top: 10, right: 14, bottom: 42, left: 52 }}
    label="The masses of the quarks, charged leptons, W, Z and Higgs bosons on a logarithmic axis from 0.1 electronvolt to 1 teraelectronvolt, with the neutrino masses shown only as a band of limits far below the electron, and a second scale giving the Yukawa coupling."
    x={{ type: 'log', domain: [LO, HI], label: 'mass [GeV]', tickValues: [1e-9, 1e-6, 1e-3, 1, 1e3], format: pow10 }}
    y={{ domain: [0, 4.1], tickValues: [0.55, 1.55, 2.55], format: (v) => ROW_NAME[Number(v.toFixed(2))] ?? '' }}
    crosshair={false}
  >
    {#snippet marks({ sx, sy })}
      <!-- the Yukawa ruler (same positions, relabelled: y = √2 m/v) -->
      <line x1={sx(LO)} x2={sx(HI)} y1={sy(YUK_ROW - 0.25)} y2={sy(YUK_ROW - 0.25)} stroke="var(--line-strong)" />
      {#each yTicks as y}
        {@const x = sx(mOfY(y))}
        {#if x > 0 && x < sx(HI)}
          <line x1={x} x2={x} y1={sy(YUK_ROW - 0.25)} y2={sy(YUK_ROW - 0.25) + 5} stroke="var(--ink-2)" />
          <text {x} y={sy(YUK_ROW - 0.25) - 5} text-anchor="middle" class="yt">{y === 1 ? '1' : pow10(y)}</text>
        {/if}
      {/each}
      <text x={sx(LO) + 4} y={sy(YUK_ROW + 0.22)} class="yl">Yukawa coupling y = √2 m/v</text>

      <!-- neutrino band: a limit, not a measurement -->
      <rect x={sx(band.lower)} y={sy(ROW.lepton) - 9} width={sx(band.upper) - sx(band.lower)} height="18" class="band" />
      <line x1={sx(band.upper)} x2={sx(band.upper) + 12} y1={sy(ROW.lepton)} y2={sy(ROW.lepton)} class="limit" />
      <text x={sx(LO) + 4} y={sy(ROW.lepton) + 26} class="nu">neutrinos: limits only, ≈ {NEUTRINO_HEAVIEST_LOWER_EV} to &lt; {NEUTRINO_LIMIT_EV} eV</text>

      <!-- the particles -->
      {#each entries as e (e.id)}
        {@const x = sx(e.mass)}
        {@const y = sy(ROW[e.group]) + (stagger[e.id] ?? 0)}
        {@const pl = place[e.id] ?? [0, -10, 'middle']}
        {#if e.group === 'quark'}
          <circle cx={x} cy={y} r="5" class="mk q" />
        {:else if e.group === 'lepton'}
          <rect x={x - 4.5} y={y - 4.5} width="9" height="9" class="mk l" />
        {:else}
          <path d="M{x},{y - 6}L{x + 6},{y}L{x},{y + 6}L{x - 6},{y}Z" class="mk b" />
        {/if}
        <text x={x + pl[0]} y={y + pl[1]} text-anchor={pl[2]} class="pl">{label(e.id, e.symbol)}</text>
      {/each}
    {/snippet}
  </Plot>

  <p class="ui lead">
    From the electron to the top quark the masses span a factor of about {fmt(ratio, 2)}; counting the neutrinos, whose masses are below 1 eV, the span is more than a factor of 10<sup>11</sup>. The Standard Model has a place to put each of these numbers and no reason for any of them: <strong>nobody knows why the masses are what they are</strong>, or why they are so unequal. Only one, the top quark's, has a Yukawa coupling near 1.
  </p>

  <div class="tw"><table class="ui">
    <caption>The same numbers as a table (masses from the library's particle table; the quark masses are the PDG's current-quark values, the top quark's is its pole mass)</caption>
    <thead><tr><th scope="col">particle</th><th scope="col">kind</th><th scope="col">mass</th><th scope="col">y = √2 m/v</th></tr></thead>
    <tbody>
      {#each entries as e (e.id)}
        <tr><th scope="row">{label(e.id, e.symbol)}</th><td>{e.group === 'quark' ? 'quark' : e.group === 'lepton' ? 'charged lepton' : 'boson'}</td><td class="n">{fmtMass(e.mass)}</td><td class="n">{fmt(e.y, 3)}{e.group === 'boson' ? ' *' : ''}</td></tr>
      {/each}
      <tr><th scope="row">ν (heaviest)</th><td>neutrino</td><td class="n">≈ {NEUTRINO_HEAVIEST_LOWER_EV} eV to &lt; {NEUTRINO_LIMIT_EV} eV</td><td class="n">&lt; {fmt((Math.SQRT2 * band.upper) / V_EW_GEV, 2)}</td></tr>
    </tbody>
  </table></div>
  <p class="ui fn">
    * For W, Z and H the same ratio √2 m/v is only a convenient rescaling of the mass: their masses come from the gauge couplings and from the Higgs self-coupling, not from a Yukawa coupling. Photons and gluons have no mass and cannot appear on a logarithmic axis. The neutrino band is bounded above by the direct limit from the beta decay of tritium (the KATRIN experiment) and below by what neutrino oscillations require of the heaviest neutrino; the lightest may be massless.
  </p>
</Widget>

<style>
  .yt {
    font-size: 10px;
    fill: var(--ink-2);
  }
  .yl {
    font-size: 10.5px;
    fill: var(--mute);
  }
  .pl {
    font-size: 11.5px;
    fill: var(--fg);
    font-weight: 500;
  }
  .nu {
    font-size: 10.5px;
    fill: var(--ink-2);
  }
  .mk.q {
    fill: var(--series-1);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .mk.l {
    fill: var(--series-3);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .mk.b {
    fill: var(--series-4);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .band {
    fill: color-mix(in srgb, var(--series-3) 25%, transparent);
    stroke: var(--series-3);
    stroke-dasharray: 3 2;
  }
  .limit {
    stroke: var(--series-3);
    stroke-width: 2;
    marker-end: none;
  }
  .lead {
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--ink-2);
    margin: 0.6rem 0;
  }
  .tw {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  caption {
    text-align: left;
    color: var(--mute);
    font-size: 0.74rem;
    padding-bottom: 0.25rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 0.5rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
  }
  thead th {
    color: var(--mute);
    font-weight: 500;
  }
  tbody th {
    font-weight: 600;
    color: var(--fg);
  }
  td.n {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .fn {
    font-size: 0.74rem;
    color: var(--mute);
    margin: 0.4rem 0 0;
    line-height: 1.45;
  }
</style>
