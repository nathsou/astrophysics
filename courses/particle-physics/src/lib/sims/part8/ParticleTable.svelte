<!--
  The particle table of appendix D: every particle in hep/particles (the same table the generator, the decays and the reaction judge use), with its PDG code, mass,
  width or lifetime, charge, spin, baryon and lepton numbers and main decays. Filter by kind, search by name or code, sort by mass or code. Values are rounded from the PDG Review of
  Particle Physics (2024 edition); antiparticles are not listed (negate the code).

    ::particle-table{n="D.1"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { allParticles, particle, type Particle } from '$lib/hep/particles';
  import { sig } from './format';

  let { n, caption, title = 'Every particle in the course’s table' }: { n?: string | number; caption?: string; title?: string } = $props();

  const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const exp10 = (x: number, d = 3) => {
    const e = Math.floor(Math.log10(Math.abs(x)));
    const m = x / 10 ** e;
    return `${m.toFixed(d - 1)} × 10${String(e).split('').map((c) => SUP[c] ?? c).join('')}`;
  };
  function fmtMass(p: Particle): string {
    if (p.mass === 0) return p.kind === 'lepton' ? '0 (table; see Chapter 31)' : '0';
    const g = p.mass;
    if (g >= 1) return `${sig(g, 6)} GeV`;
    return `${sig(g * 1000, 6)} MeV`;
  }
  function fmtLife(p: Particle): string {
    if (p.lifetime === Infinity) return 'stable';
    if (p.width > 0) return `Γ = ${p.width >= 1 ? `${sig(p.width, 4)} GeV` : p.width >= 1e-3 ? `${sig(p.width * 1000, 4)} MeV` : `${sig(p.width * 1e6, 4)} keV`}`;
    return `τ = ${exp10(p.lifetime, 4)} s`;
  }
  const fmtCharge = (p: Particle) => {
    const c = p.charge3;
    if (c === 0) return '0';
    const s = c < 0 ? '−' : '+';
    const a = Math.abs(c);
    return a % 3 === 0 ? `${s}${a / 3}` : `${s}${a}/3`;
  };
  const fmtSpin = (p: Particle) => (p.spin2 % 2 === 0 ? String(p.spin2 / 2) : `${p.spin2}/2`);
  const fmtDecays = (p: Particle) =>
    p.decays
      .slice()
      .sort((a, b) => b.br - a.br)
      .slice(0, 3)
      .map((d) => `${d.products.map((id) => particle(id).symbol).join(' ')} ${d.br >= 0.1 ? (d.br * 100).toFixed(0) : d.br >= 0.01 ? (d.br * 100).toFixed(1) : (d.br * 100).toPrecision(2)} %`)
      .join('; ');

  type Key = 'all' | Particle['kind'];
  let kind = $state<Key>('all');
  let query = $state('');
  let sortBy = $state<'pdg' | 'mass'>('mass');
  let descending = $state(false);

  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let list = allParticles().filter((p) => (kind === 'all' || p.kind === kind) && (!q || p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q) || String(p.pdg) === q));
    list = list.slice().sort((a, b) => (sortBy === 'mass' ? a.mass - b.mass || a.pdg - b.pdg : a.pdg - b.pdg));
    return descending ? list.reverse() : list;
  });
  const total = allParticles().length;
  function sort(key: 'pdg' | 'mass') {
    if (sortBy === key) descending = !descending;
    else {
      sortBy = key;
      descending = false;
    }
  }
</script>

<Widget {title} {n} {caption} kind="Reference" live={false}>
  {#snippet controls()}
    <Segmented
      label="Kind"
      size="sm"
      options={[{ value: 'all', label: 'All' }, { value: 'lepton', label: 'Leptons' }, { value: 'quark', label: 'Quarks' }, { value: 'boson', label: 'Bosons' }, { value: 'meson', label: 'Mesons' }, { value: 'baryon', label: 'Baryons' }]}
      bind:value={kind}
    />
    <label class="ui search">Search <input type="search" bind:value={query} placeholder="name, symbol or PDG code" /></label>
  {/snippet}
  <div class="table-scroll">
    <table class="ui">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th><button onclick={() => sort('pdg')} aria-label="Sort by PDG code">PDG code {sortBy === 'pdg' ? (descending ? '▼' : '▲') : ''}</button></th>
          <th>Kind</th>
          <th><button onclick={() => sort('mass')} aria-label="Sort by mass">Mass {sortBy === 'mass' ? (descending ? '▼' : '▲') : ''}</button></th>
          <th>Width or lifetime</th>
          <th>Charge</th>
          <th>Spin</th>
          <th>B</th>
          <th>Main decays (table)</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as p (p.pdg)}
          <tr>
            <td class="sym">{p.symbol}</td>
            <td class="mono">{p.name}</td>
            <td class="num">{p.pdg}</td>
            <td>{p.kind}</td>
            <td class="num">{fmtMass(p)}</td>
            <td class="num">{fmtLife(p)}</td>
            <td class="num">{fmtCharge(p)}</td>
            <td class="num">{fmtSpin(p)}</td>
            <td class="num">{p.baryon3 === 0 ? '0' : p.baryon3 === 3 ? '1' : p.baryon3 === 1 ? '⅓' : p.baryon3}</td>
            <td>{fmtDecays(p) || '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="ui note">{rows.length} of {total} entries. Masses of the quarks are current masses (the top quark is the pole mass); the width of a particle is given where its lifetime is too short to measure, the lifetime where it is long enough to matter. Decay lists are the reduced ones the generator uses: the listed fractions may not add up to 100 %.</p>
</Widget>

<style>
  .search {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  input[type='search'] {
    font: inherit;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    min-width: 12rem;
  }
  .table-scroll {
    max-height: 34rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.28rem 0.6rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    text-transform: none;
    letter-spacing: 0;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--pn);
    font-weight: 600;
    white-space: nowrap;
  }
  th button {
    all: unset;
    cursor: pointer;
    font-weight: 600;
  }
  th button:focus-visible {
    outline: 2px solid var(--focus);
  }
  .sym {
    font-size: 0.95rem;
    white-space: nowrap;
  }
  .mono,
  .num {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
</style>
