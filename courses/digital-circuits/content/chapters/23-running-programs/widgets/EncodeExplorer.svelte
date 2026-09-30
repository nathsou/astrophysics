<!--
  Flip the bits of an instruction. The first byte of an Octet instruction is `oooo ddss`: click any of its eight
  bits, or pick an instruction and registers, and see which instruction the byte is, which bits mean what, and the
  register transfer it performs. Every one of the 256 bytes is an instruction (bits an instruction does not use are
  dimmed and ignored). The encoding is `spec.ts`; the reading of the bits is encode.ts.

    ::encode-explorer{n="23.1" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { instantiate } from './cycles';
  import { cellsOf, explain, mnemonics, withMnemonic, type FieldKind } from './encode';

  let { n, caption, start = 0x86, startSecond = 0x20 }: { n?: string | number; caption?: string; start?: number | string; startSecond?: number | string } = $props();

  const num = (v: number | string) => (typeof v === 'string' ? parseInt(v, v.startsWith('0x') ? 16 : 10) : v) & 0xff;
  let first = $state(untrack(() => num(start)));
  let second = $state(untrack(() => num(startSecond)));

  const e = $derived(explain(first, second));
  const cells = $derived(cellsOf(first));
  const groups = mnemonics();
  const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
  const bin = (v: number) => v.toString(2).padStart(8, '0');
  const operation = $derived(instantiate(e.spec.operation, first));

  const letter: Record<FieldKind, string> = { op: 'o', dd: 'd', ss: 's', fixed: '', cond: 'c', ignored: '' };
  const meaning: Record<FieldKind, string> = {
    op: 'opcode: which instruction (or group)',
    dd: 'the register named first in the assembly text',
    ss: 'the register named second',
    fixed: 'a bit this instruction fixes: it chooses among the instructions that share the opcode',
    cond: 'condition bit: three choose a test, the lowest inverts it',
    ignored: 'ignored: the hardware does not look at it',
  };
  const flip = (bit: number) => (first ^= 1 << bit);
  const setD = (v: number) => (first = (first & ~0b1100) | (v << 2));
  const setS = (v: number) => (first = (first & ~0b11) | v);
  function parseHex(s: string): number | undefined {
    const t = s.trim().replace(/^0x/i, '');
    return /^[0-9a-f]{1,2}$/i.test(t) ? parseInt(t, 16) : undefined;
  }
  const regOptions = [0, 1, 2, 3].map((v) => ({ value: v, label: `R${v}` }));
  const uses = $derived(e.spec.bytes === 2 ? (e.spec.operands.includes('imm') ? 'immediate' : 'address') : '');
  const groupsOf = (sel: string) => groups.some((g) => g.items.includes(sel));
</script>

<Widget title="Flip the bits" subtitle="One byte, one instruction" {n} {caption} kind="Encoding" onreset={() => ((first = num(start)), (second = num(startSecond)))}>
  {#snippet controls()}
    <label class="pick ui">
      <span>Instruction</span>
      <select value={e.spec.mnemonic} onchange={(ev) => (first = withMnemonic(first, ev.currentTarget.value))} aria-label="Instruction">
        {#each groups as g (g.group)}
          <optgroup label={g.group}>{#each g.items as m (m)}<option value={m}>{m}</option>{/each}</optgroup>
        {/each}
        {#if !groupsOf(e.spec.mnemonic)}<option value={e.spec.mnemonic}>{e.spec.mnemonic}</option>{/if}
      </select>
    </label>
    {#if e.d !== undefined}
      <div class="reg"><span class="lbl ui">Rd (first register)</span><Segmented label="Destination register" size="sm" options={regOptions} value={(first >> 2) & 3} onchange={setD} /></div>
    {/if}
    {#if e.s !== undefined}
      <div class="reg"><span class="lbl ui">Rs (second register)</span><Segmented label="Source register" size="sm" options={regOptions} value={first & 3} onchange={setS} /></div>
    {/if}
  {/snippet}

  <div class="ee">
    <div class="bytes">
      <div class="byte">
        <div class="marks ui" aria-hidden="true">
          <span class="grp g4">opcode</span>
          <span class="grp g2">{cells[4]!.kind === 'cond' ? 'condition' : cells[4]!.kind === 'dd' ? 'dd' : cells[4]!.kind === 'ignored' ? 'ignored' : 'fixed'}</span>
          <span class="grp g2">{cells[6]!.kind === 'ss' ? 'ss' : cells[6]!.kind === 'cond' ? 'condition' : cells[6]!.kind === 'ignored' ? 'ignored' : 'fixed'}</span>
        </div>
        <div class="bits" role="group" aria-label="First byte, bit 7 to bit 0">
          {#each cells as c, i (c.bit)}
            <button
              type="button"
              class="bit {c.kind}"
              class:one={c.value === 1}
              class:gap={i === 4}
              aria-pressed={c.value === 1}
              aria-label="Bit {c.bit} is {c.value}: {meaning[c.kind]}"
              title="Bit {c.bit}: {meaning[c.kind]}"
              onclick={() => flip(c.bit)}
            >
              <span class="v">{c.value}</span><span class="k">{letter[c.kind] || ' '}</span>
            </button>
          {/each}
        </div>
        <div class="hexline"><code>0x{hex2(first)}</code><span class="dim">= {bin(first).slice(0, 4)} {bin(first).slice(4)} = {first}</span></div>
      </div>

      {#if e.second !== undefined}
        <div class="byte second">
          <div class="marks ui" aria-hidden="true"><span class="grp g8">{uses}</span></div>
          <div class="bits" aria-hidden="true">
            {#each bin(second).split('') as b, i (i)}<span class="bit {uses === 'address' ? 'addr' : 'imm'}" class:one={b === '1'} class:gap={i === 4}><span class="v">{b}</span><span class="k">{uses === 'address' ? 'a' : 'i'}</span></span>{/each}
          </div>
          <div class="hexline">
            <label class="ui"><span class="sr">Second byte, hexadecimal</span>0x<input value={hex2(second)} maxlength="4" size="3" onchange={(ev) => { const v = parseHex(ev.currentTarget.value); if (v !== undefined) second = v; ev.currentTarget.value = hex2(second); }} aria-label="Second byte, hexadecimal" /></label>
            <span class="dim">= {second}</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="reading">
      <div class="asm"><code>{e.text}</code></div>
      <dl class="ui">
        <dt>does</dt>
        <dd><code>{operation}</code></dd>
        <dt>takes</dt>
        <dd>{e.cycles} clock cycles, {e.spec.bytes} byte{e.spec.bytes === 2 ? 's' : ''}{e.spec.flags ? ', sets all four flags' : ', leaves the flags alone'}</dd>
        {#if e.nonCanonical}
          <dt>note</dt>
          <dd>An ignored bit is 1. This byte does what the instruction above does, but the assembler always writes 0 there, so it would never produce it.</dd>
        {/if}
      </dl>
      <p class="lookup ui">
        The assembler’s job for this instruction is a table lookup: <b>{e.spec.mnemonic}</b> → opcode <code>{bin(first).slice(0, 4)}</code>{#if e.d !== undefined}, R{e.d} → <code>{bin(e.d).slice(6)}</code>{/if}{#if e.s !== undefined}, R{e.s} → <code>{bin(e.s).slice(6)}</code>{/if}. Reading it back is the same table, the other way.
      </p>
    </div>
  </div>
</Widget>

<style>
  .pick {
    display: grid;
    gap: 0.2rem;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .pick select {
    height: 2rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.84rem;
    padding: 0 0.4rem;
  }
  .reg {
    display: grid;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .ee {
    display: grid;
    gap: 1.1rem 2rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
    align-items: start;
  }
  .bytes {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-width: 0;
  }
  .marks {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
    font-size: 0.66rem;
    color: var(--mute);
  }
  .grp {
    text-align: center;
    border-bottom: 2px solid var(--line-strong);
    padding-bottom: 1px;
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
  }
  .g4 {
    flex: 4;
  }
  .g2 {
    flex: 2;
  }
  .g8 {
    flex: 8;
  }
  .bits {
    display: flex;
    gap: 3px;
  }
  .bit {
    position: relative;
    flex: 1;
    max-width: 2.6rem;
    min-width: 0;
    height: 3rem;
    display: grid;
    place-items: center;
    align-content: center;
    padding: 0;
    border: 1.5px solid var(--c, var(--line-strong));
    border-radius: 6px;
    background: color-mix(in srgb, var(--c, var(--mute)) 12%, var(--panel));
    color: var(--fg);
    font-family: var(--font-mono);
    cursor: pointer;
  }
  button.bit:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  span.bit {
    cursor: default;
    height: 2.4rem;
  }
  .bit.gap {
    margin-left: 0.35rem;
  }
  .v {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1;
  }
  .k {
    font-size: 0.66rem;
    color: var(--mute);
    height: 0.8rem;
  }
  .bit.one {
    background: color-mix(in srgb, var(--c, var(--mute)) 34%, var(--panel));
  }
  .op {
    --c: var(--series-1);
  }
  .dd {
    --c: var(--series-3);
  }
  .ss {
    --c: var(--series-4);
  }
  .fixed,
  .cond {
    --c: var(--series-2);
  }
  .imm {
    --c: var(--series-5);
  }
  .addr {
    --c: var(--series-6);
  }
  .ignored {
    --c: var(--mute);
    border-style: dashed;
    background: transparent;
    color: var(--mute);
  }
  .ignored.one {
    background: color-mix(in srgb, var(--mute) 14%, transparent);
  }
  .hexline {
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
    margin-top: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }
  .hexline code {
    font-weight: 700;
    background: none;
    padding: 0;
    font-size: 1rem;
  }
  .hexline input {
    font: inherit;
    width: 2.6ch;
    border: 0;
    border-bottom: 1px solid var(--line-strong);
    background: transparent;
    color: var(--fg);
    text-transform: uppercase;
    padding: 0;
    font-weight: 700;
    font-size: 1rem;
  }
  .hexline input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .hexline label {
    display: inline-flex;
    align-items: baseline;
    font-weight: 700;
    font-size: 1rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .dim {
    color: var(--mute);
    font-size: 0.78rem;
  }
  .reading {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .asm code {
    display: block;
    padding: 0.5rem 0.8rem;
    background: var(--scope-bg);
    color: var(--phosphor);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 600;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.8rem;
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  dt {
    color: var(--mute);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-top: 0.15rem;
  }
  dd {
    margin: 0;
  }
  dd code {
    font-family: var(--font-mono);
    background: none;
    padding: 0;
    color: var(--fg);
  }
  .lookup {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
    line-height: 1.5;
  }
  .lookup code {
    font-family: var(--font-mono);
    background: none;
    padding: 0;
    color: var(--fg);
  }
</style>
