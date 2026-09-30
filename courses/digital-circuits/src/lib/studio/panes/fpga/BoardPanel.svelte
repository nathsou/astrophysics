<!--
  The virtual board: a clock (one cycle, run, and a rate), a reset button, 4 push buttons, 8 switches, 8 LEDs and
  four 7-segment digits, wired to the design's top-level ports by name. The device that runs is the **decoded
  bitstream** (not the source): the indicator compares it, cycle by cycle, with the RTL simulator.
-->
<script lang="ts">
  import { digitOfMask } from '../../fpga/board';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import SevenSeg from '../../chips/SevenSeg.svelte';
  import Icon from '../../../components/ui/Icon.svelte';

  let { session, compact = false }: { session: FpgaSession; compact?: boolean } = $props();

  const run = $derived(session.run);
  const b = $derived(run.binding);
  const out = $derived(run.outputs);
  const agree = $derived(run.agreement);
  const rates = [
    { v: 1, label: '1 Hz' },
    { v: 4, label: '4 Hz' },
    { v: 16, label: '16 Hz' },
    { v: 64, label: '64 Hz' },
    { v: 256, label: '256 Hz' },
    { v: 1000, label: '1 kHz' },
    { v: 0, label: 'max' },
  ];
  const uses = $derived(b?.uses);
  const hexText = $derived(out && b && (b.uses.digits.length || b.uses.multiplexed) ? out.digits.map((m) => (m ? (digitOfMask(m) >= 0 ? digitOfMask(m).toString(16).toUpperCase() : '·') : '0')).reverse().join('') : '');
  function hold(node: HTMLElement, f: (on: boolean) => void) {
    const down = (ev: PointerEvent) => {
      node.setPointerCapture?.(ev.pointerId);
      f(true);
    };
    const up = () => f(false);
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', up);
    return { destroy() { node.removeEventListener('pointerdown', down); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); node.removeEventListener('lostpointercapture', up); } };
  }
</script>

