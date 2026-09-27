<!-- The shapes and sizes of the main activation tensors in a GPT forward pass. -->
<script lang="ts">
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  const B = $derived(params.get('shape.B', 32));
  const T = $derived(params.get('shape.T', 256));
  const C = $derived(params.get('shape.C', 384));
  const V = $derived(params.get('shape.V', 8192));
  let H = $state(6);

  const rows = $derived([
    { name: 'Token ids', shape: ['B', 'T'], dims: [B, T], note: 'integers: one id per position' },
    { name: 'Embeddings / residual stream', shape: ['B', 'T', 'C'], dims: [B, T, C], note: 'one C-dimensional vector per position (Ch. 7, 11)' },
    { name: 'Attention scores (per layer)', shape: ['B', 'H', 'T', 'T'], dims: [B, H, T, T], note: 'every position against every other, per head (Ch. 10)' },
    { name: 'Feed-forward hidden (per layer)', shape: ['B', 'T', '4C'], dims: [B, T, 4 * C], note: 'the MLP inside each block (Ch. 11)' },
    { name: 'Logits', shape: ['B', 'T', 'V'], dims: [B, T, V], note: 'a score for every vocabulary item at every position' },
  ]);
  const bytes = (dims: number[]) => 4 * dims.reduce((a, b) => a * b, 1);
  const fmt = (b: number) => (b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(2)} GiB` : b >= 2 ** 20 ? `${(b / 2 ** 20).toFixed(1)} MiB` : `${(b / 2 ** 10).toFixed(1)} KiB`);
  const max = $derived(Math.max(...rows.map((r) => bytes(r.dims))));
</script>

<Widget title="The shapes of a language model" subtitle="The main activation tensors of one GPT forward pass, stored as 32-bit floats. Defaults are CourseGPT’s. Drag B, T, C and V (also under the equation above) and watch what dominates.">
  {#snippet controls()}
    <div class="ctl"><Slider label="B batch" min={1} max={128} step={1} value={B} oninput={(v) => params.set('shape.B', v)} format={(v) => String(v)} /></div>
    <div class="ctl"><Slider label="T context" min={16} max={4096} step={16} log value={T} oninput={(v) => params.set('shape.T', Math.round(v / 16) * 16)} format={(v) => String(Math.round(v))} /></div>
    <div class="ctl"><Slider label="C width" min={64} max={4096} step={64} log value={C} oninput={(v) => params.set('shape.C', Math.round(v / 64) * 64)} format={(v) => String(Math.round(v))} /></div>
    <div class="ctl"><Slider label="V vocabulary" min={256} max={262144} step={256} log value={V} oninput={(v) => params.set('shape.V', Math.round(v / 256) * 256)} format={(v) => Math.round(v).toLocaleString('en-GB')} /></div>
    <div class="ctl"><Slider label="H heads" min={1} max={32} step={1} bind:value={H} format={(v) => String(v)} /></div>
  {/snippet}

  <div class="rows">
    {#each rows as r (r.name)}
      <div class="row">
        <div class="name">{r.name}<span class="note">{r.note}</span></div>
        <code class="shape">({r.shape.join(', ')})</code>
        <div class="track"><span class="bar" style:width="{Math.max(0.5, (bytes(r.dims) / max) * 100)}%"></span></div>
        <div class="val num">{fmt(bytes(r.dims))}</div>
      </div>
    {/each}
  </div>
</Widget>

<style>
  .ctl {
    flex: 1 1 9rem;
  }
  .rows {
    display: grid;
    gap: 0.6rem;
  }
  .row {
    display: grid;
    grid-template-columns: 15rem 7rem 1fr 5.5rem;
    align-items: center;
    gap: 0.8rem;
    font-size: 0.82rem;
  }
  @media (max-width: 760px) {
    .row {
      grid-template-columns: 1fr 5.5rem;
    }
    .shape,
    .track {
      grid-column: 1 / -1;
    }
  }
  .name {
    font-weight: 600;
    display: flex;
    flex-direction: column;
  }
  .note {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .track {
    height: 14px;
    display: flex;
    align-items: center;
  }
  .bar {
    height: 12px;
    background: var(--series-1);
    border-radius: 0 4px 4px 0;
  }
  .val {
    text-align: right;
  }
</style>
