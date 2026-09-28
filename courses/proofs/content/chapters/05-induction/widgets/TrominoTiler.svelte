<!--
  Golomb's theorem (1954): a 2ⁿ × 2ⁿ board with any one square removed can be tiled by L-trominoes.
  The recursive proof, animated: split into four quadrants, place one tromino at the centre covering
  one square of each quadrant that does not contain the hole, and recurse.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(3);
  let hole = $state<[number, number]>([5, 2]);
  let tiles = $state<{ cells: [number, number][]; level: number; id: number }[]>([]);
  let shown = $state(0);
  let playing = $state(false);
  const size = $derived(2 ** n);
  const PX = 360;
  const cell = $derived(PX / size);

  /** Tile the square [x0, x0+s)×[y0, y0+s) whose only covered square is (hx, hy). Returns trominoes in placement order. */
  function tile(x0: number, y0: number, s: number, hx: number, hy: number, level: number, out: { cells: [number, number][]; level: number; id: number }[]) {
    if (s === 1) return;
    const h = s / 2;
    const quads: [number, number][] = [
      [x0, y0],
      [x0 + h, y0],
      [x0, y0 + h],
      [x0 + h, y0 + h],
    ];
    // The centre square of each quadrant (the one touching the middle of the board).
    const centres: [number, number][] = [
      [x0 + h - 1, y0 + h - 1],
      [x0 + h, y0 + h - 1],
      [x0 + h - 1, y0 + h],
      [x0 + h, y0 + h],
    ];
    const inQuad = (q: [number, number], x: number, y: number) => x >= q[0] && x < q[0] + h && y >= q[1] && y < q[1] + h;
    const holeQuad = quads.findIndex((q) => inQuad(q, hx, hy));
    const cells = centres.filter((_, i) => i !== holeQuad);
    out.push({ cells, level, id: out.length });
    quads.forEach((q, i) => {
      const [cx, cy] = i === holeQuad ? [hx, hy] : centres[i]!;
      tile(q[0], q[1], h, cx, cy, level + 1, out);
    });
  }

  function build() {
    const out: { cells: [number, number][]; level: number; id: number }[] = [];
    tile(0, 0, size, hole[0], hole[1], 0, out);
    tiles = out;
    shown = 0;
  }
  $effect(() => {
    void n;
    void hole;
    build();
  });

  $effect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (shown >= tiles.length) {
        playing = false;
        return;
      }
      shown++;
    }, Math.max(15, 600 / 2 ** n));
    return () => clearInterval(id);
  });

  function pick(e: MouseEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size);
    const y = Math.floor(((e.clientY - r.top) / r.height) * size);
    if (x >= 0 && y >= 0 && x < size && y < size) hole = [x, y];
  }

  const fillPath = (cells: [number, number][]) => cells.map(([x, y]) => `M${x * cell},${y * cell}h${cell}v${cell}h${-cell}z`).join('');
  /** Outline of a tromino: the cell edges that do not touch another cell of the same tromino. */
  const edgePath = (cells: [number, number][]) => {
    const has = (x: number, y: number) => cells.some(([a, b]) => a === x && b === y);
    let d = '';
    for (const [x, y] of cells) {
      const [l, t, r, b] = [x * cell, y * cell, (x + 1) * cell, (y + 1) * cell];
      if (!has(x, y - 1)) d += `M${l},${t}H${r}`;
      if (!has(x + 1, y)) d += `M${r},${t}V${b}`;
      if (!has(x, y + 1)) d += `M${l},${b}H${r}`;
      if (!has(x - 1, y)) d += `M${l},${t}V${b}`;
    }
    return d;
  };
  const PALETTE = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)'];
  const setN = (k: number) => {
    n = k;
    hole = [Math.min(hole[0], 2 ** k - 1), Math.min(hole[1], 2 ** k - 1)];
  };
</script>

<Widget title="Tiling with trominoes" subtitle="Click any square to remove it, then tile. Each tromino is placed by the inductive step: quarter the board, put one tromino in the middle, recurse." onreset={() => ((shown = 0), (playing = false))}>
  {#snippet controls()}
    <label class="ctl">board {size} × {size}
      <input type="range" min="1" max="6" value={n} oninput={(e) => setN(Number((e.target as HTMLInputElement).value))} aria-label="Board size exponent" />
    </label>
    <button onclick={() => ((shown = 0), (playing = true))}>Tile it</button>
    <button onclick={() => (shown = Math.min(tiles.length, shown + 1))}>One tromino</button>
    <button onclick={() => (shown = tiles.length)}>All at once</button>
    <span class="count num">{shown} / {tiles.length} trominoes · (4<sup>{n}</sup> − 1)/3 = {(4 ** n - 1) / 3}</span>
  {/snippet}
  <div class="wrap">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <svg viewBox="0 0 {PX} {PX}" width="100%" style:max-width="{PX}px" onclick={pick} role="img" aria-label="A {size} by {size} board with one square removed">
      {#each Array.from({ length: size }, (_, i) => i) as y (y)}
        {#each Array.from({ length: size }, (_, i) => i) as x (x)}
          <rect x={x * cell} y={y * cell} width={cell} height={cell} class="sq" class:odd={(x + y) % 2 === 1} />
        {/each}
      {/each}
      {#each tiles.slice(0, shown) as t (t.id)}
        <g class="tro">
          <path d={fillPath(t.cells)} fill={PALETTE[t.id % PALETTE.length]} style:opacity={1 - t.level * 0.12} />
          <path d={edgePath(t.cells)} class="edge" />
        </g>
      {/each}
      <rect x={hole[0] * cell} y={hole[1] * cell} width={cell} height={cell} class="hole" />
      {#if shown > 0 && n > 1}
        <line x1={PX / 2} x2={PX / 2} y1="0" y2={PX} class="split" />
        <line y1={PX / 2} y2={PX / 2} x1="0" x2={PX} class="split" />
      {/if}
    </svg>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.82rem;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .wrap {
    display: grid;
    justify-items: center;
  }
  svg {
    cursor: crosshair;
  }
  .sq {
    fill: var(--page);
    stroke: var(--rule);
    stroke-width: 0.5;
  }
  .sq.odd {
    fill: var(--surface-2);
  }
  .tro {
    animation: drop 0.25s ease-out;
  }
  .edge {
    fill: none;
    stroke: var(--byrne-ink);
    stroke-width: 2;
    stroke-linecap: square;
  }
  @keyframes drop {
    from {
      opacity: 0;
    }
  }
  .hole {
    fill: var(--byrne-ink);
  }
  .split {
    stroke: var(--byrne-ink);
    stroke-width: 2;
    stroke-dasharray: 6 4;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
