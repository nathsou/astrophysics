<!--
  Theon of Smyrna's side and diagonal numbers: q' = q + p, p' = p + 2q. Each fraction p/q is a
  better approximation of √2, and p² − 2q² is always ±1 — never 0.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  let rungs = $state(4);
  const rows = $derived.by(() => {
    const out: { q: bigint; p: bigint }[] = [{ q: 1n, p: 1n }];
    while (out.length < rungs) {
      const { q, p } = out.at(-1)!;
      out.push({ q: q + p, p: p + 2n * q });
    }
    return out;
  });
  const err = (p: bigint, q: bigint) => Number(p) / Number(q) - Math.SQRT2;
</script>

<Widget title="Theon’s ladder" subtitle="Start with side 1 and diagonal 1. Each rung: new side = side + diagonal, new diagonal = diagonal + 2 × side." onreset={() => (rungs = 4)}>
  {#snippet controls()}
    <button class="go" onclick={() => (rungs = Math.min(rungs + 1, 16))}>Climb a rung</button>
    <button class="go" onclick={() => (rungs = Math.max(rungs - 1, 1))}>Back down</button>
  {/snippet}
  <div class="scroll">
    <table class="num">
      <thead>
        <tr><th>side q</th><th>diagonal p</th><th>p / q</th><th>p/q − √2</th><th><Tex tex="p^2 - 2q^2" /></th></tr>
      </thead>
      <tbody>
        {#each rows as r, i (i)}
          {@const e = err(r.p, r.q)}
          <tr class="row">
            <td>{r.q}</td>
            <td>{r.p}</td>
            <td>{(Number(r.p) / Number(r.q)).toFixed(12)}</td>
            <td class:pos={e > 0} class:neg={e < 0}>{e.toExponential(2)}</td>
            <td class="pm">{r.p * r.p - 2n * r.q * r.q > 0n ? '+1' : '−1'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="note">The approximations alternate above and below √2 ≈ 1.41421356237 and the error shrinks by a factor of about 5.8 per rung, yet <Tex tex="p^2 - 2q^2" /> never reaches 0.</p>
</Widget>

<style>
  .go {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: auto;
    margin: 0 auto;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    padding: 0.2rem 0.75rem;
    text-align: right;
    border-bottom: 1px solid var(--rule);
  }
  th {
    color: var(--ink-2);
    font-weight: 600;
  }
  .row {
    animation: in 300ms ease-out both;
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .pos {
    color: var(--byrne-red);
  }
  .neg {
    color: var(--byrne-blue);
  }
  .pm {
    font-weight: 700;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    text-align: center;
    margin: 0.6rem 0 0;
  }
</style>
