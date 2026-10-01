<!--
  The layers of a detector and what each particle does in them. Fire one of six particles through the course detector (`hep/detector` `simulate`, the `onion` preset);
  the drawing shows the hits and calorimeter cells of that event (radii compressed so that the tracker is visible), and the table averages 40 particles: how many tracker hits, how much
  energy in each calorimeter and how many muon-chamber hits.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { presets, simulate, ecalOuterRadius, hcalOuterRadius } from '$lib/hep/detector';
  import { truthEventFrom } from '$lib/hep/reco/synthetic';
  import { rng as makeRng } from '$lib/hep/random';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const cfg = presets.onion!;
  const KINDS = [
    { id: 11, label: 'electron' },
    { id: 22, label: 'photon' },
    { id: 13, label: 'muon' },
    { id: 211, label: 'charged pion' },
    { id: 2112, label: 'neutron' },
    { id: 14, label: 'neutrino' },
  ];
  let pdg = $state(11);
  let pt = $state(20);
  let seed = $state(1);

  const rOut = cfg.muon.stations.at(-1)!.r * 1.04;
  const SV = 320;
  const sr = (r: number) => Math.pow(r / rOut, 0.55) * (SV / 2 - 4);
  const eOut = ecalOuterRadius(cfg), hOut = hcalOuterRadius(cfg);

  const one = $derived.by(() => {
    const phi = 0.6;
    const truth = truthEventFrom([{ pdg, pt, eta: 0.05, phi }]);
    const det = simulate(truth, cfg, makeRng(seed));
    return { det, phi };
  });
  // the average over 40 particles
  const stats = $derived.by(() => {
    const r = makeRng(99);
    let hits = 0, ecal = 0, hcal = 0, mu = 0;
    const N = 40;
    for (let i = 0; i < N; i++) {
      const truth = truthEventFrom([{ pdg, pt, eta: 0.05 + 0.3 * (r() - 0.5), phi: -3 + 6 * r() }]);
      const d = simulate(truth, cfg, r);
      hits += d.hits.filter((h) => h.truth === 0).length;
      for (const c of d.cells) (c.calo === 'ecal' ? (ecal += c.energy) : (hcal += c.energy));
      mu += d.muonHits.filter((h) => h.truth === 0).length;
    }
    const E = Math.sqrt(pt * pt * Math.cosh(0.05) ** 2 + 0);
    return { hits: hits / N, ecal: ecal / N, hcal: hcal / N, mu: mu / N, E };
  });

  // a cell's position in the drawing: the ring of its calorimeter at its depth layer, at its azimuth
  const cellPos = (c: { calo: 'ecal' | 'hcal'; phi: number; layer: number }) => {
    const [r0, r1, nl] = c.calo === 'ecal' ? [cfg.ecal.rIn, eOut, cfg.ecal.layers] : [cfg.hcal.rIn, hOut, cfg.hcal.layers];
    const r = r0 + ((r1 - r0) * (c.layer + 0.5)) / nl;
    return { x: sr(r) * Math.cos(c.phi), y: -sr(r) * Math.sin(c.phi) };
  };
  const cellsDrawn = $derived(one.det.cells.filter((c) => c.energy > 0.05));
  const eMax = $derived(Math.max(0.1, ...cellsDrawn.map((c) => c.energy)));
  const note: Record<number, string> = {
    11: 'A curved track in the tracker, then a shower that stops inside the ECAL.',
    22: 'No track (no charge, so nothing to ionise the silicon), but a shower in the ECAL just like the electron’s.',
    13: 'A curved track, almost nothing in either calorimeter, and hits in the muon stations beyond: the only particle that gets there.',
    211: 'A curved track, a little energy in the ECAL, and most of the energy in the HCAL.',
    2112: 'No track, a little in the ECAL if it interacts early, most in the HCAL.',
    14: 'Nothing at all. It is noticed only because the momenta of everything else do not add up to zero.',
  };
  const fmt = (v: number) => (v < 0.05 ? '0' : v < 10 ? v.toFixed(2) : v.toFixed(1));
</script>

