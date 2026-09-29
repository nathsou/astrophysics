<!--
  The multimeter. Volts between two probed nets (the black probe defaults to ground), amps into a
  component pin, ohms between two nets (measured with a small test source on a copy of the circuit, so
  only when the simulation is not running), and continuity. Readings auto-range on a four-digit display.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import Glyph from '../editor/Glyph.svelte';
  import { layoutOf } from '../editor/layout';
  import { flatten } from '../../sim/netlist/flatten';
  import { createEngine } from '../engines';
  import type { Bench } from '../editor/bench.svelte';
  import type { Instrument, MultimeterConfig } from './kinds';
  import { autorange, CONTINUITY_OHMS, measureResistance, readoutText, type ResistanceResult } from './meter';
  import { probeNet } from './probes';
  import ProbeButton from './ProbeButton.svelte';
  import SevenSeg from './SevenSeg.svelte';

  let { bench, inst }: { bench: Bench; inst: Instrument } = $props();
  const cfg = $derived(inst.config as MultimeterConfig);

  let value = $state(NaN);
  let note = $state('');
  let ohm = $state.raw<ResistanceResult | null>(null);
  let measuring = $state(false);

  const mode = $derived(cfg.mode);
  const unit = $derived(mode === 'V' ? 'V' : mode === 'A' ? 'A' : 'Ω');
  const reading = $derived(mode === 'cont' ? autorange(ohm ? ohm.ohms : NaN, 'Ω') : autorange(mode === 'ohm' ? (ohm ? ohm.ohms : NaN) : value, unit));
  const closed = $derived(mode === 'cont' && !!ohm && ohm.ohms < CONTINUITY_OHMS);
  const running = $derived(bench.sim === 'running');

  /** Read the live value (V and A) from the engine. */
  function read() {
    const e = bench.engine;
    const conn = bench.conn;
    if (!e || !conn || (mode !== 'V' && mode !== 'A')) {
      if (!Number.isNaN(value)) value = NaN;
      return;
    }
    let v = NaN;
    if (mode === 'V') {
      const plus = probeNet(cfg.plus, bench.circuit, conn);
      const minus = cfg.minus ? probeNet(cfg.minus, bench.circuit, conn) : undefined;
      if (plus !== undefined && (!cfg.minus || minus !== undefined)) {
        v = e.voltage(bench.engineNet(plus)) - (minus === undefined ? 0 : e.voltage(bench.engineNet(minus)));
      }
    } else if (cfg.pin && 'pin' in cfg.pin) {
      const dot = cfg.pin.pin.indexOf('.');
      const l = layoutOf(bench.circuit).byId.get(cfg.pin.pin.slice(0, dot));
      const p = l?.pins.find((x) => x.pin === (cfg.pin as { pin: string }).pin.slice(dot + 1));
      if (l && p) v = e.current(l.c.id, p.index);
    }
    if (v !== value && !(Number.isNaN(v) && Number.isNaN(value))) value = v;
  }

  onMount(() => bench.onFrame(read));

  // Ohms and continuity: measured on demand, whenever the probes or the circuit change and nothing is running.
  let token = 0;
  async function measure() {
    const conn = bench.conn;
    ohm = null;
    note = '';
    const a = conn ? probeNet(cfg.plus, bench.circuit, conn) : undefined;
    const b = conn ? probeNet(cfg.minus, bench.circuit, conn) : undefined;
    if (!conn || a === undefined || b === undefined) {
      note = 'Attach both probes.';
      return;
    }
    if (bench.sim === 'running') {
      note = 'Pause or stop the simulation to measure resistance.';
      return;
    }
    const mine = ++token;
    measuring = true;
    try {
      const r = await measureResistance(flatten(bench.circuit), a, b, (nl) => createEngine('analog', nl));
      if (mine !== token) return;
      ohm = r;
      note = r.nonlinear ? 'Diodes and transistors read differently at other voltages.' : '';
    } catch (e) {
      if (mine === token) note = e instanceof Error ? e.message : String(e);
    } finally {
      if (mine === token) measuring = false;
    }
  }
  $effect(() => {
    void [mode, cfg.plus, cfg.minus, bench.circuit, running];
    if (mode !== 'ohm' && mode !== 'cont') return;
    untrack(() => void measure());
  });
</script>

<div class="dmm">
  <div class="lcd screen" role="group" aria-label="Multimeter display">
    <div class="top">
      <span class="mode">{mode === 'V' ? 'V  DC' : mode === 'A' ? 'A  DC' : mode === 'ohm' ? 'Ω' : 'CONT'}</span>
      {#if mode === 'cont'}
        <span class="beep" class:on={closed} title="A beeper would sound here (sound is off)"><Glyph name="wave" size={14} />{closed ? 'CLOSED' : 'OPEN'}</span>
      {/if}
    </div>
    <div class="digits" role="status" aria-live="off" aria-label={readoutText(reading)}>
      <SevenSeg text={mode === 'cont' && !ohm ? '----' : reading.text} cells={6} height={54} />
      <span class="unit">{reading.prefix}{unit}</span>
    </div>
    {#if measuring}<div class="busy">measuring…</div>{/if}
  </div>

  <Segmented
    size="sm"
    label="Measurement"
    options={[
      { value: 'V', label: 'V', title: 'Volts' },
      { value: 'A', label: 'A', title: 'Amps into a pin' },
      { value: 'ohm', label: 'Ω', title: 'Ohms (simulation not running)' },
      { value: 'cont', label: 'Cont.', title: 'Continuity' },
    ]}
    bind:value={cfg.mode}
  />

  <div class="probes">
    {#if mode === 'A'}
      <ProbeButton {bench} label="A" value={cfg.pin} pinsOnly colour="--copper" empty="pick a component pin" onpick={(r) => (cfg.pin = r)} />
      <p class="help">Current flowing <em>into</em> the pin (negative: out of it).</p>
    {:else}
      <ProbeButton {bench} label="+" value={cfg.plus} colour="--sig-x" onpick={(r) => (cfg.plus = r)} />
      <ProbeButton {bench} label="−" value={cfg.minus} colour="--fg" empty={mode === 'V' ? 'ground' : 'not attached'} onpick={(r) => (cfg.minus = r)} />
      {#if mode === 'V'}<p class="help">Without a − probe the reading is relative to ground.</p>{/if}
    {/if}
    {#if note}<p class="note">{note}</p>{/if}
  </div>
</div>

<style>
  .dmm {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .lcd {
    position: relative;
    padding: 0.5rem 0.8rem 0.65rem;
    border-radius: 8px;
    background: var(--scope-bg);
    border: 1px solid color-mix(in srgb, var(--line-strong) 60%, black);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.5);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 1.1rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    color: var(--phosphor);
    opacity: 0.85;
  }
  .beep {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    opacity: 0.55;
  }
  .beep.on {
    opacity: 1;
    color: var(--sig-high);
    text-shadow: 0 0 6px var(--sig-high-glow);
  }
  .digits {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.15rem;
  }
  .unit {
    min-width: 2.3rem;
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--phosphor);
    text-shadow: 0 0 8px var(--phosphor-glow);
    padding-bottom: 0.25rem;
  }
  .busy {
    position: absolute;
    left: 0.8rem;
    bottom: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--phosphor);
    opacity: 0.7;
  }
  .probes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .help,
  .note {
    margin: 0;
    font-size: 0.74rem;
    color: var(--mute);
    line-height: 1.4;
  }
  .note {
    color: var(--maybe);
  }
</style>
