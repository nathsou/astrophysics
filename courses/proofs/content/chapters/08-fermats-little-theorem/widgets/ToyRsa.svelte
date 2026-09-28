<!--
  Toy RSA: choose primes p, q, a public exponent e; the private exponent d is e⁻¹ mod (p−1)(q−1).
  Encrypt each character code m as mᵉ mod n and decrypt with cᵈ mod n. Euler's theorem is why it works.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { gcd, modInv, modPow } from '$lib/nt';

  const PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  let p = $state(61);
  let q = $state(53);
  let e = $state(17);
  let msg = $state('Proof!');

  const n = $derived(p * q);
  const phi = $derived((p - 1) * (q - 1));
  const eOk = $derived(p !== q && e > 1 && e < phi && gcd(BigInt(e), BigInt(phi)) === 1n);
  const d = $derived(eOk ? Number(modInv(BigInt(e), BigInt(phi))) : null);
  const codes = $derived([...msg].map((ch) => ch.codePointAt(0)!));
  const tooBig = $derived(codes.some((m) => m >= n));
  const cipher = $derived(eOk && !tooBig ? codes.map((m) => Number(modPow(BigInt(m), BigInt(e), BigInt(n)))) : []);
  const back = $derived(d !== null ? cipher.map((c) => Number(modPow(BigInt(c), BigInt(d), BigInt(n)))) : []);
  const eChoices = $derived([3, 5, 7, 11, 13, 17, 19, 23, 65537].filter((x) => x < phi && gcd(BigInt(x), BigInt(phi)) === 1n));
</script>

<Widget title="RSA in miniature" subtitle="Anyone may know n and e and encrypt. Only someone who knows p and q can compute d — and undo the encryption." onreset={() => ((p = 61), (q = 53), (e = 17), (msg = 'Proof!'))}>
  {#snippet controls()}
    <label class="ctl">p <select bind:value={p}>{#each PRIMES as x (x)}<option value={x}>{x}</option>{/each}</select></label>
    <label class="ctl">q <select bind:value={q}>{#each PRIMES as x (x)}<option value={x}>{x}</option>{/each}</select></label>
    <label class="ctl">e <select bind:value={e}>{#each eChoices as x (x)}<option value={x}>{x}</option>{/each}</select></label>
    <label class="ctl">message <input bind:value={msg} maxlength="24" /></label>
  {/snippet}
  <div class="keys num">
    <div class="pub"><span class="lab">public key</span> n = {p} × {q} = <strong>{n}</strong>, e = <strong>{e}</strong></div>
    <div class="priv"><span class="lab">private key</span> φ(n) = ({p} − 1)({q} − 1) = {phi}, d = e⁻¹ mod φ(n) = <strong>{d ?? '—'}</strong></div>
  </div>
  {#if p === q}
    <p class="warn">Choose two different primes.</p>
  {:else if !eOk}
    <p class="warn">e must be coprime to φ(n) = {phi}.</p>
  {:else if tooBig}
    <p class="warn">Some character codes are ≥ n = {n}; choose larger primes.</p>
  {:else}
    <table class="num">
      <thead><tr><th>character</th><th>m</th><th>c = mᵉ mod n</th><th>cᵈ mod n</th><th></th></tr></thead>
      <tbody>
        {#each codes as m, i (i)}
          <tr><td>{[...msg][i]}</td><td>{m}</td><td class="c">{cipher[i]}</td><td>{back[i]}</td><td>{String.fromCodePoint(back[i]!)}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
  input {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.1rem 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  input {
    width: 9rem;
  }
  .keys {
    display: grid;
    gap: 0.3rem;
    font-size: 0.85rem;
    margin-bottom: 0.7rem;
  }
  .keys > div {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
  }
  .pub {
    background: color-mix(in srgb, var(--byrne-blue) 14%, var(--page));
  }
  .priv {
    background: color-mix(in srgb, var(--byrne-red) 14%, var(--page));
  }
  .lab {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    margin-right: 0.5rem;
    color: var(--ink-2);
  }
  table {
    width: auto;
    margin: 0 auto;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    padding: 0.2rem 0.8rem;
    border-bottom: 1px solid var(--rule);
    text-align: right;
  }
  .c {
    color: var(--byrne-red);
    font-weight: 600;
  }
  .warn {
    color: var(--maybe);
  }
</style>
