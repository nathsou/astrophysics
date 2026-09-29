<!--
  Number-system converter: the same pattern of bits in binary, octal, unsigned and two's-complement decimal and
  hexadecimal. Click bits to flip them, or type into any field; invert, add one, negate.

    ::number-converter{}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import './appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { WIDTHS, MINUS, asciiName, bitsOf, flipBit, format, maxPattern, negate, parseField, resize, signedValue, type Field, type Width } from './numbers';

  let { n, start: startProp = 0xa5 }: { n?: string | number; start?: number } = $props();
  const start = untrack(() => startProp);

  let width = $state<Width>(8);
  let pattern = $state(start);
  let draft = $state('');
  let editing = $state<Field | null>(null);
  let error = $state<{ field: Field; message: string } | null>(null);
  let note = $state('');

  const bits = $derived(bitsOf(pattern, width));
  const rows = $derived.by(() => {
    const out: { bit: number; index: number; weight: number }[][] = [];
    const all = bits.map((bit, index) => ({ bit, index, weight: width - 1 - index }));
    for (let i = 0; i < all.length; i += 8) out.push(all.slice(i, i + 8));
    return out;
  });

  const FIELDS = $derived<{ id: Field; label: string; hint: string }[]>([
    { id: 'bin', label: 'Binary', hint: '0b… allowed; spaces ignored' },
    { id: 'oct', label: 'Octal', hint: 'groups of 3 bits' },
    { id: 'dec', label: 'Decimal, unsigned', hint: `0 to ${maxPattern(width)}` },
    { id: 'sdec', label: 'Decimal, two’s complement', hint: `${MINUS}${2 ** (width - 1)} to ${2 ** (width - 1) - 1}` },
    { id: 'hex', label: 'Hexadecimal', hint: '0x… allowed; groups of 4 bits' },
  ]);

  const valueOf = (f: Field) => (editing === f ? draft : format(pattern, f, width));

  function edit(f: Field, text: string) {
    editing = f;
    draft = text;
    note = '';
    const r = parseField(text, f, width);
    if (r.ok) {
      pattern = r.pattern;
      error = null;
    } else error = { field: f, message: r.message };
  }
  function done() {
    editing = null;
    error = null;
  }

  function setWidth(w: Width) {
    // Keep the value if the number is signed and negative (sign-extend), or if it fits; otherwise cut it.
    const negative = signedValue(pattern, width) < 0;
    pattern = resize(pattern, width, w, negative);
    width = w;
    editing = null;
    error = null;
    note = '';
  }

  function toggle(index: number) {
    pattern = flipBit(pattern, width, index);
    note = '';
  }
  const invert = () => {
    pattern = maxPattern(width) - pattern;
    note = `Inverted every bit: ${format(pattern, 'bin', width)}.`;
  };
  const add = (d: number) => {
    const m = 2 ** width;
    const before = pattern;
    pattern = (((pattern + d) % m) + m) % m;
    note = (d > 0 && before === maxPattern(width)) || (d < 0 && before === 0) ? 'It wrapped round: the counter has no bit for the carry.' : '';
  };
  function neg() {
    const s = negate(pattern, width);
    note = `Invert: ${format(s.inverted, 'bin', width)}, then add one: ${format(s.result, 'bin', width)}.`;
    pattern = s.result;
  }

  const unsignedSum = $derived(
    bits
      .map((b, i) => (b ? String(2 ** (width - 1 - i)) : ''))
      .filter(Boolean)
      .join(' + ') || '0',
  );
  const signedSum = $derived(
    bits
      .map((b, i) => (b ? (i === 0 ? `${MINUS}${2 ** (width - 1)}` : `${2 ** (width - 1 - i)}`) : ''))
      .filter(Boolean)
      .join(' + ') || '0',
  );
  const sVal = $derived(signedValue(pattern, width));
</script>

