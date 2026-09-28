<!--
  The Tower of Hanoi (Lucas, 1883). Play it (click a peg, then another) or watch the recursive
  solution: move n − 1 discs out of the way, move the largest, move the n − 1 back on top.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(4);
  let pegs = $state<number[][]>([[4, 3, 2, 1], [], []]);
  let moves = $state(0);
  let selected = $state<number | null>(null);
  let solving = $state(false);
  let message = $state('');

  function reset(k = n) {
    n = k;
    pegs = [Array.from({ length: k }, (_, i) => k - i), [], []];
    moves = 0;
    selected = null;
    solving = false;
    message = '';
  }

  function move(from: number, to: number): boolean {
    const a = pegs[from]!;
    const b = pegs[to]!;
    if (!a.length) return false;
    const disc = a.at(-1)!;
    if (b.length && b.at(-1)! < disc) return false;
    pegs[from] = a.slice(0, -1);
    pegs[to] = [...b, disc];
    moves++;
    if (pegs[2]!.length === n) message = moves === 2 ** n - 1 ? `Solved in ${moves} moves — the minimum, 2^${n} − 1.` : `Solved in ${moves} moves. The minimum is 2^${n} − 1 = ${2 ** n - 1}.`;
    return true;
  }

  function click(i: number) {
    if (solving) return;
    if (selected === null) {
      if (pegs[i]!.length) selected = i;
      return;
    }
    if (selected !== i && !move(selected, i)) message = 'A larger disc may not go on a smaller one.';
    else if (selected !== i) message = pegs[2]!.length === n ? message : '';
    selected = null;
  }

  function* solution(k: number, from: number, to: number, via: number): Generator<[number, number]> {
    if (k === 0) return;
    yield* solution(k - 1, from, via, to);
    yield [from, to];
    yield* solution(k - 1, via, to, from);
  }

  async function solve() {
    reset(n);
    solving = true;
    const delay = Math.max(40, 2400 / 2 ** n);
    for (const [a, b] of solution(n, 0, 2, 1)) {
      if (!solving) return;
      move(a, b);
      await new Promise((r) => setTimeout(r, delay));
    }
    solving = false;
  }

  const W = 600;
  const pegX = [110, 300, 490];
  const discW = (d: number) => 30 + (d / n) * 140;
  const HUES = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)', 'var(--accent)', 'var(--series-2)', 'var(--series-5)'];
</script>

<Widget title="The Tower of Hanoi" subtitle="Move the tower to the right-hand peg, one disc at a time, never putting a larger disc on a smaller one. Click a peg to pick up its top disc, then click where it should go." onreset={() => reset(n)}>
  {#snippet controls()}
    <label class="ctl">discs: <strong>{n}</strong>
      <input type="range" min="1" max="8" value={n} oninput={(e) => reset(Number((e.target as HTMLInputElement).value))} aria-label="Number of discs" />
    </label>
    <button onclick={solve} disabled={solving}>Watch the recursive solution</button>
    {#if solving}<button onclick={() => (solving = false)}>Stop</button>{/if}
    <span class="count num">moves: {moves}</span>
  {/snippet}
  <svg viewBox="0 0 {W} 200" width="100%" role="group" aria-label="Three pegs with discs">
    <rect x="20" y="180" width={W - 40} height="8" rx="3" class="base" />
    {#each pegs as peg, i (i)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <g role="button" tabindex="0" aria-label="Peg {i + 1}" onclick={() => click(i)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && click(i)} class="peg" class:sel={selected === i}>
        <rect x={pegX[i]! - 95} y="20" width="190" height="165" fill="transparent" />
        <rect x={pegX[i]! - 4} y="40" width="8" height="142" rx="3" class="pole" />
        {#each peg as d, j (d)}
          <rect x={pegX[i]! - discW(d) / 2} y={165 - j * 16 - (selected === i && j === peg.length - 1 ? 14 : 0)} width={discW(d)} height="14" rx="5" fill={HUES[(d - 1) % HUES.length]} class="disc" />
        {/each}
      </g>
    {/each}
  </svg>
  {#if message}<p class="msg" class:ok={pegs[2]!.length === n}>{message}</p>{/if}
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
    font-size: 0.85rem;
    font-weight: 600;
  }
  .base {
    fill: var(--rule-strong);
  }
  .pole {
    fill: var(--ink-3);
  }
  .peg {
    cursor: pointer;
    outline: none;
  }
  .peg:focus-visible .pole,
  .peg.sel .pole {
    fill: var(--accent);
  }
  .disc {
    stroke: var(--byrne-ink);
    stroke-width: 1;
    transition: y 0.12s;
  }
  .msg {
    margin: 0.3rem 0 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--bad);
  }
  .msg.ok {
    color: var(--ok);
    font-weight: 600;
  }
</style>
