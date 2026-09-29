<!--
  Run controls: the inputs as switches, the clock, and the outputs as the device drives them (from its
  configuration bits, not from the equations), with a check that the logic view agrees.
-->
<script lang="ts">
  import type { Studio } from '../studio.svelte';
  import Icon from '../../components/ui/Icon.svelte';

  let { studio, compact = false }: { studio: Studio; compact?: boolean } = $props();

  const fit = $derived(studio.fit);
  const inputs = $derived(Object.keys(studio.inputs));
  const outputs = $derived(fit?.network.outputs ?? []);
  const hasClock = $derived(!!fit?.network.clock);
  const level = (n: string) => studio.run?.signals[n];
  const bad = $derived(studio.mismatches);
</script>

<div class="run ui" class:compact>
  <div class="grp" role="group" aria-label="Inputs">
    <span class="cap">Inputs</span>
    {#each inputs as n (n)}
      {@const on = studio.inputs[n] === 1}
      <button type="button" class="sw" class:on class:sel={studio.probe.signals.has(n)} role="switch" aria-checked={on} aria-label="Input {n}" onclick={() => studio.toggleInput(n)} onpointerenter={() => studio.hover({ kind: 'signal', name: n })} onpointerleave={() => studio.hover(null)}>
        <span class="n">{n}</span><span class="v">{on ? 1 : 0}</span>
      </button>
    {/each}
    {#if !inputs.length}<span class="none">none</span>{/if}
  </div>
  {#if hasClock}
    <div class="grp" role="group" aria-label="Clock">
      <span class="cap">Clock</span>
      <button type="button" class="btn" onclick={() => studio.clock()} title="One rising clock edge"><Icon name="wave" size={13} /> Clock <span class="cnt">{studio.run?.clocks ?? 0}</span></button>
      <button type="button" class="btn" class:on={studio.autoClock} aria-pressed={studio.autoClock} onclick={() => studio.setAutoClock(!studio.autoClock)}>{studio.autoClock ? 'Stop' : 'Run'}</button>
      <button type="button" class="btn" onclick={() => studio.powerUp()} title="Power-up: registers to their initial values"><Icon name="reset" size={13} /> Reset</button>
    </div>
  {/if}
  <div class="grp" role="group" aria-label="Outputs">
    <span class="cap">Outputs</span>
    {#each outputs as o (o.name)}
      {@const v = level(o.name)}
      <button type="button" class="pill" class:hi={v === 1} class:z={v === 'z'} class:sel={studio.probe.outputs.has(o.name)} class:bad={bad.includes(o.name)} aria-label="Output {o.name} is {v === 'z' ? 'floating' : v}" onclick={() => studio.select({ kind: 'output', name: o.name })} onpointerenter={() => studio.hover({ kind: 'output', name: o.name })} onpointerleave={() => studio.hover(null)}>
        <span class="n">{o.name}</span><span class="v">{v === 'z' ? 'Z' : (v ?? '·')}</span>
      </button>
    {/each}
  </div>
  <div class="check" class:bad={bad.length > 0} role="status" title="The logic view (drawn from the fitted network) and the device (simulated from its bits) are run side by side">
    {#if studio.logic === null}
      <span class="dim">logic view: starting</span>
    {:else if bad.length}
      <strong>Mismatch</strong> on {bad.join(', ')}: the logic view and the device disagree
    {:else}
      <Icon name="check" size={13} /> logic view agrees with the device
    {/if}
    {#if studio.run && !studio.run.stable}<span class="unstable"> · combinational loop does not settle</span>{/if}
  </div>
</div>

<style>
  .run {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 1rem;
    padding: 0.45rem 0.7rem;
    border-bottom: 1px solid var(--line);
    background: var(--pn);
    font-size: 0.78rem;
  }
  .grp {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
    margin-right: 0.2rem;
  }
  .none {
    color: var(--mute);
  }
  .sw,
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.18rem 0.2rem 0.18rem 0.55rem;
    border-radius: 99px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font: inherit;
  }
  .v {
    display: inline-grid;
    place-items: center;
    min-width: 1.35rem;
    height: 1.35rem;
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    background: var(--surface-3);
    color: var(--sig-low);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 0.74rem;
  }
  .sw.on,
  .pill.hi {
    border-color: var(--sig-high);
  }
  .sw.on .v,
  .pill.hi .v {
    background: var(--sig-high);
    color: #1b1204;
    box-shadow: 0 0 8px var(--sig-high-glow);
    font-weight: 700;
  }
  .pill.z .v {
    background: transparent;
    border: 1px dashed var(--sig-z);
    color: var(--sig-z);
  }
  .sel {
    outline: 2px solid var(--phosphor);
    outline-offset: 1px;
  }
  .pill.bad {
    border-color: var(--bad);
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
  }
  .btn:hover {
    border-color: var(--copper);
  }
  .btn.on {
    border-color: var(--sig-high);
    color: var(--sig-high);
  }
  .cnt {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .check {
    margin-left: auto;
    min-width: 0;
    flex: 0 1 auto;
    white-space: normal;
    color: var(--ok);
    font-size: 0.74rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .check.bad {
    color: var(--bad);
  }
  .dim,
  .unstable {
    color: var(--mute);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .compact {
    padding: 0.35rem 0.5rem;
  }
  @media (max-width: 560px) {
    .check {
      margin-left: 0;
      flex: 1 1 100%;
    }
  }
</style>
