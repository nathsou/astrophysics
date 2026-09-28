<!--
  The 15 puzzle, with its invariant on display: (parity of the arrangement) + (distance of the gap
  from its home corner), taken mod 2. Every move changes both by one, so the sum's parity never
  changes. Sam Loyd's version, with 14 and 15 swapped, has the wrong parity: it cannot be solved.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const SOLVED = [...Array.from({ length: 15 }, (_, i) => i + 1), 0];
  let board = $state<number[]>([...SOLVED]);
  let moves = $state(0);

  function parity(b: number[]): number {
    // Parity of the permutation of the 16 squares (gap counted as 16).
    const p = b.map((v) => (v === 0 ? 16 : v));
    let inv = 0;
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) if (p[i]! > p[j]!) inv++;
    return inv % 2;
  }
  const gap = $derived(board.indexOf(0));
  const gapDist = $derived(3 - Math.floor(gap / 4) + (3 - (gap % 4)));
  const inv = $derived((parity(board) + gapDist) % 2);
  const solved = $derived(board.every((v, i) => v === SOLVED[i]));

  function slide(i: number) {
    const r = Math.floor(i / 4);
    const c = i % 4;
    const gr = Math.floor(gap / 4);
    const gc = gap % 4;
    if (Math.abs(r - gr) + Math.abs(c - gc) !== 1) return;
    const next = [...board];
    [next[i], next[gap]] = [next[gap]!, next[i]!];
    board = next;
    moves++;
  }
  function shuffle() {
    let b = [...SOLVED];
    let g = 15;
    for (let k = 0; k < 400; k++) {
      const nbrs = [g - 4, g + 4, g % 4 ? g - 1 : -1, g % 4 < 3 ? g + 1 : -1].filter((x) => x >= 0 && x < 16);
      const t = nbrs[Math.floor(Math.random() * nbrs.length)]!;
      [b[t], b[g]] = [b[g]!, b[t]!];
      g = t;
    }
    board = b;
    moves = 0;
  }
  function loyd() {
    const b = [...SOLVED];
    [b[13], b[14]] = [b[14]!, b[13]!];
    board = b;
    moves = 0;
  }
</script>

<Widget title="The 15 puzzle" subtitle="Click a tile next to the gap to slide it. Watch the invariant: it never changes, however you play." onreset={() => ((board = [...SOLVED]), (moves = 0))}>
  {#snippet controls()}
    <button onclick={shuffle}>Shuffle (by legal moves)</button>
    <button onclick={loyd}>Sam Loyd’s $1,000 puzzle</button>
    <span class="count num">moves: {moves}</span>
  {/snippet}
  <div class="wrap">
    <div class="board" role="group" aria-label="15 puzzle board">
      {#each board as v, i (v)}
        <button class="tile" class:gap={v === 0} class:home={v !== 0 && v === SOLVED[i]} style:grid-row={Math.floor(i / 4) + 1} style:grid-column={(i % 4) + 1} onclick={() => slide(i)} disabled={v === 0} aria-label={v === 0 ? 'gap' : `tile ${v}`}>{v || ''}</button>
      {/each}
    </div>
    <div class="inv num">
      <p>parity of arrangement: <strong>{parity(board) ? 'odd' : 'even'}</strong></p>
      <p>gap’s distance from the corner: <strong>{gapDist}</strong></p>
      <p class="big">invariant = <strong class:odd={inv === 1}>{inv === 0 ? 'even' : 'odd'}</strong></p>
      <p class="note">{solved ? 'Solved!' : inv === 1 ? 'Odd: this position can never be solved (the solved position is even).' : 'Even: this position can be solved.'}</p>
    </div>
  </div>
</Widget>

<style>
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
    font-size: 0.85rem;
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(4, 3.4rem);
    grid-template-rows: repeat(4, 3.4rem);
    gap: 4px;
    padding: 6px;
    border-radius: 10px;
    background: var(--surface-3);
  }
  .tile {
    font-family: var(--font-body);
    font-size: 1.4rem;
    font-weight: 600;
    border-radius: 7px;
    border: 1px solid var(--byrne-ink);
    background: color-mix(in srgb, var(--byrne-yellow) 70%, var(--surface));
    color: #111;
    padding: 0;
    transition: transform 0.12s;
  }
  .tile.home {
    background: color-mix(in srgb, var(--byrne-yellow) 90%, white);
  }
  .tile.gap {
    background: transparent;
    border: 0;
    cursor: default;
  }
  .inv {
    font-size: 0.85rem;
    min-width: 15rem;
  }
  .inv p {
    margin: 0.2rem 0;
  }
  .big {
    font-size: 1rem;
    margin-top: 0.5rem !important;
  }
  .odd {
    color: var(--bad);
  }
  .note {
    color: var(--ink-2);
    font-size: 0.8rem;
  }
</style>
