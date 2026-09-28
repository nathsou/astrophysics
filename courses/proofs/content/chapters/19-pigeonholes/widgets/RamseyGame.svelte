<!--
  The game of Sim (Simmons, 1969) on six points: players take turns colouring an edge, red (you)
  and blue (the computer). Whoever first completes a triangle in their own colour loses. A draw is
  impossible, because R(3, 3) = 6. On five points, a draw is possible.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(6);
  type Col = 0 | 1 | 2; // none, red (you), blue (computer)
  let colour = $state<Col[]>([]);
  let over = $state<string | null>(null);
  let losing = $state<number[] | null>(null);

  const edges = $derived.by(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
    return out;
  });
  const idx = (i: number, j: number) => edges.findIndex(([a, b]) => (a === Math.min(i, j) && b === Math.max(i, j)));
  function reset() {
    colour = edges.map(() => 0 as Col);
    over = null;
    losing = null;
  }
  let pendingPentagon = false;
  $effect(() => {
    void n;
    untrack(() => {
      reset();
      if (pendingPentagon) {
        pendingPentagon = false;
        colourPentagon();
      }
    });
  });

  /** A triangle in colour c through edge e, if colouring e with c would make one. */
  function triangleWith(e: number, c: Col, cols: Col[]): number[] | null {
    const [a, b] = edges[e]!;
    for (let k = 0; k < n; k++) {
      if (k === a || k === b) continue;
      if (cols[idx(a, k)] === c && cols[idx(b, k)] === c) return [a, b, k];
    }
    return null;
  }

  function play(e: number) {
    if (over || colour[e] !== 0) return;
    const next = [...colour];
    next[e] = 1;
    const t = triangleWith(e, 1, colour);
    colour = next;
    if (t) {
      over = 'You made a red triangle — you lose!';
      losing = t;
      return;
    }
    // Computer: a random edge that does not complete a blue triangle, if there is one.
    const free = next.map((c, i) => (c === 0 ? i : -1)).filter((i) => i >= 0);
    if (free.length === 0) {
      over = 'All edges coloured and no monochromatic triangle — a draw (only possible with 5 points).';
      return;
    }
    const safe = free.filter((i) => !triangleWith(i, 2, next));
    const pick = (safe.length ? safe : free)[Math.floor(Math.random() * (safe.length ? safe.length : free.length))]!;
    const t2 = triangleWith(pick, 2, next);
    next[pick] = 2;
    colour = [...next];
    if (t2) {
      over = 'The computer had no safe move and made a blue triangle — you win!';
      losing = t2;
      return;
    }
    if (next.every((c) => c !== 0)) over = 'All edges coloured and no monochromatic triangle — a draw.';
  }

  function colourPentagon() {
    colour = edges.map(([a, b]) => ((b - a === 1 || b - a === 4 ? 1 : 2) as Col));
    over = 'Pentagon red, pentagram blue: ten edges, no monochromatic triangle. So R(3, 3) > 5.';
    losing = null;
  }
  function pentagon() {
    if (n === 5) colourPentagon();
    else {
      pendingPentagon = true;
      n = 5;
    }
  }

  const S = 300;
  const P = (i: number) => {
    const t = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [S / 2 + 115 * Math.cos(t), S / 2 + 115 * Math.sin(t)] as const;
  };
  const inLosing = (e: number) => {
    if (!losing) return false;
    const [a, b] = edges[e]!;
    return losing.includes(a) && losing.includes(b);
  };
</script>

<Widget title="Sim: a game you can’t draw" subtitle="Take turns colouring the lines between the dots — you red, the computer blue. The first to complete a triangle in their own colour loses. Click a line to play." onreset={reset}>
  {#snippet controls()}
    <label class="ctl">dots <select bind:value={n}><option value={5}>5</option><option value={6}>6</option></select></label>
    <button onclick={reset}>New game</button>
    <button onclick={pentagon}>Show a colouring of 5 dots with no triangle</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {S} {S}" width="100%" style:max-width="{S}px" role="group" aria-label="Complete graph on {n} vertices">
      {#each edges as [a, b], e (e)}
        {@const [x1, y1] = P(a)}
        {@const [x2, y2] = P(b)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <g onclick={() => play(e)} class="edge" class:free={colour[e] === 0 && !over}>
          <line {x1} {y1} {x2} {y2} class="hit" />
          <line {x1} {y1} {x2} {y2} class="vis" class:red={colour[e] === 1} class:blue={colour[e] === 2} class:lose={inLosing(e)} />
        </g>
      {/each}
      {#each Array.from({ length: n }, (_, i) => i) as i (i)}
        {@const [x, y] = P(i)}
        <circle cx={x} cy={y} r="9" class="dot" />
      {/each}
    </svg>
    <p class="msg" class:bad={over?.includes('lose')} class:ok={over?.includes('win')}>{over ?? `${colour.filter((c) => c === 0).length} lines left. Your move.`}</p>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
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
  .wrap {
    display: grid;
    justify-items: center;
  }
  .edge.free {
    cursor: pointer;
  }
  .hit {
    stroke: transparent;
    stroke-width: 14;
  }
  .vis {
    stroke: var(--rule-strong);
    stroke-width: 2;
    stroke-dasharray: 3 4;
    transition: stroke 0.2s;
  }
  .edge.free:hover .vis {
    stroke: var(--ink-2);
  }
  .vis.red {
    stroke: var(--byrne-red);
    stroke-dasharray: none;
    stroke-width: 3.5;
  }
  .vis.blue {
    stroke: var(--byrne-blue);
    stroke-dasharray: none;
    stroke-width: 3.5;
  }
  .vis.lose {
    stroke-width: 7;
  }
  .dot {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .msg {
    font-size: 0.88rem;
    margin: 0.3rem 0 0;
    text-align: center;
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
</style>
