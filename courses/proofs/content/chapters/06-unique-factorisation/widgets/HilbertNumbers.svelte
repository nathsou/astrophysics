<!--
  Hilbert's numbers 1, 5, 9, 13, … (those ≡ 1 mod 4) are closed under multiplication. Call one
  "Hilbert-prime" if it is not a product of two smaller Hilbert numbers. Factorisation into
  Hilbert primes exists — but is not unique.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const LIMIT = 2000;
  const isH = (n: number) => n % 4 === 1;
  const hPrime: boolean[] = [];
  for (let n = 1; n <= LIMIT; n++) {
    if (!isH(n) || n === 1) continue;
    let prime = true;
    for (let d = 5; d * d <= n; d += 4) if (n % d === 0 && isH(n / d)) prime = false;
    hPrime[n] = prime;
  }

  /** All factorisations of n into Hilbert primes (non-decreasing). */
  function factorisations(n: number, min = 5): number[][] {
    if (n === 1) return [[]];
    const out: number[][] = [];
    for (let d = min; d <= n; d += 4) {
      if (!hPrime[d] || n % d !== 0 || !isH(n / d)) continue;
      for (const rest of factorisations(n / d, d)) out.push([d, ...rest]);
    }
    return out;
  }

  let n = $state(441);
  const fs = $derived(isH(n) && n > 1 && n <= LIMIT ? factorisations(n) : []);
  const ambiguous = Array.from({ length: LIMIT }, (_, i) => i + 1).filter((k) => isH(k) && k > 1 && factorisations(k).length > 1).slice(0, 12);
  const hp = Array.from({ length: 120 }, (_, i) => i + 1).filter((k) => hPrime[k]);
</script>

<Widget title="Hilbert’s strange arithmetic" subtitle="Only numbers of the form 4k + 1 exist in this world: 1, 5, 9, 13, 17, 21, 25, … A “Hilbert prime” is one that isn’t a product of two smaller Hilbert numbers." onreset={() => (n = 441)}>
  {#snippet controls()}
    <label class="ctl">Factor <input type="number" min="5" max={LIMIT} step="4" bind:value={n} /></label>
    <span class="hint">Try:</span>
    {#each ambiguous.slice(0, 6) as k (k)}<button onclick={() => (n = k)}>{k}</button>{/each}
  {/snippet}
  {#if !isH(n)}
    <p class="warn">{n} is not a Hilbert number: it leaves remainder {n % 4} on division by 4.</p>
  {:else if n > LIMIT}
    <p class="warn">Please stay below {LIMIT}.</p>
  {:else}
    <p class="head num">{n} = {fs.length === 1 && fs[0]!.length === 1 ? 'a Hilbert prime' : ''}</p>
    <ul class="fs">
      {#each fs as f, i (i)}
        <li class:alt={fs.length > 1}>{#each f as p, j (j)}{#if j} × {/if}<span class="p">{p}</span>{/each}</li>
      {/each}
    </ul>
    {#if fs.length > 1}
      <p class="bad">{fs.length} different factorisations into Hilbert primes!</p>
    {/if}
  {/if}
  <p class="list">Hilbert primes below 120: {hp.join(', ')}. Note 9 = 3 × 3 and 21 = 3 × 7 are Hilbert primes, because 3 and 7 don’t exist in this world.</p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  input {
    width: 6rem;
    font: inherit;
    padding: 0.15rem 0.35rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.1rem 0.45rem;
    cursor: pointer;
  }
  .head {
    font-size: 1.1rem;
    margin: 0;
  }
  .fs {
    list-style: none;
    padding: 0;
    margin: 0.4rem 0;
    display: grid;
    gap: 0.3rem;
    font-size: 1.15rem;
    font-family: var(--font-body);
  }
  .p {
    display: inline-block;
    padding: 0.05rem 0.45rem;
    border-radius: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .alt .p {
    border-color: var(--byrne-red);
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
    margin: 0.2rem 0;
  }
  .warn {
    color: var(--maybe);
  }
  .list {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
