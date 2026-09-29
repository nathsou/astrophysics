<!--
  A generated circuit, drawn with the Schematic renderer and running on the digital engine. Used by the
  synthesiser here and by the K-map playground, gate golf and the factoring figure of Chapter 12.

    <LiveDag {circuit} scale={1.2} onparam={(id, key, value) => …} />

  A new `circuit` object gives a new engine. Clicking a toggle in the drawing flips it (the Schematic tells
  the engine) and calls `onparam`, which the host uses to follow the inputs; the drawing is not rebuilt.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { flatten } from '$lib/sim/netlist/flatten';
  import type { Engine } from '$lib/sim/engine';
  import type { Circuit, ParamValue } from '$lib/sim/netlist/types';

  let {
    circuit,
    scale = 1.2,
    label = 'Generated logic circuit',
    onparam,
  }: {
    circuit: Circuit;
    scale?: number;
    label?: string;
    onparam?: (id: string, key: string, value: ParamValue) => void;
  } = $props();

  let engine: Engine | null = $state(null);
  let error = $state('');
  let schematic: Schematic | undefined = $state();

  $effect(() => {
    const c = circuit;
    let cancelled = false;
    untrack(() => (error = ''));
    try {
      const flat = flatten(c);
      createEngine('digital', flat).then(
        (e) => {
          if (cancelled) return;
          try {
            e.advance(1e-6);
          } catch (err) {
            error = String(err);
          }
          engine = e;
        },
        (err: unknown) => !cancelled && (error = String(err)),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return () => {
      cancelled = true;
    };
  });

  function changed(id: string, key: string, value: ParamValue) {
    // Gate delays are nanoseconds; a microsecond settles any circuit drawn here.
    engine?.advance(1e-6);
    schematic?.frame(0);
    onparam?.(id, key, value);
  }
</script>

<div class="live">
  {#if error}
    <p class="err ui" role="alert">{error}</p>
  {/if}
  <Schematic bind:this={schematic} {circuit} {engine} mode="logic" {scale} live={false} {label} onparam={changed} />
</div>

<style>
  .live {
    display: flex;
    justify-content: center;
    min-width: 0;
    overflow-x: auto;
  }
  .err {
    color: var(--sig-x);
    font-size: 0.85rem;
  }
</style>
