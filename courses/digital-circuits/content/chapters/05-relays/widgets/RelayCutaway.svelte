<!--
  A relay in cross-section, driven by a live coil current.

  Turn the coil voltage up and down (or switch it on and off) and watch, in slow motion: the current build
  up through the coil's inductance, the flux through the core, the armature pulled onto the core against
  its spring, the COM contact leaving NC and reaching NO, and the strip chart of the coil current against
  the pull-in and drop-out thresholds. The numbers come from the analog engine (cutaway-circuit.ts); the
  armature is drawn by armature.ts, which follows the engine's energised flag over the operate time.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { formatSI } from '$lib/bench/format';
  import type { Engine } from '$lib/sim/engine';
  import { Armature } from './armature';
  import { COIL_RESISTANCE, DROP_OUT_CURRENT, OPERATE_TIME, PULL_IN_CURRENT, RATED_CURRENT, cutawayNetlist } from './cutaway-circuit';

  let { n, title = 'Inside a relay' }: { n?: string | number; title?: string } = $props();

  let volts = $state(0);
  let speed = $state<'0.1' | '0.01' | '0.001'>('0.01');
  let playing = $state(false);
  let engine: Engine | null = $state(null);
  let root: HTMLDivElement | undefined = $state();

  const arm = new Armature();
  let position = $state(0);
  let mA = $state(0);
  let energised = $state(false);
  let noLit = $state(0);
  let ncLit = $state(1);
  let noClosed = $state(false);
  let ncClosed = $state(true);
  let simTime = $state(0);
  let samples: { t: number; i: number; no: boolean; nc: boolean }[] = $state.raw([]);

  const sp = $derived(Number(speed));
  const WINDOW_REAL = 6;
  const span = $derived(WINDOW_REAL * sp);

  function read(e: Engine) {
    const k = e.state('K1');
    energised = !!k.energised;
    mA = Math.abs(Number(k.coilCurrent ?? 0)) * 1000;
    noClosed = !!k.closed;
    ncClosed = !!k.nc;
    noLit = Number(e.state('D1').brightness ?? 0);
    ncLit = Number(e.state('D2').brightness ?? 0);
  }

  function start() {
    const e = cutawayNetlist();
    return createEngine('analog', e).then((eng) => {
      eng.setParam('S', 'voltage', volts);
      eng.settle();
      arm.reset();
      position = 0;
      samples = [];
      engine = eng;
      read(eng);
    });
  }

  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    playing = !reduced;
    void start();
    let raf = 0;
    let last = 0;
    let visible = false;
    const loop = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      tick(playing ? dt : 0);
      raf = requestAnimationFrame(loop);
    };
    const go = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) go();
    });
    if (root) io.observe(root);
    const vis = () => !document.hidden && visible && go();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  function tick(dtReal: number) {
    const e = engine;
    if (!e) return;
    if (dtReal > 0) {
      const dt = dtReal * sp;
      // Small sub-steps, so the armature and the engine's contacts stay in step at high speeds.
      const parts = Math.max(1, Math.ceil(dt / (OPERATE_TIME / 20)));
      for (let k = 0; k < parts; k++) {
        e.advance(dt / parts);
        arm.update(dt / parts, !!e.state('K1').energised, OPERATE_TIME);
        read(e);
        const last = samples[samples.length - 1];
        if (!last || e.time - last.t >= span / 500) {
          const keep = samples.length > 700 ? samples.filter((s) => s.t > e.time - span * 1.2) : samples.slice();
          keep.push({ t: e.time, i: mA, no: noClosed, nc: ncClosed });
          samples = keep;
        }
      }
    }
    position = arm.position;
    simTime = e.time;
  }

  function setVolts(v: number) {
    volts = v;
    engine?.setParam('S', 'voltage', v);
  }

  // ── Geometry of the picture ──────────────────────────────────────────────────
  const H = { x: 325, y: 95 };
  const REST_DEG = 5;
  const theta = $derived(REST_DEG * (1 - position));
  const rot = (lx: number, ly: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [H.x + lx * Math.cos(a) - ly * Math.sin(a), H.y + lx * Math.sin(a) + ly * Math.cos(a)];
  };
  const springTop = { x: 200, y: 42 };
  const springEnd = $derived(rot(-125, -9, theta));
  const springPath = $derived.by(() => {
    const [x1, y1] = springEnd;
    const { x: x0, y: y0 } = springTop;
    const N = 9;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    let d = `M${x0} ${y0}L${(x0 + dx * 0.08).toFixed(1)} ${(y0 + dy * 0.08).toFixed(1)}`;
    for (let k = 1; k <= N; k++) {
      const t = 0.08 + (0.84 * (k - 0.5)) / N;
      const s = k % 2 ? 1 : -1;
      d += `L${(x0 + dx * t + nx * 6 * s).toFixed(1)} ${(y0 + dy * t + ny * 6 * s).toFixed(1)}`;
    }
    d += `L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    return d;
  });

  /** How strongly the core is magnetised: follows the coil current, more efficiently when the gap is closed. */
  const level = $derived(Math.min(1, (mA / 1000 / RATED_CURRENT) * (0.55 + 0.45 * position)));
  const gapY = $derived(H.y - 192 * Math.sin((theta * Math.PI) / 180));
  const fluxPath = $derived(`M133 204L133 ${(gapY - 3).toFixed(1)}L325 90L325 204Z`);

  // ── Strip chart ───────────────────────────────────────────────────────────────
  const CW = 600;
  const CH = 156;
  const PX0 = 50;
  const PX1 = CW - 8;
  const IMAX = 100;
  const yOf = (i: number) => 10 + (1 - Math.min(i, IMAX) / IMAX) * 92;
  const t1 = $derived(Math.max(simTime, span));
  const t0 = $derived(t1 - span);
  const xOf = (t: number) => PX0 + ((t - t0) / span) * (PX1 - PX0);
  const currentPath = $derived.by(() => {
    let d = '';
    for (const s of samples) {
      if (s.t < t0 - span * 0.05) continue;
      d += `${d ? 'L' : 'M'}${xOf(s.t).toFixed(1)} ${yOf(s.i).toFixed(1)}`;
    }
    return d;
  });
  function bars(field: 'no' | 'nc'): { x: number; w: number }[] {
    const out: { x: number; w: number }[] = [];
    let start: number | undefined;
    for (const s of samples) {
      if (s.t < t0 - span * 0.05) continue;
      if (s[field] && start === undefined) start = s.t;
      if (!s[field] && start !== undefined) {
        out.push({ x: xOf(start), w: Math.max(1, xOf(s.t) - xOf(start)) });
        start = undefined;
      }
    }
    if (start !== undefined) out.push({ x: xOf(start), w: Math.max(1, xOf(t1) - xOf(start)) });
    return out;
  }
  const noBars = $derived(bars('no'));
  const ncBars = $derived(bars('nc'));

  const status = $derived(
    energised
      ? `Pulled in: COM is joined to NO. Coil current ${mA.toFixed(0)} mA.`
      : `Released: COM is joined to NC. Coil current ${mA.toFixed(0)} mA.`,
  );
</script>

{#snippet controls()}
  <Slider label="Coil voltage" bind:value={volts} min={0} max={6} step={0.1} format={(v) => `${v.toFixed(1)} V`} oninput={setVolts} />
  <Button onclick={() => setVolts(5)}>Switch on (5 V)</Button>
  <Button onclick={() => setVolts(0)}>Switch off</Button>
  <Button onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Run'}</Button>
  <Segmented
    size="sm"
    label="Speed"
    bind:value={speed}
    options={[
      { value: '0.1', label: '×0.1' },
      { value: '0.01', label: '×0.01' },
      { value: '0.001', label: '×0.001' },
    ]}
  />
{/snippet}

<Widget {title} {n} kind="Live cutaway" caption="Drag the coil voltage up slowly: nothing moves until the current reaches 50 mA (3.5 V), then the armature snaps in. Bring it down: it stays in until the current falls to 21 mA (1.5 V). Try the switch buttons at ×0.001 to watch the operate time." {controls} onreset={() => void start()} fullscreen>
  <div class="rc" bind:this={root}>
    <svg class="cut" viewBox="0 0 480 250" role="img" aria-label="Cross-section of a relay: a coil round an iron core, a hinged armature held off the core by a spring, and a changeover contact. {status}">
      <defs>
        <filter id="rc-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- base, yoke, post, core -->
      <rect x="30" y="228" width="380" height="8" rx="2" class="base" />
      <rect x="56" y="36" width="8" height="192" class="frame" />
      <rect x="56" y="36" width="232" height="6" class="frame" />
      <rect x="105" y="196" width="229" height="16" class="iron" />
      <rect x="316" y="95" width="18" height="117" class="iron" />
      <rect x="120" y="95" width="26" height="101" class="iron" />

      <!-- coil: wire cross-sections, current into the page on the left (×), out on the right (•) -->
      {#each [0, 1, 2, 3, 4, 5, 6, 7] as r (r)}
        {#each [0, 1, 2] as c (c)}
          <circle cx={99 + c * 7.5} cy={118 + r * 9} r="3.3" class="wire" />
          <circle cx={148.5 + c * 7.5} cy={118 + r * 9} r="3.3" class="wire" />
          <path d="M{97.5 + c * 7.5} {116.5 + r * 9}l3 3m0-3l-3 3" class="mark" />
          <circle cx={148.5 + c * 7.5} cy={118 + r * 9} r="1" class="dot" />
        {/each}
      {/each}
      <line x1="76" y1="110" x2="104" y2="110" class="lead" />
      <line x1="104" y1="110" x2="104" y2="115" class="lead" />
      <line x1="76" y1="190" x2="104" y2="190" class="lead" />
      <circle cx="76" cy="110" r="4" class="term" /><circle cx="76" cy="190" r="4" class="term" />
      <text x="70" y="126" class="lbl">A</text><text x="70" y="206" class="lbl">B</text>

      <!-- magnetic flux -->
      <path d={fluxPath} class="flux" style:opacity={0.1 + 0.9 * level} style:stroke-width={1 + 2.5 * level} class:flow={playing && level > 0.03} />

      <!-- spring -->
      <path d={springPath} class="spring" />
      <circle cx={springTop.x} cy={springTop.y + 3} r="2.5" class="pin" />

      <!-- contact pads -->
      <rect x="372" y="73" width="22" height="8.6" class="pad" />
      <rect x="372" y="104.5" width="22" height="8" class="pad" />
      <line x1="394" y1="77" x2="415" y2="77" class="lead" />
      <line x1="394" y1="108" x2="415" y2="108" class="lead" />
      <line x1="334" y1="146" x2="415" y2="146" class="lead" />

      <!-- armature -->
      <g transform="translate({H.x} {H.y}) rotate({theta})">
        <rect x="-255" y="-9" width="325" height="9" rx="1.5" class="armature" />
        <ellipse cx="58" cy="2" rx="3.4" ry="2.5" class="contact" />
        <ellipse cx="58" cy="-11" rx="3.4" ry="2.5" class="contact" />
        <circle cx="0" cy="-4.5" r="3" class="pin" />
      </g>

      <!-- terminals and their lamps -->
      {#each [{ y: 77, name: 'NO', lit: noLit, cls: 'green' }, { y: 108, name: 'NC', lit: ncLit, cls: 'red' }] as t (t.name)}
        <circle cx="419" cy={t.y} r="4" class="term" />
        <text x="419" y={t.y - 8} text-anchor="middle" class="lbl">{t.name}</text>
        <line x1="423" y1={t.y} x2="446" y2={t.y} class="lead" />
        <circle cx="456" cy={t.y} r="9" class="led {t.cls}" style:opacity={0.25 + 0.75 * Math.min(1, t.lit * 1.6)} filter={t.lit > 0.05 ? 'url(#rc-glow)' : undefined} />
      {/each}
      <circle cx="419" cy="146" r="4" class="term" />
      <text x="419" y="138" text-anchor="middle" class="lbl">COM</text>
      <text x="212" y="66" class="note">return spring</text>
      <text x="78" y="62" class="note">armature</text>
      <text x="240" y="224" text-anchor="middle" class="note">yoke</text>
      <text x="133" y="106" text-anchor="middle" class="note core">core</text>
      <text x="92" y="153" text-anchor="end" class="note">coil</text>
      <text x={H.x + 12} y="176" class="note">post</text>
    </svg>

    <dl class="stats ui" aria-live="polite">
      <div><dt>Coil</dt><dd>{volts.toFixed(1)} V</dd><dd class="sub">{COIL_RESISTANCE} Ω, rated 5 V</dd></div>
      <div><dt>Coil current</dt><dd>{mA.toFixed(0)} mA</dd><dd class="sub">pull-in {(PULL_IN_CURRENT * 1000).toFixed(0)} · drop-out {(DROP_OUT_CURRENT * 1000).toFixed(0)}</dd></div>
      <div class:in={energised}><dt>Armature</dt><dd>{energised ? 'pulled in' : 'released'}</dd><dd class="sub">{Math.round(position * 100)} % of its travel</dd></div>
      <div><dt>Time</dt><dd>{formatSI(simTime, 's', 3)}</dd><dd class="sub">operate time {(OPERATE_TIME * 1000).toFixed(0)} ms</dd></div>
    </dl>

    <svg class="chart" viewBox="0 0 {CW} {CH}" role="img" aria-label="Strip chart of the coil current against the pull-in and drop-out thresholds, with the times the NO and NC contacts are closed">
      <line x1={PX0} x2={PX1} y1={yOf(0)} y2={yOf(0)} class="axis" />
      <line x1={PX0} x2={PX1} y1={yOf(RATED_CURRENT * 1000)} y2={yOf(RATED_CURRENT * 1000)} class="axis faint" />
      <line x1={PX0} x2={PX1} y1={yOf(PULL_IN_CURRENT * 1000)} y2={yOf(PULL_IN_CURRENT * 1000)} class="thr pull" />
      <line x1={PX0} x2={PX1} y1={yOf(DROP_OUT_CURRENT * 1000)} y2={yOf(DROP_OUT_CURRENT * 1000)} class="thr drop" />
      <text x="4" y={yOf(0) - 2}>0</text>
      <text x="4" y={yOf(RATED_CURRENT * 1000) + 3}>71 mA</text>
      <text x={PX1} y={yOf(PULL_IN_CURRENT * 1000) - 3} text-anchor="end" class="pull">pull-in 50 mA</text>
      <text x={PX1} y={yOf(DROP_OUT_CURRENT * 1000) + 11} text-anchor="end" class="drop">drop-out 21 mA</text>
      <path d={currentPath} class="trace" />
      <text x="4" y="120" class="rowlbl">NO</text>
      <text x="4" y="140" class="rowlbl">NC</text>
      <line x1={PX0} x2={PX1} y1="122" y2="122" class="axis faint" />
      <line x1={PX0} x2={PX1} y1="142" y2="142" class="axis faint" />
      {#each noBars as b, i (i)}<rect x={b.x} y="110" width={b.w} height="12" class="bar no" />{/each}
      {#each ncBars as b, i (i)}<rect x={b.x} y="130" width={b.w} height="12" class="bar nc" />{/each}
      <text x={PX1} y={CH - 2} text-anchor="end" class="tlabel">{formatSI(span, 's', 2)} across</text>
    </svg>
    <p class="sr-only" role="status">{status}</p>
  </div>
</Widget>

<style>
  .rc {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
  }
  .cut {
    width: 100%;
    max-width: 640px;
    height: auto;
    margin: 0 auto;
    display: block;
    font-family: var(--font-mono);
  }
  .base {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .frame {
    fill: var(--surface-3);
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .iron {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .armature {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .wire {
    fill: var(--copper);
    opacity: 0.85;
  }
  .mark {
    stroke: var(--bg);
    stroke-width: 1.1;
    fill: none;
  }
  .dot {
    fill: var(--bg);
  }
  .lead {
    stroke: var(--wire);
    stroke-width: 2;
    fill: none;
  }
  .term {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .pad {
    fill: var(--silicon-metal);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .contact {
    fill: var(--silicon-metal);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .pin {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .spring {
    fill: none;
    stroke: var(--copper-ink);
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
  .flux {
    fill: none;
    stroke: var(--sig-current);
    stroke-linejoin: round;
    stroke-dasharray: 6 8;
    stroke-linecap: round;
  }
  .flux.flow {
    animation: flow 0.8s linear infinite;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -30;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flux.flow {
      animation: none;
    }
  }
  .led {
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .led.green {
    fill: var(--phosphor);
  }
  .led.red {
    fill: var(--sig-x);
  }
  .lbl {
    font-size: 11px;
    font-weight: 600;
    fill: var(--fg);
  }
  .note {
    font-size: 10px;
    fill: var(--mute);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .stats > div {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    background: var(--pn);
  }
  .stats > div.in {
    border-color: var(--phosphor);
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.02rem;
    font-weight: 600;
    color: var(--fg);
  }
  dd.sub {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--mute);
  }
  .chart {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
    font-size: 10.5px;
  }
  .chart text {
    fill: var(--mute);
  }
  .chart text.pull {
    fill: var(--sig-high);
  }
  .chart text.drop {
    fill: var(--sig-x);
  }
  .rowlbl {
    font-weight: 600;
  }
  .note.core {
    fill: var(--fg);
  }
  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .axis.faint {
    stroke: var(--line);
    stroke-dasharray: 3 4;
  }
  .thr {
    stroke-width: 1.4;
    stroke-dasharray: 6 4;
  }
  .thr.pull {
    stroke: var(--sig-high);
  }
  .thr.drop {
    stroke: var(--sig-x);
  }
  .trace {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 2.2;
    stroke-linejoin: round;
  }
  .bar.no {
    fill: var(--phosphor);
    opacity: 0.85;
  }
  .bar.nc {
    fill: var(--sig-x);
    opacity: 0.7;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
