<!--
  The flyback spike on a scope, with and without the diode.

  Two copies of the same circuit (a 5 V relay coil, a switch to ground), one with a diode across the
  coil. "Open the switch" cuts the coil current in both at the same instant, and each scope shows the
  voltage at the coil's switched end, recorded by engine.watch() at every step the solver took and
  reduced to a min/max envelope per pixel so that a spike a few microseconds wide is never lost.
  Never do this on real hardware: the spike destroys the transistor that would be doing the switching.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { flatten } from '$lib/sim/netlist/flatten';
  import { formatSI } from '$lib/bench/format';
  import type { Engine } from '$lib/sim/engine';
  import type { Circuit } from '$lib/sim/netlist/types';
  import bare from '../circuits/flyback-bare.json';
  import withDiode from '../circuits/flyback-diode.json';
  import { closeSwitch, openSwitch, type FlybackTrace } from './flyback';
  import { envelope, niceCeil } from './scope';

  let { n, title = 'The flyback spike' }: { n?: string | number; title?: string } = $props();

  type Timebase = 'spike' | 'whole';
  const BASES: Record<Timebase, { pre: number; span: number; label: string }> = {
    spike: { pre: 10e-6, span: 80e-6, label: '10 µs / div' },
    whole: { pre: 1e-3, span: 10e-3, label: '1 ms / div' },
  };
  let base = $state<Timebase>('spike');
  let opened = $state(false);
  let busy = $state(false);

  interface Panel {
    key: 'bare' | 'diode';
    title: string;
    circuit: Circuit;
    engine: Engine | null;
    trace: FlybackTrace | null;
  }
  let panels: Panel[] = $state([
    { key: 'bare', title: 'Nothing across the coil', circuit: bare as unknown as Circuit, engine: null, trace: null },
    { key: 'diode', title: 'Diode across the coil', circuit: withDiode as unknown as Circuit, engine: null, trace: null },
  ]);
  let schematics: (Schematic | undefined)[] = $state([]);
  let mounted = $state(false);

  async function build() {
    busy = true;
    opened = false;
    for (const p of panels) {
      p.trace = null;
      p.engine = null;
    }
    const engines = await Promise.all(panels.map((p) => createEngine('analog', flatten(p.circuit))));
    engines.forEach((e, i) => {
      e.advance(0.03);
      panels[i]!.engine = e;
    });
    busy = false;
    queueMicrotask(() => schematics.forEach((s) => s?.frame(0)));
  }

  onMount(() => {
    mounted = true;
    void build();
  });

  function toggle() {
    if (busy) return;
    if (!opened) {
      for (const p of panels) if (p.engine) p.trace = openSwitch(p.engine, { warm: 0, pre: 1e-3, post: 0.02 });
      opened = true;
    } else {
      for (const p of panels) {
        if (p.engine) closeSwitch(p.engine);
        p.trace = null;
      }
      opened = false;
    }
    queueMicrotask(() => schematics.forEach((s) => s?.frame(0)));
  }

  // ── Scope drawing ────────────────────────────────────────────────────────────
  const W = 420;
  const HGT = 170;
  const X0 = 46;
  const X1 = W - 8;
  const Y0 = 10;
  const Y1 = HGT - 26;
  const COLS = 260;

  function scopeMax(tr: FlybackTrace | null): number {
    return niceCeil(Math.max(6, (tr?.peak ?? 0) * 1.02));
  }
  function shape(tr: FlybackTrace | null, tb: Timebase) {
    const ymax = scopeMax(tr);
    const b = BASES[tb];
    const X = (t: number) => X0 + ((t + b.pre) / b.span) * (X1 - X0);
    const Y = (v: number) => Y1 - (Math.max(0, Math.min(ymax, v)) / ymax) * (Y1 - Y0);
    let area = '';
    if (tr) {
      const cols = envelope(tr.t, tr.v, -b.pre, b.span - b.pre, COLS);
      const top: string[] = [];
      const bottom: string[] = [];
      cols.forEach((c, k) => {
        if (!c) return;
        const x = X0 + ((k + 0.5) / COLS) * (X1 - X0);
        top.push(`${x.toFixed(1)} ${Y(c.max).toFixed(1)}`);
        bottom.unshift(`${x.toFixed(1)} ${Math.min(Y1, Y(c.min) + 1.5).toFixed(1)}`);
      });
      if (top.length) area = `M${top.join('L')}L${bottom.join('L')}Z`;
    }
    return { ymax, X, Y, area, b };
  }
  const shapes = $derived(panels.map((p) => shape(p.trace, base)));
  const ticksFor = (ymax: number) => [0, ymax / 2, ymax];
  const fmtV = (v: number) => (v >= 10 ? `${v.toFixed(0)} V` : `${v.toFixed(1)} V`);
</script>

