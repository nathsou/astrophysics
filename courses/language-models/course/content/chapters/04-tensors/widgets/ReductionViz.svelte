<!-- Reductions collapse a dimension; softmax normalises along one. Hover to see what contributes. -->
<script lang="ts">
  import { Tensor } from '@lm/core/tensor';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  const x = Tensor.from([
    [2, -1, 0, 3, 1],
    [0, 4, 1, -2, 2],
    [1, 1, 5, 0, -1],
    [3, 0, -1, 2, 2],
  ]);
  let op = $state<'sum' | 'mean' | 'max' | 'softmax'>('sum');
  let dim = $state<0 | 1 | 'all'>(1);
  let keepdim = $state(false);
  let hover = $state<[number, number] | null>(null);

  const result = $derived.by(() => {
    if (op === 'softmax') return x.softmax(dim === 'all' ? 1 : dim);
    if (dim === 'all') return op === 'max' ? Tensor.scalar(Math.max(...x.toFloat32Array())) : op === 'sum' ? x.sum() : x.mean();
    return op === 'sum' ? x.sum(dim, keepdim) : op === 'mean' ? x.mean(dim, keepdim) : x.max(dim, keepdim);
  });
  const vals = $derived(result.toFloat32Array());
  const shapeStr = $derived(`[${result.shape.join(', ')}]`);
  const contributes = (r: number, c: number) => {
    if (!hover) return false;
    if (dim === 'all' && op !== 'softmax') return true;
    const d = dim === 'all' ? 1 : dim;
    return d === 0 ? c === hover[1] : r === hover[0];
  };
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
</script>

<Widget title="Reductions and softmax" subtitle="Pick an operation and a dimension. A reduction collapses that dimension; softmax keeps the shape but normalises along it. Hover a result to see which inputs fed it.">
  {#snippet controls()}
    <Segmented label="Operation" size="sm" options={[{ value: 'sum', label: 'sum' }, { value: 'mean', label: 'mean' }, { value: 'max', label: 'max' }, { value: 'softmax', label: 'softmax' }]} bind:value={op} />
    <Segmented label="Dimension" size="sm" options={[{ value: 0, label: 'dim 0 (down)' }, { value: 1, label: 'dim 1 (across)' }, { value: 'all', label: 'all' }]} bind:value={dim} />
    {#if op !== 'softmax'}<Toggle bind:checked={keepdim} label="keepdim" />{/if}
  {/snippet}

  <div class="layout">
    <div>
      <div class="k">x, shape [4, 5]</div>
      <div class="g" style:grid-template-columns="repeat(5, 2.4rem)">
        {#each { length: 4 } as _, r (r)}{#each { length: 5 } as _, c (c)}<span class:hl={contributes(r, c)}>{x.get(r, c)}</span>{/each}{/each}
      </div>
    </div>
    <div class="arrow">→</div>
    <div>
      <div class="k"><code>x.{op}({dim === 'all' ? '' : `${dim}`}{keepdim && op !== 'softmax' && dim !== 'all' ? ', keepdim' : ''})</code>, shape {shapeStr}</div>
      {#if op === 'softmax'}
        <div class="g" style:grid-template-columns="repeat(5, 3rem)">
          {#each { length: 4 } as _, r (r)}{#each { length: 5 } as _, c (c)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="out" class:hl={hover?.[0] === r && hover?.[1] === c} onpointerenter={() => (hover = [r, c])} onpointerleave={() => (hover = null)}>{vals[r * 5 + c]!.toFixed(2)}</span>
            {/each}{/each}
        </div>
      {:else}
        {@const cols = dim === 0 ? 5 : 1}
        {@const n = vals.length}
        <div class="g" style:grid-template-columns="repeat({cols}, 2.8rem)">
          {#each { length: n } as _, i (i)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="out" onpointerenter={() => (hover = dim === 0 ? [0, i] : [i, 0])} onpointerleave={() => (hover = null)}>{fmt(vals[i]!)}</span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <p class="note">
    {#if op === 'softmax'}Each {dim === 0 ? 'column' : 'row'} of the result is positive and sums to 1 — a probability distribution along dim {dim === 'all' ? 1 : dim}. Language models apply softmax along the vocabulary dimension.
    {:else if dim === 'all'}Reducing over everything gives a single number (shape []).
    {:else}Reducing dim {dim} removes it{keepdim ? ' — or, with keepdim, keeps it with size 1 so the result still broadcasts against x' : ''}: [4, 5] → {shapeStr}.{/if}
  </p>
</Widget>

<style>
  .layout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.2rem;
  }
  .k {
    font-size: 0.74rem;
    color: var(--ink-2);
    margin-bottom: 0.3rem;
  }
  .g {
    display: grid;
    gap: 3px;
  }
  .g span {
    height: 2rem;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    background: var(--surface-2);
    border-radius: 4px;
    transition: background-color 80ms;
  }
  .g span.out {
    background: var(--accent-soft);
    cursor: default;
  }
  .g span.hl {
    background: var(--series-2);
    color: #fff;
  }
  .arrow {
    font-size: 1.4rem;
    color: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.8rem 0 0;
  }
</style>
