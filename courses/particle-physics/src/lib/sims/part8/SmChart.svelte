<!--
  The Standard Model at a glance: the twelve fermions and the bosons on one logarithmic mass axis, from the course's particle table (values rounded from the PDG 2024 review).
  The neutrinos have no entry on the axis: their masses are below 0.45 eV (direct limit) and not yet measured.

    ::sm-chart{n="D.2"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { particle } from '$lib/hep/particles';
  import { sig } from './format';

  let { n, caption, title = 'Twelve fermions and the bosons on one mass axis' }: { n?: string | number; caption?: string; title?: string } = $props();

  interface Row {
    pdg: number;
    group: string;
    gen?: string;
    shape: 'circle' | 'diamond' | 'square';
    color: string;
  }
  const ROWS: Row[] = [
    { pdg: 2, group: 'Quarks', gen: '1', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 1, group: 'Quarks', gen: '1', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 3, group: 'Quarks', gen: '2', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 4, group: 'Quarks', gen: '2', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 5, group: 'Quarks', gen: '3', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 6, group: 'Quarks', gen: '3', shape: 'circle', color: 'var(--p-jet)' },
    { pdg: 11, group: 'Charged leptons', gen: '1', shape: 'diamond', color: 'var(--p-electron)' },
    { pdg: 13, group: 'Charged leptons', gen: '2', shape: 'diamond', color: 'var(--p-muon)' },
    { pdg: 15, group: 'Charged leptons', gen: '3', shape: 'diamond', color: 'var(--p-tau)' },
    { pdg: 22, group: 'Bosons', shape: 'square', color: 'var(--p-photon)' },
    { pdg: 21, group: 'Bosons', shape: 'square', color: 'var(--p-photon)' },
    { pdg: 24, group: 'Bosons', shape: 'square', color: 'var(--p-boson)' },
    { pdg: 23, group: 'Bosons', shape: 'square', color: 'var(--p-boson)' },
    { pdg: 25, group: 'Bosons', shape: 'square', color: 'var(--p-higgs)' },
  ];
  const LO = Math.log10(1e-4), HI = Math.log10(300);
  const pos = (m: number) => ((Math.log10(m) - LO) / (HI - LO)) * 100;
  const fmt = (g: number) => (g >= 1 ? `${sig(g, 4)} GeV` : `${sig(g * 1000, 3)} MeV`);
  const ticks = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 100];
  const tickLabel = (t: number) => (t >= 1 ? `${t} GeV` : `${sig(t * 1000, 1)} MeV`);
</script>

<Widget {title} {n} {caption} kind="Reference" live={false}>
  <ol class="rows ui">
    <li class="axis" aria-hidden="true">
      <span></span>
      <span class="track">{#each ticks as t}<span class="tick" style:left="{pos(t)}%">{tickLabel(t)}</span>{/each}</span>
      <span></span>
    </li>
    {#each ROWS as r, i}
      {@const p = particle(r.pdg)}
      {#if i === 0 || ROWS[i - 1]!.group !== r.group}<li class="grp">{r.group}{r.group === 'Charged leptons' ? ' (the three neutrinos: below 0.45 eV, not on this axis)' : ''}</li>{/if}
      <li class="row">
        <span class="name"><span class="sym">{p.symbol}</span> <span class="meta">{r.gen ? `generation ${r.gen}` : p.spin2 === 0 ? 'spin 0' : 'spin 1'}</span></span>
        <span class="track">
          {#each ticks as t}<span class="grid" style:left="{pos(t)}%"></span>{/each}
          {#if p.mass > 0}
            <span class="dot {r.shape}" style:left="{pos(p.mass)}%" style:background={r.color} title="{p.symbol}: {fmt(p.mass)}"></span>
          {:else}
            <span class="zero">massless (left of the axis)</span>
          {/if}
        </span>
        <span class="val">{p.mass > 0 ? fmt(p.mass) : '0'}</span>
      </li>
    {/each}
  </ol>
</Widget>

<style>
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.82rem;
  }
  li {
    display: grid;
    grid-template-columns: minmax(7.5rem, 11rem) minmax(0, 1fr) 6.5rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.12rem 0;
  }
  li.grp {
    display: block;
    margin-top: 0.6rem;
    padding: 0.1rem 0;
    font-weight: 600;
    color: var(--ink-2);
    border-bottom: 1px solid var(--line);
    font-size: 0.78rem;
  }
  .name {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  .sym {
    font-size: 1rem;
    min-width: 1.6rem;
  }
  .meta {
    color: var(--mute);
    font-size: 0.72rem;
  }
  .track {
    position: relative;
    height: 1.3rem;
  }
  .axis .track {
    height: 1.1rem;
  }
  .tick {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.66rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .grid {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--grid, var(--line));
  }
  .dot {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translate(-50%, -50%);
    border: 1.5px solid var(--fg);
  }
  .dot.circle {
    border-radius: 50%;
  }
  .dot.diamond {
    transform: translate(-50%, -50%) rotate(45deg);
    width: 10px;
    height: 10px;
  }
  .dot.square {
    border-radius: 2px;
  }
  .val {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-align: right;
    white-space: nowrap;
  }
  .zero {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.72rem;
    color: var(--mute);
  }
  @media (max-width: 560px) {
    li {
      grid-template-columns: 6rem minmax(0, 1fr) 4.6rem;
      gap: 0.3rem;
    }
    .meta {
      display: none;
    }
  }
</style>
