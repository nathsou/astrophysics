<!--
  Hosts the FPGA workspace inside the Studio: owns the FPGA session, keeps it in step with the Studio's source and
  example (so the URL hash and "Open in the Studio" work as for the other devices), and offers the by-hand mode.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Studio } from '../../studio.svelte';
  import { FpgaSession } from '../../fpga/session.svelte';
  import Segmented from '../../../components/ui/Segmented.svelte';
  import FpgaWorkspace from './FpgaWorkspace.svelte';

  let { studio, views, compact = false }: { studio: Studio; views: string[]; compact?: boolean } = $props();

  const session = new FpgaSession({
    example: untrack(() => studio.exampleId ?? undefined),
    source: untrack(() => (studio.exampleId ? undefined : studio.source || undefined)),
    onsource: (source, example) => {
      studio.source = source;
      studio.exampleId = example;
    },
  });
  // Report the session's source to the Studio straight away (the hash and the picker read it).
  untrack(() => {
    studio.source = session.source;
    studio.exampleId = session.exampleId;
  });

  // The Studio loaded something else (a link, another example): follow it.
  $effect(() => {
    const ex = studio.exampleId;
    const src = studio.source;
    untrack(() => {
      if (ex && ex !== session.exampleId) session.loadExample(ex);
      else if (!ex && src && src !== session.source) session.setSource(src);
    });
  });

  const all = $derived(compact ? views : [...new Set([...views, 'replay', 'board', 'hand'])]);
  const canHand = $derived(all.includes('hand'));
  let mode = $state<'design' | 'hand'>('design');
  function setMode(m: 'design' | 'hand') {
    mode = m;
    session.setMode(m);
  }
  onMount(() => () => session.destroy());
</script>

<div class="fh">
  {#if canHand}
    <div class="row ui">
      <Segmented
        size="sm"
        label="Programming mode"
        value={mode}
        options={[
          { value: 'design', label: 'From source', title: 'Fit the DCL source to the device' },
          { value: 'hand', label: 'By hand', title: 'Configure the small device (vFPGA-S) bit by bit' },
        ]}
        onchange={setMode}
      />
      <span class="note">{mode === 'hand' ? 'vFPGA-S: click LUT bits and pins on the chip.' : 'The flow runs in a worker: check, synthesis, mapping, placement, routing, bitstream.'}</span>
    </div>
  {/if}
  <FpgaWorkspace {session} views={all} {compact} />
</div>

<style>
  .fh {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.8rem;
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid var(--line);
    background: var(--pn);
    font-size: 0.76rem;
  }
  .note {
    color: var(--mute);
  }
</style>