{#snippet controls()}
  <Button onclick={toggle} disabled={busy || !mounted} aria-pressed={opened}>{opened ? 'Close the switch again' : 'Open the switch'}</Button>
  <Segmented
    label="Time base"
    bind:value={base}
    options={[
      { value: 'spike', label: 'Zoom on the spike' },
      { value: 'whole', label: 'The whole event' },
    ]}
  />
{/snippet}

<Widget {title} {n} kind="Scope" caption="Both coils carry 71 mA. Open the switch: the same current has to go somewhere. Without a diode it drives the coil’s end to hundreds of volts; with one it takes the diode’s 0.8 V path. Switch to the wider time base to see how long each takes to die away. (This happens in the simulator only. On a real transistor circuit it would be the transistor that dies.)" {controls} onreset={() => void build()}>
  <div class="fs">
    {#each panels as p, i (p.key)}
      {@const s = shapes[i]!}
      <section class="panel" aria-label={p.title}>
        <h5 class="ui">{p.title}</h5>
        <div class="sch">
          <Schematic bind:this={schematics[i]} circuit={p.circuit} engine={p.engine} mode="voltage" interactive={false} scale={1.2} live={false} label="{p.title}: a relay coil, a switch and {p.key === 'diode' ? 'a diode across the coil' : 'nothing else'}" />
        </div>
        <svg class="scope" viewBox="0 0 {W} {HGT}" role="img" aria-label="Scope trace of the voltage at the coil’s switched end. {p.trace ? `Peak ${fmtV(p.trace.peak)}.` : 'Switch still closed.'}">
          <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} class="screen" />
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as d (d)}
            <line x1={X0 + (d / 10) * (X1 - X0)} x2={X0 + (d / 10) * (X1 - X0)} y1={Y0} y2={Y1} class="grid" />
          {/each}
          {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
            <line x1={X0} x2={X1} y1={Y0 + (d / 8) * (Y1 - Y0)} y2={Y0 + (d / 8) * (Y1 - Y0)} class="grid" />
          {/each}
          <!-- the moment the switch opens -->
          <line x1={s.X(0)} x2={s.X(0)} y1={Y0} y2={Y1} class="trigger" />
          {#if p.key === 'bare' && s.ymax >= 100}
            <line x1={X0} x2={X1} y1={s.Y(40)} y2={s.Y(40)} class="rating" />
            <text x={X1 - 4} y={s.Y(40) - 18} text-anchor="end" class="ratingtxt">a 2N3904 breaks down at 40 V</text>
          {/if}
          {#if s.area}<path d={s.area} class="beam" />{:else}<line x1={X0} x2={X1} y1={s.Y(0)} y2={s.Y(0)} class="beam flat" />{/if}
          {#each ticksFor(s.ymax) as v (v)}
            <text x={X0 - 5} y={s.Y(v) + 3.5} text-anchor="end" class="tick">{fmtV(v)}</text>
          {/each}
          <text x={X0} y={HGT - 8} class="tick">{s.b.label}</text>
          <text x={s.X(0) + 4} y={Y0 + 11} class="tick">switch opens</text>
        </svg>
        <p class="peak ui" class:bad={p.key === 'bare' && !!p.trace} class:good={p.key === 'diode' && !!p.trace}>
          {#if p.trace}
            Peak <strong>{fmtV(p.trace.peak)}</strong>
            {#if p.key === 'bare'}<span>, {formatSI(p.trace.peak / 5, '', 2)}× the supply</span>{:else}<span>, {(p.trace.peak - 5).toFixed(1)} V above the supply</span>{/if}
          {:else}
            Switch closed: the coil’s end is at 0 V.
          {/if}
        </p>
      </section>
    {/each}
  </div>
</Widget>

<style>
  .fs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.2rem;
    min-width: 0;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  h5 {
    margin: 0 !important;
    font-size: 0.86rem !important;
    font-weight: 600;
    color: var(--fg);
  }
  .sch {
    overflow-x: auto;
    display: flex;
    justify-content: center;
  }
  .scope {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
  }
  .screen {
    fill: var(--scope-bg);
    stroke: var(--line-strong);
    stroke-width: 1.2;
    rx: 4;
  }
  .grid {
    stroke: var(--scope-grid);
    stroke-width: 1;
  }
  .trigger {
    stroke: var(--phosphor);
    stroke-width: 1;
    stroke-dasharray: 3 4;
    opacity: 0.7;
  }
  .rating {
    stroke: var(--sig-x);
    stroke-width: 1;
    stroke-dasharray: 5 4;
  }
  .ratingtxt {
    font-size: 9.5px;
    fill: var(--sig-x);
  }
  .beam {
    fill: var(--phosphor);
    stroke: var(--phosphor);
    stroke-width: 1.6;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 3px var(--phosphor-glow));
  }
  .beam.flat {
    fill: none;
  }
  .tick {
    font-size: 10px;
    fill: var(--mute);
  }
  /* The screen is dark in both themes: keep the on-screen labels light. */
  .scope :global(text.tick) {
    fill: var(--mute);
  }
  .peak {
    margin: 0;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .peak.bad strong {
    color: var(--bad);
  }
  .peak.good strong {
    color: var(--ok);
  }
</style>
