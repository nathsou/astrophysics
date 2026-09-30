<!--
  A ring oscillator you can hear. n inverters in a ring on the digital engine: an odd ring oscillates with period
  2 × n × delay, an even ring settles into one of two states. The ring is drawn as a ring, each wire coloured by its
  logic level; the sound (off until you switch it on) is a square wave at the ring's real frequency divided by
  125,000, so that the pitch goes up an octave when the frequency doubles.

    ::ring-oscillator{n="16.1"}
-->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import TimingDiagram from '$lib/bench/TimingDiagram.svelte';
  import type { Recorder } from '$lib/sim/engine';
  import { SCALE, audibleHz, formatHz, frequencyHz, makeRing, measuredPeriod, predictedPeriod, ringGeometry, type Ring } from './ring';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let count = $state(3);
  let delay = $state(1);
  let seed = $state(1);
  let sound = $state(false);
  let soundNote = $state('');

  let ring: Ring | undefined = $state.raw();
  let scope: TimingDiagram | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let levels: number[] = $state([]);
  let period = $state(NaN);
  let message = $state('');
  let visible = $state(false);
  let awake = $state(true);
  let rec: Recorder | undefined;
  let raf = 0;
  let reduced = false;

  const odd = $derived(count % 2 === 1);
  const predicted = $derived(predictedPeriod(count, delay));
  const oscillates = $derived(Number.isFinite(predicted));
  const realHz = $derived(oscillates ? frequencyHz(predicted) : NaN);
  const tone = $derived(oscillates ? audibleHz(realHz) : NaN);
  const geo = $derived(ringGeometry(count));
  const span = $derived((oscillates ? predicted * 3 : 12) * 1e-9);
  const traces = $derived(ring ? ring.nodes.slice(0, 5).map((net, k) => ({ name: `n${k + 1}`, net })) : []);
  const speed = $derived((oscillates ? predicted / 1.6 : 4) * 1e-9);

  async function build() {
    cancelAnimationFrame(raf);
    const r = makeRing(count, delay, seed);
    ring = r;
    period = NaN;
    message = '';
    levels = r.nodes.map((x) => r.engine.logic(x));
    await tick();
    if (ring !== r) return;
    rec = r.engine.watch([r.nodes[0]!]);
    if (reduced) {
      // No motion: run three periods at once and draw the result.
      run(r, span);
    }
    scope?.frame();
    loop();
  }

  function run(r: Ring, dt: number) {
    try {
      r.engine.advance(dt);
    } catch (e) {
      message = String(e);
    }
    const err = r.engine.messages.filter((m) => m.level === 'error').at(-1);
    message = err ? err.text : '';
    levels = r.nodes.map((x) => r.engine.logic(x));
    if (rec) period = measuredPeriod(rec.times(), rec.values()[0]!);
    scope?.frame();
  }

  function loop() {
    let last = 0;
    const step = (t: number) => {
      raf = 0;
      const r = ring;
      if (!r) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (visible && awake && !reduced) run(r, dt * speed);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  $effect(() => {
    // A new ring whenever a setting changes.
    void count;
    void delay;
    void seed;
    untrack(() => void build());
  });

  // ── Sound ──────────────────────────────────────────────────────────────────
  let audio: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | undefined;
  function startAudio() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error('This browser has no Web Audio.');
      const ctx = new AC();
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audio = { ctx, osc, gain };
      soundNote = '';
    } catch (e) {
      sound = false;
      soundNote = e instanceof Error ? e.message : 'The sound could not start.';
    }
  }
  function stopAudio() {
    if (!audio) return;
    try {
      audio.osc.stop();
      void audio.ctx.close();
    } catch {
      /* already closed */
    }
    audio = undefined;
  }
  function toggleSound(on: boolean) {
    // Called from the switch's change event: a user gesture, which is what browsers require.
    if (on) startAudio();
    else stopAudio();
  }
  $effect(() => {
    const a = audio;
    if (!a) return;
    const on = sound && oscillates && visible && awake;
    const now = a.ctx.currentTime;
    if (Number.isFinite(tone)) a.osc.frequency.setTargetAtTime(tone, now, 0.03);
    a.gain.gain.setTargetAtTime(on ? 0.035 : 0, now, 0.03);
  });

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (root) io.observe(root);
    const vis = () => (awake = !document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      stopAudio();
    };
  });

  const cls = (v: number | undefined) => (v === 1 ? 'hi' : v === 0 ? 'lo' : 'x');
  const stateText = $derived(
    !odd && levels.length && levels.every((v) => v <= 1)
      ? `Settled: node 1 = ${levels[0]}, node 2 = ${levels[1]}${count > 2 ? ', …' : ''}. Every wire is the opposite of the one before it, and nothing moves.`
      : '',
  );
