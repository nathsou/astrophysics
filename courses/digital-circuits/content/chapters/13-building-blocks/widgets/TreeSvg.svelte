<!--
  A multiplexer tree, drawn: data inputs (or lookup-table bits) at the left, a two-way multiplexer for every
  pair, the select bit of each level written on its multiplexers, and the output at the right. The wires
  are coloured by value (amber 1, slate 0); the path from the selected input to the output is drawn thick,
  the rest faint. Used by the mux-tree figure and the LUT explorer (mux.ts holds the logic).
-->
<script lang="ts">
  import { nodeValues, nodesAt, onPath, childSelected } from './mux';

  let {
    k,
    leaves,
    sel,
    labels,
    leafTitle = 'D',
    onleaf,
    selNames,
    output = 'Y',
    label,
  }: {
    k: number;
    leaves: number[];
    /** The selected input (the value of the select bits). */
    sel: number;
    /** Text beside each leaf (the row's inputs, for a lookup table). */
    labels?: string[];
    leafTitle?: string;
    /** Click or Enter on a leaf. */
    onleaf?: (i: number) => void;
    /** Names of the select bits, S0 first. */
    selNames: string[];
    output?: string;
    label: string;
  } = $props();

  const P = $derived(k >= 4 ? 21 : 30);
  const LEAF_X = $derived(labels ? 46 : 30);
  const LEAF_W = 26;
  const COL = 74;
  const BOX_W = 30;
  const BOX_H = 24;
  const levels = $derived(nodeValues(leaves, k, sel));
  const rows = $derived(1 << k);
  const height = $derived(rows * P + 12);
  const nodeX = (j: number) => LEAF_X + LEAF_W + 30 + (j - 1) * COL;
  const outX = (j: number) => (j === 0 ? LEAF_X + LEAF_W : nodeX(j) + BOX_W);
  const width = $derived(nodeX(k) + BOX_W + 56);
  /** Vertical centre of node i at level j. */
  const cy = (j: number, i: number): number => {
    if (j === 0) return 6 + P / 2 + i * P;
    return (cy(j - 1, 2 * i) + cy(j - 1, 2 * i + 1)) / 2;
  };
  const val = (v: number) => (v ? 'hi' : 'lo');

  function key(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onleaf?.(i);
    }
  }
</script>

<svg class="tree" viewBox="0 0 {width} {height}" role="img" aria-label={label} style="max-width: {width * 1.5}px">
  <!-- Wires first, so the boxes sit on top. -->
  {#each { length: k } as _, j0 (j0)}
    {@const j = j0 + 1}
    {#each { length: nodesAt(k, j) } as __, i (i)}
      {#each [0, 1] as c (c)}
        {@const child = 2 * i + c}
        {@const y0 = cy(j - 1, child)}
        {@const y1 = cy(j, i) + (c ? 6 : -6)}
        {@const xm = nodeX(j) - 14}
        {@const chosen = onPath(j, i, sel) && childSelected(j, sel) === c}
        <path class="w {val(levels[j - 1]![child]!)}" class:path={chosen} d="M{outX(j - 1)} {y0} H{xm} V{y1} H{nodeX(j)}" />
      {/each}
    {/each}
  {/each}
  <path class="w {val(levels[k]![0]!)} path" d="M{outX(k)} {cy(k, 0)} H{outX(k) + 22}" />

  {#each { length: k } as _, j0 (j0)}
    {@const j = j0 + 1}
    {#each { length: nodesAt(k, j) } as __, i (i)}
      {@const on = onPath(j, i, sel)}
      <g class="mux" class:on>
        <rect x={nodeX(j)} y={cy(j, i) - BOX_H / 2} width={BOX_W} height={BOX_H} rx="4" />
        <text x={nodeX(j) + BOX_W / 2} y={cy(j, i) + 3.5} text-anchor="middle">{selNames[j - 1] ?? `S${j - 1}`}</text>
      </g>
    {/each}
  {/each}

  {#each { length: rows } as _, i (i)}
    {@const on = onPath(0, i, sel)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <g
      class="leaf {val(leaves[i]!)}"
      class:on
      class:live={!!onleaf}
      role={onleaf ? 'button' : undefined}
      tabindex={onleaf ? 0 : undefined}
      aria-pressed={onleaf ? !!leaves[i] : undefined}
      aria-label={onleaf ? `${leafTitle}${i}${labels ? `, row ${labels[i]}` : ''}: ${leaves[i]}. Press to change.` : undefined}
      onclick={() => onleaf?.(i)}
      onkeydown={(e) => key(e, i)}
    >
      <rect x={LEAF_X} y={cy(0, i) - (P - 6) / 2} width={LEAF_W} height={P - 6} rx="3" />
      <text class="v" x={LEAF_X + LEAF_W / 2} y={cy(0, i) + 4} text-anchor="middle">{leaves[i]}</text>
      <text class="n" x={LEAF_X - 5} y={cy(0, i) + 3.5} text-anchor="end">{labels ? labels[i] : `${leafTitle}${i}`}</text>
    </g>
  {/each}

  <g class="out {val(levels[k]![0]!)}">
    <circle cx={outX(k) + 34} cy={cy(k, 0)} r="11" />
    <text x={outX(k) + 34} y={cy(k, 0) + 4} text-anchor="middle">{levels[k]![0]}</text>
    <text class="n" x={outX(k) + 34} y={cy(k, 0) - 17} text-anchor="middle">{output}</text>
  </g>
</svg>

<style>
  .tree {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 auto;
    font-family: var(--font-mono);
    font-size: 10px;
    overflow: visible;
  }
  .w {
    fill: none;
    stroke-width: 1.5;
    opacity: 0.4;
    stroke-linejoin: round;
  }
  .w.hi {
    stroke: var(--sig-high);
  }
  .w.lo {
    stroke: var(--sig-low);
  }
  .w.path {
    stroke-width: 3.2;
    opacity: 1;
  }
  .mux rect {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.3;
  }
  .mux.on rect {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 2;
  }
  .mux text {
    fill: var(--ink-2);
    font-weight: 600;
  }
  .leaf rect {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .leaf.hi rect {
    fill: color-mix(in srgb, var(--sig-high) 22%, var(--panel));
    stroke: var(--sig-high);
  }
  .leaf.on rect {
    stroke: var(--copper);
    stroke-width: 2.4;
  }
  .leaf .v {
    font-weight: 700;
    font-size: 11px;
    fill: var(--sig-low);
  }
  .leaf.hi .v {
    fill: var(--sig-high);
  }
  .leaf .n,
  .out .n {
    fill: var(--mute);
    font-size: 9.5px;
  }
  .leaf.on .n {
    fill: var(--copper-ink);
    font-weight: 700;
  }
  .leaf.live {
    cursor: pointer;
  }
  .leaf.live:hover rect {
    stroke: var(--copper);
  }
  .leaf:focus-visible {
    outline: none;
  }
  .leaf:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 3;
  }
  .out circle {
    fill: var(--pn);
    stroke: var(--sig-low);
    stroke-width: 1.5;
  }
  .out.hi circle {
    fill: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    stroke: var(--sig-high);
    filter: drop-shadow(0 0 4px var(--sig-high-glow));
  }
  .out text:not(.n) {
    font-weight: 700;
    font-size: 11px;
    fill: var(--sig-low);
  }
  .out.hi text:not(.n) {
    fill: var(--sig-high);
  }
</style>
