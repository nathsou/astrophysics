<!--
  The bits of an Octet instruction as coloured boxes: opcode, register fields, fixed sub-operation or
  condition bits, ignored bits, and the second byte. Colour is never the only cue: every box carries its
  letter (0/1 for fixed bits, d and s for register fields, c for a condition, i for an immediate, a for an address).
-->
<script lang="ts">
  import type { BitCell } from './card';

  let { cells, second, label }: { cells: BitCell[]; second?: BitCell[]; label: string } = $props();

  const title: Record<string, string> = {
    op: 'opcode',
    dd: 'destination register',
    ss: 'source register',
    fixed: 'fixed bit of this instruction',
    ignored: 'ignored: the assembler writes 0',
    cond: 'condition',
    imm: 'immediate value',
    addr: 'address',
  };
</script>

<span class="bits" role="img" aria-label={label}>
  {#each cells as c, i (i)}<span class="b {c.kind}" title={title[c.kind]}>{c.text}</span>{#if i === 3}<span class="gap"></span>{/if}{/each}
  {#if second}
    <span class="plus" aria-hidden="true">+</span>
    {#each second as c, i (i)}<span class="b {c.kind}" title={title[c.kind]}>{c.text}</span>{#if i === 3}<span class="gap small"></span>{/if}{/each}
  {/if}
</span>

<style>
  .bits {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }
  .b {
    display: inline-block;
    width: 1.02rem;
    height: 1.45rem;
    line-height: 1.45rem;
    margin-right: 1px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 18%, var(--panel));
    color: var(--fg);
    border-radius: 3px;
  }
  .gap {
    width: 0.3rem;
  }
  .gap.small {
    width: 0.2rem;
  }
  .plus {
    margin: 0 0.3rem;
    color: var(--mute);
    font-family: var(--font-mono);
  }
  .op { --c: var(--series-1); }
  .dd { --c: var(--series-3); }
  .ss { --c: var(--series-4); }
  .fixed { --c: var(--series-2); }
  .cond { --c: var(--series-2); }
  .ignored {
    --c: var(--mute);
    border-style: dashed;
    background: transparent;
    color: var(--mute);
  }
  .imm { --c: var(--series-5); }
  .addr { --c: var(--series-6); }
</style>
