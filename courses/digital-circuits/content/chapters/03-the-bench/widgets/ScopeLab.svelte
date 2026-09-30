<!--
  Scope lab: a function generator wired to an oscilloscope. Change the waveform and frequency, then turn the
  trigger off to see why an untriggered display smears; set the timebase, volts per division, and read the
  signal with cursors. The scope's samples come from engine.watch() (see the "under the hood" box).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import Scope, { type ChannelView } from './Scope.svelte';
  import ScopeControls from './ScopeControls.svelte';
  import { netlist } from './flat';
  import { ScopeModel, readCursors, seq125, nearestIndex, type Cursors, type Slope, type TriggerMode } from './scope-model';
  import { ScopeRig, visibleLoop } from './scope-rig';

  let { title = 'Function generator and oscilloscope', n, trigger = 'off' }: { title?: string; n?: string; trigger?: TriggerMode } = $props();

  const TIMEBASES = seq125(-5, -1); // 10 µs … 100 ms per division
  const VDIVS = seq125(-1, 1); // 0.1 … 10 V per division

  let waveform = $state<'square' | 'sine' | 'triangle'>('square');
  let freq = $state(1000);
  let amp = $state(2.5);
  let offset = $state(2.5);
  let tbIndex = $state(nearestIndex(TIMEBASES, 5e-4));
  let vdIndex = $state(nearestIndex(VDIVS, 2));
  let trigMode = $state<TriggerMode>(untrack(() => trigger));
  let slope = $state<Slope>('rise');
  let level = $state(2.5);
  let running = $state(true);
  let cursors = $state<Cursors>({ on: false, t1: 2, t2: 4, v1: 0, v2: 5 });

  const model = new ScopeModel(1, TIMEBASES[untrack(() => tbIndex)]!, { mode: untrack(() => trigger), channel: 0, level: 2.5, position: 0.2 });
  let rig: ScopeRig | undefined;
  let scope: Scope | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let reduced = false;
  let statusText = $state('');

  const channels = $derived<ChannelView[]>([{ name: 'CH1', voltsPerDiv: VDIVS[vdIndex]!, position: -2, colour: 'high' }]);
  let lastSweepReadout = $state<ReturnType<typeof readCursors> | undefined>();

  // Rebuild the circuit when the signal's shape or the timebase changes (the engine's largest step depends on both).
  $effect(() => {
    const w = waveform;
    const f = freq;
    const tb = TIMEBASES[tbIndex]!;
    untrack(() => {
      rig?.dispose();
      const c = netlist();
      c.add('G', 'siggen', { '-': 'gnd', '+': 'sig' }, { waveform: w, frequency: f, amplitude: amp, offset });
      c.add('RL', 'resistor', { '1': 'sig', '2': 'gnd' }, { resistance: 1000 });
      model.timebase = tb;
      rig = new ScopeRig(c.build(), [c.net('sig')], model, { step: Math.min((tb * 10) / 250, 1 / (100 * f)) });
      model.restart(0);
      if (!running && !reduced) running = true;
    });
    return () => {
      rig?.dispose();
      rig = undefined;
    };
  });

  // Amplitude and offset change without rebuilding.
  $effect(() => {
    const a = amp;
    const o = offset;
    untrack(() => {
      rig?.setParam('G', 'amplitude', a);
      rig?.setParam('G', 'offset', o);
    });
  });

  // Trigger settings flow into the model.
  $effect(() => {
    const m = trigMode;
    const s = slope;
    const l = level;
    untrack(() => {
      const modeChanged = model.trigger.mode !== m;
      model.trigger.mode = m;
      model.trigger.slope = s;
      model.trigger.level = l;
      if (modeChanged && rig) {
        if (m === 'single') model.arm(rig.time);
        else model.restart(rig.time, true);
      }
    });
  });

  function arm() {
    if (rig) model.arm(rig.time);
    scope?.draw(null);
  }

  function frame(dt: number) {
    if (!rig) return;
    if (running) {
      rig.step(dt);
      if (reduced && model.sweeps.length >= 6) {
        running = false;
        statusText = 'Paused (reduced motion). Press Run to watch it move.';
      }
    }
    scope?.draw(running ? rig.partial() : null);
    lastSweepReadout = readCursors(cursors, model.timebase, model.last, 1);
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    return visibleLoop(root, frame);
  });

  const label = $derived(
    `Oscilloscope. Channel 1 shows a ${waveform} wave of ${formatSI(freq, 'Hz', 3)}, ${formatSI(offset - amp, 'V', 2)} to ${formatSI(offset + amp, 'V', 2)}. ` +
      `Timebase ${formatSI(TIMEBASES[tbIndex]!, 's', 2)} per division, ${formatSI(VDIVS[vdIndex]!, 'V', 2)} per division. Trigger ${trigMode}.`,
  );
</script>

<Widget {title} {n} kind="Lab bench" caption="Set the trigger to Off and watch the picture smear; then turn it on. Switch cursors on and read the period and the peak-to-peak voltage.">
  <div class="lab" bind:this={root}>
    <Scope bind:this={scope} {model} {channels} bind:cursors {label} onchange={() => {}} />
    {#if cursors.on && lastSweepReadout}
      <p class="read ui" aria-live="off">
        <span>Δt <b>{formatSI(lastSweepReadout.dt, 's', 3)}</b></span>
        <span>1/Δt <b>{Number.isFinite(lastSweepReadout.freq) ? formatSI(lastSweepReadout.freq, 'Hz', 3) : '–'}</b></span>
        <span>ΔV <b>{formatSI(lastSweepReadout.dv, 'V', 3)}</b></span>
      </p>
    {/if}
    {#if statusText}<p class="note ui" role="status">{statusText}</p>{/if}

    <div class="gen ui">
      <h5>Function generator</h5>
      <div class="gen-row">
        <Segmented
          size="sm"
          label="Waveform"
          bind:value={waveform}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'sine', label: 'Sine' },
            { value: 'triangle', label: 'Triangle' },
          ]}
        />
      </div>
      <div class="gen-sliders">
        <Slider label="Frequency" min={20} max={50000} log bind:value={freq} format={(v) => formatSI(v, 'Hz', 3)} />
        <Slider label="Amplitude (peak)" min={0.2} max={5} step={0.05} bind:value={amp} format={(v) => formatSI(v, 'V', 3)} />
        <Slider label="Offset" min={-3} max={5} step={0.05} bind:value={offset} format={(v) => formatSI(v, 'V', 3)} />
      </div>
    </div>

    <ScopeControls timebases={TIMEBASES} bind:tbIndex vdivs={VDIVS} bind:vdIndex bind:trigMode bind:slope bind:level levelRange={[-8, 8]} bind:cursors vRange={[-8, 8]} bind:running onarm={arm} />
  </div>
</Widget>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .read {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .read b {
    color: var(--fg);
    font-weight: 600;
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .gen {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
  .gen h5 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-mono) !important;
    font-size: 0.66rem !important;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
    font-weight: 500 !important;
  }
  .gen h5::before,
  .gen h5::after {
    display: none !important;
  }
  .gen-sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
    gap: 0.5rem 1.4rem;
  }
</style>
