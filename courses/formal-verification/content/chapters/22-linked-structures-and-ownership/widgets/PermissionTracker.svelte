<!--
  The permission tracker: Rust-style ownership and borrowing as permission accounting. Each variable holds a fraction
  of the permission to the object; reading needs some, writing and dropping need all of it. A shared borrow splits
  the lender's permission, a mutable borrow takes all of it, and a borrow gives it back after its last use.
-->
<script lang="ts">
  import { frac, track, type PermLine } from './perm';

  let { programs, caption }: { programs: { name: string; code: string }[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let choice = $state(0);
  // svelte-ignore state_referenced_locally
  let source = $state(programs[0]!.code.replace(/\n$/, ''));
  let at = $state(0);

  const traced = $derived.by((): { lines: PermLine[]; error: string } => {
    try {
      return { lines: track(source.split('\n')), error: '' };
    } catch (e) {
      return { lines: [], error: (e as Error).message };
    }
  });
  const shown = $derived(Math.min(at, Math.max(0, traced.lines.length - 1)));
  const line = $derived(traced.lines[shown]);
  const firstError = $derived(traced.lines.findIndex((l) => l.error));

  function pick(i: number) {
    choice = i;
    source = programs[i]!.code.replace(/\n$/, '');
    at = 0;
  }
</script>

<figure class="pt">
  <div class="tabs ui" role="tablist">
    {#each programs as p, i (p.name)}
      <button type="button" role="tab" aria-selected={choice === i} class:on={choice === i} onclick={() => pick(i)}>{p.name}</button>
    {/each}
  </div>
  <div class="cols">
    <div>
      <label class="ui lab" for="pt-src">The program (edit it)</label>
      <textarea id="pt-src" bind:value={source} rows={Math.max(6, source.split('\n').length + 1)} spellcheck="false"></textarea>
      <p class="ui hint">One statement per line: {#each ['let a = new', 'let r = &a', 'let m = &mut a', 'let b = a', 'read x', 'write x', 'drop a'] as st, i (st)}{#if i > 0}<span class="sep">·</span>{/if}<code>{st}</code>{/each}</p>
    </div>
    <div class="trace">
      {#if traced.error}
        <p class="err ui">{traced.error}</p>
      {:else}
        <ol class="steps">
          {#each traced.lines as l, i (i)}
            <li class:on={i === shown} class:bad={!!l.error} class:after={firstError >= 0 && i > firstError}>
              <button type="button" onclick={() => (at = i)}><code>{l.text}</code>{#if l.error}<span class="x">✗</span>{/if}</button>
            </li>
          {/each}
        </ol>
        {#if line}
          <p class="ui sub">after <code>{line.text}</code></p>
          <div class="bars">
            {#each line.holdings as h (h.name)}
              <div class="row">
                <span class="nm"><code>{h.name}</code>{#if h.owner}<span class="own ui" title="owns the object">owner</span>{/if}</span>
                <span class="bar" aria-label="{h.name} holds {frac(h.amount)}"><span class="fill" class:full={h.amount === 1} style="width: {h.amount * 100}%"></span></span>
                <span class="amt ui">{frac(h.amount)}{#if h.note}<span class="note">&nbsp;· {h.note}</span>{/if}</span>
              </div>
            {/each}
          </div>
          {#if line.error}
            <p class="verdict bad ui">✗ Rejected: {line.error}.</p>
          {:else if firstError < 0 && shown === traced.lines.length - 1}
            <p class="verdict ok ui">✓ Accepted: every read held some permission, every write and drop held all of it.</p>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .pt {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.6rem;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 0.8rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .lab,
  .sub {
    display: block;
    margin: 0 0 0.25rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .sub {
    margin-top: 0.6rem;
  }
  .sep {
    margin: 0 0.35rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .hint {
    font-size: 0.75rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
  .pt code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .steps button {
    width: 100%;
    text-align: left;
    display: flex;
    justify-content: space-between;
    border-color: var(--line);
    border-left: 3px solid var(--line);
  }
  .steps li.on button {
    border-left-color: var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 12%, var(--panel));
  }
  .steps li.bad button {
    border-left-color: var(--pencil);
  }
  .steps li.after button {
    opacity: 0.5;
  }
  .x {
    color: var(--pencil);
    font-weight: 700;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .row {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr) 7.5rem;
    gap: 0.5rem;
    align-items: center;
  }
  .nm {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .own {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--gold);
    border: 1px solid var(--gold);
    border-radius: 999px;
    padding: 0 0.3rem;
  }
  .bar {
    height: 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: color-mix(in srgb, var(--ink-blue) 55%, var(--panel));
    transition: width 0.2s;
  }
  .fill.full {
    background: var(--seal);
  }
  .amt {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .note {
    color: var(--mute);
  }
  .verdict {
    margin: 0.7rem 0 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .verdict.ok {
    color: var(--seal);
  }
  .verdict.bad,
  .err {
    color: var(--pencil);
  }
  .err {
    font-size: 0.82rem;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .pt .sub code {
    text-transform: none;
    letter-spacing: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
