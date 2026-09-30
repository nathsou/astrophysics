<!-- Horizontal bar list: label · bar · value. Single series; hover shows details. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    items,
    max,
    color = 'var(--series-1)',
    format = (v: number) => v.toLocaleString('en-GB'),
    label,
    detail,
    highlight = null,
    onhover,
  }: {
    items: { label: string; value: number; key?: string }[];
    max?: number;
    color?: string;
    format?: (v: number) => string;
    label: string;
    detail?: Snippet<[{ label: string; value: number }]>;
    highlight?: string | null;
    onhover?: (key: string | null) => void;
  } = $props();

  const top = $derived(max ?? Math.max(...items.map((i) => i.value), 1e-12));
  let hovered = $state<number | null>(null);
</script>

<div class="bars ui" role="list" aria-label={label}>
  {#each items as it, i (it.key ?? it.label)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="row"
      role="listitem"
      class:hl={highlight !== null && (it.key ?? it.label) === highlight}
      onpointerenter={() => ((hovered = i), onhover?.(it.key ?? it.label))}
      onpointerleave={() => ((hovered = null), onhover?.(null))}
    >
      <span class="lbl">{it.label}</span>
      <span class="track"><span class="bar" style:width="{(it.value / top) * 100}%" style:background={color}></span></span>
      <span class="val num">{format(it.value)}</span>
      {#if hovered === i && detail}<div class="detail">{@render detail(it)}</div>{/if}
    </div>
  {/each}
</div>

<style>
  .bars {
    display: grid;
    /* Columns are shared by all rows (subgrid), so the bars start at the same x. */
    grid-template-columns: minmax(2.5rem, max-content) 1fr 4.5rem;
    gap: 2px 0.6rem;
    font-size: 0.78rem;
  }
  .row {
    position: relative;
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.6rem;
    padding: 1px 0.3rem;
    border-radius: 4px;
  }
  .row:hover,
  .row.hl {
    background: var(--surface-2);
  }
  .lbl {
    font-family: var(--font-mono);
    white-space: pre;
    color: var(--ink);
    text-align: right;
  }
  .track {
    height: 14px;
    display: flex;
    align-items: center;
  }
  .bar {
    height: 12px;
    border-radius: 0 4px 4px 0;
    min-width: 1px;
  }
  .val {
    color: var(--ink-2);
    text-align: right;
  }
  .detail {
    position: absolute;
    right: 0;
    bottom: calc(100% + 4px);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    border-radius: 6px;
    padding: 0.35rem 0.55rem;
    z-index: 5;
    white-space: nowrap;
  }
</style>
