<!--
  Euler's prime-producing polynomial n² + n + 41: prime for n = 0, …, 39, then it fails.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { factor, isPrime } from '$lib/nt';

  let upto = $state(12);
  const N = 60;
  const rows = Array.from({ length: N }, (_, n) => {
    const v = BigInt(n * n + n + 41);
    const prime = isPrime(v);
    const f = [...factor(v)].map(([p, e]) => (e > 1 ? `${p}²` : `${p}`)).join('·');
    return { n, v: Number(v), prime, f };
  });
  const firstFail = rows.find((r) => !r.prime)!.n;
  const shown = $derived(rows.slice(0, upto + 1));
  const failed = $derived(upto >= firstFail);
</script>

<Widget title="A pattern that lies" subtitle="n² + n + 41 for n = 0, 1, 2, … Drag the slider to test more values." onreset={() => (upto = 12)}>
  {#snippet controls()}
    <label class="ctl">Test up to n = <strong class="num">{upto}</strong>
      <input type="range" min="0" max={N - 1} bind:value={upto} aria-label="Largest n tested" />
    </label>
    <span class="status" class:bad={failed}>
      {#if failed}Fails at n = {firstFail}: {rows[firstFail]!.v} = {rows[firstFail]!.f}{:else}{upto + 1} primes in a row…{/if}
    </span>
  {/snippet}
  <div class="grid">
    {#each shown as r (r.n)}
      <div class="tile" class:prime={r.prime} class:comp={!r.prime} title={r.prime ? `${r.v} is prime` : `${r.v} = ${r.f}`}>
        <span class="n">n={r.n}</span>
        <span class="v num">{r.v}</span>
        {#if !r.prime}<span class="f">{r.f}</span>{/if}
      </div>
    {/each}
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
  }
  .ctl input {
    width: 14rem;
  }
  .status {
    font-size: 0.85rem;
    color: var(--ok);
    font-weight: 600;
  }
  .status.bad {
    color: var(--bad);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tile {
    display: grid;
    width: 4.7rem;
    padding: 0.3rem 0.45rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    font-size: 0.72rem;
    line-height: 1.3;
    animation: pop 220ms ease-out both;
  }
  .prime {
    background: color-mix(in srgb, var(--ok) 10%, var(--surface));
  }
  .comp {
    background: var(--bad-soft);
    border-color: var(--bad);
  }
  .n {
    color: var(--ink-3);
  }
  .v {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .f {
    color: var(--bad);
    font-weight: 600;
  }
  @keyframes pop {
    from {
      transform: scale(0.85);
      opacity: 0;
    }
  }
</style>
