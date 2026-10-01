<!--
  A toy air shower (Chapter 9's sibling: Chapter 10's flagship). A proton of 10^13–10^16 eV enters the atmosphere; the hadronic cascade is followed particle
  by particle (./airshower.ts) and the muons it makes are followed to the ground, with and without special-relativistic time dilation.
  The electromagnetic component is not followed. It is a teaching toy: see the header of airshower.ts for every simplification.

    ::air-shower{n="10.2" caption="…" seed=4}
-->
<script lang="ts">
  import './part3.css';
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { simulateShower, type ShowerResult } from './airshower';

  let { n, caption, seed: seed0 = 4 }: { n?: string | number; caption?: string; seed?: number } = $props();

  let energy = $state(1e6); // GeV
  let zenith = $state(0);
  let dilation = $state(true);
  let seed = $state(seed0);
  let cfg = $state({ energy: 1e6, zenith: 0, dilation: true, seed: seed0 });
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;

  $effect(() => {
    const next = { energy, zenith, dilation, seed };
    clearTimeout(timer);
    if (!mounted) { cfg = next; return; }
    busy = true;
    timer = setTimeout(() => { cfg = next; busy = false; }, 120);
  });
  onMount(() => { mounted = true; });

  const res: ShowerResult = $derived(simulateShower({ E0: cfg.energy, zenithDeg: cfg.zenith, seed: cfg.seed, timeDilation: cfg.dilation, keepTracks: 240 }));
  const fmtE = (gev: number) => `10^${Math.round(Math.log10(gev * 1e9))} eV`;
  const fmtN = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-GB') : x >= 1 ? x.toFixed(0) : x.toPrecision(2));

  // view
  const W = 640, Hh = 400, ML = 44, MB = 26, MT = 10;
  const maxH = 32; // km
  const latMax = $derived.by(() => {
    let m = 0.5;
    for (const t of res.tracks) for (const p of t.pts) m = Math.max(m, Math.abs(p[0]));
    return Math.min(4, Math.ceil(m * 2) / 2);
  });
  const sx = (lat: number) => ML + ((lat + latMax) / (2 * latMax)) * (W - ML - 8);
  const sy = (h: number) => MT + (1 - h / maxH) * (Hh - MT - MB);
  const line = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');

  // histogram of birth heights
  const bins = 16;
  const hist = $derived.by(() => {
    const born = new Array<number>(bins).fill(0);
    const reached = new Array<number>(bins).fill(0);
    const noDil = new Array<number>(bins).fill(0);
    for (let k = 0; k < res.muonBirthKm.length; k++) {
      const b = Math.min(bins - 1, Math.max(0, Math.floor((res.muonBirthKm[k]! / maxH) * bins)));
      born[b]!++;
      reached[b]! += res.muonReached[k]!;
      noDil[b]! += res.muonPNoDilation[k]!;
    }
    return { born, reached, noDil, max: Math.max(1, ...born) };
  });
  const medianE = $derived.by(() => {
    const s = [...res.groundEnergies].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)]! : NaN;
  });
  const frac = $derived(res.muonsMade ? res.muonsGround / res.muonsMade : 0);
  const fracNo = $derived(res.muonsMade ? res.expectedNoDilation / res.muonsMade : 0);
</script>

