<!--
  Inertial against transport delay: one pulse, a chain of four buffers (1, 2, 3 and 4 ns), and both delay models of the
  digital engine side by side. Drag the pulse width: with inertial delay the pulse dies at the first buffer slower
  than it is long, with transport delay it never dies.

    ::pulse-filter{n="15.5"}
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import TimingDiagram from '$lib/bench/TimingDiagram.svelte';
  import type { Circuit } from '$lib/sim/netlist/types';
  import type { DelayModel } from '$lib/sim/digital';
  import type { Recorder } from '$lib/sim/engine';
  import chain from '../circuits/pulse-chain.json';
  import { T_END, T_VIEW, makeRig, sendPulse, stages, summary, type Rig, type Stage } from './pulse';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const circuit = chain as unknown as Circuit;
  let width = $state(2.5);
  const models: { id: DelayModel; title: string; note: string }[] = [
    { id: 'inertial', title: 'Inertial delay', note: 'a gate swallows a pulse shorter than its own delay' },
    { id: 'transport', title: 'Transport delay', note: 'every change is passed on, however short' },
  ];
  let rigs: Record<string, Rig | undefined> = $state.raw({});
  let scopes: Record<string, TimingDiagram | undefined> = $state({});
  let results: Record<string, Stage[]> = $state({});
  let schematic: Schematic | undefined = $state();
  const recs: Record<string, Recorder> = {};

  onMount(async () => {
    const made: Record<string, Rig> = {};
    for (const m of models) {
      const rig = makeRig(circuit, m.id);
      recs[m.id] = rig.engine.watch(rig.traces.map((t) => t.net));
      made[m.id] = rig;
    }
    rigs = made;
    await tick();
    run();
  });

  function run() {
    for (const m of models) {
      const rig = rigs[m.id];
      if (!rig) continue;
      sendPulse(rig.engine, width);
      results[m.id] = stages(recs[m.id]!.times(), recs[m.id]!.values());
      scopes[m.id]?.frame();
    }
    schematic?.frame(0);
  }
  $effect(() => {
    void width;
    if (rigs.inertial) run();
  });
</script>

<Widget {n} title="Short pulses" subtitle="One pulse, four buffers, two ideas of delay" kind="Lab bench" {caption} onreset={() => (width = 2.5)} live={false}>
  {#snippet controls()}
    <Slider label="Pulse width" bind:value={width} min={0.25} max={5} step={0.25} format={(v) => `${v.toFixed(2)} ns`} />
  {/snippet}

  <div class="pf">
    <div class="rig">
      <Schematic bind:this={schematic} {circuit} engine={rigs.inertial?.engine ?? null} mode="logic" scale={1.15} live={false} interactive={false} label="A chain of four buffers with delays of 1, 2, 3 and 4 nanoseconds" />
    </div>
    <div class="cols">
      {#each models as m (m.id)}
        <section aria-label={m.title}>
          <h5 class="ui">{m.title}<small>{m.note}</small></h5>
          {#if rigs[m.id]}
            <TimingDiagram bind:this={scopes[m.id]} engine={rigs[m.id]!.engine} traces={rigs[m.id]!.traces} window={(T_END - T_VIEW) * 1e-9} live={false} rowHeight={26} label="{m.title}: the input pulse and the four buffer outputs" />
          {:else}
            <div class="blank" aria-busy="true"></div>
          {/if}
          <p class="say ui">{results[m.id] ? summary(results[m.id]!, width) : ''}</p>
        </section>
      {/each}
    </div>
  </div>
</Widget>

<style>
  .pf {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .rig {
    display: flex;
    justify-content: center;
    overflow-x: auto;
  }
  .cols {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    min-width: 0;
  }
  section {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg);
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 0.6rem;
    align-items: baseline;
  }
  h5 small {
    font-weight: 400;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .say {
    margin: 0.4rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    min-height: 2.6em;
  }
  .blank {
    height: 9rem;
  }
</style>
