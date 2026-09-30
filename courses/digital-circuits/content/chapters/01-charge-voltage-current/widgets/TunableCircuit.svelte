<!--
  A live circuit with sliders: the reader turns a part's value (battery voltage, a resistor) and watches the
  meters, colours, current and lamps respond. Built on the bench's Schematic and the analog engine, like
  `::circuit`, but the circuit is given as an object and `controls` bind sliders to component parameters.

    <TunableCircuit circuit={c} controls={[{ id: 'B1', key: 'voltage', label: 'Battery', min: 0, max: 12, step: 0.5, value: 6, format: fmtV }]}
                    probes={[{ label: 'Current', value: (e) => formatReadout(e.current('A1', 0), 'A') }]} />

  Used by the labs of Chapters 1 and 2. Paused off-screen; SSR renders the static schematic and the readouts' labels.
-->
<script lang="ts" module>
  import type { Engine } from '$lib/sim/engine';

  export interface Control {
    /** Component id in the circuit. */
    id: string;
    /** Parameter key (`voltage`, `resistance`, …). */
    key: string;
    label: string;
    min: number;
    max: number;
    step?: number;
    log?: boolean;
    value: number;
    format?: (v: number) => string;
    /** A list of allowed values (for instance the E12 resistor series): the slider then steps through them. */
    stops?: number[];
  }

  export interface Probe {
    label: string;
    /** Read a value off the engine, formatted for display. `values` holds the sliders' values, keyed "id.key". */
    value: (e: Engine, values: Record<string, number>) => string;
  }
</script>

