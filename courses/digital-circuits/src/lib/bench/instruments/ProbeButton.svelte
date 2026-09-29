<!--
  A probe socket on an instrument panel: shows where the probe is attached and lets the reader click a
  pin or wire on the schematic to move it there.
-->
<script lang="ts">
  import Glyph from '../editor/Glyph.svelte';
  import type { Bench } from '../editor/bench.svelte';
  import { probeLabel, type ProbeRef } from './probes';

  let {
    bench,
    label,
    value,
    onpick,
    pinsOnly = false,
    colour,
    clearable = true,
    empty = 'not attached',
  }: {
    bench: Bench;
    /** Name shown on the button and in the banner: "CH1", "+ probe". */
    label: string;
    value: ProbeRef | undefined;
    onpick: (ref: ProbeRef | undefined) => void;
    pinsOnly?: boolean;
    /** A CSS custom property for the probe's colour. */
    colour?: string;
    clearable?: boolean;
    empty?: string;
  } = $props();

  const picking = $derived(bench.pick?.label === label);
  const where = $derived(value ? probeLabel(value, bench.conn, bench.circuit) : empty);
  function start() {
    if (picking) bench.cancelPick();
    else bench.startPick({ label, pinsOnly, onpick: (ref) => onpick(ref) });
  }
</script>

<div class="probe ui" class:picking>
  <button type="button" class="sock" onclick={start} aria-pressed={picking} title={picking ? 'Cancel' : `Click a ${pinsOnly ? 'pin' : 'pin or wire'} on the schematic to attach the ${label} probe`}>
    <span class="dot" style:background={colour ? `var(${colour})` : 'var(--copper)'}></span>
    <span class="lbl">{label}</span>
    <span class="where" class:none={!value}>{picking ? 'click the schematic…' : where}</span>
    <Glyph name="probe" size={14} />
  </button>
  {#if value && clearable}
    <button type="button" class="clear" onclick={() => onpick(undefined)} aria-label="Detach {label}" title="Detach"><Glyph name="close" size={12} /></button>
  {/if}
</div>

<style>
  .probe {
    display: flex;
    align-items: stretch;
    gap: 0.2rem;
    min-width: 0;
  }
  .sock {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    text-align: left;
  }
  .sock:hover {
    border-color: var(--copper);
  }
  .picking .sock {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    flex: none;
    box-shadow: 0 0 0 1.5px var(--panel), 0 0 0 2.5px var(--line-strong);
  }
  .lbl {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.72rem;
    flex: none;
  }
  .where {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .where.none {
    color: var(--mute);
    font-family: var(--font-ui);
  }
  .clear {
    display: grid;
    place-items: center;
    width: 1.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: none;
    color: var(--mute);
    cursor: pointer;
  }
  .clear:hover {
    color: var(--bad);
    border-color: var(--bad);
  }
</style>
