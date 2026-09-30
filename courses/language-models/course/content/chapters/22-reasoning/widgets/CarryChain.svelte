<!--
  Why a scratchpad helps: in the direct format the model must write the answer's leading digit first, and that
  digit depends on the carry out of every column to its right — all computed inside one forward pass. The
  scratchpad writes the carries down, one column per step. Uses the learner's scratchpad().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(a: number, b: number): string {
    const da = String(a).padStart(6, '0').split('').reverse();
    const db = String(b).padStart(6, '0').split('').reverse();
    const steps: string[] = [];
    let carry = 0;
    for (let i = 0; i < 6; i++) {
      const s = Number(da[i]) + Number(db[i]) + carry;
      steps.push(`${da[i]}+${db[i]}+${carry}=${s}`);
      carry = Math.floor(s / 10);
    }
    return `${steps.join(',')}>${a + b}`;
  }
  const scratchpad = $derived(impl.get('reason.scratchpad', reference));
  const mine = $derived(impl.isMine('reason.scratchpad'));

  const rng = mulberry32(22);
  let a = $state(348105);
  let b = $state(920377);
  function roll(hard = false) {
    if (hard) {
      // A long carry chain: digits that sum to 9 everywhere except the last column.
      a = Math.floor(rng() * 9e5) + 1e5;
      b = 999999 - a + 1 + Math.floor(rng() * 9);
      if (b >= 1e6 || b < 0) b = 999999 - a + 1;
    } else {
      a = Math.floor(rng() * 1e6);
      b = Math.floor(rng() * 1e6);
    }
  }

  const pad = $derived.by(() => {
    try {
      return scratchpad(a, b);
    } catch {
      return reference(a, b);
    }
  });
  const correct = $derived(pad === reference(a, b));
  // The longest run of consecutive carries: how far one column's result travels.
  const carries = $derived.by(() => {
    const da = String(a).padStart(6, '0').split('').reverse().map(Number);
    const db = String(b).padStart(6, '0').split('').reverse().map(Number);
    const out: number[] = [];
    let c = 0;
    for (let i = 0; i < 6; i++) {
      c = Math.floor((da[i]! + db[i]! + c) / 10);
      out.push(c);
    }
    return out;
  });
  const chain = $derived.by(() => {
    let best = 0, run = 0;
    for (const c of carries) best = Math.max(best, (run = c ? run + 1 : 0));
    return best;
  });
  const sum = $derived(String(a + b));
</script>

<Widget
  title="The carry chain"
  subtitle="Answering directly, the model writes the sum’s first digit before any other — and that digit can depend on every column to its right. The scratchpad writes each column, with its carry, as it goes."
  onreset={() => {
    a = 348105;
    b = 920377;
  }}
>
  {#snippet controls()}
    <Button size="sm" onclick={() => roll()}>Random problem</Button>
    <Button size="sm" onclick={() => roll(true)}>Long carry chain</Button>
  {/snippet}

  {#if mine}<p class="mine ui">Using your scratchpad(){correct ? '' : ' — which differs from the reference'}.</p>{/if}
  <div class="sum num">
    <div class="row"><span class="op"></span>{#each String(a).padStart(7, ' ').split('') as d, i (i)}<span class="d">{d}</span>{/each}</div>
    <div class="row"><span class="op">+</span>{#each String(b).padStart(7, ' ').split('') as d, i (i)}<span class="d">{d}</span>{/each}</div>
    <div class="row carry"><span class="op">carry in</span>{#each [0, ...carries].reverse() as c, i (i)}<span class="d" class:on={c}>{c ? '1' : ''}</span>{/each}</div>
    <div class="row total"><span class="op"></span>{#each sum.padStart(7, ' ').split('') as d, i (i)}<span class="d" class:lead-digit={i === 0 && d !== ' '}>{d}</span>{/each}</div>
    {#if sum.length > 6}<div class="lead ui">the leading 1 is the carry out of the leftmost column</div>{/if}
  </div>

  <dl class="formats ui">
    <dt>Direct</dt>
    <dd class="num">{a}+{b}=<strong>{a + b}</strong> <span class="count">{sum.length + 1} tokens to write</span></dd>
    <dt>Scratchpad</dt>
    <dd class="num">{a}+{b}=<strong>{pad}</strong> <span class="count">{pad.length + 1} tokens to write</span></dd>
  </dl>
  <p class="note ui">
    Longest run of carries here: <strong>{chain}</strong> column{chain === 1 ? '' : 's'}. Directly, the model must resolve it within a single forward pass through its 4 layers; with the scratchpad, each column only needs the carry it has just written down.
  </p>
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .sum {
    display: inline-block;
    font-size: 1.15rem;
    margin: 0.2rem 0 0.8rem;
  }
  .row {
    display: flex;
  }
  .op {
    width: 4rem;
    white-space: nowrap;
    text-align: right;
    padding-right: 0.5rem;
    color: var(--ink-3);
    font-size: 0.8rem;
    align-self: center;
  }
  .d {
    width: 1.3rem;
    text-align: center;
  }
  .carry .d {
    font-size: 0.75rem;
    color: var(--accent-ink);
  }
  .carry .d.on {
    background: var(--accent-soft, var(--surface-2));
    border-radius: 3px;
  }
  .total {
    border-top: 1.5px solid var(--ink-2);
    font-weight: 600;
  }
  .lead-digit {
    color: var(--accent-ink);
  }
  .lead {
    font-size: 0.72rem;
    color: var(--ink-3);
    margin-left: 4rem;
  }
  .formats {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.3rem 0.8rem;
    font-size: 0.82rem;
    margin: 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .count {
    color: var(--ink-3);
    font-size: 0.72rem;
    margin-left: 0.4rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.7rem 0 0;
  }
</style>
