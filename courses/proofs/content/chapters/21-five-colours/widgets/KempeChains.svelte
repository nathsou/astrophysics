<!--
  Kempe chains: the heart of the five-colour theorem. The centre vertex v has five neighbours using
  all five colours. Pick two colours and a neighbour: the chain of vertices reachable through those
  two colours can have its colours swapped without spoiling the colouring. The right swap frees a
  colour for v.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const COLOURS = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)'];
  const NAMES = ['red', 'blue', 'yellow', 'green', 'purple'];
  // Vertices: 0 = v (centre), 1–5 = neighbours, then extra vertices.
  const pos: [number, number][] = [
    [0, 0],
    ...[90, 18, -54, -126, 162].map((a) => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)] as [number, number]),
    [1.3, 1.25], // 6 w1
    [1.95, -0.25], // 7 w2
    [1.35, 0.3], // 8 x1
    [-1.65, -0.6], // 9 y1
    [-1.2, 1.25], // 10 z1
  ];
  const E: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [2, 3], [3, 4], [4, 5], [5, 1],
    [1, 6], [2, 6], [6, 7], [7, 3], [2, 7],
    [2, 8], [8, 6], [8, 7],
    [9, 4], [9, 5],
    [10, 5], [10, 1],
  ];
  const START = [-1, 0, 1, 2, 3, 4, 2, 0, 3, 1, 2];
  let colour = $state<number[]>([...START]);
  let pair = $state<[number, number]>([0, 2]);
  let chain = $state<number[]>([]);
  let log = $state('Pick two colours, then click one of v’s neighbours to see its chain.');

  const nbr = (i: number) => E.filter(([a, b]) => a === i || b === i).map(([a, b]) => (a === i ? b : a));
  const vNbrColours = $derived(new Set(nbr(0).map((i) => colour[i])));
  const free = $derived([0, 1, 2, 3, 4].filter((c) => !vNbrColours.has(c)));

  function pickVertex(i: number) {
    if (i === 0) {
      if (free.length && colour[0] === -1) {
        colour[0] = free[0]!;
        log = `v coloured ${NAMES[free[0]!]} — the graph is five-coloured.`;
      }
      return;
    }
    const c = colour[i]!;
    if (!pair.includes(c)) {
      log = `That vertex is ${NAMES[c]}; pick a vertex coloured ${NAMES[pair[0]]} or ${NAMES[pair[1]]}.`;
      return;
    }
    // Component of the (pair[0], pair[1])-subgraph containing i, ignoring v.
    const seen = new Set([i]);
    const stack = [i];
    while (stack.length) {
      const u = stack.pop()!;
      for (const w of nbr(u)) if (w !== 0 && !seen.has(w) && pair.includes(colour[w]!)) {
        seen.add(w);
        stack.push(w);
      }
    }
    chain = [...seen];
    const others = nbr(0).filter((w) => w !== i && pair.includes(colour[w]!) && seen.has(w));
    log = others.length
      ? `This ${NAMES[pair[0]]}–${NAMES[pair[1]]} chain also contains neighbour ${others.join(', ')} of v: swapping would not free a colour. Try the other pair.`
      : `This chain contains no other neighbour of v coloured ${NAMES[pair[0]]}/${NAMES[pair[1]]}. Swap it to free a colour!`;
  }
  function swap() {
    if (!chain.length) return;
    colour = colour.map((c, i) => (chain.includes(i) ? (c === pair[0] ? pair[1] : pair[0]) : c));
    chain = [];
    log = free.length ? `Swapped. Colour ${NAMES[free[0]!]} is now free for v — click v.` : 'Swapped.';
  }
  function reset() {
    colour = [...START];
    chain = [];
    log = 'Pick two colours, then click one of v’s neighbours to see its chain.';
  }
  const S = 330;
  const X = (x: number) => S / 2 + x * 72;
  const Y = (y: number) => S / 2 - y * 72;
  const proper = $derived(E.every(([a, b]) => colour[a] === -1 || colour[b] === -1 || colour[a] !== colour[b]));
</script>

<Widget title="Kempe chains" subtitle="v’s five neighbours use all five colours. Choose two colours, click a neighbour to highlight its two-coloured chain, and swap the chain’s colours." onreset={reset}>
  {#snippet controls()}
    <span class="lab">colours:</span>
    {#each [0, 1, 2, 3, 4] as c (c)}
      <button class="chip" class:on={pair.includes(c)} style:--c={COLOURS[c]} onclick={() => ((pair = [pair[1], c]), (chain = []))} aria-label="Select {NAMES[c]}"></button>
    {/each}
    <button onclick={swap} disabled={!chain.length}>Swap the chain</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {S} {S}" width="100%" style:max-width="{S}px" role="group" aria-label="A planar graph with a partial five-colouring">
      {#each E as [a, b] (a + '-' + b)}
        <line x1={X(pos[a]![0])} y1={Y(pos[a]![1])} x2={X(pos[b]![0])} y2={Y(pos[b]![1])} class="e" class:hot={chain.includes(a) && chain.includes(b)} />
      {/each}
      {#each pos as p, i (i)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <g transform="translate({X(p[0])},{Y(p[1])})" onclick={() => pickVertex(i)} class="v" class:inchain={chain.includes(i)}>
          <circle r={i === 0 ? 15 : 12} fill={colour[i]! >= 0 ? COLOURS[colour[i]!] : 'var(--surface)'} />
          {#if i === 0}<text y="5">v</text>{:else if i <= 5}<text y="4" class="small">{i}</text>{/if}
        </g>
      {/each}
    </svg>
    <div class="info">
      <p>{log}</p>
      <p class="num">Colours free for v: <strong>{free.length ? free.map((c) => NAMES[c]).join(', ') : 'none yet'}</strong></p>
      <p class:bad={!proper} class="small2">{proper ? 'The colouring is proper (no edge joins two equal colours).' : 'Oops: an edge joins two equal colours.'}</p>
    </div>
  </div>
</Widget>

<style>
  .lab {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .chip {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .chip.on {
    border-color: var(--ink);
    box-shadow: 0 0 0 2px var(--surface) inset;
  }
  button:not(.chip) {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: center;
    justify-content: center;
  }
  .e {
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }
  .e.hot {
    stroke: var(--ink);
    stroke-width: 4;
  }
  .v {
    cursor: pointer;
  }
  .v circle {
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
    transition: fill 0.3s;
  }
  .v.inchain circle {
    stroke-width: 4;
  }
  .v text {
    font-size: 13px;
    font-weight: 700;
    text-anchor: middle;
    fill: var(--ink);
    font-family: var(--font-body);
    font-style: italic;
    pointer-events: none;
  }
  .v text.small {
    font-size: 10px;
    fill: #111;
    font-style: normal;
    font-family: var(--font-ui);
  }
  .info {
    font-size: 0.85rem;
    max-width: 19rem;
  }
  .info p {
    margin: 0.3rem 0;
  }
  .small2 {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .bad {
    color: var(--bad);
  }
</style>
