<!--
  The multiplication table modulo n. Pick a row a: when gcd(a, n) = 1 the row is a permutation of
  the non-zero remainders — the key step of Euler's and Ivory's proof.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let n = $state(7);
  let row = $state(3);
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
  const cells = $derived(Array.from({ length: n - 1 }, (_, i) => Array.from({ length: n - 1 }, (_, j) => ((i + 1) * (j + 1)) % n)));
  const rowVals = $derived(cells[row - 1] ?? []);
  const isPerm = $derived(new Set(rowVals).size === n - 1 && !rowVals.includes(0));
  const hue = (v: number) => (v === 0 ? 'var(--surface-3)' : `hsl(${(v / n) * 300} 60% 55%)`);
</script>

<Widget title="Times tables modulo n" subtitle="Entry (a, k) is a·k mod n. Click a row. When gcd(a, n) = 1, multiplying by a just shuffles the non-zero remainders." onreset={() => ((n = 7), (row = 3))}>
  {#snippet controls()}
    <label class="ctl">n = <strong>{n}</strong> <input type="range" min="3" max="16" bind:value={n} oninput={() => (row = Math.min(row, n - 1))} /></label>
    <span class="msg" class:ok={isPerm} class:bad={!isPerm}>
      Row {row}: {rowVals.join(', ')} — {isPerm ? `a permutation of 1…${n - 1}` : `not a permutation (gcd(${row}, ${n}) = ${g(row, n)})`}
    </span>
  {/snippet}
  <div class="scroll">
    <table class="num" style:--n={n}>
      <thead>
        <tr><th>×</th>{#each Array.from({ length: n - 1 }, (_, j) => j + 1) as k (k)}<th>{k}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each cells as r, i (i)}
          <tr class:sel={row === i + 1} onclick={() => (row = i + 1)}>
            <th>{i + 1}</th>
            {#each r as v, j (j)}<td style:--c={hue(v)}>{v}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .msg {
    font-size: 0.82rem;
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
  }
  .bad {
    color: var(--bad);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: auto;
    margin: 0 auto;
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.75rem;
  }
  th {
    color: var(--ink-3);
    font-weight: 600;
    padding: 0.1rem 0.3rem;
  }
  td {
    width: 1.8rem;
    height: 1.6rem;
    text-align: center;
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 35%, var(--page));
    cursor: pointer;
  }
  tr.sel td {
    background: var(--c);
    color: #111;
    font-weight: 700;
  }
  tr.sel th {
    color: var(--accent);
  }
</style>