<script lang="ts">
  import '$lib/sim/netlist/catalog';
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import type { SchematicMode } from '$lib/bench/model';
  import { createEngine } from '$lib/bench/engines';
  import { flatten } from '$lib/sim/netlist/flatten';
  import type { Circuit, ParamValue } from '$lib/sim/netlist/types';

  let {
    circuit,
    controls = [],
    probes = [],
    title,
    subtitle,
    caption,
    n,
    mode = 'voltage',
    current = true,
    speed = 1,
    scale = 1.5,
    kind = 'Interactive',
  }: {
    circuit: Circuit;
    controls?: Control[];
    probes?: Probe[];
    title: string;
    subtitle?: string;
    caption?: string;
    n?: string | number;
    mode?: SchematicMode;
    /** Current dots on at the start. */
    current?: boolean;
    /** Simulated seconds per real second. */
    speed?: number;
    scale?: number;
    kind?: string;
  } = $props();

  let values = $state<number[]>(untrack(() => controls.map((c) => c.value)));
  let showCurrent = $state(untrack(() => current));
  let engine: Engine | null = $state(null);
  let engineError = $state('');
  let status = $state('');
  let generation = $state(0);
  let schematic: Schematic | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let readouts = $state<string[]>(untrack(() => probes.map(() => '–')));
  let announced = $state('');

  /** The circuit as drawn: the base circuit with the sliders' values in its parameters (so labels follow). */
  const shown = $derived.by<Circuit>(() => {
    if (!controls.length) return circuit;
    return {
      ...circuit,
      components: circuit.components.map((c) => {
        const own = controls.map((k, i) => ({ k, i })).filter(({ k }) => k.id === c.id);
        if (!own.length) return c;
        const params = { ...(c.params ?? {}) };
        for (const { k, i } of own) params[k.key] = values[i]!;
        return { ...c, params };
      }),
    };
  });

  function apply(i: number) {
    // A part that burned out stays burned until the circuit is rebuilt: a changed slider rebuilds it.
    if (status) {
      reset();
      return;
    }
    const c = controls[i]!;
    engine?.setParam(c.id, c.key, values[i]! as ParamValue);
    engine?.settle();
    schematic?.frame(0);
    readProbes();
    describeNow();
  }

  function readProbes() {
    const e = engine;
    if (!e) return;
    const map = Object.fromEntries(controls.map((c, i) => [`${c.id}.${c.key}`, values[i] ?? c.value]));
    const next = probes.map((p) => {
      try {
        return p.value(e, map);
      } catch {
        return '–';
      }
    });
    if (next.some((v, k) => v !== readouts[k])) readouts = next;
  }
  function describeNow() {
    announced = probes.map((p, k) => `${p.label} ${readouts[k] ?? ''}`).join(', ');
  }

  // Create the engine (again on reset). Parameters are applied from the sliders' current values.
  $effect(() => {
    void generation;
    if (typeof window === 'undefined') return;
    let cancelled = false;
    engineError = '';
    status = '';
    try {
      const flat = flatten(untrack(() => shown));
      createEngine('analog', flat).then(
        (e) => {
          if (cancelled) return;
          try {
            untrack(() => controls.forEach((c, i) => e.setParam(c.id, c.key, values[i]! as ParamValue)));
            e.settle();
          } catch (err) {
            engineError = String(err);
          }
          engine = e;
          readProbes();
        },
        (err: unknown) => !cancelled && (engineError = String(err)),
      );
    } catch (err) {
      engineError = err instanceof Error ? err.message : String(err);
    }
    return () => {
      cancelled = true;
      engine = null;
    };
  });

  let shownMessages = 0;
  function tick(dt: number) {
    const e = engine;
    if (!e) return;
    try {
      e.advance(dt * speed);
    } catch (err) {
      status = `Simulation stopped: ${err instanceof Error ? err.message : String(err)}`;
    }
    schematic?.frame(dt);
    readProbes();
    const msgs = e.messages;
    if (msgs.length !== shownMessages) {
      shownMessages = msgs.length;
      const last = msgs.filter((m) => m.level !== 'info').at(-1);
      if (last) status = last.text;
    }
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
      tick(dt);
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

  function reset() {
    shownMessages = 0;
    status = '';
    engine = null;
    generation++;
  }
  function onparam() {
    engine?.settle();
    schematic?.frame(0);
    readProbes();
  }
</script>

<Widget {title} {subtitle} {caption} {n} {kind} onreset={reset} fullscreen grid>
  <div class="tc" bind:this={root}>
    {#if controls.length || probes.length}
      <div class="panel ui">
        {#each controls as c, i (c.id + c.key)}
          {#if c.stops}
            {@const stops = c.stops}
            <Slider
              value={Math.max(0, stops.indexOf(values[i] ?? c.value))}
              min={0}
              max={stops.length - 1}
              step={1}
              label={c.label}
              format={(k) => (c.format ?? String)(stops[Math.round(k)] ?? c.value)}
              oninput={(k) => {
                values[i] = stops[Math.round(k)] ?? c.value;
                apply(i);
              }}
            />
          {:else}
            <Slider
              value={values[i] ?? c.value}
              min={c.min}
              max={c.max}
              step={c.step ?? 0.01}
              log={c.log}
              label={c.label}
              format={c.format}
              oninput={(v) => {
                values[i] = v;
                apply(i);
              }}
            />
          {/if}
        {/each}
        <Toggle bind:checked={showCurrent} label="Current" />
      </div>
    {/if}
    <Schematic bind:this={schematic} circuit={shown} {engine} {mode} showCurrent={showCurrent} running live={false} {scale} {onparam} />
    {#if probes.length}
      <dl class="probes ui">
        {#each probes as p, k (p.label)}
          <div>
            <dt>{p.label}</dt>
            <dd>{readouts[k]}</dd>
          </div>
        {/each}
      </dl>
      <p class="sr-only" role="status" aria-live="polite">{announced}</p>
    {/if}
    {#if engineError || status}
      <p class="status ui" class:error={!!engineError} role="status">{engineError || status}</p>
    {/if}
  </div>
</Widget>

<style>
  .tc {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
  }
  .panel {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem 1.5rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--line);
  }
  .probes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .probes > div {
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .status {
    margin: 0;
    font-size: 0.82rem;
    color: var(--maybe);
  }
  .status.error {
    color: var(--bad);
    font-weight: 600;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
