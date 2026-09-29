<!--
  A live circuit in a chapter:

    ::circuit{src="06-shannons-switches/circuits/staircase.json" title="Two-way switching" mode="logic" speed=1 current=true}

  Loads the circuit (src relative to content/chapters/, or an inline `circuit` object), creates its
  engine through ./engines.ts, and runs it: sim time advances by `speed` × real time (sim seconds
  per real second), paused off-screen and in hidden tabs. The server renders the static schematic
  for inline circuits and a placeholder for `src` circuits.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '../components/ui/Widget.svelte';
  import Segmented from '../components/ui/Segmented.svelte';
  import Toggle from '../components/ui/Toggle.svelte';
  import Schematic from './Schematic.svelte';
  import type { SchematicMode } from './model';
  import TimingDiagram from './TimingDiagram.svelte';
  import type { Engine } from '../sim/engine';
  import type { Circuit } from '../sim/netlist/types';
  import type { SubResolver } from '../sim/netlist/connect';
  import { flatten } from '../sim/netlist/flatten';
  import { topLevelNets } from '../sim/netlist/flatten';
  import { createEngine } from './engines';
  import { resolveTraces } from './traces';
  import { formatSI, formatSpeed } from './format';

  let {
    src,
    circuit: inline,
    title,
    subtitle,
    caption,
    mode: initialMode,
    speed: initialSpeed = 1,
    current = false,
    traces,
    window: traceWindow,
    autoplay = true,
    controls = true,
    scale = 1.5,
    highlight,
    parts,
  }: {
    /** Path of a circuit JSON relative to content/chapters/, e.g. "06-shannons-switches/circuits/staircase.json". */
    src?: string;
    /** A circuit object (for widgets that build circuits in code). */
    circuit?: Circuit;
    title?: string;
    subtitle?: string;
    caption?: string;
    /** Wire colouring; default: logic for digital circuits, voltage for analog ones. */
    mode?: SchematicMode;
    /** Simulated seconds per real second (1e-8 for nanosecond logic, 1 for relays and lamps). */
    speed?: number;
    /** Show current as moving dots (analog circuits). */
    current?: boolean;
    /** Timing-diagram traces: net names, "U1.Y" pins or component ids, comma-separated. */
    traces?: string;
    /** Simulated seconds shown in the timing diagram (default: 4 real seconds' worth). */
    window?: number;
    autoplay?: boolean;
    controls?: boolean;
    scale?: number;
    /** Component ids or net names to highlight, comma-separated. */
    highlight?: string;
    parts?: SubResolver;
  } = $props();

  const files = import.meta.glob<Circuit>('/content/chapters/*/circuits/*.json', { import: 'default' });

  let loaded: Circuit | undefined = $state();
  let loadError = $state('');
  const circuit = $derived(inline ?? loaded);
  const kind = $derived(circuit?.engine ?? 'digital');
  const analog = $derived(kind === 'analog');

  // Settings the reader can change (seeded from the props).
  let mode: SchematicMode = $state(untrack(() => initialMode ?? (inline?.engine === 'analog' ? 'voltage' : 'logic')));
  let showCurrent = $state(untrack(() => current));
  let speed = $state(untrack(() => initialSpeed));
  let playing = $state(untrack(() => autoplay));
  let modeSet = untrack(() => initialMode !== undefined);
  $effect(() => {
    // Default colouring once the circuit is known.
    if (circuit && !modeSet) {
      modeSet = true;
      mode = circuit.engine === 'analog' ? 'voltage' : 'logic';
    }
  });

  let engine: Engine | null = $state(null);
  let engineError = $state('');
  let status = $state('');
  let statusLevel: 'info' | 'warning' | 'error' = $state('info');
  let simTime = $state(0);
  let generation = $state(0);
  let schematic: Schematic | undefined = $state();
  let timing: TimingDiagram | undefined = $state();
  let root: HTMLDivElement | undefined = $state();

  const highlightSet = $derived(highlight ? new Set(highlight.split(',').map((s) => s.trim())) : undefined);
  const conn = $derived(circuit ? topLevelNets(circuit, parts) : undefined);
  const resolved = $derived(circuit && conn && traces ? resolveTraces(traces, circuit, conn) : { traces: [], missing: [] });
  const span = $derived(traceWindow ?? speed * 4);

  // Load a circuit file (browser only; the glob is lazy).
  $effect(() => {
    if (inline || !src) return;
    const key = `/content/chapters/${src.replace(/^\/+/, '')}`;
    const load = files[key];
    if (!load) {
      loadError = `Circuit not found: ${src}`;
      return;
    }
    let cancelled = false;
    load().then(
      (c) => !cancelled && (loaded = c),
      (e: unknown) => !cancelled && (loadError = `Could not load ${src}: ${String(e)}`),
    );
    return () => {
      cancelled = true;
    };
  });

  // Create the engine for the circuit (again on reset).
  $effect(() => {
    const c = circuit;
    void generation;
    if (!c || typeof window === 'undefined') return;
    let cancelled = false;
    let made: Engine | null = null;
    engineError = '';
    status = '';
    try {
      const flat = flatten(c, parts);
      createEngine(c.engine, flat).then(
        (e) => {
          if (cancelled) return;
          made = e;
          try {
            e.settle();
          } catch (err) {
            engineError = String(err);
          }
          engine = e;
          simTime = e.time;
        },
        (err: unknown) => !cancelled && (engineError = String(err)),
      );
    } catch (err) {
      engineError = err instanceof Error ? err.message : String(err);
    }
    return () => {
      cancelled = true;
      if (engine === made) engine = null;
    };
  });

  let shownMessages = 0;
  function pollMessages(e: Engine) {
    const msgs = e.messages;
    if (msgs.length === shownMessages) return;
    shownMessages = msgs.length;
    const last = msgs[msgs.length - 1];
    if (last) {
      status = last.text;
      statusLevel = last.level;
    }
  }

  function tick(dtReal: number) {
    const e = engine;
    if (!e) return;
    if (dtReal > 0) {
      try {
        e.advance(dtReal * speed);
      } catch (err) {
        playing = false;
        status = `Simulation stopped: ${err instanceof Error ? err.message : String(err)}`;
        statusLevel = 'error';
      }
    }
    schematic?.frame(dtReal);
    timing?.frame();
    pollMessages(e);
    simTime = e.time;
  }

  function step() {
    playing = false;
    tick(0.1);
  }
  function reset() {
    shownMessages = 0;
    status = '';
    engine = null;
    generation++;
  }
  function onparam() {
    const e = engine;
    if (!e) return;
    try {
      e.settle();
    } catch {
      /* the engine reports problems in messages */
    }
    schematic?.frame(0);
    timing?.frame();
  }

  onMount(() => {
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

  // Speed: a log slider in thirds of a decade (1, 2, 5 × 10ⁿ).
  const STEPS = [1, 2, 5];
  const speedIndex = $derived(Math.round(Math.log10(speed) * 3));
  function setSpeedIndex(i: number) {
    const decade = Math.floor(i / 3);
    speed = STEPS[((i % 3) + 3) % 3]! * 10 ** decade;
  }
  const minIndex = $derived(Math.min(-27, speedIndex - 6));
  const maxIndex = $derived(Math.max(3, speedIndex + 3));
</script>

<Widget title={title ?? circuit?.title ?? 'Circuit'} {subtitle} {caption} onreset={reset}>
    <div class="cw" bind:this={root}>
      {#if controls}
        <div class="bar ui" role="toolbar" aria-label="Simulation controls">
          <button class="icon" type="button" onclick={() => (playing = !playing)} aria-label={playing ? 'Pause' : 'Run'} title={playing ? 'Pause' : 'Run'} disabled={!engine}>
            {#if playing}
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg>
            {:else}
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
            {/if}
          </button>
          <button class="icon" type="button" onclick={step} aria-label="Step" title="Step (a tenth of a second at this speed)" disabled={!engine}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 5l10 7-10 7zM17 5h3v14h-3z" fill="currentColor" /></svg>
          </button>
          <label class="speed">
            <span>Speed</span>
            <input
              type="range"
              min={minIndex}
              max={maxIndex}
              step="1"
              value={speedIndex}
              oninput={(ev) => setSpeedIndex(Number((ev.currentTarget as HTMLInputElement).value))}
              aria-valuetext="{formatSpeed(speed)} (simulated time per second)"
            />
            <output>{formatSpeed(speed)}</output>
          </label>
          {#if analog}
            <Segmented
              size="sm"
              label="Wire colours"
              bind:value={mode}
              options={[
                { value: 'voltage', label: 'Volts', title: 'Colour wires by voltage' },
                { value: 'logic', label: 'Logic', title: 'Colour wires by logic level' },
                { value: 'plain', label: 'Ink', title: 'No colouring' },
              ]}
            />
            <Toggle label="Current" bind:checked={showCurrent} />
          {/if}
          <span class="time" aria-label="Simulated time">t = {formatSI(simTime, 's', 3)}</span>
        </div>
      {/if}

      {#if circuit}
        {#key generation}
        <Schematic
          bind:this={schematic}
          {circuit}
          {engine}
          {mode}
          showCurrent={analog && showCurrent}
          highlight={highlightSet}
          running={playing}
          {scale}
          {parts}
          live={false}
          {onparam}
        />
        {/key}
        {#if resolved.traces.length}
          <div class="traces">
            <TimingDiagram bind:this={timing} {engine} traces={resolved.traces} window={span} live={false} />
          </div>
        {/if}
      {:else}
        <div class="placeholder" aria-busy={!loadError}>{loadError || 'Loading circuit…'}</div>
      {/if}

      {#if engineError || status || resolved.missing.length}
        <p class="status ui {engineError ? 'error' : statusLevel}" role="status" aria-live="polite">
          {engineError || status || `Unknown traces: ${resolved.missing.join(', ')}`}
        </p>
      {:else}
        <p class="status ui empty" role="status" aria-live="polite"></p>
      {/if}
    </div>
</Widget>

<style>
  .cw {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    font-size: 0.8rem;
    color: var(--ink-2, #3f3b34);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 2px solid var(--fg, #1a1917);
    border-radius: var(--radius-sm, 3px);
    background: var(--surface, #fff);
    color: var(--ink, #1a1917);
    cursor: pointer;
  }
  .icon:hover:not(:disabled) {
    background: var(--pn, #eee);
  }
  .icon:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .icon:focus-visible,
  .speed input:focus-visible {
    outline: 3px solid var(--focus, #1f5aa6);
    outline-offset: 2px;
  }
  .icon + .icon {
    margin-left: -0.5rem;
  }
  .speed {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }
  .speed input {
    width: 7.5rem;
    accent-color: var(--accent, #b12520);
  }
  .speed output {
    font-family: var(--font-mono, monospace);
    font-size: 0.76rem;
    min-width: 4.5rem;
  }
  .time {
    margin-left: auto;
    font-family: var(--font-mono, monospace);
    font-size: 0.76rem;
    color: var(--ink-3, #635b4e);
    font-variant-numeric: tabular-nums;
  }
  .placeholder {
    min-height: 10rem;
    display: grid;
    place-items: center;
    color: var(--ink-3, #635b4e);
    font-size: 0.85rem;
  }
  .traces {
    border-top: 1px solid var(--rule, #ddd);
    padding-top: 0.5rem;
  }
  .status {
    margin: 0;
    min-height: 1.2em;
    font-size: 0.8rem;
    color: var(--ink-2, #3f3b34);
  }
  .status.empty {
    min-height: 0;
  }
  .status.warning {
    color: var(--maybe, #7d5200);
  }
  .status.error {
    color: var(--bad, #b12520);
    font-weight: 600;
  }
</style>
