<!--
  The symbolic heap stepper: the heap verifier's symbolic execution of one function, step by step. Each step shows
  the variables and the symbolic heap (points-to facts and list segments joined by ∗); unfolding a segment, a branch,
  the loop's arbitrary iteration and the final check are marked. Errors are pinpointed in the listing.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { HeapVerifier, type HeapResult } from '$lib/fv/heap/symheap';

  let { code, fn: fnName, title, caption }: { code: string; fn: string; title?: string; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  let result = $state.raw<HeapResult | undefined>();
  let error = $state('');
  let at = $state(0);
  let editing = $state(false);

  function run() {
    error = '';
    const p = parse(source);
    const c = check(p.program);
    const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs.map((e) => e.message).join(' ');
      result = undefined;
      return;
    }
    result = new HeapVerifier(c, source).verify(fnName);
    at = 0;
  }
  untrack(run);

  const lineOf = (off: number) => source.slice(0, off).split('\n').length;
  const step = $derived(result?.steps[at]);
  const errLines = $derived(new Set((result?.errors ?? []).map((e) => lineOf(e.span.start))));
  const EVENT: Record<string, string> = { unfold: 'unfold', fold: 'fold', branch: 'branch', loop: 'loop', 'loop-exit': 'loop exit', call: 'frame', return: 'check', free: 'free' };
</script>

<figure class="hs">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <div class="bar ui">
    <button type="button" onclick={() => (at = Math.max(0, at - 1))} disabled={!result || at === 0}>← Back</button>
    <button type="button" class="go" onclick={() => (at = Math.min((result?.steps.length ?? 1) - 1, at + 1))} disabled={!result || at >= result.steps.length - 1}>Next step →</button>
    <span class="pos">{result ? `step ${at + 1} of ${result.steps.length}` : ''}</span>
    <button type="button" onclick={() => (editing ? ((editing = false), run()) : (editing = true))}>{editing ? 'Done editing' : 'Edit the code'}</button>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  <div class="cols">
    {#if editing}
      <textarea bind:value={source} rows={source.split('\n').length + 1} spellcheck="false" aria-label="The code"></textarea>
    {:else}
      <ol class="listing">
        {#each source.split('\n') as l, i (i)}
          <li class:on={step && lineOf(step.span.start) === i + 1} class:err={errLines.has(i + 1)}><span class="ln">{i + 1}</span><code>{l || ' '}</code></li>
        {/each}
      </ol>
    {/if}
    <div class="state">
      {#if step}
        <p class="lab ui">{step.label}{#if step.event}<span class="ev ev-{step.event} ui">{EVENT[step.event] ?? step.event}</span>{/if}</p>
        <p class="ui sub">variables</p>
        <p class="vars"><code>{step.state[0] || '—'}</code></p>
        <p class="ui sub">heap</p>
        <p class="heap">{#each step.state[1]!.split(' ∗ ') as a, i (i)}{#if i > 0}<span class="star"> ∗ </span>{/if}<code class="atom" class:seg={a.startsWith('list') || a.startsWith('lseg')}>{a}</code>{/each}</p>
        {#if step.state[2]}<p class="ui sub">facts</p><p class="pure"><code>{step.state[2]}</code></p>{/if}
      {/if}
      {#if result}
        <div class="verdict ui" class:ok={result.verified}>
          {#if result.verified}✓ Verified: memory-safe on every path, and the postcondition describes the whole heap at the end.
          {:else}{#each result.errors as e, i (i)}<p>✗ Line {lineOf(e.span.start)}: {e.message}</p>{/each}{/if}
        </div>
      {/if}
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .hs {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .pos {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 0.8rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .listing {
    list-style: none;
    margin: 0;
    padding: 0.4rem 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    overflow-x: auto;
  }
  .listing li {
    display: flex;
    white-space: pre;
    border-left: 3px solid transparent;
  }
  .listing li.on {
    background: color-mix(in srgb, var(--ink-blue) 14%, transparent);
    border-left-color: var(--ink-blue);
  }
  .listing li.err {
    border-left-color: var(--pencil);
  }
  .ln {
    flex: none;
    width: 2rem;
    text-align: right;
    padding-right: 0.5rem;
    color: var(--mute);
  }
  .hs code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .listing code {
    white-space: pre;
  }
  .state {
    min-width: 0;
  }
  .lab {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .ev {
    margin-left: 0.5rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--panel);
    border: 1px solid var(--gold);
    color: var(--gold);
  }
  .ev-unfold,
  .ev-fold {
    border-color: var(--ink-blue);
    color: var(--ink-blue);
  }
  .ev-return,
  .ev-call {
    border-color: var(--seal);
    color: var(--seal);
  }
  .sub {
    margin: 0.4rem 0 0.1rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .vars,
  .heap,
  .pure {
    margin: 0;
  }
  .hs code.atom {
    display: inline-block;
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 8%, var(--panel));
    margin: 0.1rem 0;
  }
  .hs code.atom.seg {
    border-color: var(--seal);
    background: color-mix(in srgb, var(--seal) 10%, var(--panel));
  }
  .star {
    color: var(--mute);
  }
  .verdict {
    margin-top: 0.8rem;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pencil);
    color: var(--pencil);
    font-size: 0.84rem;
  }
  .verdict.ok {
    border-color: var(--seal);
    color: var(--seal);
  }
  .verdict p {
    margin: 0.2rem 0;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
