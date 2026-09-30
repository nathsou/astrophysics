<!--
  A flash cell. Electrons are pushed onto a floating gate a little at a time (each programming pulse raises the
  threshold voltage Vt by a step, and the cell is checked after every pulse); erasing takes them all off at once.
  Reading compares Vt with reference voltages. Choose one to four bits per cell and watch the windows shrink.
  The model is flash.ts (tested).

    ::flash-cell{n="20.7" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { FLASH, KINDS, levelsFor, margin, program, readLevel, references, stepFor, windows, wobble } from './flash';

  let { bits: firstBits = 2, n: fig, caption }: { bits?: number; n?: string | number; caption?: string } = $props();

  let bits = $state(untrack(() => firstBits));
  let target = $state(untrack(() => (1 << firstBits) - 2));
  let vt = $state<number>(FLASH.erased);
  let trace = $state.raw<number[]>([FLASH.erased]);
  let pulse = $state(0);
  let running = $state(false);
  let message = $state('The cell is erased: its Vt is the lowest of all.');
  let cycles = $state(0);
  let plan = $state.raw<number[]>([]);
  let root: HTMLElement | undefined = $state();
  let visible = true;
  let reduced = false;

  const levels = $derived(levelsFor(bits));
  const wins = $derived(windows(bits));
  const refs = $derived(references(bits));
  const kind = $derived(KINDS.find((k) => k.bits === bits)!);
  const binary = (l: number) => l.toString(2).padStart(bits, '0');

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  });

  $effect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (!visible) return;
      if (pulse < plan.length - 1) {
        pulse++;
        vt = plan[pulse]!;
        trace = plan.slice(0, pulse + 1);
        message = `Pulse ${pulse}: Vt = ${vt.toFixed(2)} V, ${vt < wins[target]!.lo ? `below the window of ${binary(target)} (${wins[target]!.lo.toFixed(2)} V): another pulse` : 'inside the window: verify passes, stop'}.`;
      } else {
        running = false;
        cycles = cycles;
      }
    }, 220);
    return () => clearInterval(id);
  });

  function setBits(b: number) {
    bits = b;
    target = Math.min(target, levelsFor(b) - 1);
    erase(false);
  }
  function erase(count = true) {
    running = false;
    vt = FLASH.erased;
    trace = [FLASH.erased];
    pulse = 0;
    if (count) cycles++;
    message = count ? `Erased (program/erase cycle ${cycles}): a high voltage on the substrate pulls every electron off the floating gate at once.` : 'The cell is erased: its Vt is the lowest of all.';
  }
  function doProgram() {
    if (vt > wins[target]!.hi) {
      message = `Vt is already above the window of ${binary(target)} (${vt.toFixed(2)} V): programming can only raise it. Erase first.`;
      return;
    }
    const p = program(vt, target, bits, wobble);
    plan = p.trace;
    pulse = 0;
    trace = [vt];
    if (p.pulses === 0) {
      message = `Already in the window of ${binary(target)}: no pulse needed.`;
      return;
    }
    if (reduced) {
      vt = p.vt;
      trace = p.trace;
      pulse = p.pulses;
      message = `${p.pulses} pulses of about ${stepFor(bits).toFixed(2)} V, each followed by a check, brought Vt to ${vt.toFixed(2)} V.`;
    } else running = true;
  }
  const readout = $derived.by(() => {
    const steps = refs.map((r) => ({ ref: r, conducts: vt < r }));
    return { steps, level: readLevel(vt, bits) };
  });

  const VMIN = -2.6;
  const VMAX = 5.6;
  const W = 400;
  const X0 = 14;
  const px = (v: number) => X0 + ((v - VMIN) / (VMAX - VMIN)) * (W - 2 * X0);
  const CH = 110;
  /** Row of pulse number i in the staircase below the axis. */
  const py = (i: number, steps: number) => 122 + (i / Math.max(1, steps)) * 66;
</script>

