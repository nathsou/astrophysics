<!--
  Tracking under growing pile-up: a tracker of your own settings against the reference, with efficiency and fake-rate curves that
  fill in live as events are simulated (hep/detector `simulate`) and reconstructed (hep/reco `findTracks`).

    ::pileup-tracking{n="8.6" caption="…"}

  The signal is six charged pions; the pile-up is `pu` minimum-bias collisions of about 25 charged particles each, spread along the beam.
  Efficiency = signal pions with pT > 1 GeV and |η| < 2.3 that a track was matched to (at least half of the track's hits from that
  particle). Fake rate = tracks for which no particle supplies half the hits. "Use my code" swaps in the reader's circleFit, houghTransform
  and kalmanUpdate (whichever the reader has written).
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { DEFAULT_QUALITY, PILEUP_POINTS, REFERENCE, aggregate, eventSeed, reconstructCrossing, simulateCrossing, configFor, type EventResult, type FinderSettings, type PointResult, type Quality } from './pileup.ts';
  import { savedFor, useMine } from './mine.ts';

  let { n: figNo, caption, title = 'Tracking under growing pile-up' }: { n?: string | number; caption?: string; title?: string } = $props();

  const HOOKS = ['reco.circleFit', 'reco.houghTransform', 'reco.kalmanUpdate'];
  let seeding = $state<'triplets' | 'hough'>('triplets');
  let minHits = $state(0);
  let road = $state(4);
  let logChi = $state(Math.log10(4));
  let noise = $state(DEFAULT_QUALITY.noise);
  let deadPct = $state(DEFAULT_QUALITY.dead * 100);
  let perPoint = $state(5);
  let picPu = $state(50);
  let mineSaved = $state<string[]>([]);
  let useMineOn = $state(false);
  let mineNote = $state('');
  let mineVersion = $state(0);

  const settings = $derived<FinderSettings>({ seeding, minHits: Math.round(minHits), roadSigmas: road, maxChi2: 10 ** logChi });
  const quality = $derived<Quality>({ noise: Math.round(noise), dead: deadPct / 100 });

  onMount(() => {
    mineSaved = savedFor(HOOKS);
    return () => useMine(HOOKS, false);
  });
  function toggleMine(on: boolean) {
    const r = useMine(HOOKS, on);
    const errs = Object.entries(r.errors);
    mineNote = errs.length ? `Could not load: ${errs.map(([k, v]) => `${k} (${v})`).join('; ')}.` : on ? `Running with your ${r.active.map((h) => h.split('.')[1]).join(', ')}.` : '';
    mineVersion++;
  }

  // ── the scans ──
  let ref = $state<PointResult[]>([]);
  let mine = $state<PointResult[]>([]);
  let progress = $state(0);
  let running = $state(false);
  let token = 0;

  let refKey = '';
  const tick0 = () => new Promise((r) => setTimeout(r, 0));

  /** The reference curve: always the library's code, so the reader's hooks are taken out while it runs. */
  async function scanRef(q: Quality, n: number, my: number): Promise<boolean> {
    const restore = useMineOn;
    if (restore) useMine(HOOKS, false);
    ref = [];
    const out: PointResult[] = [];
    let ok = true;
    for (const pu of PILEUP_POINTS) {
      const ev: EventResult[] = [];
      for (let i = 0; i < n; i++) {
        ev.push(reconstructCrossing(simulateCrossing(pu, eventSeed(1, pu, i), q), REFERENCE));
        await tick0();
        if (my !== token) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      out.push(aggregate(pu, ev));
      ref = [...out];
    }
    if (restore) useMine(HOOKS, true);
    if (ok) refKey = JSON.stringify([q, n]);
    return ok;
  }

  async function scan() {
    const my = ++token;
    const s = settings, q = quality, n = Math.round(perPoint);
    void mineVersion;
    running = true;
    progress = 0;
    mine = [];
    if (refKey !== JSON.stringify([q, n])) {
      progress = 0;
      if (!(await scanRef(q, n, my))) return;
    }
    const out: PointResult[] = [];
    let done = 0;
    const total = PILEUP_POINTS.length * n;
    for (const pu of PILEUP_POINTS) {
      const ev: EventResult[] = [];
      for (let i = 0; i < n; i++) {
        ev.push(reconstructCrossing(simulateCrossing(pu, eventSeed(1, pu, i), q), s));
        done++;
        progress = done / total;
        await tick0();
        if (my !== token) return;
      }
      out.push(aggregate(pu, ev));
      mine = [...out];
    }
    running = false;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void settings.seeding, settings.minHits, settings.roadSigmas, settings.maxChi2, quality.noise, quality.dead, perPoint, mineVersion;
    clearTimeout(timer);
    timer = setTimeout(() => void scan(), 350);
    return () => clearTimeout(timer);
  });

  // ── the picture ──
  let canvas: HTMLCanvasElement | undefined = $state();
  let picResult = $state.raw<EventResult | null>(null);
  let picError = $state('');
  $effect(() => {
    void settings.seeding, settings.minHits, settings.roadSigmas, settings.maxChi2, quality.noise, quality.dead, picPu, mineVersion;
    const s = settings, q = quality, pu = picPu;
    const id = setTimeout(() => {
      try {
        const x = simulateCrossing(pu, eventSeed(7, pu, 0), q);
        picResult = reconstructCrossing(x, s, true);
        picError = '';
        void tick().then(draw);
      } catch (e) {
        picError = e instanceof Error ? e.message : String(e);
      }
    }, 200);
    return () => clearTimeout(id);
  });

  function cssVar(name: string): string {
    const v = canvas ? getComputedStyle(canvas).getPropertyValue(name).trim() : '';
    return v || '#888';
  }
  function draw() {
    const r = picResult;
    if (!canvas || !r) return;
    const cfg = configFor(quality);
    const size = canvas.clientWidth || 360;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const R = 1150;
    const k = (size / 2 - 4) / R;
    const cx = size / 2, cy = size / 2;
    ctx.strokeStyle = cssVar('--line-strong');
    ctx.lineWidth = 0.7;
    for (const l of cfg.trackerLayers) {
      ctx.beginPath();
      ctx.arc(cx, cy, l.r * k, 0, 2 * Math.PI);
      ctx.stroke();
    }
    const colHit = cssVar('--p-hit');
    ctx.fillStyle = colHit;
    ctx.globalAlpha = r.hits.length > 4000 ? 0.45 : 0.75;
    for (const h of r.hits) {
      if (h.kind === 'signal') continue;
      ctx.fillRect(cx + h.x * k - 0.7, cy - h.y * k - 0.7, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    const stroke = (ids: number[], col: string, w: number) => {
      const pts = ids.map((i) => r.hits[i]!).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const p of pts) ctx.lineTo(cx + p.x * k, cy - p.y * k);
      ctx.stroke();
    };
    const colOk = cssVar('--series-3'), colBad = cssVar('--bad'), colSig = cssVar('--sig-high');
    for (const t of r.tracks) if (!t.fake && !t.signal) stroke(t.hits, cssVar('--mute'), 0.6);
    for (const t of r.tracks) if (t.fake) stroke(t.hits, colBad, 0.9);
    for (const t of r.tracks) if (t.signal) stroke(t.hits, colOk, 2);
    ctx.fillStyle = colSig;
    for (const h of r.hits) if (h.kind === 'signal') ctx.fillRect(cx + h.x * k - 1.6, cy - h.y * k - 1.6, 3.2, 3.2);
    ctx.strokeStyle = colBad;
    ctx.lineWidth = 1.5;
    for (const ids of r.missed) for (const i of ids) {
      const h = r.hits[i]!;
      ctx.beginPath();
      ctx.arc(cx + h.x * k, cy - h.y * k, 5, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  $effect(() => {
    void picResult;
    if (canvas) draw();
  });

  const xs = PILEUP_POINTS;
  const series = (a: PointResult[], f: (p: PointResult) => number) => ({ x: a.map((p) => p.pu), y: a.map(f) });
  const effPts = $derived(mine.map((p) => ({ x: p.pu, y: p.efficiency.value, yerr: (p.efficiency.high - p.efficiency.low) / 2, color: 'var(--series-2)' })));
  const fakePts = $derived(mine.map((p) => ({ x: p.pu, y: p.fakeRate.value, yerr: (p.fakeRate.high - p.fakeRate.low) / 2, color: 'var(--series-2)' })));
  const last = $derived(mine.at(-1));
  void xs;
</script>

<Widget {title} n={figNo} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Seeding"
      options={[
        { value: 'triplets', label: 'pixel triplets' },
        { value: 'hough', label: 'Hough transform' },
      ]}
      bind:value={seeding}
    />
    <Slider bind:value={minHits} min={0} max={8} step={1} label="Hits required (0 = automatic)" format={(v) => (v === 0 ? 'auto' : v.toFixed(0))} />
    <Slider bind:value={road} min={2} max={12} step={0.5} label="Road width [σ]" format={(v) => v.toFixed(1)} />
    <Slider bind:value={logChi} min={0.3} max={2} step={0.05} label="Largest χ²/ndof" format={(v) => (10 ** v).toFixed(0)} />
    <Slider bind:value={noise} min={0} max={300} step={10} label="Noise hits per layer" format={(v) => v.toFixed(0)} />
    <Slider bind:value={deadPct} min={0} max={10} step={0.5} label="Dead channels [%]" format={(v) => v.toFixed(1)} />
    <Slider bind:value={perPoint} min={3} max={12} step={1} label="Events per point" format={(v) => v.toFixed(0)} />
    {#if mineSaved.length}<Toggle bind:checked={useMineOn} label="use my code" onchange={toggleMine} />{/if}
  {/snippet}

  <div class="charts">
    <div>
      <h5 class="ui">Efficiency for the signal pions</h5>
      <LinePlot
        lines={[
          { x: ref.map((p) => p.pu), y: ref.map((p) => p.efficiency.value), label: 'reference', dash: '6 3', color: 'var(--series-1)' },
          { x: mine.map((p) => p.pu), y: mine.map((p) => p.efficiency.value), label: 'yours', dash: '', color: 'var(--series-2)' },
        ]}
        points={effPts}
        x={{ domain: [0, 200], label: 'pile-up collisions per crossing' }}
        y={{ domain: [0, 1.05], label: 'efficiency', format: (v) => v.toFixed(1) }}
        height={210}
        label="Tracking efficiency for the signal pions against the number of pile-up collisions, reference and your settings"
      />
    </div>
    <div>
      <h5 class="ui">Fake rate</h5>
      <LinePlot
        lines={[
          { x: ref.map((p) => p.pu), y: ref.map((p) => p.fakeRate.value), label: 'reference', dash: '6 3', color: 'var(--series-1)' },
          { x: mine.map((p) => p.pu), y: mine.map((p) => p.fakeRate.value), label: 'yours', dash: '', color: 'var(--series-2)' },
        ]}
        points={fakePts}
        x={{ domain: [0, 200], label: 'pile-up collisions per crossing' }}
        y={{ domain: [0, 1], label: 'fraction of tracks that are fake', format: (v) => v.toFixed(1) }}
        height={210}
        label="Fake rate against the number of pile-up collisions, reference and your settings"
      />
    </div>
    <div>
      <h5 class="ui">The cost: seeds tried per event</h5>
      <LinePlot
        lines={[{ x: mine.map((p) => p.pu), y: mine.map((p) => Math.max(1, p.seedsPerEvent)), label: 'seeds', dash: '' }]}
        x={{ domain: [0, 200], label: 'pile-up collisions per crossing' }}
        y={{ type: 'log', domain: [1, 1e5], label: 'seeds per event' }}
        height={210}
        legend={false}
        label="Number of seeds tried per event against the number of pile-up collisions on a logarithmic scale"
      />
    </div>
  </div>
  <div class="status ui" aria-live="polite">
    <div class="prog" role="progressbar" aria-valuenow={Math.round(100 * progress)} aria-valuemin="0" aria-valuemax="100"><div style:width="{100 * progress}%"></div></div>
    <span>{running ? `Simulating and reconstructing… ${(100 * progress).toFixed(0)} %` : 'Done.'}</span>
    {#if last}<span class="sum">At {last.pu} pile-up collisions: {(100 * last.efficiency.value).toFixed(0)} % efficient, {(100 * last.fakeRate.value).toFixed(1)} % fakes, {last.tracksPerEvent.toFixed(0)} tracks and {last.msPerEvent.toFixed(0)} ms per event.</span>{/if}
  </div>
  {#if mineNote}<p class="ui small">{mineNote}</p>{/if}

  <h5 class="ui">One crossing, seen along the beam</h5>
  <Slider bind:value={picPu} min={0} max={200} step={5} label="Pile-up collisions in this picture" format={(v) => v.toFixed(0)} />
  <div class="pic">
    <canvas bind:this={canvas} aria-label="The transverse view of one simulated bunch crossing with the tracks found by your settings" role="img"></canvas>
    <div class="keys ui">
      <p><span class="k" style="background: var(--sig-high)"></span> hits of the six signal pions</p>
      <p><span class="k line" style="border-color: var(--series-3)"></span> track matched to a signal pion</p>
      <p><span class="k line" style="border-color: var(--mute)"></span> track matched to a pile-up particle</p>
      <p><span class="k line" style="border-color: var(--bad)"></span> fake track</p>
      <p><span class="k ring" style="border-color: var(--bad)"></span> hit of a signal pion that was missed</p>
      <p><span class="k" style="background: var(--p-hit)"></span> all other hits</p>
      {#if picResult}
        <p class="sum">{picResult.nHits.toLocaleString('en-GB')} hits, {picResult.nTracks} tracks ({picResult.nFakes} fake), {picResult.nFound} of {picResult.nSignal} signal pions found, {picResult.nSeeds.toLocaleString('en-GB')} seeds, {picResult.ms.toFixed(0)} ms.</p>
      {/if}
      {#if picError}<p class="sum">{picError}</p>{/if}
    </div>
  </div>
</Widget>

<style>
  .charts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 900px) {
    .charts {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0.4rem 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 1rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-top: 0.4rem;
  }
  .prog {
    width: 8rem;
    height: 6px;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .prog div {
    height: 100%;
    background: var(--track);
    transition: width 120ms;
  }
  .sum {
    color: var(--fg);
  }
  .small {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .pic {
    display: grid;
    grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
    gap: 1.2rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .pic {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  canvas {
    width: 100%;
    aspect-ratio: 1;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .keys p {
    margin: 0.15rem 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .k {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.45rem;
    vertical-align: middle;
    border-radius: 1px;
  }
  .k.line {
    height: 0;
    width: 1.2rem;
    border-top: 3px solid;
    background: none !important;
  }
  .k.ring {
    border: 2px solid;
    border-radius: 50%;
    background: none;
  }
</style>
