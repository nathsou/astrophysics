<!--
  RC lab: a function generator's square wave drives a resistor into a capacitor, and a two-channel scope shows both
  (CH1 the generator, CH2 the capacitor). Drag R and C, use the cursors to read the time constant, and check it
  against R × C. With preset="wire" it becomes Chapter 4's wire-delay figure: a logic output's resistance driving the
  capacitance of a wire, with time in nanoseconds (the engine simulates a circuit a million times slower and the
  scope scales the axis, see scope-rig.ts).
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
  import { ScopeModel, readCursors, seq125, nearestIndex, type Cursors } from '../../03-the-bench/widgets/scope-model';
  import { ScopeRig, visibleLoop } from '../../03-the-bench/widgets/scope-rig';
  import { autosetIndex, checkTau, nb, tau, wireMetrics, type TauCheck } from './rc';

  let { preset = 'lab', n }: { preset?: 'lab' | 'wire'; n?: string } = $props();

  const wire = untrack(() => preset === 'wire');
  const CFG = wire
    ? { title: 'A wire is a capacitor', kind: 'Lab bench', k: 1e6, tb: seq125(-11, -6), tb0: 1e-9, R: [10, 1000], R0: 50, C: [1e-12, 1e-9], C0: 10e-12, rLabel: 'Output resistance', cLabel: 'Wire and input capacitance', vdd: 5 }
    : { title: 'RC lab', kind: 'Lab bench', k: 1, tb: seq125(-6, 0), tb0: 1e-3, R: [100, 1e5], R0: 1000, C: [1e-8, 1e-4], C0: 1e-6, rLabel: 'Resistor R', cLabel: 'Capacitor C', vdd: 5 };
  const TB = CFG.tb;
  const K = CFG.k;

  let R = $state(CFG.R0);
  let C = $state(CFG.C0);
  let tbIndex = $state(nearestIndex(TB, CFG.tb0));
  let running = $state(true);
  let cursors = $state<Cursors>({ on: true, t1: 1, t2: 3, v1: 0, v2: 5 });
  let check = $state<TauCheck | null>(null);
  let statusText = $state('');
  let scope: Scope | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let reduced = false;
  let lastReadout = $state<ReturnType<typeof readCursors> | undefined>();

  const model = new ScopeModel(2, TB[untrack(() => tbIndex)]!, { mode: 'auto', channel: 0, slope: 'rise', level: 2.5, position: 0.1 });
  let rig: ScopeRig | undefined;
  let prevTb = -1;

  const channels = $derived<ChannelView[]>([
    { name: 'CH1', voltsPerDiv: 1, position: -3, colour: 'high' },
    { name: 'CH2', voltsPerDiv: 1, position: -3, colour: 'phosphor' },
  ]);

  // (Re)build the circuit whenever R, C or the timebase changes. The old picture stays until a new sweep arrives.
  $effect(() => {
    const r = R;
    const c = C;
    const i = tbIndex;
    untrack(() => {
      rig?.dispose();
      const tb = TB[i]!;
      const ckt = netlist();
      ckt.add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 1 / (10 * tb * K), amplitude: 2.5, offset: 2.5, rise: Math.max(1e-12, (tb * K) / 2000) });
      ckt.add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: r });
      ckt.add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: c * K });
      model.timebase = tb;
      rig = new ScopeRig(ckt.build(), [ckt.net('in'), ckt.net('out')], model, { timeScale: K, step: Math.min((tb * K * 10) / 250, (r * c * K) / 5) });
      model.restart(0, i === prevTb);
      prevTb = i;
      check = null;
      if (!running && !reduced) running = true;
    });
    return () => {
      rig?.dispose();
      rig = undefined;
    };
  });

  const edgeDiv = 1; // the trigger point: 10 % of ten divisions

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
    lastReadout = readCursors(cursors, model.timebase, model.last, 2);
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    return visibleLoop(root, frame);
  });

  function autoset() {
    tbIndex = autosetIndex(TB, tau(R, C));
  }
  function doCheck() {
    const ro = readCursors(cursors, model.timebase, model.last, 2);
    const t1 = Math.min(cursors.t1, cursors.t2);
    const t2 = Math.max(cursors.t1, cursors.t2);
    const sw = model.last;
    if (!sw) {
      check = { ok: false, text: 'Wait for the trace to appear first.' };
      return;
    }
    const swap = cursors.t1 > cursors.t2;
    check = checkTau({ dt: ro.dt, v1: swap ? ro.at2[1]! : ro.at1[1]!, v2: swap ? ro.at1[1]! : ro.at2[1]!, vs: 5, t1Div: t1, edgeDiv, R, C });
    void t2;
  }

  const tauNow = $derived(tau(R, C));
  const wm = $derived(wireMetrics(R, C, CFG.vdd));
  const fShown = $derived(1 / (10 * TB[tbIndex]!));
  const label = $derived(
    `Oscilloscope with two channels. Channel 1 is a 0 to 5 volt square wave; channel 2 is the voltage across a ${nb(formatSI(C, 'F', 2))} capacitor charged through ${nb(formatSI(R, 'Ω', 2))}. ${nb(formatSI(TB[tbIndex]!, 's', 2))} per division.`,
  );
