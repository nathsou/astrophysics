<!--
  The flagship of Chapter 5: a telegraph line, first without a repeater and then with one.

  A key at one end sends current down a long iron line (a resistance that grows with its length) to a
  lamp at the other end. Without a repeater the lamp fades as the line gets longer. With a relay at
  the far end the line only has to carry a few milliamps to the relay's coil; the relay's contacts
  switch a local battery onto the lamp, which is as bright at 300 km as at 20 km.

  Two circuits (../circuits/telegraph-*.json) run on the analog engine; this widget adds the line
  length, a Morse sender, readouts and a strip chart of the key against the light at the far end.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { flatten } from '$lib/sim/netlist/flatten';
  import { formatSI } from '$lib/bench/format';
  import type { Engine } from '$lib/sim/engine';
  import type { Circuit } from '$lib/sim/netlist/types';
  import bare from '../circuits/telegraph-bare.json';
  import repeater from '../circuits/telegraph-repeater.json';
  import { OHMS_PER_KM, lineResistance, morseSchedule, type KeyEvent } from './telegraph';

  let { n, title = 'Telegraph repeater', autoplay }: { n?: string | number; title?: string; autoplay?: boolean } = $props();

  type Mode = 'bare' | 'repeater';
  let mode = $state<Mode>('bare');
  let km = $state(80);
  let slow = $state<'1' | '0.1'>('1');
  let playing = $state(false);
  let engine: Engine | null = $state(null);
  let engineError = $state('');
  let schematic: Schematic | undefined = $state();
  let root: HTMLDivElement | undefined = $state();

  const circuit = $derived((mode === 'repeater' ? repeater : bare) as unknown as Circuit);
  const speed = $derived(Number(slow));
  const ohms = $derived(lineResistance(km));

  /** The 12 V line battery and the lamp: a lamp rated 12 V, 0.12 W draws 10 mA and glows fully. */
  const LAMP_RATED_MW = 120;
  const WINDOW = 4;

  // Live readouts, updated every frame.
  let lineMa = $state(0);
  let lampMw = $state(0);
  let lampBrightness = $state(0);
  let relayIn = $state(false);
  let keyDown = $state(false);
  let samples: { t: number; key: number; lamp: number }[] = $state.raw([]);
  let simTime = $state(0);

  // The message being sent.
  let sending = $state(false);
  let msg: { events: KeyEvent[]; idx: number; t0: number } | null = null;

  function applyLine(e: Engine, kmValue: number) {
    const half = Math.max(0.01, lineResistance(kmValue) / 2);
    e.setParam('R1', 'resistance', half);
    e.setParam('R2', 'resistance', half);
  }

  // A new engine whenever the circuit changes (bare / repeater).
  $effect(() => {
    const c = circuit;
    if (typeof window === 'undefined') return;
    let cancelled = false;
    engineError = '';
    engine = null;
    msg = null;
    sending = false;
    samples = [];
    createEngine(c.engine, flatten(c)).then(
      (e) => {
        if (cancelled) return;
        applyLine(e, km);
        e.settle();
        engine = e;
        simTime = e.time;
        read(e);
      },
      (err: unknown) => !cancelled && (engineError = String(err)),
    );
    return () => {
      cancelled = true;
    };
  });

  // Line length changed.
  $effect(() => {
    const k = km;
    const e = engine;
    if (!e) return;
    untrack(() => {
      applyLine(e, k);
      e.settle();
      schematic?.frame(0);
      read(e);
    });
  });

  function read(e: Engine) {
    lineMa = Math.abs(e.current('S1', 0)) * 1000;
    const l = e.state('L1');
    lampMw = Number(l.power ?? 0) * 1000;
    lampBrightness = Number(l.brightness ?? 0);
    keyDown = !!e.state('S1').closed;
    relayIn = mode === 'repeater' ? !!e.state('K1').energised : false;
  }

  /** Advance the engine by `dt` simulated seconds, pressing and releasing the key on schedule. */
  function advance(e: Engine, dt: number) {
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-12 && guard++ < 200) {
      const next = msg && msg.idx < msg.events.length ? msg.t0 + msg.events[msg.idx]!.t : Infinity;
      if (next <= e.time + 1e-12) {
        e.setParam('S1', 'pressed', msg!.events[msg!.idx]!.down);
        msg!.idx++;
        if (msg!.idx >= msg!.events.length) {
          msg = null;
          sending = false;
        }
        continue;
      }
      const step = Math.min(remaining, next - e.time);
      e.advance(step);
      remaining -= step;
    }
  }

  function sample(e: Engine) {
    const last = samples[samples.length - 1];
    if (last && e.time - last.t < WINDOW / 400) return;
    const keep = samples.filter((s) => s.t > e.time - WINDOW * 1.2);
    keep.push({ t: e.time, key: keyDown ? 1 : 0, lamp: lampBrightness });
    samples = keep;
  }

  function tick(dtReal: number) {
    const e = engine;
    if (!e) return;
    if (dtReal > 0) advance(e, dtReal * speed);
    schematic?.frame(dtReal);
    read(e);
    if (dtReal > 0) sample(e);
    simTime = e.time;
  }

  function sendSos() {
    const e = engine;
    if (!e || sending) return;
    const { events } = morseSchedule('SOS', 0.15);
    msg = { events, idx: 0, t0: e.time + 0.2 };
    sending = true;
    playing = true;
  }

  function reset() {
    const c = circuit;
    engine = null;
    msg = null;
    sending = false;
    samples = [];
    createEngine(c.engine, flatten(c)).then((e) => {
      applyLine(e, km);
      e.settle();
      engine = e;
      read(e);
    });
  }

  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    playing = autoplay ?? !reduced;
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
    const start = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
    });
    if (root) io.observe(root);
    const vis = () => !document.hidden && visible && start();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // Strip chart geometry.
  const CW = 600;
  const ROW = 34;
  function path(field: 'key' | 'lamp', row: number): string {
    const e = engine;
    if (!e || samples.length === 0) return '';
    const t1 = Math.max(e.time, WINDOW);
    const t0 = t1 - WINDOW;
    const X = (t: number) => 46 + ((t - t0) / WINDOW) * (CW - 52);
    const Y = (v: number) => row * (ROW + 14) + 6 + (1 - v) * ROW;
    let d = '';
    for (const s of samples) {
      if (s.t < t0 - 0.2) continue;
      d += `${d ? 'L' : 'M'}${X(s.t).toFixed(1)} ${Y(s[field]).toFixed(1)}`;
    }
    d += `L${X(e.time).toFixed(1)} ${Y(samples[samples.length - 1]![field]).toFixed(1)}`;
    return d;
  }
  const keyPath = $derived(path('key', 0));
  const lampPath = $derived(path('lamp', 1));

  const verdict = $derived.by(() => {
    if (!engine) return '';
    if (mode === 'bare') {
      if (lampBrightness > 0.8) return 'The line is short enough: the lamp gets nearly all the power it needs.';
      if (lampBrightness > 0.02) return 'The lamp glows faintly: the line eats most of the voltage.';
      return keyDown ? 'The current still flows, but the lamp gets too little power to glow.' : 'Press the key.';
    }
    if (relayIn) return 'The relay has pulled in: its contacts put the local battery on the lamp.';
    return keyDown ? 'Even the relay coil gets too little current: this line needs another repeater.' : 'Press the key.';
  });
