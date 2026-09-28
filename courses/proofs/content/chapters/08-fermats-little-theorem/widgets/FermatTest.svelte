<!--
  The Fermat primality test: if aⁿ⁻¹ ≢ 1 (mod n) then n is certainly composite (a is a witness).
  Composite n that pass for a base a are pseudoprimes; Carmichael numbers pass for every coprime base.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { gcd, modPow, isPrime, factor } from '$lib/nt';

  let n = $state(561);
  const PRESETS = [
    { n: 97, note: 'prime' },
    { n: 91, note: '7 × 13' },
    { n: 341, note: 'fools base 2' },
    { n: 561, note: 'Carmichael' },
    { n: 1105, note: 'Carmichael' },
    { n: 1729, note: 'Carmichael' },
  ];
  const valid = $derived(Number.isInteger(n) && n >= 5 && n <= 100000);
  const bases = $derived(valid ? Array.from({ length: Math.min(n - 3, 119) }, (_, i) => i + 2) : []);
  const results = $derived(
    bases.map((a) => {
      const common = gcd(BigInt(a), BigInt(n)) !== 1n;
      const pass = modPow(BigInt(a), BigInt(n - 1), BigInt(n)) === 1n;
      return { a, common, pass };
    }),
  );
  const prime = $derived(valid && isPrime(BigInt(n)));
  const coprime = $derived(results.filter((r) => !r.common));
  const liars = $derived(prime ? 0 : coprime.filter((r) => r.pass).length);
  const fac = $derived(valid ? [...factor(BigInt(n))].map(([p, e]) => (e > 1 ? `${p}^${e}` : `${p}`)).join(' × ') : '');
</script>

<Widget title="Fermat’s test" subtitle="For each base a, compute aⁿ⁻¹ mod n. If it isn’t 1, a is a witness that n is composite. If n is composite but it is 1, a is a liar." onreset={() => (n = 561)}>
  {#snippet controls()}
    <label class="ctl">n = <input type="number" min="5" max="100000" bind:value={n} /></label>
    {#each PRESETS as p (p.n)}<button onclick={() => (n = p.n)} title={p.note}>{p.n}</button>{/each}
  {/snippet}
  {#if valid}
    <p class="head">
      {n} {prime ? 'is prime.' : `= ${fac} is composite.`}
      {#if !prime}{liars} of the {coprime.length} bases coprime to {n} shown are liars{liars === coprime.length && coprime.length ? ' — every one! A Carmichael number.' : '.'}{/if}
    </p>
    <div class="grid num">
      {#each results as r (r.a)}
        <span class="b" class:common={r.common} class:liar={!prime && r.pass && !r.common} class:wit={!prime && !r.pass && !r.common} class:ok={prime} title="{r.a}^{n - 1} mod {n} {r.pass ? '= 1' : '≠ 1'}{r.common ? ` (gcd(${r.a}, ${n}) > 1)` : ''}">{r.a}</span>
      {/each}
    </div>
    <p class="legend">
      <span class="sw liar"></span> liar (passes the test) <span class="sw wit"></span> witness <span class="sw common"></span> shares a factor with n
      {#if n - 3 > 119}<span class="more">(bases up to 120 shown)</span>{/if}
    </p>
  {:else}
    <p class="warn">Choose n between 5 and 100000.</p>
  {/if}
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  input {
    width: 6.5rem;
    font: inherit;
    padding: 0.15rem 0.35rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.1rem 0.5rem;
    cursor: pointer;
  }
  .head {
    font-size: 0.9rem;
    margin: 0 0 0.6rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.3rem, 1fr));
    gap: 3px;
  }
  .b {
    text-align: center;
    font-size: 0.75rem;
    padding: 0.2rem 0;
    border-radius: 4px;
    background: var(--surface-2);
  }
  .liar {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 700;
  }
  .wit {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .common {
    background: var(--surface-3);
    color: var(--ink-3);
  }
  .b.ok {
    background: var(--ok-soft);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .sw {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    display: inline-block;
    margin-left: 0.4rem;
  }
  .sw.liar {
    background: var(--bad);
  }
  .sw.wit {
    background: var(--ok);
  }
  .sw.common {
    background: var(--surface-3);
    border: 1px solid var(--border);
  }
  .more {
    color: var(--ink-3);
  }
  .warn {
    color: var(--maybe);
  }
</style>