<Widget title="Number converter" {n} kind="Converter" live={false} onreset={() => { pattern = start; width = 8; editing = null; error = null; note = ''; }} caption="Click a bit, or type into any field. Try 127 then + 1 in the signed field, then click the top bit of 0000 0101 and ask what the number is now.">
  {#snippet controls()}
    <Segmented label="Width in bits" value={width} onchange={setWidth} options={WIDTHS.map((w) => ({ value: w, label: `${w} bit` }))} />
    <span class="btns">
      <Button size="sm" onclick={invert} title="Invert every bit (NOT)">Invert</Button>
      <Button size="sm" onclick={() => add(1)}>+ 1</Button>
      <Button size="sm" onclick={() => add(-1)}>− 1</Button>
      <Button size="sm" onclick={neg} title="Two’s complement: invert, then add one">Negate</Button>
    </span>
  {/snippet}

  <div class="nc">
    <div class="bitrows" role="group" aria-label="The bits, most significant first">
      {#each rows as row, r (r)}
        <div class="bitrow">
          {#each row as b (b.index)}
            {@const sign = b.index === 0}
            <button
              type="button"
              class="bit"
              class:one={b.bit === 1}
              class:sign
              aria-pressed={b.bit === 1}
              aria-label="Bit {b.weight}, weight {sign ? MINUS : ''}{2 ** b.weight}, is {b.bit}. Press to flip."
              onclick={() => toggle(b.index)}
            >
              <span class="w">{sign ? MINUS : ''}{2 ** b.weight}</span>
              <span class="v">{b.bit}</span>
              <span class="i">bit {b.weight}</span>
            </button>
            {#if (b.index + 1) % 4 === 0 && (b.index + 1) % 8 !== 0}<span class="gap" aria-hidden="true"></span>{/if}
          {/each}
        </div>
      {/each}
    </div>

    <div class="fields">
      {#each FIELDS as f (f.id)}
        <label class="ap-label">
          <span>{f.label}</span>
          <input
            class="ap-input"
            type="text"
            value={valueOf(f.id)}
            oninput={(e) => edit(f.id, e.currentTarget.value)}
            onblur={done}
            aria-invalid={error?.field === f.id}
            spellcheck="false"
            autocomplete="off"
            inputmode={f.id === 'dec' || f.id === 'sdec' ? 'numeric' : 'text'}
          />
          {#if error?.field === f.id}<span class="err" role="alert">{error.message}</span>{:else}<span class="hint">{f.hint}</span>{/if}
        </label>
      {/each}
    </div>

    <div class="sums" aria-live="polite">
      <p><b>Unsigned:</b> {unsignedSum} = <b>{pattern}</b></p>
      <p><b>Two’s complement:</b> {signedSum} = <b>{sVal < 0 ? MINUS + -sVal : sVal}</b>{#if width === 8}&nbsp;· as ASCII: <code>{asciiName(pattern)}</code>{/if}</p>
      {#if note}<p class="note">{note}</p>{/if}
    </div>
  </div>
</Widget>

<style>
  .nc {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.1rem 1.2rem;
  }
  .btns {
    display: inline-flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .bitrows {
    display: grid;
    gap: 0.5rem;
    justify-content: center;
  }
  .bitrow {
    display: flex;
    gap: 3px;
    justify-content: center;
  }
  .gap {
    width: 0.4rem;
  }
  .bit {
    display: grid;
    justify-items: center;
    gap: 1px;
    padding: 0.25rem 0;
    width: clamp(2.05rem, 9.2vw, 3.1rem);
    background: var(--pn);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    color: var(--mute);
    cursor: pointer;
    font-family: var(--font-mono);
  }
  .bit:hover {
    border-color: var(--copper);
  }
  .bit .w {
    font-size: 0.62rem;
    line-height: 1;
  }
  .bit .v {
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--sig-low);
  }
  .bit .i {
    font-size: 0.5rem;
    line-height: 1;
    opacity: 0.8;
  }
  .bit.one {
    background: color-mix(in srgb, var(--sig-high) 16%, var(--panel));
    border-color: var(--sig-high);
  }
  .bit.one .v {
    color: var(--sig-high);
  }
  .bit.sign {
    box-shadow: inset 0 2px 0 var(--volt-neg);
  }
  .bit.sign .w {
    color: var(--volt-neg);
    font-weight: 600;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.7rem 0.9rem;
  }
  .hint,
  .err {
    font-family: var(--font-ui);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    font-size: 0.76rem;
    color: var(--mute);
  }
  .err {
    color: var(--bad);
  }
  .sums {
    padding: 0.7rem 0.95rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.84rem;
    line-height: 1.6;
    overflow-x: auto;
  }
  .sums p {
    margin: 0 !important;
    white-space: nowrap;
  }
  .sums .note {
    white-space: normal;
    font-family: var(--font-ui);
    color: var(--copper-ink);
  }
  .sums b {
    color: var(--fg);
  }
</style>
