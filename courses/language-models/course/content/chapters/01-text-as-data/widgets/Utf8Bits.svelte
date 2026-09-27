<script lang="ts">
  import * as T from '@lm/core/text';
  import { focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  const EXAMPLES = ['A', '~', 'é', 'ß', 'Ω', '€', '中', '😀', '𝄞'];
  let ch = $state('€');

  const cp = $derived(T.codePoints(ch)[0] ?? 0x41);
  const n = $derived(T.utf8Length(cp));
  const payloadBits = $derived([7, 11, 16, 21][n - 1]!);
  const bits = $derived(cp.toString(2).padStart(payloadBits, '0'));

  // Byte templates: fixed prefix bits followed by payload slots.
  const PREFIX = [['0'], ['110', '10'], ['1110', '10', '10'], ['11110', '10', '10', '10']] as const;
  const SLOTS = [[7], [5, 6], [4, 6, 6], [3, 6, 6, 6]] as const;

  const bytes = $derived.by(() => {
    const prefixes = PREFIX[n - 1]!;
    const slots = SLOTS[n - 1]!;
    let offset = 0;
    return slots.map((w, i) => {
      const payload = bits.slice(offset, offset + w);
      const start = offset;
      offset += w;
      const value = parseInt(prefixes[i]! + payload, 2);
      return { prefix: prefixes[i]!, payload, start, value };
    });
  });

  // Colour of payload bit k (by destination byte).
  const byteOf = (k: number) => bytes.findIndex((b) => k >= b.start && k < b.start + b.payload.length);
  const RANGES = [
    { lo: 0x0, hi: 0x7f, n: 1 },
    { lo: 0x80, hi: 0x7ff, n: 2 },
    { lo: 0x800, hi: 0xffff, n: 3 },
    { lo: 0x10000, hi: 0x10ffff, n: 4 },
  ];
</script>

<Widget
  title="How UTF-8 packs a code point"
  subtitle="Pick a character. Its code point’s bits are split into groups and poured into the payload slots (x) of 1–4 byte templates. The prefixes make every byte self-describing."
  onreset={() => (ch = '€')}
>
  {#snippet controls()}
    <label class="field">
      <span>Character</span>
      <input value={ch} maxlength="2" oninput={(e) => (ch = [...e.currentTarget.value].at(-1) ?? 'A')} aria-label="Character" />
    </label>
    <div class="ex" role="group" aria-label="Examples">
      {#each EXAMPLES as e (e)}<button class:on={e === ch} onclick={() => (ch = e)}>{e}</button>{/each}
    </div>
  {/snippet}

  <div class="layout">
    <div class="flow">
      <div class="line">
        <span class="lbl">Code point</span>
        <span class="big">{ch}</span>
        <span class="mono">{T.formatCodePoint(cp)} = {cp.toLocaleString('en-GB')}</span>
      </div>
      <div class="line">
        <span class="lbl">{payloadBits} payload bits</span>
        <span class="bits mono">
          {#each bits as b, k (k)}<span class="bit b{byteOf(k)}">{b}</span>{/each}
        </span>
      </div>
      <div class="line">
        <span class="lbl">{n} byte{n > 1 ? 's' : ''}</span>
        <span class="bytes">
          {#each bytes as byte, i (i)}
            <span class="byte">
              <span class="mono"><span class="prefix">{byte.prefix}</span>{#each byte.payload as b, k (k)}<span class="bit b{i}">{b}</span>{/each}</span>
              <span class="hex mono">0x{byte.value.toString(16).toUpperCase().padStart(2, '0')}</span>
            </span>
          {/each}
        </span>
      </div>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <table class="ranges" onpointerenter={() => focus.set('utf8n', 'utf8-table')} onpointerleave={() => focus.set(null)}>
      <thead><tr><th>Code points</th><th>Bytes</th><th>Template</th></tr></thead>
      <tbody>
        {#each RANGES as r, i (i)}
          <tr class:cur={r.n === n}>
            <td class="mono">{T.formatCodePoint(r.lo)}–{T.formatCodePoint(r.hi)}</td>
            <td class="num">{r.n}</td>
            <td class="mono small">{PREFIX[i]!.map((p, j) => p + 'x'.repeat(SLOTS[i]![j]!)).join(' ')}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Widget>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .field input {
    width: 4rem;
    font-size: 1.3rem;
    text-align: center;
    padding: 0.2rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .ex {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .ex button {
    min-width: 2.1rem;
    height: 2.1rem;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    color: var(--ink);
  }
  .ex button.on {
    border-color: var(--accent-2);
    background: var(--accent-soft);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .flow {
    display: grid;
    gap: 0.9rem;
  }
  .line {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .line:first-child {
    grid-template-columns: 7.5rem auto 1fr;
  }
  .lbl {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
  }
  .big {
    font-size: 2rem;
    font-family: var(--font-body);
    line-height: 1;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
  .small {
    font-size: 0.72rem;
  }
  .bits {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
  }
  .bit {
    display: inline-block;
    min-width: 0.95em;
    text-align: center;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) 18%, transparent);
    border-bottom: 2px solid var(--c);
    font-family: var(--font-mono);
  }
  .b0 {
    --c: var(--series-1);
  }
  .b1 {
    --c: var(--series-2);
  }
  .b2 {
    --c: var(--series-3);
  }
  .b3 {
    --c: var(--series-7);
  }
  .bytes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .byte {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
  }
  .prefix {
    color: var(--ink-3);
  }
  .hex {
    font-weight: 650;
  }
  .ranges {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  .ranges th {
    text-align: left;
    font-weight: 600;
    color: var(--ink-2);
    border-bottom: 1px solid var(--rule-strong);
    padding: 0.3rem 0.4rem;
  }
  .ranges td {
    padding: 0.35rem 0.4rem;
    border-bottom: 1px solid var(--rule);
  }
  .ranges tr.cur td {
    background: var(--accent-soft);
  }
</style>