<Widget title="A flash cell" n={fig} {caption} kind="Interactive" onreset={() => { setBits(firstBits); cycles = 0; }}>
  {#snippet controls()}
    <Segmented size="sm" label="Bits per cell" value={bits} onchange={setBits} options={KINDS.map((k) => ({ value: k.bits, label: `${k.name} · ${k.bits} bit${k.bits > 1 ? 's' : ''}` }))} />
    <Segmented size="sm" label="Value to store" value={target} onchange={(v) => (target = v)} options={Array.from({ length: levels }, (_, l) => ({ value: l, label: binary(l) }))} />
  {/snippet}

  <div class="fc ui" bind:this={root}>
    <div class="acts">
      <Button size="sm" variant="primary" onclick={doProgram} disabled={running}>Program {binary(target)}</Button>
      <Button size="sm" onclick={() => erase()} disabled={running}>Erase</Button>
      <span class="rd"><Button size="sm" onclick={() => (message = `Read: Vt = ${vt.toFixed(2)} V. ${readout.steps.map((s) => `${s.ref.toFixed(2)} V: ${s.conducts ? 'conducts' : 'does not'}`).join('; ')} → level ${binary(readout.level)}.`)} disabled={running}>Read</Button></span>
    </div>

    <svg class="axis" viewBox="0 0 {W} {CH + 86}" role="img" aria-label="Threshold voltage axis from {VMIN} to {VMAX} volts with {levels} windows. The cell's Vt is {vt.toFixed(2)} V and it reads as {binary(readout.level)}.">
      {#each wins as w (w.level)}
        <rect class="win" class:t={w.level === target} class:got={w.level === readout.level} x={px(w.lo)} y="14" width={px(w.hi) - px(w.lo)} height="40" rx="3" />
        <text class="wl" x={(px(w.lo) + px(w.hi)) / 2} y="38" text-anchor="middle">{binary(w.level)}</text>
      {/each}
      {#each refs as r (r)}
        <line class="ref" x1={px(r)} y1="8" x2={px(r)} y2="60" />
      {/each}
      <line class="ax" x1={X0} y1="60" x2={W - X0} y2="60" />
      {#each [-2, 0, 2, 4] as v (v)}
        <line class="ax" x1={px(v)} y1="60" x2={px(v)} y2="65" /><text class="tk" x={px(v)} y="88" text-anchor="middle">{v} V</text>
      {/each}
      <!-- The cell -->
      <path class="mark" d="M{px(vt)} 61 l-6 12 h12 z" />
      <text class="vt" x={Math.max(60, Math.min(W - 60, px(vt)))} y="108" text-anchor="middle">Vt = {vt.toFixed(2)} V</text>
      <!-- Vt against pulse number -->
      <text class="tk" x={X0} y="120">pulses ↓</text>
      {#if trace.length > 1}
        <polyline class="stair" points={trace.map((v, i) => `${px(v)},${py(i, Math.max(trace.length - 1, 8))}`).join(' ')} />
      {/if}
    </svg>

    <p class="msg" role="status" aria-live="polite">{message}</p>
    <dl class="nums">
      <div><dt>levels</dt><dd>{levels} ({kind.name})</dd></div>
      <div><dt>margin between windows</dt><dd>{margin(bits) === Infinity ? '–' : `${margin(bits).toFixed(2)} V`}</dd></div>
      <div><dt>pulse size</dt><dd>{stepFor(bits).toFixed(2)} V</dd></div>
      <div><dt>references to read it</dt><dd>{refs.length}</dd></div>
      <div><dt>typical endurance</dt><dd>~{kind.endurance.toLocaleString('en-GB')} erase cycles</dd></div>
      <div><dt>erase cycles so far</dt><dd>{cycles}</dd></div>
    </dl>
  </div>
</Widget>

<style>
  .fc {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
    min-width: 0;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
  }
  .axis {
    width: 100%;
    max-width: 40rem;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
  }
  .win {
    fill: color-mix(in srgb, var(--sig-low) 14%, var(--panel));
    stroke: var(--line-strong);
  }
  .win.t {
    stroke: var(--copper);
    stroke-width: 2;
    stroke-dasharray: 4 2;
  }
  .win.got {
    fill: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
  }
  .wl {
    font-size: 12px;
    fill: var(--fg);
    font-weight: 600;
  }
  .ref {
    stroke: var(--sig-x);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.7;
  }
  .ax {
    stroke: var(--line-strong);
  }
  .tk {
    font-size: 11px;
    fill: var(--mute);
  }
  .mark {
    fill: var(--sig-high);
  }
  .vt {
    font-size: 12px;
    fill: var(--fg);
    font-weight: 700;
  }
  .stair {
    fill: none;
    stroke: var(--copper);
    stroke-width: 1.4;
    opacity: 0.7;
  }
  .msg {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
    min-height: 2.6em;
  }
  .nums {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.25rem 1.4rem;
  }
  .nums div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    border-bottom: 1px solid var(--line);
    padding: 0.15rem 0;
    font-size: 0.82rem;
  }
  .nums dt {
    color: var(--mute);
  }
  .nums dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
  }
</style>
