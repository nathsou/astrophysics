<!--
  Switch bounce and RC debouncing. A real pushbutton's contacts bounce for a millisecond or several before they settle.
  Arm the scope in single-shot mode (the Press and Release buttons do it for you), press, and see what a logic input
  would see on the raw line and after an RC filter. The pushbutton model here has `bounce: true`; see the bounce
  generator in src/lib/sim/analog/models/switches.ts.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { formatSI } from '$lib/bench/format';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import Scope, { type ChannelView } from '../../03-the-bench/widgets/Scope.svelte';
  import ScopeControls from '../../03-the-bench/widgets/ScopeControls.svelte';
  import { netlist } from '../../03-the-bench/widgets/flat';
  import { ScopeModel, countEdges, seq125, nearestIndex, type Cursors } from '../../03-the-bench/widgets/scope-model';
  import { ScopeRig, visibleLoop } from '../../03-the-bench/widgets/scope-rig';
  import { nb } from './rc';

  let { n }: { n?: string } = $props();

  const TB = seq125(-5, -1);
  const RF = 10000;
  let C = $state(1e-6);
  let tbIndex = $state(nearestIndex(TB, 2e-3));
  let running = $state(true);
  let cursors = $state<Cursors>({ on: false, t1: 2, t2: 4, v1: 0, v2: 5 });
  let scope: Scope | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let reduced = false;
  let held = $state(false);
  let seen = $state<{ raw: number; filtered: number; what: 'press' | 'release' } | null>(null);
  let pressed = $state(false);

  const model = new ScopeModel(2, TB[untrack(() => tbIndex)]!, { mode: 'single', channel: 0, slope: 'fall', level: 2.5, position: 0.1 });
  let rig: ScopeRig | undefined;
  const channels: ChannelView[] = [
    { name: 'CH1', voltsPerDiv: 1, position: -3, colour: 'high' },
    { name: 'CH2', voltsPerDiv: 1, position: -3, colour: 'phosphor' },
  ];

  $effect(() => {
    const c = C;
    const i = tbIndex;
    untrack(() => {
      rig?.dispose();
      const tb = TB[i]!;
      const ckt = netlist();
      ckt.add('VCC', 'rail', { v: 'vcc' }, { voltage: 5 });
      ckt.add('RP', 'resistor', { '1': 'vcc', '2': 'raw' }, { resistance: 1000 });
      ckt.add('SW', 'pushbutton', { '1': 'raw', '2': 'gnd' }, { pressed: false, bounce: true });
      ckt.add('RF', 'resistor', { '1': 'raw', '2': 'flt' }, { resistance: RF });
      ckt.add('CF', 'capacitor', { '1': 'flt', '2': 'gnd' }, { capacitance: c, initial: 5 });
      model.timebase = tb;
      rig = new ScopeRig(ckt.build(), [ckt.net('raw'), ckt.net('flt')], model, { step: Math.min((tb * 10) / 250, (RF * c) / 5, 2e-4) });
      pressed = false;
      model.trigger.slope = 'fall';
      model.arm(0);
      seen = null;
      held = false;
      if (!running && !reduced) running = true;
    });
    return () => {
      rig?.dispose();
      rig = undefined;
    };
  });

  function act(press: boolean) {
    if (!rig) return;
    running = true;
    model.arm(rig.time, press ? 'fall' : 'rise');
    seen = null;
    held = false;
    pressed = press;
    rig.setParam('SW', 'pressed', press);
  }

  function frame(dt: number) {
    if (!rig) return;
    if (running) rig.step(dt);
    scope?.draw(running ? rig.partial() : null);
    const sw = model.last;
    if (sw && !held && !model.armed) {
      held = true;
      // A logic input sees a Schmitt trigger: it switches at about 1.5 V and 3.5 V.
      seen = { raw: Math.ceil(countEdges(sw.raw, 0, 1.5, 3.5) / 2), filtered: Math.ceil(countEdges(sw.raw, 1, 1.5, 3.5) / 2), what: pressed ? 'press' : 'release' };
    }
  }
  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    return visibleLoop(root, frame);
  });

  const tauNow = $derived(RF * C);
  const label = $derived(`Oscilloscope in single-shot mode. Channel 1 is the raw switch line; channel 2 is the same line after a ${nb(formatSI(RF, 'Ω', 2))} and ${nb(formatSI(C, 'F', 2))} filter.`);
</script>

<Widget title="Switch bounce" {n} kind="Lab bench" caption="Press the button and see the bounce captured by a single-shot trigger. Press it a few times: no two bounces are alike. Then make the filter capacitor smaller and see when it stops working.">
  <div class="lab" bind:this={root}>
    <Scope bind:this={scope} {model} {channels} bind:cursors cursorChannel={0} {label} />
    <div class="act ui">
      <Button variant="primary" onclick={() => act(true)} title="Arm the scope and press the switch">Press</Button>
      <Button onclick={() => act(false)} title="Arm the scope on a rising edge and release the switch">Release</Button>
      <span class="state" aria-live="polite">switch is {pressed ? 'pressed' : 'released'}</span>
    </div>
    {#if seen}
      <div class="seen ui" role="status">
        <div class="cell bad"><span class="k">a logic input on the raw line sees</span><span class="n">{seen.raw} {seen.what}{seen.raw === 1 ? '' : 'es'}</span></div>
        <div class="cell" class:ok={seen.filtered === 1}>
          <span class="k">after the RC filter (τ = {nb(formatSI(tauNow, 's', 2))})</span>
          <span class="n">{seen.filtered} {seen.what}{seen.filtered === 1 ? '' : 'es'}</span>
        </div>
      </div>
      {#if seen.filtered === 0}<p class="note ui">The filtered line has not crossed the threshold within this window: it is slower than the sweep. Try a longer timebase.</p>{/if}
    {:else}
      <p class="note ui">The scope is armed, waiting for the line to fall. Press the button.</p>
    {/if}
    <div class="parts ui">
      <Slider label="Filter capacitor (with 10 kΩ)" min={10e-9} max={10e-6} log bind:value={C} format={(v) => nb(formatSI(v, 'F', 3))} />
    </div>
    <ScopeControls timebases={TB} bind:tbIndex showVolts={false} showTrigger={false} showCursors={false} showRun={false} bind:running />
  </div>
</Widget>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .act {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .state {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .seen {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .cell {
    flex: 1 1 14rem;
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
  }
  .cell.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .cell.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--fg);
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--mute);
  }
  .parts {
    border-top: 1px solid var(--line);
    padding-top: 0.6rem;
    max-width: 24rem;
  }
</style>