</script>

<Widget title={CFG.title} {n} kind={CFG.kind} caption={wire ? 'Drag the output resistance and the capacitance. The edge that reaches the far end of the wire is never square: it is an exponential with τ = R × C.' : 'Drag R and C, press Autoset, then place T1 on the rising edge and T2 where the capacitor has closed 63 % of the gap. Δt is τ.'}>
  <div class="lab" bind:this={root}>
    <Scope bind:this={scope} {model} {channels} bind:cursors cursorChannel={1} {label} />
    {#if cursors.on && lastReadout}
      <p class="read ui">
        <span>Δt <b>{nb(formatSI(lastReadout.dt, 's', 3))}</b></span>
        <span class="c2">CH2 at T1 <b>{nb(formatSI(lastReadout.at1[1]!, 'V', 3))}</b></span>
        <span class="c2">CH2 at T2 <b>{nb(formatSI(lastReadout.at2[1]!, 'V', 3))}</b></span>
        <span
          >gap closed <b
            >{Number.isFinite(lastReadout.at1[1]) ? Math.round(((lastReadout.at2[1]! - lastReadout.at1[1]!) / (5 - lastReadout.at1[1]!)) * 100) : '–'} %</b
          ></span
        >
      </p>
    {/if}
    {#if statusText}<p class="note ui" role="status">{statusText}</p>{/if}

    <div class="parts ui">
      <Slider label={CFG.rLabel} min={CFG.R[0]!} max={CFG.R[1]!} log bind:value={R} format={(v) => nb(formatSI(v, 'Ω', 3))} />
      <Slider label={CFG.cLabel} min={CFG.C[0]!} max={CFG.C[1]!} log bind:value={C} format={(v) => nb(formatSI(v, 'F', 3))} />
    </div>

    {#if wire}
      <dl class="metrics ui">
        <div><dt>τ = R × C</dt><dd>{nb(formatSI(wm.tau, 's', 3))}</dd></div>
        <div><dt>10–90 % rise time (2.2 τ)</dt><dd>{nb(formatSI(wm.rise, 's', 3))}</dd></div>
        <div><dt>delay to 50 % (0.69 τ)</dt><dd>{nb(formatSI(wm.delay, 's', 3))}</dd></div>
        <div><dt>fastest clock (period 10 τ)</dt><dd>{nb(formatSI(wm.fmax, 'Hz', 3))}</dd></div>
        <div><dt>energy per cycle (C V²)</dt><dd>{nb(formatSI(wm.energy, 'J', 3))}</dd></div>
        <div><dt>power at the clock shown ({nb(formatSI(fShown, 'Hz', 2))})</dt><dd>{nb(formatSI(wm.power(fShown), 'W', 3))}</dd></div>
      </dl>
    {:else}
      <div class="check ui">
        <Button variant="primary" size="sm" onclick={doCheck}>Check my τ against R × C</Button>
        {#if check}<p class="verdict" class:ok={check.ok} role="status">{check.text}</p>{/if}
      </div>
    {/if}

    <ScopeControls
      timebases={TB}
      bind:tbIndex
      showVolts={false}
      showTrigger={false}
      bind:cursors
      vRange={[-2, 6]}
      bind:running
      onautoset={autoset}
    />
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
    gap: 0.3rem 1.3rem;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .read b {
    color: var(--fg);
    font-weight: 600;
  }
  .read .c2 b {
    color: var(--phosphor-ink);
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .parts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.4rem 1.6rem;
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0;
  }
  .metrics div {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
  }
  dt {
    font-size: 0.72rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 1.05rem;
    color: var(--fg);
  }
  .check {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  .verdict {
    margin: 0;
    padding: 0.5rem 0.7rem;
    font-size: 0.86rem;
    line-height: 1.5;
    border-left: 3px solid var(--bad);
    background: var(--bad-soft);
    border-radius: 0 5px 5px 0;
  }
  .verdict.ok {
    border-left-color: var(--ok);
    background: var(--ok-soft);
  }
</style>
