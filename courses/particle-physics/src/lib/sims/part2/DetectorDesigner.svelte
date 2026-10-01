<!--
  The detector designer: set the field, the tracker radius, the number of strip layers, the calorimeter depths and the ECAL technology
  within a budget, then see what the detector measures. Every number on the right comes from `simulate` (hep/detector) on particles fired
  into the design you built; the cost model is a toy (see designer.ts).

    ::detector-designer{n="7.5" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import EventDisplay from '$lib/display/EventDisplay.svelte';
  import { geometryFromDetectorConfig } from '$lib/display/geometry.ts';
  import { ecalOuterRadius, hcalOuterRadius } from '../../hep/detector/index.ts';
  import { BUDGET, DEFAULT_DESIGN, LIMITS, buildConfig, cost, type DesignParams, type Measurements } from './designer.ts';
  import { savedFor } from './mine.ts';
  import { loadMine } from '../../code/mine.ts';
  import type { DesignerRequest, DesignerResponse } from './designer.worker.ts';
  import type { FullEvent } from '../../hep/event/index.ts';

  let { n: figNo, caption, title = 'Detector designer' }: { n?: string | number; caption?: string; title?: string } = $props();

  let B = $state(DEFAULT_DESIGN.B);
  let R = $state(DEFAULT_DESIGN.trackerRadius);
  let strips = $state(DEFAULT_DESIGN.stripLayers);
  let ecalType = $state<'crystal' | 'sampling'>(DEFAULT_DESIGN.ecalType);
  let ecalDepth = $state(DEFAULT_DESIGN.ecalDepth);
  let hcalDepth = $state(DEFAULT_DESIGN.hcalDepth);
  let gunPdg = $state(13);
  let gunPt = $state(40);
  let shot = $state(1);
  let useMineOn = $state(false);
  let mineAvailable = $state(false);

  const design = $derived<DesignParams>({ B, trackerRadius: R, stripLayers: Math.round(strips), ecalDepth, ecalType, hcalDepth });
  const cfg = $derived(buildConfig(design));
  const c = $derived(cost(design));
  const over = $derived(c.total > BUDGET);

  let meas = $state<Measurements | null>(null);
  let ev = $state.raw<FullEvent | null>(null);
  let busy = $state(true);
  let note = $state('');

  let worker: Worker | undefined;
  let jobId = 0;
  function startWorker() {
    worker?.terminate();
    worker = new Worker(new URL('./designer.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<DesignerResponse>) => {
      const r = e.data;
      if (r.id !== jobId) return;
      busy = false;
      if ('error' in r) {
        note = `The simulation stopped: ${r.error}`;
        return;
      }
      meas = r.meas;
      ev = r.event;
      const errs = Object.entries(r.errors);
      note = errs.length ? `Could not load your code (${errs.map(([, v]) => v).join('; ')}); the library's circle fit is used.` : '';
    };
  }

  onMount(() => {
    mineAvailable = savedFor(['reco.circleFit']).length > 0;
    startWorker();
    return () => worker?.terminate();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  function recompute() {
    busy = true;
    clearTimeout(timer);
    const d = { ...design };
    const gun = { pdg: gunPdg, pt: gunPt, eta: 0.4, phi: 0.8, seed: shot };
    const mine: Record<string, string> = {};
    if (useMineOn) {
      const m = loadMine()['reco.circleFit'];
      if (m) mine['reco.circleFit'] = m.code;
    }
    timer = setTimeout(() => {
      if (!worker) return;
      // a new request replaces the one in progress: restart the worker so that the old simulation stops
      startWorker();
      worker!.postMessage({ id: ++jobId, design: d, gun, mine } satisfies DesignerRequest);
    }, 220);
  }
  $effect(() => {
    void design.B, design.trackerRadius, design.stripLayers, design.ecalDepth, design.ecalType, design.hcalDepth, gunPdg, gunPt, shot, useMineOn;
    recompute();
    return () => clearTimeout(timer);
  });

  const geo = $derived(geometryFromDetectorConfig(cfg, { ecalOuterRadius: ecalOuterRadius(cfg), hcalOuterRadius: hcalOuterRadius(cfg) }));

  // ── targets ──
  const targets = $derived(
    meas
      ? [
          { id: 'pt', label: 'Momentum resolution of 100 GeV muons', value: `${(100 * meas.ptRes100).toFixed(2)} %`, goal: '≤ 1.5 %', ok: meas.ptRes100 <= 0.015 },
          { id: 'pt10', label: 'Momentum resolution of 10 GeV muons', value: `${(100 * meas.ptRes10).toFixed(2)} %`, goal: 'for information', ok: null },
          { id: 'ecal', label: '50 GeV electron: energy in the ECAL', value: `${(100 * meas.eResponse).toFixed(0)} % of E`, goal: '≥ 95 %', ok: meas.eResponse >= 0.95 },
          { id: 'eres', label: '50 GeV electron: resolution', value: `${(100 * meas.eRes50).toFixed(2)} %`, goal: '≤ 1 %', ok: meas.eRes50 <= 0.01 },
          { id: 'had', label: '50 GeV pion: resolution', value: `${(100 * meas.hadRes50).toFixed(1)} %`, goal: '≤ 18 %', ok: meas.hadRes50 <= 0.18 },
          { id: 'leak', label: '100 GeV pion: energy that leaks out', value: `${(100 * meas.leakage100).toFixed(1)} %`, goal: '≤ 5 %', ok: meas.leakage100 <= 0.05 },
          { id: 'mu', label: '100 GeV muons seen in 3 or more stations', value: `${(100 * meas.muonEff100).toFixed(0)} %`, goal: '≥ 95 %', ok: meas.muonEff100 >= 0.95 },
          { id: 'minp', label: 'Lowest muon momentum that reaches the muon stations', value: `${meas.muonMinP.toFixed(1)} GeV`, goal: 'for information', ok: null },
        ]
      : [],
  );
  const allMet = $derived(targets.length > 0 && targets.every((t) => t.ok !== false) && !over);

  // ── the cross-section drawing: radii compressed with a power law so that the tracker is visible next to the muon system ──
  const rOut = $derived(cfg.muon.stations.at(-1)!.r);
  const SV = 300;
  const sr = (r: number) => (Math.pow(r / rOut, 0.55) * (SV / 2 - 6));
  const rings = $derived([
    ...cfg.trackerLayers.map((l) => ({ r: l.r, kind: 'tracker' })),
    { r: cfg.ecal.rIn, kind: 'ecal0' },
    { r: ecalOuterRadius(cfg), kind: 'ecal1' },
    { r: cfg.hcal.rIn, kind: 'hcal0' },
    { r: hcalOuterRadius(cfg), kind: 'hcal1' },
    ...cfg.muon.stations.map((s) => ({ r: s.r, kind: 'muon' })),
  ]);

  const PRESETS: { name: string; set: DesignParams }[] = [
    { name: 'Course detector', set: DEFAULT_DESIGN },
    { name: 'Cheap and cheerful', set: { B: 2, trackerRadius: 700, stripLayers: 3, ecalDepth: 20, ecalType: 'sampling', hcalDepth: 7 } },
    { name: 'Big field', set: { B: 4.5, trackerRadius: 1100, stripLayers: 4, ecalDepth: 25, ecalType: 'crystal', hcalDepth: 10 } },
  ];
  function apply(p: DesignParams) {
    B = p.B;
    R = p.trackerRadius;
    strips = p.stripLayers;
    ecalDepth = p.ecalDepth;
    ecalType = p.ecalType;
    hcalDepth = p.hcalDepth;
  }
  const PARTICLES = [
    { v: 13, l: 'muon' },
    { v: 11, l: 'electron' },
    { v: 211, l: 'pion' },
    { v: 22, l: 'photon' },
  ];
</script>

<Widget {title} n={figNo} {caption} kind="Design">
  {#snippet controls()}
    <Slider bind:value={B} min={LIMITS.B.min} max={LIMITS.B.max} step={LIMITS.B.step} label="Solenoid field B [T]" />
    <Slider bind:value={R} min={LIMITS.trackerRadius.min} max={LIMITS.trackerRadius.max} step={LIMITS.trackerRadius.step} label="Tracker outer radius [mm]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={strips} min={LIMITS.stripLayers.min} max={LIMITS.stripLayers.max} step={1} label="Strip layers (plus 3 pixel)" format={(v) => v.toFixed(0)} />
    <Slider bind:value={ecalDepth} min={LIMITS.ecalDepth.min} max={LIMITS.ecalDepth.max} step={1} label="ECAL depth [X₀]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={hcalDepth} min={LIMITS.hcalDepth.min} max={LIMITS.hcalDepth.max} step={0.5} label="HCAL depth [λ_I of iron]" format={(v) => v.toFixed(1)} />
    <Segmented
      label="ECAL technology"
      options={[
        { value: 'crystal', label: 'crystals (fine, dear)' },
        { value: 'sampling', label: 'sampling (coarser, cheap)' },
      ]}
      bind:value={ecalType}
    />
    {#each PRESETS as p}<Button size="sm" onclick={() => apply(p.set)}>{p.name}</Button>{/each}
    {#if mineAvailable}<Toggle bind:checked={useMineOn} label="use my code (circleFit)" />{/if}
  {/snippet}

  <div class="top">
    <div>
      <svg viewBox="0 0 {SV} {SV}" role="img" aria-label="Cross-section of the designed detector seen along the beam, with the radii compressed: tracker layers, electromagnetic calorimeter, hadron calorimeter and muon stations" class="cross">
        <g transform="translate({SV / 2},{SV / 2})">
          <circle r={sr(hcalOuterRadius(cfg))} fill="none" stroke="var(--series-8)" stroke-width="2" stroke-dasharray="6 3" opacity="0.8" />
          <circle r={sr(ecalOuterRadius(cfg))} fill="var(--p-calo-em)" fill-opacity="0.25" stroke="none" />
          <circle r={sr(cfg.ecal.rIn)} fill="var(--panel)" stroke="var(--p-calo-em)" />
          <circle r={sr(hcalOuterRadius(cfg))} fill="var(--p-calo-had)" fill-opacity="0.18" stroke="var(--p-calo-had)" />
          <circle r={sr(cfg.hcal.rIn)} fill="var(--panel)" stroke="var(--p-calo-had)" />
          <circle r={sr(ecalOuterRadius(cfg))} fill="var(--p-calo-em)" fill-opacity="0.35" stroke="var(--p-calo-em)" />
          <circle r={sr(cfg.ecal.rIn)} fill="var(--panel)" stroke="none" />
          {#each cfg.trackerLayers as l}
            <circle r={sr(l.r)} fill="none" stroke="var(--p-hit)" stroke-width={l.kind === 'pixel' ? 2 : 1.2} />
          {/each}
          {#each cfg.muon.stations as s}
            <circle r={sr(s.r)} fill="none" stroke="var(--p-muon)" stroke-width="1.6" stroke-dasharray="1 3" />
          {/each}
          <circle r="2" fill="var(--fg)" />
        </g>
      </svg>
      <ul class="legend ui">
        <li><span style="border-color: var(--p-hit)"></span>tracker</li>
        <li><span style="border-color: var(--p-calo-em)"></span>ECAL</li>
        <li><span style="border-color: var(--p-calo-had)"></span>HCAL</li>
        <li><span style="border-color: var(--series-8); border-top-style: dashed"></span>coil (field inside)</li>
        <li><span style="border-color: var(--p-muon); border-top-style: dotted"></span>muon stations</li>
      </ul>
      <p class="ui tiny">Radii compressed (r^0.55) so that the tracker shows: the outermost muon station is at {(rOut / 1000).toFixed(1)} m.</p>
    </div>
    <div>
      <h5 class="ui">Cost (toy units)</h5>
      <div class="cost ui" role="img" aria-label="Total cost {c.total.toFixed(0)} of a budget of {BUDGET}">
        <div class="stack">
          {#each [['tracker', c.tracker, 'var(--p-hit)'], ['magnet', c.magnet, 'var(--series-5)'], ['ECAL', c.ecal, 'var(--p-calo-em)'], ['HCAL', c.hcal, 'var(--p-calo-had)'], ['muon', c.muon, 'var(--p-muon)']] as [name, v, col]}
            <div class="seg" style:width="{Math.min(100, (Number(v) / Math.max(BUDGET, c.total)) * 100)}%" style:background={String(col)} title="{name}: {Number(v).toFixed(1)}"></div>
          {/each}
        </div>
        <div class="budget" style:left="{(BUDGET / Math.max(BUDGET, c.total)) * 100}%"><span>budget {BUDGET}</span></div>
      </div>
      <table class="ui small">
        <tbody>
          <tr><th>tracker</th><td>{c.tracker.toFixed(1)}</td><th>magnet ({c.storedEnergyGJ.toFixed(2)} GJ)</th><td>{c.magnet.toFixed(1)}</td></tr>
          <tr><th>ECAL</th><td>{c.ecal.toFixed(1)}</td><th>HCAL</th><td>{c.hcal.toFixed(1)}</td></tr>
          <tr><th>muon system</th><td>{c.muon.toFixed(1)}</td><th>total</th><td class:bad={over}><strong>{c.total.toFixed(1)}</strong> / {BUDGET}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h5 class="ui">What this detector measures {#if busy}<span class="busy">(measuring…)</span>{/if}</h5>
  <div class="table-wrap">
    <table class="ui res">
      <thead><tr><th>Quantity</th><th>Result</th><th>Goal</th><th></th></tr></thead>
      <tbody>
        {#each targets as t (t.id)}
          <tr class:dim={busy}>
            <td>{t.label}</td>
            <td class="num">{t.value}</td>
            <td>{t.goal}</td>
            <td class="mark" class:ok={t.ok === true} class:no={t.ok === false}>{t.ok === true ? '✓' : t.ok === false ? '✗' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="ui verdict" class:good={allMet} aria-live="polite">
    {#if over}Over budget by {(c.total - BUDGET).toFixed(1)} units.
    {:else if allMet}Every goal is met, within budget: {c.total.toFixed(1)} of {BUDGET}.
    {:else if meas}Within budget, but some goals are not met yet.{/if}
  </p>
  {#if note}<p class="ui tiny">{note}</p>{/if}
  <p class="ui tiny">Numbers from 200 simulated muons at each momentum, 100 electrons and 200 pions at each energy, with the muons fitted with the library's circle fit on the hits of each muon (so the pattern recognition is taken as perfect). They fluctuate by about 5–10 % from one design to the next: the simulation is seeded, so the same design always gives the same numbers.</p>

  <h5 class="ui">Fire one particle into it</h5>
  <div class="gun ui">
    <Segmented label="Particle" options={PARTICLES.map((p) => ({ value: p.v, label: p.l }))} bind:value={gunPdg} size="sm" />
    <Slider bind:value={gunPt} min={5} max={200} step={5} label="pT [GeV]" format={(v) => v.toFixed(0)} compact />
    <Button size="sm" onclick={() => (shot += 1)}>Again (shot {shot})</Button>
  </div>
  {#if ev}
    <EventDisplay event={ev} geometry={geo} views="rphi,rz" showTruth showReco showHits viewHeight={300} objectList={false} inspector={false} controls={false} />
  {/if}
</Widget>

<style>
  .top {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 1.2rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .top {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cross {
    width: 100%;
    max-width: 340px;
    display: block;
    margin: 0 auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  h5 {
    margin: 0.8rem 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    padding: 0;
    margin: 0.4rem 0 0;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 !important;
  }
  .legend span {
    display: inline-block;
    width: 1.1rem;
    border-top: 3px solid;
  }
  .tiny {
    font-size: 0.76rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
  .cost {
    position: relative;
    margin: 0.2rem 0 0.8rem;
  }
  .stack {
    display: flex;
    height: 1.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    overflow: hidden;
    background: var(--pn);
  }
  .seg {
    height: 100%;
    border-right: 1px solid var(--panel);
  }
  .budget {
    position: absolute;
    top: -4px;
    bottom: -4px;
    border-left: 2px solid var(--fg);
  }
  .budget span {
    position: absolute;
    right: 4px;
    bottom: -1.2rem;
    font-size: 0.7rem;
    white-space: nowrap;
    color: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.84rem;
  }
  th,
  td {
    padding: 0.2rem 0.5rem;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    border-bottom: 1px solid var(--line);
  }
  .small th {
    font-weight: 500;
    color: var(--ink-2);
  }
  td.bad {
    color: var(--bad);
  }
  .res thead th {
    font-size: 0.72rem;
    color: var(--mute);
    font-weight: 500;
  }
  .num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .dim {
    opacity: 0.55;
  }
  .mark {
    width: 1.5rem;
    text-align: center;
    font-weight: 700;
  }
  .mark.ok {
    color: var(--ok);
  }
  .mark.no {
    color: var(--bad);
  }
  .busy {
    text-transform: none;
    letter-spacing: 0;
    color: var(--mute);
  }
  .verdict {
    margin: 0.5rem 0;
    font-weight: 600;
    color: var(--ink-2);
  }
  .verdict.good {
    color: var(--ok);
  }
  .gun {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
    align-items: flex-end;
    margin-bottom: 0.6rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
</style>
