<!--
  One flat buffer, many views. Apply a view operation and see how each logical element maps to a
  storage offset via offset = o + Σ i_k·s_k — and which operations had to copy.
-->
<script lang="ts">
  import { Tensor } from '@lm/core/tensor';
  import { focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  type Scenario = { label: string; code: string; make: (base: Tensor) => Tensor; note: string };
  const SCENARIOS: Scenario[] = [
    { label: 'Original', code: 'x = arange(24).reshape(2, 3, 4)', make: (b) => b, note: 'Contiguous: the last index moves fastest, so its stride is 1; each step of the middle index skips a row of 4; each step of the first skips a 3×4 block of 12.' },
    { label: 'Transpose', code: 'x.transpose(1, 2)', make: (b) => b.transpose(1, 2), note: 'Swapping two dimensions just swaps their sizes and strides. No data moves — but the result is no longer contiguous.' },
    { label: 'Permute', code: 'x.permute(2, 0, 1)', make: (b) => b.permute(2, 0, 1), note: 'Any reordering of dimensions is a permutation of the (size, stride) pairs.' },
    { label: 'Slice', code: 'x[:, 1:3, :]', make: (b) => b.slice(1, 1, 3), note: 'Slicing moves the offset to the first selected element and shrinks one size. Strides are unchanged — rows are still 4 apart.' },
    { label: 'Every other column', code: 'x[..., ::2]', make: (b) => new Tensor(b.storage, [2, 3, 2], [12, 4, 2], 0), note: 'A step of 2 along the last dimension doubles its stride. Still a view: the skipped elements are simply never visited.' },
    { label: 'Expand', code: 'x[:, :1, :].expand(2, 3, 4)', make: (b) => b.slice(1, 0, 1).expand(2, 3, 4), note: 'Broadcasting sets a stride to 0: every step along that dimension stays on the same element. Many logical elements, one storage cell.' },
    { label: 'Reshape (view)', code: 'x.reshape(4, 6)', make: (b) => b.reshape(4, 6), note: 'A contiguous tensor can be reshaped to any shape with the same number of elements, for free: only the strides are recomputed.' },
    { label: 'Reshape (copy)', code: 'x.transpose(1, 2).reshape(2, 12)', make: (b) => b.transpose(1, 2).reshape(2, 12), note: 'A non-contiguous tensor cannot be reshaped by changing strides alone — the elements are in the wrong order in memory — so reshape makes a contiguous copy first.' },
  ];

  let which = $state(0);
  const base = Tensor.arange(24).reshape(2, 3, 4);
  const view = $derived(SCENARIOS[which]!.make(base));
  const shares = $derived(view.storage === base.storage);
  let hoverLogical = $state<number[] | null>(null);
  let hoverStorage = $state<number | null>(null);

  // Enumerate logical elements (≤3-d) as blocks of rows × cols for display.
  const cells = $derived.by(() => {
    const s = view.shape;
    const nd = s.length;
    const [B, R, C] = nd === 3 ? s : nd === 2 ? [1, s[0]!, s[1]!] : [1, 1, s[0]!];
    const blocks: { idx: number[]; off: number; val: number }[][][] = [];
    for (let b = 0; b < B!; b++) {
      const rows = [];
      for (let r = 0; r < R!; r++) {
        const row = [];
        for (let c = 0; c < C!; c++) {
          const idx = nd === 3 ? [b, r, c] : nd === 2 ? [r, c] : [c];
          const off = view.index(...idx);
          row.push({ idx, off, val: view.storage[off]! });
        }
        rows.push(row);
      }
      blocks.push(rows);
    }
    return blocks;
  });

  const hoverOff = $derived(hoverLogical ? view.index(...hoverLogical) : null);
  const eq = $derived(
    hoverLogical ? `${view.offset} + ${hoverLogical.map((i, k) => `${i}·${view.strides[k]}`).join(' + ')} = ${hoverOff}` : null,
  );
</script>

<Widget
  title="Strides: one buffer, many views"
  subtitle="The 24 numbers live in one flat array (bottom). Each view is just a shape, a list of strides and an offset. Hover an element to see where it lives."
  onreset={() => (which = 0)}
>
  {#snippet controls()}
    <div class="ops" role="radiogroup" aria-label="Operation">
      {#each SCENARIOS as s, i (s.label)}
        <button role="radio" aria-checked={which === i} class:on={which === i} onclick={() => (which = i)}>{s.label}</button>
      {/each}
    </div>
  {/snippet}

  <div class="code"><code>{SCENARIOS[which]!.code}</code></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="meta" onpointerenter={() => focus.set('sk', 'strides')} onpointerleave={() => focus.set(null)}>
    <span>shape <strong class="num">[{view.shape.join(', ')}]</strong></span>
    <span>strides <strong class="num">[{view.strides.join(', ')}]</strong></span>
    <span>offset <strong class="num">{view.offset}</strong></span>
    <span class="tag" class:good={view.isContiguous()}>{view.isContiguous() ? 'contiguous' : 'not contiguous'}</span>
    <span class="tag" class:good={shares} class:warn={!shares}>{shares ? 'view — shares storage' : 'copy — new storage'}</span>
  </div>

  <div class="logical">
    {#each cells as block, b (b)}
      <div class="block">
        {#if cells.length > 1}<div class="blabel">[{b}, :, :]</div>{/if}
        <div class="grid" style:grid-template-columns="repeat({block[0]?.length ?? 1}, 2.2rem)">
          {#each block as row, r (r)}
            {#each row as cell, c (c)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="cell"
                class:hl={hoverOff === cell.off || hoverStorage === cell.off}
                onpointerenter={() => (hoverLogical = cell.idx)}
                onpointerleave={() => (hoverLogical = null)}
                title="index [{cell.idx.join(', ')}] → offset {cell.off}"
              >
                {cell.val}
              </div>
            {/each}
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="eqline">{#if eq}offset = {eq}{:else}&nbsp;{/if}</div>

  <div class="storage-label">Storage ({view.storage.length} floats{shares ? ', shared with x' : ', freshly allocated'})</div>
  <div class="storage">
    {#each Array.from(view.storage) as v, i (i)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="scell" class:hl={hoverOff === i || hoverStorage === i} onpointerenter={() => (hoverStorage = i)} onpointerleave={() => (hoverStorage = null)}>
        <span class="v">{v}</span><span class="i">{i}</span>
      </div>
    {/each}
  </div>
  <p class="note">{SCENARIOS[which]!.note}</p>
</Widget>

<style>
  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .ops button {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .ops button.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .code {
    font-size: 0.9rem;
    margin-bottom: 0.4rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.8rem;
  }
  .meta strong {
    color: var(--ink);
    font-family: var(--font-mono);
  }
  .tag {
    padding: 0 0.5rem;
    border-radius: 99px;
    background: var(--surface-3);
    color: var(--ink);
  }
  .tag.good {
    background: color-mix(in srgb, var(--good) 16%, var(--surface));
  }
  .tag.warn {
    background: color-mix(in srgb, var(--warn) 22%, var(--surface));
  }
  .logical {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    min-height: 7rem;
  }
  .blabel {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--ink-3);
    margin-bottom: 0.2rem;
  }
  .grid {
    display: grid;
    gap: 3px;
  }
  .cell,
  .scell {
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--series-1) calc(var(--t, 0.12) * 100%), var(--surface));
    border: 1px solid var(--border);
    cursor: default;
    transition: background-color 80ms;
  }
  .cell {
    height: 2rem;
  }
  .cell.hl,
  .scell.hl {
    background: var(--series-2);
    color: #fff;
    border-color: var(--series-2);
  }
  .eqline {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    margin: 0.6rem 0;
    min-height: 1.2rem;
  }
  .storage-label {
    font-size: 0.74rem;
    color: var(--ink-2);
    margin-bottom: 0.25rem;
  }
  .storage {
    display: grid;
    grid-template-columns: repeat(24, minmax(1.4rem, 1fr));
    gap: 2px;
    overflow-x: auto;
  }
  .scell {
    height: 2.3rem;
    grid-template-rows: 1fr auto;
    padding: 0.15rem 0;
  }
  .scell .i {
    font-size: 0.58rem;
    color: var(--ink-3);
  }
  .scell.hl .i {
    color: #fff;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.7rem 0 0;
    line-height: 1.5;
  }
</style>
