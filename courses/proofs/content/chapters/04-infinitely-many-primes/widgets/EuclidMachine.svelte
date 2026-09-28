<!--
  Euclid's argument as a machine: multiply the primes you have, add one, and factor the result.
  Its prime factors are new. Starting from {2} this produces the Euclid–Mullin sequence.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { smallestPrimeFactor, isPrime } from '$lib/nt';

  const STARTS: { name: string; list: bigint[] }[] = [
    { name: '{2}', list: [2n] },
    { name: '{2, 3, 5, 7, 11, 13}', list: [2n, 3n, 5n, 7n, 11n, 13n] },
    { name: '{3, 5}', list: [3n, 5n] },
  ];

  interface Row {
    list: bigint[];
    N: bigint;
    factor: bigint | null;
    prime: boolean;
  }
  let start = $state(0);
  let rows = $state<Row[]>([]);
  let busy = $state(false);
  let list = $state<bigint[]>([2n]);

  function reset() {
    list = [...STARTS[start]!.list];
    rows = [];
  }
  $effect(() => {
    void start;
    reset();
  });

  async function step() {
    busy = true;
    await new Promise((r) => setTimeout(r, 30));
    const N = list.reduce((a, b) => a * b, 1n) + 1n;
    const f = N < 10n ** 45n ? smallestPrimeFactor(N) : null;
    rows = [...rows, { list: [...list], N, factor: f, prime: f === N && isPrime(N) }];
    if (f !== null) list = [...list, f];
    busy = false;
  }

  const stuck = $derived(rows.length > 0 && rows.at(-1)!.factor === null);
  const short = (n: bigint) => {
    const s = n.toString();
    return s.length > 28 ? `${s.slice(0, 12)}…${s.slice(-8)} (${s.length} digits)` : s;
  };
</script>

<Widget title="Euclid’s machine" subtitle="Multiply the primes you have and add 1. The result has a prime factor that is not on your list — add it, and repeat." onreset={reset}>
  {#snippet controls()}
    <label class="sel">Start from
      <select bind:value={start}>{#each STARTS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select>
    </label>
    <button onclick={step} disabled={busy || stuck}>{rows.length ? 'Next prime' : 'Run the machine'}</button>
  {/snippet}
  <p class="list">Primes so far: {#each list as p, i (i)}<span class="chip" class:new={i >= STARTS[start]!.list.length}>{p}</span>{/each}</p>
  {#if rows.length}
    <ol class="rows num">
      {#each rows as r, i (i)}
        <li>
          <span class="prod">{r.list.length > 6 ? `(product of ${r.list.length} primes)` : r.list.join(' × ')} + 1 = <strong>{short(r.N)}</strong></span>
          {#if r.factor === null}
            <span class="warn">too big to factor here — but it has a prime factor, and none of the primes on the list divide it.</span>
          {:else if r.prime}
            <span class="ok">which is itself prime</span>
          {:else}
            <span class="comp">= {r.factor} × {short(r.N / r.factor)}; smallest prime factor {r.factor}</span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</Widget>

<style>
  .sel {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
  button {
    font: inherit;
    font-size: 0.82rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.2rem 0.7rem;
    color: var(--ink);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    margin: 0 0 0.6rem;
  }
  .chip {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.05rem 0.45rem;
    border-radius: 99px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .chip.new {
    background: var(--accent-soft);
    color: var(--accent-ink);
    border-color: var(--accent);
    animation: pop 0.35s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
    }
  }
  .rows {
    margin: 0;
    padding-left: 1.4rem;
    font-size: 0.82rem;
    display: grid;
    gap: 0.35rem;
  }
  .rows li {
    overflow-wrap: anywhere;
  }
  .rows span {
    overflow-wrap: anywhere;
  }
  .prod {
    font-family: var(--font-mono);
    margin-right: 0.5rem;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .comp {
    color: var(--byrne-red);
    font-weight: 600;
  }
  .warn {
    color: var(--maybe);
  }
</style>