<div class="board ui" class:compact>
  {#if !session.result}
    <p class="empty">Fit a design to put it on the board.</p>
  {:else if run.error}
    <p class="empty err">{run.error}</p>
  {:else if b}
    <div class="row top">
      <div class="grp" role="group" aria-label="Clock">
        <span class="cap">Clock</span>
        <button type="button" class="btn" onclick={() => run.step(1)} disabled={run.running} title="One clock cycle"><Icon name="wave" size={13} /> Step</button>
        <button type="button" class="btn" class:on={run.running} aria-pressed={run.running} onclick={() => (run.running ? run.pause() : run.play())}>{run.running ? 'Stop' : 'Run'}</button>
        <label class="rate"><span class="sr">Clock rate</span>
          <select value={run.speed} onchange={(ev) => (run.speed = Number((ev.currentTarget as HTMLSelectElement).value))} aria-label="Clock rate">
            {#each rates as r (r.v)}<option value={r.v}>{r.label}</option>{/each}
          </select>
        </label>
        <span class="cnt" title="Clock cycles since power-up">{run.cycles.toLocaleString('en-GB')} cycles{run.running && run.hz ? ` · ${run.hz.toLocaleString('en-GB')} Hz` : ''}</span>
      </div>
      <div class="grp" role="group" aria-label="Power">
        <button type="button" class="btn" onclick={() => run.powerUp()} title="Power-up: every flip-flop to its initial value"><Icon name="reset" size={13} /> Power-up</button>
        <button type="button" class="btn hold" class:on={run.inputs.reset} class:dim={!uses?.reset} use:hold={(on) => run.setReset(on)} title={uses?.reset ? 'Hold to reset the design' : 'The design has no rst port'} aria-pressed={run.inputs.reset}>Reset</button>
      </div>
    </div>

    <div class="row">
      <div class="grp" role="group" aria-label="Push buttons">
        <span class="cap">Buttons</span>
        {#each run.inputs.buttons as on, i (i)}
          <button type="button" class="pb" class:on class:dim={!uses?.buttons} use:hold={(v) => run.setButton(i, v)} aria-pressed={on} aria-label="Button {i}">{i}</button>
        {/each}
      </div>
      <div class="grp" role="group" aria-label="Switches">
        <span class="cap">Switches</span>
        {#each run.inputs.switches as on, i (i)}
          <button type="button" class="sw" class:on class:dim={!uses?.switches} role="switch" aria-checked={on} aria-label="Switch {i}" onclick={() => run.setSwitch(i, !on)}><span class="knob"></span><span class="n">{i}</span></button>
        {/each}
      </div>
    </div>

    <div class="row">
      <div class="grp" role="group" aria-label="LEDs">
        <span class="cap">LEDs</span>
        {#each out?.leds ?? [] as v, i (i)}
          <span class="led" class:on={v === 1} class:x={v === 'x'} class:dim={!uses?.leds} role="img" aria-label="LED {i} is {v === 1 ? 'on' : v === 'x' ? 'unknown' : 'off'}"><span class="n">{i}</span></span>
        {/each}
      </div>
      {#if uses && (uses.digits.length || uses.multiplexed)}
        <div class="grp digits" role="group" aria-label="Seven-segment digits">
          <span class="cap">Digits</span>
          {#each [3, 2, 1, 0] as d (d)}
            <span class:off={!out?.digitLit[d]}><SevenSeg segments={out?.digits[d] ?? 0} size={compact ? 34 : 44} label="Digit {d}" /></span>
          {/each}
          {#if hexText}<code class="hex" title="What the four digits read as hexadecimal">{hexText}</code>{/if}
        </div>
      {/if}
    </div>

    {#if b.freeInputs.length || b.freeOutputs.length}
      <div class="row">
        {#if b.freeInputs.length}
          <div class="grp" role="group" aria-label="Free input pins">
            <span class="cap">Pins in</span>
            {#each b.freeInputs as n (n)}
              {@const on = !!run.inputs.free[n]}
              <button type="button" class="pin" class:on role="switch" aria-checked={on} onclick={() => run.setFree(n, !on)}><span class="pn">{n}</span><span class="v">{on ? 1 : 0}</span></button>
            {/each}
          </div>
        {/if}
        {#if b.freeOutputs.length}
          <div class="grp" role="group" aria-label="Free output pins">
            <span class="cap">Pins out</span>
            {#each b.freeOutputs as n (n)}
              {@const v = out?.free[n]}
              <span class="pin out" class:on={v === 1} class:x={v === 'x'}><span class="pn">{n}</span><span class="v">{v === 'x' ? 'x' : (v ?? 0)}</span></span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="check" class:bad={agree && !agree.ok} role="status" title="The configured device (decoded from its bitstream and run on the digital engine) is compared with the RTL simulator running the source, after every clock cycle">
      {#if agree?.ok}
        <Icon name="check" size={13} /> device agrees with the RTL simulator ({agree.checked} output bit{agree.checked === 1 ? '' : 's'} checked)
      {:else if agree}
        <strong>Mismatch</strong> on {agree.mismatches.slice(0, 6).join(', ')}{agree.mismatches.length > 6 ? '…' : ''}: the device and the source disagree
      {/if}
    </div>
    {#if b.errors.length}
      <ul class="errs">{#each b.errors as e, i (i)}<li>{e}</li>{/each}</ul>
    {:else if b.bound.length}
      <p class="map">Bound by name: {[...new Set(b.bound.map((x) => x.port.replace(/\[\d+\]$/, '')))].join(', ')}. {b.freeInputs.length || b.freeOutputs.length ? 'Other ports get pins of their own.' : ''}</p>
    {:else}
      <p class="map">No port has a board name (clk, rst, btn, sw, led, seg0 … seg3): every port gets a pin of its own. Name them like the board to use the switches, LEDs and digits.</p>
    {/if}
  {/if}
</div>

<style>
  .board {
    padding: 0.5rem 0.7rem 0.6rem;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--panel) 92%, #0d3b2a), color-mix(in srgb, var(--panel) 84%, #0d3b2a));
    border-top: 1px solid var(--line-strong);
    font-size: 0.76rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .empty {
    margin: 0.3rem 0;
    color: var(--mute);
  }
  .empty.err {
    color: var(--bad);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    align-items: center;
  }
  .row.top {
    justify-content: space-between;
  }
  .grp {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
    min-width: 3.4rem;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--copper);
  }
  .btn:disabled {
    opacity: 0.5;
  }
  .btn.on {
    border-color: var(--sig-high);
    color: var(--sig-high);
  }
  .btn.dim,
  .pb.dim,
  .sw.dim,
  .led.dim {
    opacity: 0.45;
  }
  select {
    font: inherit;
    padding: 0.18rem 0.3rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
  }
  .cnt {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .pb {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    background: radial-gradient(circle at 35% 30%, var(--surface), var(--surface-3));
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .pb.on {
    border-color: var(--sig-high);
    color: var(--sig-high);
    box-shadow: 0 0 8px var(--sig-high-glow);
    transform: translateY(1px);
  }
  .sw {
    position: relative;
    width: 1.5rem;
    height: 2.5rem;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background: var(--surface-3);
    cursor: pointer;
    padding: 0;
  }
  .sw .knob {
    position: absolute;
    left: 2px;
    right: 2px;
    bottom: 2px;
    height: 1.05rem;
    border-radius: 3px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    transition: bottom 90ms;
  }
  .sw.on .knob {
    bottom: calc(100% - 1.05rem - 2px);
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 6px var(--sig-high-glow);
  }
  .sw .n,
  .led .n {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 0.56rem;
    color: var(--mute);
  }
  .sw .n {
    left: 0;
    right: 0;
    top: 100%;
    text-align: center;
    margin-top: 1px;
  }
  .sw {
    margin-bottom: 0.7rem;
  }
  .led {
    position: relative;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--line-strong);
    margin-bottom: 0.7rem;
  }
  .led .n {
    left: 0;
    right: 0;
    top: 100%;
    text-align: center;
  }
  .led.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 10px var(--sig-high-glow);
  }
  .led.x {
    background: transparent;
    border: 1px dashed var(--sig-x);
  }
  .digits {
    gap: 0.25rem;
  }
  .digits .off {
    opacity: 0.4;
  }
  .hex {
    margin-left: 0.4rem;
    font-family: var(--font-mono);
    font-size: 1rem;
    color: var(--sig-high);
    letter-spacing: 0.1em;
  }
  .pin {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.12rem 0.2rem 0.12rem 0.5rem;
    border-radius: 99px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }
  .pin.out {
    cursor: default;
  }
  .pin .pn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .pin .v {
    display: inline-grid;
    place-items: center;
    min-width: 1.25rem;
    height: 1.25rem;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    background: var(--surface-3);
    color: var(--sig-low);
  }
  .pin.on {
    border-color: var(--sig-high);
  }
  .pin.on .v {
    background: var(--sig-high);
    color: #1b1204;
    font-weight: 700;
    box-shadow: 0 0 8px var(--sig-high-glow);
  }
  .pin.x .v {
    border: 1px dashed var(--sig-x);
    background: transparent;
    color: var(--sig-x);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--ok);
    font-size: 0.74rem;
  }
  .check.bad {
    color: var(--bad);
  }
  .map {
    margin: 0;
    font-size: 0.7rem;
    color: var(--mute);
  }
  .errs {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.72rem;
    color: var(--bad);
  }
  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
