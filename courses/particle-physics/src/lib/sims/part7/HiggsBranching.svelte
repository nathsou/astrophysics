<!--
  The Higgs boson's branching fractions against its mass (Chapter 30), from the library's LEADING-ORDER partial widths (`higgsWidths` in hep/sm), with the
  values of the course's particle table (rounded, from the PDG and the LHC Higgs Cross Section Working Group's higher-order calculations) beside them at
  125.2 GeV. Drag the mass: this is the plot that tells an experimenter where to look, because the visible channels change completely between 100 and 160 GeV.

    ::higgs-branching{n="30.2" caption="…"}

  Limits of the model: LO (the differences from the table are the higher-order corrections and the running quark masses); H → Zγ is not computed; above
  about 160 GeV the W and Z pairs are on-shell and the library's formula stops (so the slider stops at 159 GeV).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { higgsWidths } from '$lib/hep/sm';
  import { particle } from '$lib/hep/particles';
  import { sig } from '$lib/sims/stats/common';

  let { n, caption, title = 'What the Higgs boson decays to, against its mass' }: { n?: string | number; caption?: string; title?: string } = $props();

  let mH = $state(125.2);
  const CH: { key: 'bb' | 'WW' | 'gg' | 'tautau' | 'cc' | 'ZZ' | 'gammagamma' | 'mumu'; label: string; colour: string; table: number | null }[] = [
    { key: 'bb', label: 'bb̄', colour: 'var(--series-1)', table: 0.582 },
    { key: 'WW', label: 'WW*', colour: 'var(--series-2)', table: 0.214 },
    { key: 'gg', label: 'gg', colour: 'var(--series-3)', table: 0.0819 },
    { key: 'tautau', label: 'ττ', colour: 'var(--series-4)', table: 0.0627 },
    { key: 'cc', label: 'cc̄', colour: 'var(--series-5)', table: 0.0289 },
    { key: 'ZZ', label: 'ZZ*', colour: 'var(--series-6)', table: 0.0262 },
    { key: 'gammagamma', label: 'γγ', colour: 'var(--p-photon)', table: 0.00227 },
    { key: 'mumu', label: 'μμ', colour: 'var(--series-8)', table: 0.00022 },
  ];
  /** Where each curve is labelled: a mass and a vertical nudge in pixels, chosen so that no two labels touch. */
  const LABEL: Record<string, [number, number]> = { bb: [103, -7], WW: [157, -7], gg: [118, 11], tautau: [103, -7], cc: [143, 11], ZZ: [141, 11], gammagamma: [150, -7], mumu: [103, -7] };
  const masses = Array.from({ length: 60 }, (_, i) => 100 + i);
  const curves = masses.map((m) => higgsWidths(m));
  const here = $derived(higgsWidths(mH));
  const totalMeV = $derived(here.total * 1000);
  const lifetime = $derived(6.582119569e-25 / here.total); // s
  const tableH = particle(25);
  void tableH;
  const path = (key: (typeof CH)[number]['key'], sx: (v: number) => number, sy: (v: number) => number) => masses.map((m, i) => `${i ? 'L' : 'M'}${sx(m).toFixed(1)},${sy(curves[i]!.br[key]).toFixed(1)}`).join('');
</script>

<Widget {title} {n} {caption} kind="Calculation">
  {#snippet controls()}
    <Slider bind:value={mH} min={100} max={159} step={0.1} label="Higgs boson mass (GeV)" format={(v) => v.toFixed(1)} />
  {/snippet}
  <Plot x={{ domain: [100, 160], label: 'Higgs boson mass [GeV]' }} y={{ type: 'log', domain: [1e-4, 1], label: 'branching fraction' }} height={320} label="Branching fractions of the Higgs boson against its mass on a logarithmic axis for eight decay channels">
    {#snippet marks({ sx, sy })}
      <line x1={sx(mH)} x2={sx(mH)} y1={sy(1)} y2={sy(1e-4)} stroke="var(--ink-3)" stroke-dasharray="4 3" />
      {#each CH as c}
        <path d={path(c.key, sx, sy)} fill="none" stroke={c.colour} stroke-width="2" />
        {@const lb = LABEL[c.key]!}
        <text x={sx(lb[0])} y={sy(higgsWidths(lb[0]).br[c.key]) + lb[1]} class="lbl" fill={c.colour}>{c.label}</text>
        <circle cx={sx(mH)} cy={sy(here.br[c.key])} r="3.5" fill={c.colour} />
      {/each}
    {/snippet}
  </Plot>
  <div class="ui table-wrap">
    <table>
      <thead><tr><th>Channel</th><th>This calculation (LO) at {mH.toFixed(1)} GeV</th><th>Particle table (125.2 GeV)</th></tr></thead>
      <tbody>
        {#each CH as c}
          <tr><td style:color={c.colour}>{c.label}</td><td>{(100 * here.br[c.key]).toPrecision(3)} %</td><td>{c.table === null ? '' : `${(100 * c.table).toPrecision(3)} %`}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="s">Total width at LO: <strong>{sig(totalMeV, 3)} MeV</strong>, a lifetime of {lifetime.toExponential(2)} s. The table's width is 4.1 MeV.</p>
  </div>
</Widget>

<style>
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .table-wrap {
    margin-top: 0.6rem;
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.15rem 0.9rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  .s {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
</style>
