<!--
  A GPipe schedule: p pipeline stages (one per GPU) and m micro-batches. Forward passes flow down the stages, then
  backward passes flow back up; the grey cells are the bubble. Uses the learner's bubble().
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  const reference = (stages: number, micro: number) => (stages - 1) / (micro + stages - 1);
  const bubble = $derived(impl.get('eff.bubble', reference));
  const mine = $derived(impl.isMine('eff.bubble'));

  let p = $state(4);
  let m = $state(4);
  const slots = $derived(2 * (m + p - 1));
  // Forward of micro-batch j on stage s at slot s + j; backward (twice as long in reality, one slot here) at
  // slot (m + p − 1) + (p − 1 − s) + j.
  const cell = (s: number, t: number): { kind: 'f' | 'b' | null; j: number } => {
    if (t < m + p - 1) {
      const j = t - s;
      return j >= 0 && j < m ? { kind: 'f', j } : { kind: null, j: -1 };
    }
    const j = t - (m + p - 1) - (p - 1 - s);
    return j >= 0 && j < m ? { kind: 'b', j } : { kind: null, j: -1 };
  };
  const idle = $derived.by(() => {
    try {
      return bubble(p, m);
    } catch {
      return reference(p, m);
    }
  });
</script>

<Widget
  title="The pipeline bubble"
  subtitle="Each row is a GPU holding a quarter (or so) of the layers; time runs left to right. A micro-batch must pass through every stage forwards, then backwards. Split the batch into more micro-batches to keep the GPUs busier."
  onreset={() => {
    p = 4;
    m = 4;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Stages (GPUs)" min={1} max={8} step={1} value={p} oninput={(v) => (p = v)} format={(v) => v.toFixed(0)} /></div>
    <div class="sl"><Slider label="Micro-batches" min={1} max={16} step={1} value={m} oninput={(v) => (m = v)} format={(v) => v.toFixed(0)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your bubble().</p>{/if}
  <div class="grid" style:grid-template-columns="4rem repeat({slots}, minmax(0, 1fr))">
    {#each Array.from({ length: p }, (_, s) => s) as s (s)}
      <span class="lbl ui">GPU {s + 1}</span>
      {#each Array.from({ length: slots }, (_, t) => t) as t (t)}
        {@const c = cell(s, t)}
        <span class="c num" class:f={c.kind === 'f'} class:b={c.kind === 'b'}>{c.kind ? c.j + 1 : ''}</span>
      {/each}
    {/each}
  </div>
  <p class="note ui"><span class="k f"></span> forward <span class="k b"></span> backward · each GPU idles <strong class="num">{(idle * 100).toFixed(0)}%</strong> of the time: (p − 1) / (m + p − 1).</p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .grid {
    display: grid;
    gap: 2px;
    overflow-x: auto;
  }
  .lbl {
    font-size: 0.7rem;
    color: var(--ink-3);
    align-self: center;
  }
  .c {
    height: 1.4rem;
    border-radius: 2px;
    background: var(--surface-2);
    font-size: 0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    min-width: 0;
  }
  .c.f,
  .k.f {
    background: var(--series-1);
  }
  .c.b,
  .k.b {
    background: var(--series-2);
  }
  .k {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    vertical-align: -1px;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
