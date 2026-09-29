<!--
  The slow pull-up edge. An open-drain output can only pull the wire down; a pull-up resistor must pull it up,
  through the wire's capacitance, so the rising edge is an exponential with τ = R × C while the falling edge is fast.
  This is why I²C bus speeds are limited by the pull-up resistor and the bus capacitance. Compare with a push-pull
  (CMOS) driver, which pushes as well as pulls.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import Scope, { type ChannelView } from '../../03-the-bench/widgets/Scope.svelte';
  import ScopeControls from '../../03-the-bench/widgets/ScopeControls.svelte';
  import { netlist } from '../../03-the-bench/widgets/flat';
  import { ScopeModel, riseTime, seq125, nearestIndex, type Cursors } from '../../03-the-bench/widgets/scope-model';
  import { ScopeRig, visibleLoop } from '../../03-the-bench/widgets/scope-rig';
  import { autosetIndex, nb, pullupRise } from './rc';

  let { n }: { n?: string } = $props();

  const TB = seq125(-8, -4); // 10 ns … 100 µs per division
  let R = $state(4700);
  let C = $state(100e-12);
  let driver = $state<'open-drain' | 'push-pull'>('open-drain');
  let tbIndex = $state(nearestIndex(TB, 5e-7));
  let running = $state(true);
  let cursors = $state<Cursors>({ on: false, t1: 2, t2: 4, v1: 1.5, v2: 3.5 });
  let scope: Scope | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let reduced = false;
  let statusText = $state('');
  let measured = $state<number | null>(null);

  const model = new ScopeModel(2, TB[untrack(() => tbIndex)]!, { mode: 'auto', channel: 0, slope: 'fall', level: 2.5, position: 0.1 });
  let rig: ScopeRig | undefined;
  let prevTb = -1;
  const channels: ChannelView[] = [
    { name: 'CH1', voltsPerDiv: 1, position: -3, colour: 'high' },
    { name: 'CH2', voltsPerDiv: 1, position: -3, colour: 'phosphor' },
  ];

  $effect(() => {
    const r = R;
    const c = C;
    const d = driver;
    const i = tbIndex;
    untrack(() => {
      rig?.dispose();
      const tb = TB[i]!;
      const ckt = netlist();
      ckt.add('VCC', 'rail', { v: 'vcc' }, { voltage: 5 });
      ckt.add('G', 'siggen', { '-': 'gnd', '+': 'gate' }, { waveform: 'square', frequency: 1 / (10 * tb), amplitude: 2.5, offset: 2.5, rise: Math.max(1e-12, tb / 2000) });
      ckt.add('MN', 'nmos', { G: 'gate', D: 'bus', S: 'gnd' });
      if (d === 'open-drain') ckt.add('RP', 'resistor', { '1': 'vcc', '2': 'bus' }, { resistance: r });
      else ckt.add('MP', 'pmos', { G: 'gate', S: 'vcc', D: 'bus' });
      ckt.add('CB', 'capacitor', { '1': 'bus', '2': 'gnd' }, { capacitance: c });
      model.timebase = tb;
      rig = new ScopeRig(ckt.build(), [ckt.net('gate'), ckt.net('bus')], model, { step: Math.min((tb * 10) / 250, (r * c) / 5) });
      model.restart(0, i === prevTb);
      prevTb = i;
      measured = null;
      if (!running && !reduced) running = true;
    });
    return () => {
      rig?.dispose();
      rig = undefined;
    };
  });

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
    const sw = model.last;
    measured = sw ? riseTime(sw.raw, 1, 1.5, 3.5) : null;
  }
  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    return visibleLoop(root, frame);
  });

  const predicted = $derived(pullupRise(R, C));
  const modes = $derived([
    { name: 'Standard mode, 100 kHz', limit: 1000e-9 },
    { name: 'Fast mode, 400 kHz', limit: 300e-9 },
    { name: 'Fast-mode Plus, 1 MHz', limit: 120e-9 },
  ]);
  const shown = $derived(measured ?? predicted);
  const label = $derived(`Oscilloscope. Channel 1 is the driver's input, channel 2 is the bus wire. ${driver === 'open-drain' ? `The wire rises slowly through a ${nb(formatSI(R, 'Ω', 2))} pull-up into ${nb(formatSI(C, 'F', 2))}.` : 'A push-pull driver pushes the wire up quickly.'}`);
</script>

<Widget title="The slow pull-up edge" {n} kind="Lab bench" caption="An open-drain driver pulls the bus low fast but relies on the pull-up to bring it high. Raise the pull-up resistance or the bus capacitance and watch the rising edge lose its shape; compare the push-pull driver.">
  <div class="lab" bind:this={root}>
    <Scope bind:this={scope} {model} {channels} bind:cursors cursorChannel={1} {label} />
    {#if statusText}<p class="note ui" role="status">{statusText}</p>{/if}
    <div class="parts ui">
      <Segmented
        size="sm"
        label="Driver"
        bind:value={driver}
        options={[
          { value: 'open-drain', label: 'Open-drain + pull-up', title: 'The output can only pull down; a resistor pulls up (I²C, 1-Wire)' },
          { value: 'push-pull', label: 'Push-pull', title: 'A CMOS output: a transistor pulls up as well as down' },
        ]}
      />
      {#if driver === 'open-drain'}
        <Slider label="Pull-up resistor" min={500} max={100000} log bind:value={R} format={(v) => nb(formatSI(v, 'Ω', 3))} />
      {/if}
      <Slider label="Bus capacitance" min={10e-12} max={1e-9} log bind:value={C} format={(v) => nb(formatSI(v, 'F', 3))} />
    </div>
    <div class="rise ui">
      <div class="big">
        <span class="k">rise time, 30 → 70 %{measured === null ? ' (predicted)' : ''}</span>
        <span class="n">{nb(formatSI(shown, 's', 3))}</span>
        {#if driver === 'open-drain'}<span class="k">0.85 × R × C = {nb(formatSI(predicted, 's', 3))}</span>{/if}
      </div>
      <ul class="modes">
        {#each modes as m (m.name)}
          <li class:ok={shown <= m.limit}>
            <span class="tag">{shown <= m.limit ? 'meets' : 'too slow for'}</span>
            {m.name} <span class="lim">(max {nb(formatSI(m.limit, 's', 2))})</span>
          </li>
        {/each}
      </ul>
    </div>
    <ScopeControls timebases={TB} bind:tbIndex showVolts={false} showTrigger={false} bind:cursors vRange={[-2, 6]} bind:running onautoset={() => (tbIndex = autosetIndex(TB, R * C))} />
  </div>
</Widget>

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .parts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem 1.6rem;
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
    align-items: end;
  }
  .rise {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.6rem;
    align-items: center;
  }
  .big {
    display: flex;
    flex-direction: column;
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--fg);
  }
  .modes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .tag {
    display: inline-block;
    min-width: 6.4em;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--bad);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  li.ok .tag {
    color: var(--ok);
  }
  .lim {
    color: var(--mute);
    font-size: 0.78rem;
  }
</style>
