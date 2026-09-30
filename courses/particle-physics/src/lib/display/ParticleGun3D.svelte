<!--
  Fire one particle through the detector and see what each kind does: choose the particle, its transverse momentum and
  direction, and the magnetic field. The truth (the path the particle takes, dotted or wavy when it leaves no track) and the
  reconstruction are overlaid.

    ::particle-gun-3d{n="7.2" caption="…"}  (for Chapter 7)
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import EventDisplay from './EventDisplay.svelte';
  import { defaultGeometry, type DisplayGeometry } from './geometry.ts';
  import { gunEvent } from './sampleEvents.ts';
  import { particle } from '../hep/particles/index.ts';

  let {
    n,
    caption,
    title = 'Fire a particle through the detector',
    views = '3d,rphi',
    geometry = defaultGeometry,
    pdg = 13,
    viewHeight = 360,
  }: {
    n?: string | number;
    caption?: string;
    title?: string;
    views?: string | string[];
    geometry?: DisplayGeometry;
    pdg?: number | string;
    viewHeight?: number | string;
  } = $props();

  const KINDS: { pdg: number; note: string }[] = [
    { pdg: 11, note: 'Bends in the field, leaves hits in the tracker and stops in the electromagnetic calorimeter, where it showers.' },
    { pdg: 13, note: 'Bends slightly, leaves hits in the tracker, only a trace in both calorimeters, and reaches the muon chambers.' },
    { pdg: 22, note: 'Neutral: no track and no hits, but a shower in the electromagnetic calorimeter.' },
    { pdg: 211, note: 'Charged hadron: a track, then most of its energy in the hadronic calorimeter.' },
    { pdg: 2212, note: 'Proton: like a charged pion, a track and a hadronic shower.' },
    { pdg: 2112, note: 'Neutron: neutral, so no track; it deposits energy in the hadronic calorimeter.' },
    { pdg: 130, note: 'Neutral kaon (K-long): no track; deposits energy in the hadronic calorimeter.' },
    { pdg: 14, note: 'Neutrino: passes through everything; only the missing momentum shows that it was there.' },
  ];
  let choice = $state(untrack(() => Number(pdg) || 13));
  let flip = $state(false);
  let logPt = $state(Math.log10(20));
  let eta = $state(0.4);
  let phi = $state(0.8);
  let bField = $state(untrack(() => geometry.bField));
  let shot = $state(1);
  const pT = $derived(10 ** logPt);
  const charged = $derived(particle(choice).charge3 !== 0);
  const signed = $derived(flip && charged ? -choice : choice);
  const geo = $derived({ ...geometry, bField });
  const ev = $derived(gunEvent({ pdg: signed, pt: pT, eta, phi, seed: shot, geometry: geo }));
  const note = $derived(KINDS.find((k) => k.pdg === choice)?.note ?? '');
  const det = $derived(ev.detector!);
  const sum = (c: 'ecal' | 'hcal') => det.cells.filter((x) => x.calo === c).reduce((a, x) => a + x.energy, 0);
  const name = $derived(particle(ev.truth!.particles[0]!.pdg).symbol);
  let index = $state(0);
  let selected = $state<string | null>(null);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <div class="ui row" role="radiogroup" aria-label="Particle">
      {#each KINDS as k (k.pdg)}
        <button type="button" role="radio" aria-checked={choice === k.pdg} class:on={choice === k.pdg} onclick={() => (choice = k.pdg)}>{particle(k.pdg).symbol}</button>
      {/each}
    </div>
    {#if charged}
      <label class="ui chk"><input type="checkbox" bind:checked={flip} /> antiparticle (opposite charge)</label>
    {/if}
    <Slider bind:value={logPt} min={-0.3} max={2.3} step={0.02} label="Transverse momentum pT" format={(v) => `${(10 ** v).toFixed(10 ** v < 10 ? 1 : 0)} GeV`} />
    <Slider bind:value={eta} min={-2.4} max={2.4} step={0.05} label="Direction η" />
    <Slider bind:value={phi} min={-3.14} max={3.14} step={0.05} label="Direction φ" />
    <Slider bind:value={bField} min={0} max={4} step={0.1} label="Magnetic field B [T]" />
    <button type="button" class="again ui" onclick={() => (shot += 1)}>Fire again (shot {shot})</button>
  {/snippet}
  <p class="ui note"><strong>{name}</strong>, pT {pT.toFixed(pT < 10 ? 1 : 0)} GeV. {note}</p>
  <EventDisplay event={ev} geometry={geo} {views} showTruth showReco showHits bind:index bind:selected toggles controls viewHeight={Number(viewHeight) || 360} objectList={false} />
  <table class="ui resp">
    <caption>What the detector recorded</caption>
    <tbody>
      <tr><th>tracker hits</th><td>{det.hits.length}</td><th>ECAL energy</th><td>{sum('ecal').toFixed(1)} GeV</td></tr>
      <tr><th>muon-chamber hits</th><td>{det.muonHits.length}</td><th>HCAL energy</th><td>{sum('hcal').toFixed(1)} GeV</td></tr>
      <tr><th>reconstructed as</th><td colspan="3">{ev.reco.objects.length ? ev.reco.objects.map((o) => o.kind).join(', ') : ev.reco.tracks.length ? 'a track only' : 'nothing identified'}; missing pT {Math.hypot(ev.reco.met.x, ev.reco.met.y).toFixed(1)} GeV</td></tr>
    </tbody>
  </table>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .row button,
  .again {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    min-height: 1.9rem;
  }
  .row button.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .chk {
    font-size: 0.8rem;
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .note {
    margin: 0 0 0.6rem !important;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    margin-top: 0.8rem;
    font-size: 0.8rem;
    width: 100%;
  }
  caption {
    text-align: left;
    color: var(--mute);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding-bottom: 0.2rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.15rem 0.6rem 0.15rem 0;
    text-transform: none;
    letter-spacing: 0;
  }
  th {
    color: var(--mute);
    font-weight: 500;
  }
  td {
    font-family: var(--font-mono);
  }
</style>
