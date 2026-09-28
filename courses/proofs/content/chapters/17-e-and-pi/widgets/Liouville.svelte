<!--
  Liouville's constant L = Σ 10^(−k!) = 0.110001000000000000000001000… Its truncations are
  fractions p/q with q = 10^(k!) whose error is about q^(−(k+1)): far too good for an algebraic number.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let k = $state(3);
  const fact = (m: number) => Array.from({ length: m }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
  const DIGITS = 130;
  const ones = new Set(Array.from({ length: 6 }, (_, i) => fact(i + 1)));
  const digits = Array.from({ length: DIGITS }, (_, i) => (ones.has(i + 1) ? '1' : '0'));
  const rows = $derived(
    Array.from({ length: k }, (_, i) => i + 1).map((j) => ({
      j,
      logq: fact(j),
      logerr: -fact(j + 1),
      ratio: fact(j + 1) / fact(j),
    })),
  );
</script>

<Widget title="A number that is too easy to approximate" subtitle="Liouville’s constant has a 1 in decimal places 1, 2, 6, 24, 120, … (the factorials) and 0 elsewhere. Cutting it off after the k!-th place gives a fraction p/q with q = 10^(k!)." onreset={() => (k = 3)}>
  {#snippet controls()}
    <label class="ctl">truncations k ≤ <strong>{k}</strong> <input type="range" min="1" max="6" bind:value={k} /></label>
  {/snippet}
  <p class="digits num">0.{#each digits as d, i (i)}<span class:one={d === '1'} class:cut={ones.has(i + 1) && i + 1 <= fact(k)}>{d}</span>{/each}…</p>
  <table class="num">
    <thead><tr><th>k</th><th>denominator q</th><th>error |L − p/q|</th><th>error as a power of q</th></tr></thead>
    <tbody>
      {#each rows as r (r.j)}
        <tr>
          <td>{r.j}</td>
          <td>10<sup>{r.logq}</sup></td>
          <td>≈ 10<sup>{r.logerr}</sup></td>
          <td>≈ q<sup>−{r.ratio}</sup></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">The exponent k + 1 grows without bound. An algebraic number of degree d can’t be approximated better than about q<sup>−d</sup> (Liouville’s theorem) — so L is not algebraic of any degree.</p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .digits {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
    line-height: 1.6;
    color: var(--ink-3);
  }
  .one {
    color: var(--ink);
    font-weight: 700;
  }
  .cut {
    background: var(--byrne-yellow);
    color: #111;
    border-radius: 2px;
  }
  table {
    width: auto;
    margin: 0.5rem auto;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    padding: 0.2rem 0.8rem;
    border-bottom: 1px solid var(--rule);
    text-align: right;
  }
  th {
    color: var(--ink-2);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
</style>
