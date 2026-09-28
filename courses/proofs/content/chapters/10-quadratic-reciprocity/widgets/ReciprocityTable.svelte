<!--
  The table of Legendre symbols (p/q) for odd primes p (row) and q (column). Quadratic reciprocity
  says it is symmetric — except that it flips sign when both p and q are ≡ 3 (mod 4).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { jacobi, primesUpTo } from '$lib/nt';

  let N = $state(47);
  let mark = $state(false);
  let hover = $state<[number, number] | null>(null);
  const primes = $derived(primesUpTo(N).filter((p) => p > 2));
  const sym = (a: number, q: number) => (a === q ? 0 : jacobi(BigInt(a), BigInt(q)));
</script>

<Widget title="The table of squares" subtitle="Row p, column q: blue if p is a square modulo q, red if not — the Legendre symbol (p/q). Hover a cell to compare it with its mirror image (q/p)." onreset={() => ((N = 47), (mark = false))}>
  {#snippet controls()}
    <label class="ctl">primes up to <strong>{N}</strong> <input type="range" min="13" max="89" bind:value={N} /></label>
    <label class="ctl"><input type="checkbox" bind:checked={mark} /> outline primes ≡ 3 (mod 4)</label>
  {/snippet}
  <div class="scroll">
    <table class="num">
      <thead>
        <tr>
          <th class="corner">p \ q</th>
          {#each primes as q (q)}<th class:m3={mark && q % 4 === 3}>{q}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each primes as p (p)}
          <tr>
            <th class:m3={mark && p % 4 === 3}>{p}</th>
            {#each primes as q (q)}
              {@const s = sym(p, q)}
              <td
                class:pos={s === 1}
                class:neg={s === -1}
                class:both3={mark && p % 4 === 3 && q % 4 === 3 && p !== q}
                class:hl={hover && ((hover[0] === p && hover[1] === q) || (hover[0] === q && hover[1] === p))}
                onmouseenter={() => (hover = [p, q])}
                onmouseleave={() => (hover = null)}
              ></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="read num">
    {#if hover && hover[0] !== hover[1]}
      ({hover[0]}/{hover[1]}) = {sym(hover[0], hover[1]) > 0 ? '+1' : '−1'}, &nbsp;({hover[1]}/{hover[0]}) = {sym(hover[1], hover[0]) > 0 ? '+1' : '−1'} —
      {sym(hover[0], hover[1]) === sym(hover[1], hover[0]) ? 'the same' : 'opposite'}{hover[0] % 4 === 3 && hover[1] % 4 === 3 ? ' (both ≡ 3 mod 4)' : ''}.
    {:else}
      Hover a cell.
    {/if}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: auto;
    margin: 0 auto;
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.62rem;
  }
  th {
    color: var(--ink-3);
    font-weight: 600;
    padding: 0 0.2rem;
    border-radius: 3px;
  }
  th.m3 {
    color: var(--accent);
  }
  .corner {
    font-size: 0.6rem;
  }
  td {
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 3px;
    background: var(--surface-3);
    cursor: crosshair;
  }
  td.pos {
    background: var(--byrne-blue);
  }
  td.neg {
    background: var(--byrne-red);
  }
  td.both3 {
    outline: 2px solid var(--byrne-yellow);
    outline-offset: -2px;
  }
  td.hl {
    box-shadow: 0 0 0 2px var(--ink);
  }
  .read {
    font-size: 0.82rem;
    text-align: center;
    margin: 0.4rem 0 0;
    color: var(--ink-2);
  }
</style>