<Widget title="What each layer sees" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Particle" options={KINDS.map((k) => ({ value: k.id, label: k.label }))} bind:value={pdg} />
    <Slider bind:value={pt} min={5} max={100} step={5} label="pT [GeV]" format={(v) => v.toFixed(0)} />
    <Button onclick={() => (seed += 1)}>Again (shot {seed})</Button>
  {/snippet}
  <div class="grid">
    <svg viewBox="0 0 {SV} {SV}" role="img" aria-label="Cross-section of the course detector with the hits and calorimeter cells of one simulated particle" class="cross">
      <g transform="translate({SV / 2},{SV / 2})">
        <circle r={sr(hOut)} fill="var(--p-calo-had)" fill-opacity="0.13" stroke="var(--p-calo-had)" />
        <circle r={sr(cfg.hcal.rIn)} fill="var(--panel)" stroke="var(--p-calo-had)" />
        <circle r={sr(eOut)} fill="var(--p-calo-em)" fill-opacity="0.22" stroke="var(--p-calo-em)" />
        <circle r={sr(cfg.ecal.rIn)} fill="var(--panel)" stroke="var(--p-calo-em)" />
        {#each cfg.trackerLayers as l}<circle r={sr(l.r)} fill="none" stroke="var(--p-hit)" stroke-width="0.8" />{/each}
        {#each cfg.muon.stations as s}<circle r={sr(s.r)} fill="none" stroke="var(--p-muon)" stroke-dasharray="1 3" stroke-width="1.4" />{/each}
        {#each one.det.cells as c}
          {#if c.energy > 0.05}
            {@const p = cellPos(c)}
            <circle cx={p.x} cy={p.y} r={2 + 7 * Math.sqrt(c.energy / eMax)} fill={c.calo === 'ecal' ? 'var(--p-calo-em)' : 'var(--p-calo-had)'} fill-opacity="0.75" stroke="var(--fg)" stroke-width="0.5" />
          {/if}
        {/each}
        {#each one.det.hits as h}
          {#if h.truth === 0}<circle cx={sr(Math.hypot(h.x, h.y)) * Math.cos(Math.atan2(h.y, h.x))} cy={-sr(Math.hypot(h.x, h.y)) * Math.sin(Math.atan2(h.y, h.x))} r="2.2" fill="var(--fg)" />{/if}
        {/each}
        {#each one.det.muonHits as h}
          <circle cx={sr(Math.hypot(h.x, h.y)) * Math.cos(Math.atan2(h.y, h.x))} cy={-sr(Math.hypot(h.x, h.y)) * Math.sin(Math.atan2(h.y, h.x))} r="3.2" fill="var(--p-muon)" />
        {/each}
        <circle r="2" fill="var(--fg)" />
      </g>
    </svg>
    <div>
      <p class="ui note">{note[pdg]}</p>
      <table class="ui">
        <caption>Average of 40 {KINDS.find((k) => k.id === pdg)!.label}s of pT {pt} GeV</caption>
        <tbody>
          <tr><th>tracker hits (of 8 layers)</th><td>{stats.hits.toFixed(1)}</td></tr>
          <tr><th>ECAL energy</th><td>{fmt(stats.ecal)} GeV</td></tr>
          <tr><th>HCAL energy</th><td>{fmt(stats.hcal)} GeV</td></tr>
          <tr><th>muon-chamber hits (of 4 stations)</th><td>{stats.mu.toFixed(1)}</td></tr>
        </tbody>
      </table>
      <ul class="legend ui">
        <li><span class="d" style="background: var(--fg)"></span>tracker hit</li>
        <li><span class="d" style="background: var(--p-calo-em)"></span>ECAL cell</li>
        <li><span class="d" style="background: var(--p-calo-had)"></span>HCAL cell</li>
        <li><span class="d" style="background: var(--p-muon)"></span>muon hit</li>
      </ul>
      <p class="ui tiny">Radii compressed. Cell size ∝ √energy. One random particle of each kind, simulated with the <code>onion</code> preset; the ECAL is 25 X₀ of lead tungstate, the HCAL 10 λ of iron.</p>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cross {
    width: 100%;
    max-width: 380px;
    margin: 0 auto;
    display: block;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .note {
    margin: 0 0 0.6rem;
    font-size: 0.88rem;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.84rem;
  }
  caption {
    text-align: left;
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-bottom: 0.25rem;
  }
  th,
  td {
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    font-weight: 400;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--line);
  }
  td {
    text-align: right;
    font-family: var(--font-mono);
  }
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    padding: 0;
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    margin: 0 !important;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .d {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    display: inline-block;
  }
  .tiny {
    font-size: 0.76rem;
    color: var(--mute);
    margin: 0.5rem 0 0;
  }
</style>