</script>

<Widget n={fig} title="A ring of inverters" subtitle="Odd rings sing, even rings remember" kind="Lab bench" {caption} onreset={() => ((count = 3), (delay = 1), (seed = 1))} live={false}>
  {#snippet controls()}
    <Segmented label="Inverters in the ring" size="sm" bind:value={count} options={[2, 3, 4, 5, 7, 9].map((v) => ({ value: v, label: String(v) }))} />
    <Slider label="Delay per inverter" bind:value={delay} min={0} max={5} step={0.5} compact format={(v) => `${v.toFixed(1)} ns`} />
    <Toggle label="Sound" bind:checked={sound} onchange={toggleSound} />
    <Button size="sm" onclick={() => (seed += 1)}>Power up again</Button>
  {/snippet}

  <div class="rg" bind:this={root}>
    <div class="top">
      <svg viewBox="0 0 220 220" class="ring" role="img" aria-label="{count} inverters in a ring, each output feeding the next. Wires are amber when 1 and slate when 0.">
        {#each geo.arcs as d, k (k)}
          <path class="wire {cls(levels[k])}" {d} />
        {/each}
        {#each geo.gates as g, k (k)}
          <g transform="translate({g.x.toFixed(1)} {g.y.toFixed(1)}) rotate({g.angle})">
            <path class="tri" d="M-8 -9 V9 L9 0 Z" />
            <circle class="bub" cx="12.5" cy="0" r="3.5" />
          </g>
        {/each}
        <text x="110" y="104" text-anchor="middle" class="big">{oscillates ? formatHz(realHz) : odd ? 'no delay' : 'holds'}</text>
        <text x="110" y="124" text-anchor="middle" class="small">{count} × {delay.toFixed(1)} ns</text>
      </svg>

      <div class="read ui">
        {#if oscillates}
          <dl>
            <div><dt>Period, by the rule 2 × n × delay</dt><dd>{predicted.toFixed(predicted % 1 ? 1 : 0)} ns = 2 × {count} × {delay.toFixed(1)} ns</dd></div>
            <div><dt>Period, measured on the waveform</dt><dd>{Number.isFinite(period) ? `${period.toFixed(period % 1 ? 1 : 0)} ns` : 'measuring…'}</dd></div>
            <div><dt>Frequency</dt><dd>{formatHz(realHz)}</dd></div>
            <div><dt>What you would hear</dt><dd>{formatHz(tone)}, the frequency ÷ {SCALE.toLocaleString('en-GB')}{sound ? '' : ' (sound is off)'}</dd></div>
          </dl>
        {:else if odd}
          <p class="msg">With no delay, an odd ring has nowhere to go: every inverter changes in the same instant, over and over, and the engine gives up. Its message is below, and the wires read X, unknown.</p>
        {:else}
          <p class="msg">{stateText || 'An even ring has two stable states and no input.'} <em>Power up again</em> starts it afresh from a different random state; the simulator picks the state with a seeded random number, so every run of the page is the same.</p>
          <p class="msg">You have made a memory that holds one bit and cannot be written. The next figures add the inputs.</p>
        {/if}
        {#if message}<p class="err">{message}</p>{/if}
        {#if soundNote}<p class="err">{soundNote}</p>{/if}
      </div>
    </div>
    {#if traces.length}
      <TimingDiagram bind:this={scope} engine={ring?.engine ?? null} {traces} window={span} live={false} rowHeight={24} label="The outputs of the first inverters of the ring" />
    {/if}
  </div>
</Widget>

<style>
  .rg {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .top {
    display: grid;
    gap: 1rem 2rem;
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    align-items: center;
  }
  @media (max-width: 40rem) {
    .top {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .ring {
    width: 100%;
    max-width: 15rem;
    justify-self: center;
    overflow: visible;
  }
  .wire {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke 60ms;
  }
  .wire.hi {
    stroke: var(--sig-high);
    stroke-width: 4;
  }
  .wire.lo {
    stroke: var(--sig-low);
  }
  .wire.x {
    stroke: var(--sig-x);
    stroke-dasharray: 3 3;
  }
  .tri {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .bub {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
  }
  .big {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
  }
  .small {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  dt {
    font-size: 0.72rem;
    color: var(--mute);
  }
  dd {
    margin: 0.05rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    color: var(--fg);
    font-weight: 600;
  }
  .msg {
    margin: 0 0 0.5rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .err {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--bad);
  }
</style>
