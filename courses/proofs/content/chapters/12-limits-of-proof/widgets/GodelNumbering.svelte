<!--
  Gödel numbering: give each symbol a code, and encode a formula s₁s₂…sₖ as 2^c(s₁) · 3^c(s₂) · 5^c(s₃) ⋯
  Unique factorisation lets you decode it again. Statements about formulas become statements about numbers.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { factor, primesUpTo } from '$lib/nt';

  const SYMBOLS: [string, number, string][] = [
    ['0', 1, 'zero'],
    ['S', 2, 'successor'],
    ['=', 3, 'equals'],
    ['+', 4, 'plus'],
    ['×', 5, 'times'],
    ['(', 6, ''],
    [')', 7, ''],
    ['¬', 8, 'not'],
    ['→', 9, 'implies'],
    ['∀', 10, 'for all'],
    ['x', 11, 'variable'],
    ['y', 12, 'variable'],
  ];
  const CODE = new Map(SYMBOLS.map(([s, c]) => [s, c]));
  const BY_CODE = new Map(SYMBOLS.map(([s, c]) => [c, s]));
  const PRIMES = primesUpTo(200).map(BigInt);

  let formula = $state('S0+S0=SS0');
  let decodeInput = $state('');

  const symbols = $derived([...formula.replace(/\s+/g, '')].filter((c) => CODE.has(c)));
  const unknown = $derived([...formula.replace(/\s+/g, '')].filter((c) => !CODE.has(c)));
  const number = $derived(symbols.reduce((acc, s, i) => acc * PRIMES[i]! ** BigInt(CODE.get(s)!), 1n));
  const digits = $derived(number.toString());

  const decoded = $derived.by(() => {
    const t = decodeInput.trim();
    if (!/^\d+$/.test(t)) return null;
    const n = BigInt(t);
    if (n < 2n || t.length > 60) return null;
    const f = factor(n);
    const out: string[] = [];
    let i = 0;
    for (const [p, e] of f) {
      if (p !== PRIMES[i]) return { ok: false, text: `Not a Gödel number: the primes must be 2, 3, 5, … with no gaps (found ${p}).` };
      const s = BY_CODE.get(e);
      if (!s) return { ok: false, text: `Exponent ${e} of ${p} is not the code of any symbol.` };
      out.push(s);
      i++;
    }
    return { ok: true, text: out.join('') };
  });
</script>

<Widget title="Gödel numbering" subtitle="Each symbol has a code. A formula s₁ s₂ … sₖ becomes the number 2^code(s₁) · 3^code(s₂) · 5^code(s₃) ⋯ — and unique factorisation means it can be decoded again." onreset={() => ((formula = 'S0+S0=SS0'), (decodeInput = ''))}>
  <div class="codes">
    {#each SYMBOLS as [s, c, name] (s)}
      <button class="sym" onclick={() => (formula += s)} title={name}><span class="s">{s}</span><span class="c">{c}</span></button>
    {/each}
    <button class="sym clear" onclick={() => (formula = '')}>clear</button>
  </div>
  <label class="in">Formula <input bind:value={formula} spellcheck="false" aria-label="Formula to encode" /></label>
  {#if unknown.length}<p class="warn">Ignoring symbols not in the alphabet: {unknown.join(' ')}</p>{/if}
  <p class="factors num">
    {#each symbols as s, i (i)}{#if i} · {/if}{PRIMES[i]}<sup>{CODE.get(s)}</sup>{/each}
    {#if !symbols.length}—{/if}
  </p>
  <p class="big num">= {digits.length > 90 ? `${digits.slice(0, 40)}…${digits.slice(-20)} (${digits.length} digits)` : digits}</p>
  <label class="in">Decode a number <input bind:value={decodeInput} placeholder="e.g. 2^2 · 3 = 12 → type 12" inputmode="numeric" aria-label="Number to decode" /></label>
  {#if decoded}<p class:ok={decoded.ok} class:bad={!decoded.ok} class="dec">{decoded.ok ? `Decodes to: ${decoded.text}` : decoded.text}</p>{/if}
</Widget>

<style>
  .codes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.6rem;
  }
  .sym {
    display: grid;
    justify-items: center;
    min-width: 2.2rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.15rem 0.35rem;
    cursor: pointer;
    font: inherit;
  }
  .sym .s {
    font-family: var(--font-body);
    font-size: 1.05rem;
  }
  .sym .c {
    font-size: 0.65rem;
    color: var(--ink-3);
  }
  .clear {
    font-size: 0.75rem;
    align-content: center;
  }
  .in {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85rem;
    margin: 0.4rem 0;
  }
  .in input {
    flex: 1;
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.25rem 0.45rem;
    border-radius: 6px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .factors {
    font-size: 0.9rem;
    margin: 0.3rem 0 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--byrne-red);
    overflow-wrap: anywhere;
    margin: 0.2rem 0 0.6rem;
  }
  .dec {
    font-size: 0.85rem;
    margin: 0.2rem 0 0;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
  }
  .warn {
    color: var(--maybe);
    font-size: 0.8rem;
  }
</style>