</script>

{#snippet controls()}
  <Segmented
    label="Far end"
    bind:value={mode}
    options={[
      { value: 'bare', label: 'Lamp on the line' },
      { value: 'repeater', label: 'Relay repeater' },
    ]}
  />
  <Slider label="Line length" bind:value={km} min={0} max={500} step={10} format={(v) => `${v} km`} />
  <Button onclick={sendSos} disabled={!engine || sending}>{sending ? 'Sending…' : 'Send SOS'}</Button>
  <Button onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Run'}</Button>
  <Segmented
    size="sm"
    label="Speed"
    bind:value={slow}
    options={[
      { value: '1', label: 'Real time' },
      { value: '0.1', label: 'Slow ×0.1' },
    ]}
  />
{/snippet}

<Widget {title} {n} kind="Live circuit" caption="Hold the key (click and hold it on the schematic) or press Send SOS. Slide the line length up and watch the lamp at the far end, then switch to the relay repeater." {controls} onreset={reset} fullscreen grid>
  <div class="tr" bind:this={root}>
    <Schematic bind:this={schematic} {circuit} {engine} mode="voltage" showCurrent running={playing} scale={1.5} live={false} label="Telegraph circuit: key, {km} km of line, and {mode === 'repeater' ? 'a relay repeater driving a lamp from a local battery' : 'a lamp'}" />

    <dl class="stats ui" aria-live="polite">
      <div>
        <dt>Line</dt>
        <dd>{formatSI(ohms, 'Ω', 3)}</dd>
        <dd class="sub">{km} km × {OHMS_PER_KM} Ω/km</dd>
      </div>
      <div>
        <dt>Current in the line</dt>
        <dd>{lineMa.toFixed(1)} mA</dd>
        <dd class="sub">{keyDown ? 'key down' : 'key up'}</dd>
      </div>
      <div class="lamp" class:lit={lampBrightness > 0.5}>
        <dt>Power at the lamp</dt>
        <dd>{lampMw.toFixed(0)} mW</dd>
        <dd class="sub">of {LAMP_RATED_MW} mW · {Math.round(lampBrightness * 100)} % light</dd>
      </div>
      {#if mode === 'repeater'}
        <div class="relay" class:in={relayIn}>
          <dt>Relay</dt>
          <dd>{relayIn ? 'pulled in' : 'released'}</dd>
          <dd class="sub">needs 3.5 mA</dd>
        </div>
      {/if}
    </dl>

    <p class="verdict ui" role="status">{verdict}{#if engineError} {engineError}{/if}</p>

    <svg class="chart" viewBox="0 0 {CW} {2 * (ROW + 14) + 6}" role="img" aria-label="Strip chart: the key, and the light at the far end, over the last four seconds">
      <g class="rows">
        {#each ['Key', 'Lamp'] as name, r (name)}
          <text x="4" y={r * (ROW + 14) + 6 + ROW / 2 + 4}>{name}</text>
          <line x1="46" x2={CW - 6} y1={r * (ROW + 14) + 6 + ROW} y2={r * (ROW + 14) + 6 + ROW} class="axis" />
          <line x1="46" x2={CW - 6} y1={r * (ROW + 14) + 6} y2={r * (ROW + 14) + 6} class="axis faint" />
        {/each}
      </g>
      <path d={keyPath} class="trace key" />
      <path d={lampPath} class="trace lamp" />
      <text x={CW - 6} y={2 * (ROW + 14) + 2} class="tlabel" text-anchor="end">last {WINDOW} s · t = {formatSI(simTime, 's', 3)}</text>
    </svg>
  </div>
</Widget>

<style>
  .tr {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .stats > div {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.45rem 0.7rem;
    background: var(--pn);
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
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg);
  }
  dd.sub {
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--mute);
  }
  .lamp.lit {
    border-color: var(--sig-high);
    box-shadow: 0 0 10px var(--sig-high-glow);
  }
  .relay.in {
    border-color: var(--phosphor);
  }
  .verdict {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    min-height: 1.3em;
  }
  .chart {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .chart text {
    fill: var(--mute);
  }
  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .axis.faint {
    stroke: var(--line);
    stroke-dasharray: 3 4;
  }
  .trace {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .trace.key {
    stroke: var(--sig-current);
  }
  .trace.lamp {
    stroke: var(--sig-high);
    stroke-width: 2.5;
  }
  .tlabel {
    font-size: 10px;
  }
</style>
