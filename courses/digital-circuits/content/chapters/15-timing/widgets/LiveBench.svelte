<!--
  A schematic that runs on the digital engine, with a timing diagram of some of its nets, for chapter widgets that
  need what `::circuit` cannot give them: a choice of delay model, a seed, their own controls around the drawing.

    <LiveBench {circuit} traces="A,F" window={24e-9} bind:speed bind:engine {onparam} />

  A new `circuit` object (or new `options`) gives a new engine, settled for `settle` seconds so that it starts in a
  steady state. Simulated time advances by `speed` × real time while the figure is on screen and `playing`; with
  `instant` (or when the reader prefers reduced motion) a change made in the drawing is followed by a jump of one
  timing-diagram window, so the outcome appears at once and nothing moves.
-->
<script lang="ts">
  import { onMount, tick as nextTick, untrack } from 'svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import TimingDiagram from '$lib/bench/TimingDiagram.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { resolveTraces } from '$lib/bench/traces';
  import { flatten, topLevelNets } from '$lib/sim/netlist/flatten';
  import type { Engine, EngineOptions } from '$lib/sim/engine';
  import type { Circuit, ParamValue } from '$lib/sim/netlist/types';

  let {
    circuit,
    options = {},
    traces = '',
    window: span = 24e-9,
    speed = 5e-9,
    playing = true,
    instant = false,
    settle = 40e-9,
    scale = 1.25,
    engine = $bindable(null),
    label,
    onparam,
    onready,
    onframe,
  }: {
    circuit: Circuit;
    /** Engine options: `delayModel`, `powerUp`, `seed`, … */
    options?: Record<string, unknown>;
    /** Names of the nets to draw as waveforms, comma-separated (see the bench's timing diagrams). */
    traces?: string;
    /** Simulated seconds across the timing diagram. */
    window?: number;
    /** Simulated seconds per real second. */
    speed?: number;
    playing?: boolean;
    /** Jump ahead after every change instead of playing it. */
    instant?: boolean;
    /** Simulated seconds to run before the reader sees the circuit. */
    settle?: number;
    scale?: number;
    engine?: Engine | null;
    label?: string;
    onparam?: (id: string, key: string, value: ParamValue) => void;
    onready?: (engine: Engine) => void;
    onframe?: (engine: Engine) => void;
  } = $props();

  let schematic: Schematic | undefined = $state();
  let timing: TimingDiagram | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let error = $state('');
  let reduced = $state(false);

  const conn = $derived(topLevelNets(circuit));
  const resolved = $derived(traces ? resolveTraces(traces, circuit, conn) : { traces: [], missing: [] });

  // A new engine whenever the circuit or the options change.
  $effect(() => {
    const c = circuit;
    const o = options;
    let cancelled = false;
    let made: Engine | null = null;
    untrack(() => (error = ''));
    try {
      const flat = flatten(c);
      createEngine('digital', flat, o as EngineOptions).then(
        async (e) => {
          if (cancelled) return;
          made = e;
          // Hand the engine over first, so the timing diagram is recording from t = 0, and only then run the
          // power-up transient: the diagram starts on a steady state and its window is never blank.
          engine = e;
          await nextTick();
          if (cancelled) return;
          try {
            e.settle();
            e.advance(settle);
          } catch (err) {
            error = String(err);
          }
          onready?.(e);
          tick(0);
        },
        (err: unknown) => !cancelled && (error = String(err)),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return () => {
      cancelled = true;
      if (engine === made) engine = null;
    };
  });

  function tick(dtReal: number) {
    const e = engine;
    if (!e) return;
    if (dtReal > 0) {
      try {
        e.advance(dtReal * speed);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
    schematic?.frame(dtReal);
    timing?.frame();
    onframe?.(e);
  }

  /** Jump ahead by `seconds` of simulated time and redraw. */
  export function skip(seconds: number) {
    const e = engine;
    if (!e) return;
    e.advance(seconds);
    tick(0);
  }

  function changed(id: string, key: string, value: ParamValue) {
    const e = engine;
    if (e && (instant || reduced)) {
      // The switch has already been flipped in the engine: run the consequences through, at once.
      e.advance(span * 0.9);
    }
    tick(0);
    onparam?.(id, key, value);
  }

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    let visible = false;
    const loop = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      tick(playing && !instant && !reduced ? dt : 0);
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
</script>

<div class="lb" bind:this={root}>
  <div class="stage">
    {#key circuit}
      <Schematic bind:this={schematic} {circuit} {engine} mode="logic" {scale} live={false} {label} onparam={changed} />
    {/key}
  </div>
  {#if resolved.traces.length}
    <div class="traces">
      <TimingDiagram bind:this={timing} {engine} traces={resolved.traces} window={span} live={false} />
    </div>
  {/if}
  {#if error}
    <p class="err ui" role="alert">{error}</p>
  {:else if resolved.missing.length}
    <p class="err ui" role="status">Unknown traces: {resolved.missing.join(', ')}</p>
  {/if}
</div>

<style>
  .lb {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .stage {
    display: flex;
    justify-content: center;
    min-width: 0;
    overflow-x: auto;
  }
  /* A drawing of a dozen gates shrunk to a phone's width is too small to read: let it scroll sideways instead. */
  @media (max-width: 40rem) {
    .stage :global(.sch-wrap),
    .stage :global(.sch) {
      max-width: none;
    }
    .stage {
      justify-content: flex-start;
    }
  }
  .traces {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .err {
    margin: 0;
    font-size: 0.8rem;
    color: var(--bad);
  }
</style>