<Widget title="An air shower from a cosmic-ray proton" {n} {caption} kind="Simulation" live={false}>
  {#snippet controls()}
    <Segmented
      label="Primary energy"
      size="sm"
      bind:value={energy}
      options={[
        { value: 1e4, label: '10¹³ eV' },
        { value: 1e5, label: '10¹⁴ eV' },
        { value: 1e6, label: '10¹⁵ eV' },
        { value: 1e7, label: '10¹⁶ eV' },
      ]}
    />
    <Slider bind:value={zenith} min={0} max={75} step={1} label="Zenith angle θ" format={(v) => `${v.toFixed(0)}°`} />
    <Toggle bind:checked={dilation} label={dilation ? 'Time dilation: on (real muons)' : 'Time dilation: off (muon lifetime in the lab frame)'} />
    <Button size="sm" onclick={() => (seed = seed + 1)}>New shower (seed {seed + 1})</Button>
  {/snippet}
  <div class="p3-two views">
    <div>
      <h5 class="p3-h">The cascade (tracks sampled; vertical and lateral scales differ)</h5>
      <svg viewBox="0 0 {W} {Hh}" role="img" aria-label="Side view of the shower: altitude up to 32 kilometres against lateral distance from the axis. A proton enters at the top, pions spread out, and muons fall to the ground; those that reach it are drawn solid.">
        <rect x={ML} y={sy(maxH)} width={W - ML - 8} height={sy(0) - sy(maxH)} fill="var(--panel)" stroke="var(--line)" />
        {#each [0, 5, 10, 15, 20, 25, 30] as h}
          <line x1={ML} x2={W - 8} y1={sy(h)} y2={sy(h)} stroke="var(--grid)" />
          <text x={ML - 6} y={sy(h) + 4} text-anchor="end" class="p3-tag">{h}</text>
        {/each}
        <text x="12" y={MT + 10} class="p3-tag" transform="rotate(-90 12 {MT + 60})">height [km]</text>
        {#each Array.from({ length: Math.floor(latMax * 2) * 2 + 1 }, (_, i) => -latMax + i / 2) as l}
          <text x={sx(l)} y={Hh - 8} text-anchor="middle" class="p3-tag">{l}</text>
        {/each}
        <text x={W - 10} y={Hh - 8} text-anchor="end" class="p3-tag">km from the axis</text>
        <rect x={ML} y={sy(0)} width={W - ML - 8} height="3" fill="var(--ink-3)" />
        {#each res.tracks.filter((t) => t.kind === 'pion') as t}
          <path d={line(t.pts)} stroke="var(--p-hadron)" stroke-width="0.8" fill="none" opacity="0.55" />
        {/each}
        {#each res.tracks.filter((t) => t.kind === 'muon' && !t.reached) as t}
          <path d={line(t.pts)} stroke="var(--p-muon)" stroke-width="0.8" stroke-dasharray="3 3" fill="none" opacity="0.5" />
        {/each}
        {#each res.tracks.filter((t) => t.kind === 'muon' && t.reached) as t}
          <path d={line(t.pts)} stroke="var(--p-muon)" stroke-width="1.3" fill="none" />
        {/each}
        {#each res.tracks.filter((t) => t.kind === 'proton') as t}
          <path d={line(t.pts)} stroke="var(--ink)" stroke-width="2.4" fill="none" />
        {/each}
      </svg>
      <ul class="p3-note ui legend">
        <li><span style="color: var(--ink)">━</span> primary proton</li>
        <li><span style="color: var(--p-hadron)">─</span> charged pions</li>
        <li><span style="color: var(--p-muon)">━</span> muon that reaches the ground</li>
        <li><span style="color: var(--p-muon)">┄</span> muon that decays or stops first</li>
      </ul>
    </div>
    <div>
      <h5 class="p3-h">Where the muons were born, and how many arrive</h5>
      <svg viewBox="0 0 320 260" role="img" aria-label="Histogram of the height at which muons are born, with the number that reach the ground in this run and the number expected without time dilation.">
        {#each hist.born as b, i}
          {@const bw = 280 / bins}
          {@const x = 36 + i * bw}
          {@const y0 = 226}
          {@const sc = 200 / hist.max}
          <rect {x} y={y0 - b * sc} width={bw - 1} height={b * sc} fill="var(--line-strong)" />
          <rect {x} y={y0 - hist.reached[i]! * sc} width={bw - 1} height={hist.reached[i]! * sc} fill="var(--p-muon)" />
          <rect x={x + 1} y={y0 - hist.noDil[i]! * sc - 1.5} width={bw - 3} height="3" fill="var(--series-3)" />
        {/each}
        {#each [0, 8, 16, 24, 32] as h}
          <text x={36 + (h / maxH) * 280} y="244" text-anchor="middle" class="p3-tag">{h}</text>
        {/each}
        <text x="176" y="258" text-anchor="middle" class="p3-tag">height of birth [km]</text>
        <text x="36" y="14" class="p3-tag">muons per 2 km bin (max {fmtN(hist.max)})</text>
        <rect x="190" y="6" width="9" height="9" fill="var(--line-strong)" /><text x="202" y="14" class="p3-tag">born</text>
        <rect x="236" y="6" width="9" height="9" fill="var(--p-muon)" /><text x="248" y="14" class="p3-tag">arrive</text>
        <rect x="190" y="20" width="9" height="3" fill="var(--series-3)" /><text x="202" y="26" class="p3-tag">expected with no dilation</text>
      </svg>
    </div>
  </div>
  <dl class="p3-out ui" aria-live="polite" aria-busy={busy}>
    <div><dt>primary · first interaction</dt><dd>{fmtE(cfg.energy)} · {Number.isFinite(res.firstHeightKm) ? res.firstHeightKm.toFixed(1) + ' km' : 'none'}</dd></div>
    <div><dt>charged pions · muons made</dt><dd>{fmtN(res.pions)} · {fmtN(res.muonsMade)}</dd></div>
    <div><dt>muons at the ground (this run)</dt><dd>{fmtN(res.muonsGround)} ({(100 * frac).toFixed(0)} %) {cfg.dilation ? 'with' : 'without'} dilation</dd></div>
    <div><dt>expected without dilation</dt><dd>{fmtN(res.expectedNoDilation)} ({(100 * fracNo).toFixed(1)} %)</dd></div>
    <div><dt>median muon energy at the ground</dt><dd>{Number.isFinite(medianE) ? medianE.toFixed(1) + ' GeV' : '—'}</dd></div>
    <div><dt>energy in neutral pions (not followed)</dt><dd>{((100 * res.emEnergy) / cfg.energy).toFixed(0)} % of the primary</dd></div>
  </dl>
  <p class="p3-note ui">
    A toy, not a substitute for the production simulations (CORSIKA and its relatives): isothermal atmosphere, one multiplicity law, no kaons, no electromagnetic cascade, straight tracks, and pions' decays in flight against interactions as the only competition. The counts are the toy's, and its absolute
    muon number is an upper-end estimate. What it does show correctly is the structure: most muons are born several kilometres up, live 2.2 µs at rest, and reach the ground only because their clocks run slow.
    Turning the dilation off changes the muons' flight and nothing else.
  </p>
</Widget>

<style>
  svg { width: 100%; height: auto; display: block; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; list-style: none; padding: 0; margin: 0.3rem 0 0; }
</style>
