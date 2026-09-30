<!--
  The logic probe: shows HIGH, LOW, floating (Z) or unknown (X) for the net it touches, in the same signal
  colours and marks as the wires, with the voltage when the engine is analog.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Bench } from '../editor/bench.svelte';
  import { autorange } from './meter';
  import type { Instrument, LogicProbeConfig } from './kinds';
  import { probeNet } from './probes';
  import ProbeButton from './ProbeButton.svelte';

  let { bench, inst }: { bench: Bench; inst: Instrument } = $props();
  const cfg = $derived(inst.config as LogicProbeConfig);

  let level = $state<0 | 1 | 2 | 3 | null>(null);
  let volts = $state(NaN);
  onMount(() =>
    bench.onFrame(() => {
      const e = bench.engine;
      const conn = bench.conn;
      const n = conn ? probeNet(cfg.probe, bench.circuit, conn) : undefined;
      if (!e || n === undefined) {
        if (level !== null) level = null;
        return;
      }
      const l = e.logic(bench.engineNet(n));
      const v = e.kind === 'analog' ? e.voltage(bench.engineNet(n)) : NaN;
      if (l !== level) level = l;
      if (v !== volts && !(Number.isNaN(v) && Number.isNaN(volts))) volts = v;
    }),
  );
  const NAMES = ['LOW', 'HIGH', 'UNKNOWN', 'FLOATING'] as const;
  const CHARS = ['0', '1', 'X', 'Z'] as const;
</script>

<div class="lp">
  <div class="lamp screen" data-v={level === null ? 'none' : CHARS[level].toLowerCase()} role="status" aria-label={level === null ? 'No reading' : `Logic ${NAMES[level]}`}>
    <span class="big">{level === null ? '–' : CHARS[level]}</span>
    <span class="word ui">{level === null ? (bench.engine ? 'attach the probe' : 'run the circuit') : NAMES[level]}</span>
    {#if level !== null && !Number.isNaN(volts)}<span class="volts num">{autorange(volts, 'V', 3).text} {autorange(volts, 'V', 3).prefix}V</span>{/if}
  </div>
  <ProbeButton {bench} label="LP" value={cfg.probe} colour="--sig-high" onpick={(r) => (cfg.probe = r)} />
</div>

<style>
  .lp {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .lamp {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: 0.9rem;
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
    background: var(--scope-bg);
    border: 1px solid color-mix(in srgb, var(--line-strong) 60%, black);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.5);
    --c: var(--mute);
  }
  .lamp[data-v='1'] {
    --c: var(--sig-high);
  }
  .lamp[data-v='0'] {
    --c: var(--sig-low);
  }
  .lamp[data-v='z'] {
    --c: var(--sig-z);
  }
  .lamp[data-v='x'] {
    --c: var(--sig-x);
  }
  .big {
    grid-row: span 2;
    font-family: var(--font-mono);
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1;
    min-width: 2.2rem;
    text-align: center;
    color: var(--c);
    text-shadow: 0 0 12px color-mix(in srgb, var(--c) 60%, transparent);
  }
  .lamp[data-v='1'] .big {
    -webkit-text-stroke: 0.5px var(--c);
  }
  .lamp[data-v='z'] .big {
    text-decoration: underline dashed;
    text-underline-offset: 6px;
  }
  .word {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--c);
  }
  .volts {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: color-mix(in srgb, var(--c) 75%, white);
  }
</style>
