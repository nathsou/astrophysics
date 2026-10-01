<!--
  The rate ladder (Chapter 27): rate = σ L for a ladder of processes, from any inelastic collision down to a Higgs boson decaying to four
  leptons, at an instantaneous luminosity you choose, against the three numbers that matter to a trigger: the 40 MHz crossing rate, the
  100 kHz Level-1 output and the 1 kHz that can be written out.

    ::rate-ladder{n="27.1" caption="…"}

  The cross-sections are ROUNDED, APPROXIMATE values at 13 to 14 TeV, chosen to be of the right order (the point is the ladder, not the digits):
  inelastic 80 mb, dijets with pT > 30 GeV about 19 μb (the toy trigger model's value), W → ℓν (ℓ = e, μ together) 40 nb, Z → μμ (m > 50 GeV)
  2 nb, tt̄ 830 pb, all Higgs production about 50 pb ("several tens of picobarns"), times branching fractions from the course's particle table
  (H → γγ 0.227 %) or the library's Higgs widths (H → 4ℓ with ℓ = e, μ, about 1.2 × 10⁻⁴).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { particle } from '$lib/hep/particles';
  import { sig } from '$lib/sims/stats/common';

  let { n, caption, title = 'Rate = σ × L: a ladder of processes' }: { n?: string | number; caption?: string; title?: string } = $props();

  const SIGMA_H_PB = 50;
  const brGG = particle(25).decays!.find((d) => d.products.length === 2 && d.products[0] === 22 && d.products[1] === 22)!.br;
  const BR_4L = 1.2e-4;
  interface Row { key: string; label: string; sigmaPb: number; note: string }
  const rows: Row[] = [
    { key: 'inel', label: 'Any inelastic collision', sigmaPb: 8.0e10, note: '80 mb' },
    { key: 'jj', label: 'Dijets, pT > 30 GeV', sigmaPb: 1.9e7, note: 'about 19 μb' },
    { key: 'w', label: 'W → ℓν (e or μ)', sigmaPb: 4.0e4, note: 'about 40 nb' },
    { key: 'z', label: 'Z → μμ (m > 50 GeV)', sigmaPb: 2.0e3, note: 'about 2 nb' },
    { key: 'tt', label: 'Top pairs', sigmaPb: 830, note: 'about 830 pb' },
    { key: 'h', label: 'Higgs boson, any decay', sigmaPb: SIGMA_H_PB, note: 'about 50 pb' },
    { key: 'hgg', label: 'H → γγ', sigmaPb: SIGMA_H_PB * brGG, note: 'about 50 pb × 0.23 %' },
    { key: 'h4l', label: 'H → ZZ* → 4ℓ (e, μ)', sigmaPb: SIGMA_H_PB * BR_4L, note: 'about 50 pb × 0.012 %' },
  ];

  let lumi = $state(2); // 10³⁴ cm⁻² s⁻¹
  let dataset = $state(140); // fb⁻¹

  const LO = -6, HI = 10; // log10 Hz
  const pos = (hz: number) => Math.min(100, Math.max(0, ((Math.log10(hz) - LO) / (HI - LO)) * 100));
  const rate = (r: Row) => r.sigmaPb * 1e-36 * lumi * 1e34; // Hz
  const inel = rows[0]!.sigmaPb;

  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  /** A number as "1.6 × 10⁹" from 10⁴ up, plain below. */
  function big(x: number): string {
    if (!(x >= 1e4)) return sig(x, 2);
    const e = Math.floor(Math.log10(x));
    return `${sig(x / 10 ** e, 2)} × 10${String(e).replace(/\d/g, (d) => SUP[+d]!)}`;
  }
  function every(hz: number): string {
    const s = 1 / hz;
    if (s < 1e-6) return `one every ${sig(s * 1e9, 2)} ns`;
    if (s < 1e-3) return `one every ${sig(s * 1e6, 2)} µs`;
    if (s < 1) return `one every ${sig(s * 1e3, 2)} ms`;
    if (s < 120) return `one every ${sig(s, 2)} s`;
    if (s < 7200) return `one every ${sig(s / 60, 2)} min`;
    if (s < 172800) return `one every ${sig(s / 3600, 2)} h`;
    return `one every ${sig(s / 86400, 2)} days`;
  }
  const fmtHz = (hz: number) => (hz >= 1e9 ? `${sig(hz / 1e9, 2)} GHz` : hz >= 1e6 ? `${sig(hz / 1e6, 2)} MHz` : hz >= 1e3 ? `${sig(hz / 1e3, 2)} kHz` : hz >= 1 ? `${sig(hz, 2)} Hz` : `${sig(hz * 1000, 2)} mHz`);
  const count = (r: Row) => r.sigmaPb * dataset * 1e3; // fb⁻¹ → pb⁻¹ = 1e3
  const fmtCount = (x: number) => big(x);
  const LINES = [
    { hz: 40e6, label: '40 MHz: crossings' },
    { hz: 100e3, label: '100 kHz: Level 1' },
    { hz: 1e3, label: '1 kHz: storage' },
  ];
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={lumi} min={0.1} max={6} step={0.1} label="Instantaneous luminosity (10³⁴ cm⁻² s⁻¹)" format={(v) => v.toFixed(1)} />
    <Slider bind:value={dataset} min={1} max={3000} log label="Data recorded (fb⁻¹)" format={(v) => sig(v, 3)} />
  {/snippet}

  <div class="ladder ui" role="table" aria-label="Rates of several processes at the chosen luminosity">
    <div class="axis" aria-hidden="true">
      <span></span>
      <div class="track head">
        {#each [-6, -4, -2, 0, 2, 4, 6, 8, 10] as e}<span class="tick" style:left="{pos(10 ** e)}%">10{e < 0 ? '⁻' : ''}{String(Math.abs(e)).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!)}</span>{/each}
      </div>
      <span class="unit">events per second</span>
    </div>
    {#each rows as r (r.key)}
      {@const hz = rate(r)}
      <div class="row" role="row">
        <div class="name" role="cell"><strong>{r.label}</strong><small>{r.note}</small></div>
        <div class="track" role="cell" aria-label="{fmtHz(hz)}">
          {#each LINES as l}<span class="ref" style:left="{pos(l.hz)}%"></span>{/each}
          <span class="bar" class:hot={r.key.startsWith('h')} style:width="{pos(hz)}%"></span>
        </div>
        <div class="val" role="cell"><strong>{fmtHz(hz)}</strong><small>{every(hz)}</small></div>
        <div class="cnt" role="cell"><strong>{fmtCount(count(r))}</strong><small>in {sig(dataset, 3)} fb⁻¹; 1 in {big(inel / r.sigmaPb)} collisions</small></div>
      </div>
    {/each}
    <div class="legend">
      {#each LINES as l}<span><i class="ref-sw"></i>{l.label}</span>{/each}
    </div>
  </div>
</Widget>

<style>
  .ladder {
    display: grid;
    gap: 0.35rem;
    font-size: 0.85rem;
  }
  .row,
  .axis {
    display: grid;
    grid-template-columns: minmax(9rem, 13rem) 1fr minmax(7rem, 9rem) minmax(8rem, 12rem);
    gap: 0.6rem;
    align-items: center;
  }
  .axis {
    grid-template-columns: minmax(9rem, 13rem) 1fr;
  }
  .name,
  .val,
  .cnt {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  small {
    color: var(--mute);
    font-size: 0.72rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .track {
    position: relative;
    height: 1.1rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 4px;
    overflow: hidden;
  }
  .track.head {
    height: 1.2rem;
    background: none;
    border: none;
    overflow: visible;
  }
  .tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    font-size: 0.68rem;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  .unit {
    display: none;
  }
  .bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--series-1);
    opacity: 0.85;
  }
  .bar.hot {
    background: var(--sig-high);
  }
  .ref {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 2px dashed var(--ink-2);
    z-index: 2;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    color: var(--ink-2);
    font-size: 0.78rem;
    margin-top: 0.3rem;
  }
  .ref-sw {
    display: inline-block;
    width: 0;
    height: 0.8rem;
    border-left: 2px dashed var(--ink-2);
    margin-right: 0.35rem;
    vertical-align: middle;
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr 1fr;
    }
    .track {
      grid-column: 1 / -1;
      order: 3;
    }
    .axis {
      display: none;
    }
  }
</style>
