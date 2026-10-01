<!--
  Couplings against mass (Chapter 30): the Standard Model's straight line. Every particle that gets its mass from the Higgs field has a coupling to the Higgs
  boson in proportion to that mass: for a fermion y = κ_F m_F/v, for a gauge boson √κ_V m_V/v, with κ = 1 in the Standard Model, so that on a log–log plot all of
  them lie on the line y = m/v (slope 1). This is the form in which ATLAS and CMS show their measurements.

  THE FIGURE SHOWS THE PREDICTION ONLY. No measured value is drawn: the experiments' combinations are in the papers cited in the chapter and could not be
  verified for the figure. Each marker says how far that particle's coupling has been tested (an observation, evidence, or not yet) as a status, not as a value.
  The slider tilts the line, y = (m/v)(m/125 GeV)^ε, to show what a deviation from "proportional to mass" would look like.

    ::coupling-line{n="30.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { V_EW_GEV } from '$lib/hep/fields';

  let { n, caption, title = 'Couplings against mass: the Standard Model line' }: { n?: string | number; caption?: string; title?: string } = $props();

  type Status = 'observed' | 'evidence' | 'not yet';
  interface P { id: string; pdg: number; label: string; kind: 'fermion' | 'boson'; status: Status; how: string }
  const ITEMS: P[] = [
    { id: 'e', pdg: 11, label: 'e', kind: 'fermion', status: 'not yet', how: 'H → e⁺e⁻ has a branching fraction of about 5 × 10⁻⁹ (the muon’s, times (mₑ/m_μ)²): out of reach.' },
    { id: 'u', pdg: 2, label: 'u', kind: 'fermion', status: 'not yet', how: 'Too small to see in any decay or production process so far.' },
    { id: 'd', pdg: 1, label: 'd', kind: 'fermion', status: 'not yet', how: 'Too small to see in any decay or production process so far.' },
    { id: 's', pdg: 3, label: 's', kind: 'fermion', status: 'not yet', how: 'Searches exist, with sensitivity far above the Standard Model rate.' },
    { id: 'mu', pdg: 13, label: 'μ', kind: 'fermion', status: 'evidence', how: 'H → μ⁺μ⁻: evidence at about 3σ in CMS data (Run 2).' },
    { id: 'c', pdg: 4, label: 'c', kind: 'fermion', status: 'not yet', how: 'H → cc̄ searches set limits that are still much weaker than the Standard Model prediction.' },
    { id: 'tau', pdg: 15, label: 'τ', kind: 'fermion', status: 'observed', how: 'H → τ⁺τ⁻, established in the Run 1 data of ATLAS and CMS together.' },
    { id: 'b', pdg: 5, label: 'b', kind: 'fermion', status: 'observed', how: 'H → bb̄ and the associated production VH, observed in 2018.' },
    { id: 'W', pdg: 24, label: 'W', kind: 'boson', status: 'observed', how: 'H → WW*, and production through W fusion and WH.' },
    { id: 'Z', pdg: 23, label: 'Z', kind: 'boson', status: 'observed', how: 'H → ZZ* → 4ℓ, and production through ZH.' },
    { id: 't', pdg: 6, label: 't', kind: 'fermion', status: 'observed', how: 'ttH production, observed in 2018 (the top is too heavy for H → tt̄).' },
  ];
  const v = V_EW_GEV;
  const pts = ITEMS.map((p) => ({ ...p, m: particle(p.pdg).mass }));
  let eps = $state(0);
  const yOf = (m: number, e: number) => (m / v) * (m / 125) ** e;
  const X: [number, number] = [0.3e-3, 600];
  const grid = Array.from({ length: 60 }, (_, i) => 10 ** (Math.log10(0.0003) + ((Math.log10(600) - Math.log10(0.0003)) * i) / 59));
  const fmtM = (m: number) => (m >= 1 ? `${m.toPrecision(4)} GeV` : `${(m * 1000).toPrecision(3)} MeV`);
  const OFFSET: Record<string, number> = { s: -16, W: -16, c: -16 };
  const MARK: Record<Status, string> = { observed: 'var(--sig-high)', evidence: 'var(--series-1)', 'not yet': 'var(--mute)' };
</script>

<Widget {title} {n} {caption} kind="Prediction">
  {#snippet controls()}
    <Slider bind:value={eps} min={-0.5} max={0.5} step={0.01} label="Departure from proportionality: y ∝ m^(1+ε)" format={(x) => (x >= 0 ? '+' : '') + x.toFixed(2)} />
  {/snippet}
  <Plot
    x={{ type: 'log', domain: X, label: 'particle mass [GeV]' }}
    y={{ type: 'log', domain: [1e-6, 2], label: 'coupling to the Higgs boson' }}
    height={340}
    margin={{ top: 12, right: 16, bottom: 42, left: 86 }}
    label="Reduced coupling strength against mass on logarithmic axes: the Standard Model line y = m/v and one marker for each particle, coded by how well its coupling has been tested"
  >
    {#snippet marks({ sx, sy })}
      <path d={grid.map((m, i) => `${i ? 'L' : 'M'}${sx(m).toFixed(1)},${sy(m / v).toFixed(1)}`).join('')} fill="none" stroke="var(--p-higgs)" stroke-width="2.2" />
      {#if eps !== 0}
        <path d={grid.map((m, i) => `${i ? 'L' : 'M'}${sx(m).toFixed(1)},${sy(yOf(m, eps)).toFixed(1)}`).join('')} fill="none" stroke="var(--bad)" stroke-width="1.6" stroke-dasharray="6 4" />
      {/if}
      <text x={sx(1.5)} y={sy(1.5 / v) + 34} class="lbl" fill="var(--p-higgs)">y = m/v: the Standard Model</text>
      {#each pts as p}
        {@const y = yOf(p.m, eps)}
        {#if p.status === 'observed'}
          <circle cx={sx(p.m)} cy={sy(y)} r="6" fill={MARK[p.status]} stroke="var(--fg)" />
        {:else if p.status === 'evidence'}
          <circle cx={sx(p.m)} cy={sy(y)} r="6" fill="none" stroke={MARK[p.status]} stroke-width="2.5" />
        {:else}
          <rect x={sx(p.m) - 5} y={sy(y) - 5} width="10" height="10" fill="none" stroke={MARK[p.status]} stroke-width="1.5" transform="rotate(45 {sx(p.m)} {sy(y)})" />
        {/if}
        <text x={sx(p.m) + (OFFSET[p.id] ?? 9)} y={sy(y) + 14} class="lbl" fill="var(--ink-2)">{p.label}</text>
      {/each}
    {/snippet}
  </Plot>
  <ul class="ui key">
    <li><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="var(--sig-high)" stroke="var(--fg)" /></svg> coupling tested through an observed decay or production process (5σ)</li>
    <li><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--series-1)" stroke-width="2.5" /></svg> evidence (about 3σ)</li>
    <li><svg width="16" height="16"><rect x="3" y="3" width="10" height="10" fill="none" stroke="var(--mute)" stroke-width="1.5" transform="rotate(45 8 8)" /></svg> not yet observed</li>
  </ul>
  <details class="ui how">
    <summary>How each coupling is tested</summary>
    <table>
      <thead><tr><th>Particle</th><th>Mass</th><th>Prediction y = m/v</th><th>Status and how</th></tr></thead>
      <tbody>
        {#each pts.slice().sort((a, b) => b.m - a.m) as p}
          <tr><td>{p.label}</td><td>{fmtM(p.m)}</td><td>{(p.m / v).toExponential(2)}</td><td><strong>{p.status}.</strong> {p.how}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</Widget>

<style>
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .key {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .key svg {
    vertical-align: -3px;
  }
  .how {
    font-size: 0.82rem;
  }
  .how table {
    border-collapse: collapse;
    margin-top: 0.4rem;
  }
  .how th,
  .how td {
    padding: 0.2rem 0.7rem;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    vertical-align: top;
  }
</style>
