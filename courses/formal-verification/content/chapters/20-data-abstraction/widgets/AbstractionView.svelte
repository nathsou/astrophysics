<!--
  The abstraction view: a ring-buffer queue (concrete state: an array, a head and a count) beside the sequence it
  represents (abstract state: the ghost field `items`). Each operation runs the Vouch code in the interpreter, and
  its simulation square is drawn: concrete before and after on the bottom, abstract before and after on top, linked
  by the abstraction. The verifier's verdict says whether the square commutes for every state, not just this one.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check, type Checked } from '$lib/fv/vouch/check/checker';
  import { Runner } from '$lib/fv/vouch/interp/exec';
  import { seq, show, type Value, type StructV, type SeqV } from '$lib/fv/vouch/interp/values';
  import { verifyDocument } from '$lib/fv/verify/document';
  import type { Verdict } from '$lib/fv/engines';

  let { code, capacity = 5, caption }: { code: string; capacity?: number; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  const checked: Checked = check(parse(code).program);
  // svelte-ignore state_referenced_locally
  const initial: StructV = { t: 'struct', name: 'Queue', fields: [seq(Array.from({ length: capacity }, () => 0n)), 0n, 0n, seq([])] };
  let q = $state.raw<StructV>(initial);
  let last = $state.raw<{ op: string; before: StructV; after: StructV; expected: Value[]; ok: boolean } | undefined>();
  let next = $state(1);
  let error = $state('');
  let verdicts = $state.raw<Record<string, Verdict[]>>({});

  onMount(async () => {
    const r = await verifyDocument(checked, { timeout: 8000 });
    verdicts = Object.fromEntries(r.map((d) => [d.decl, d.verdicts]));
  });

  const items = (s: StructV) => (s.fields[3] as SeqV).items;
  const data = (s: StructV) => (s.fields[0] as SeqV).items;
  const head = (s: StructV) => Number(s.fields[1] as bigint);
  const count = (s: StructV) => Number(s.fields[2] as bigint);

  function call(fn: string, args: Value[]): Value | undefined {
    const r = new Runner(checked, { fuel: 100_000 }).run(fn, args);
    if (r.failure) {
      error = r.failure.message;
      return undefined;
    }
    if (r.discarded) {
      error = `The precondition of ${fn} does not hold here.`;
      return undefined;
    }
    error = '';
    return r.result;
  }

  function push() {
    const x = BigInt(next);
    const after = call('push', [q, x]) as StructV | undefined;
    if (!after) return;
    const expected = [...items(q), x];
    last = { op: `push(${x})`, before: q, after, expected, ok: show(seq(items(after))) === show(seq(expected)) };
    q = after;
    next++;
  }
  function pop() {
    const front = call('front', [q]);
    if (front === undefined) return;
    const after = call('pop', [q]) as StructV | undefined;
    if (!after) return;
    const expected = items(q).slice(1);
    last = { op: `pop() → ${show(front)}`, before: q, after, expected, ok: show(seq(items(after))) === show(seq(expected)) };
    q = after;
  }
  function reset() {
    q = initial;
    last = undefined;
    next = 1;
    error = '';
  }

  const occupied = (s: StructV) => {
    const n = data(s).length;
    const set = new Set<number>();
    for (let k = 0; k < count(s); k++) set.add((head(s) + k) % n);
    return set;
  };
  const status = (fn: string) => {
    const v = verdicts[fn];
    if (!v) return 'checking…';
    return v.every((x) => x.status === 'verified') ? 'proved for every state' : 'not proved';
  };
</script>

{#snippet ring(s: StructV, small = false)}
  {@const occ = occupied(s)}
  <div class="ring" class:small>
    {#each data(s) as c, i (i)}
      <div class="cell" class:occ={occ.has(i)} class:head={i === head(s) && count(s) > 0}>
        <span class="v">{occ.has(i) ? show(c) : '·'}</span>
        <span class="i">{i}</span>
      </div>
    {/each}
  </div>
  <p class="ui meta">head = {head(s)}, count = {count(s)}</p>
{/snippet}
{#snippet abs(xs: readonly Value[], small = false)}
  <div class="seq" class:small>{#each xs as x, i (i)}<span class="it">{show(x)}</span>{:else}<span class="empty ui">empty</span>{/each}</div>
{/snippet}

<figure class="av">
  <div class="bar ui">
    <button type="button" class="go" onclick={push} disabled={count(q) >= capacity}>push({next})</button>
    <button type="button" onclick={pop} disabled={count(q) === 0}>pop()</button>
    <button type="button" onclick={reset}>Reset</button>
    <span class="vs">push: <b class:ok={status('push').startsWith('proved')}>{status('push')}</b> · pop: <b class:ok={status('pop').startsWith('proved')}>{status('pop')}</b></span>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  <div class="now">
    <div>
      <p class="lab ui">Concrete: the buffer</p>
      {@render ring(q)}
    </div>
    <div>
      <p class="lab ui">Abstract: the queue (front first)</p>
      {@render abs(items(q))}
    </div>
  </div>
  {#if last}
    <div class="square">
      <p class="lab ui">The simulation square for {last.op}</p>
      <div class="grid">
        <div class="corner">{@render abs(items(last.before), true)}</div>
        <div class="arrow ui">— {last.op.split(' ')[0]} on sequences →</div>
        <div class="corner">{@render abs(last.expected, true)}</div>
        <div class="down ui">↑ items</div>
        <div></div>
        <div class="down ui">↑ items {last.ok ? '✓ equal' : '✗ differs'}</div>
        <div class="corner">{@render ring(last.before, true)}</div>
        <div class="arrow ui">— {last.op.split(' ')[0]} on the buffer →</div>
        <div class="corner">{@render ring(last.after, true)}</div>
      </div>
      <p class="ui note">Going right then up (run the buffer operation, then read off the sequence) must give the same sequence as going up then right (read off the sequence, then do the operation on sequences). This run checks one square; the verifier proves it for every queue that satisfies the representation invariant.</p>
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .av {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.82rem;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.7rem;
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
  .vs {
    margin-left: auto;
    color: var(--ink-2);
  }
  .vs b {
    color: var(--gold);
  }
  .vs b.ok {
    color: var(--seal);
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .now {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    margin-top: 0.7rem;
  }
  @media (max-width: 640px) {
    .now {
      grid-template-columns: 1fr;
    }
  }
  .lab {
    margin: 0 0 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .ring {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  .cell {
    position: relative;
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--panel);
    font-family: var(--font-mono);
  }
  .small .cell {
    width: 1.7rem;
    height: 1.7rem;
    font-size: 0.75rem;
  }
  .cell.occ {
    background: color-mix(in srgb, var(--ink-blue) 14%, var(--panel));
    border-color: var(--ink-blue);
  }
  .cell.head {
    box-shadow: 0 0 0 2px var(--gold);
  }
  .i {
    position: absolute;
    bottom: 1px;
    right: 3px;
    font-size: 0.55rem;
    color: var(--mute);
  }
  .meta {
    margin: 0.25rem 0 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .seq {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    min-height: 2.4rem;
    align-items: center;
  }
  .it {
    min-width: 2rem;
    padding: 0.35rem 0.4rem;
    text-align: center;
    border: 1px solid var(--seal);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--seal) 12%, var(--panel));
    font-family: var(--font-mono);
  }
  .small .it {
    min-width: 1.5rem;
    padding: 0.15rem 0.3rem;
    font-size: 0.75rem;
  }
  .empty {
    color: var(--mute);
    font-size: 0.78rem;
  }
  .square {
    margin-top: 1rem;
    padding-top: 0.7rem;
    border-top: 1px dashed var(--line-strong);
  }
  .grid {
    display: grid;
    grid-template-columns: auto auto auto;
    gap: 0.3rem 0.8rem;
    align-items: center;
    overflow-x: auto;
  }
  .arrow,
  .down {
    font-size: 0.75rem;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .down {
    text-align: center;
  }
  .note {
    font-size: 0.78rem;
    color: var(--mute);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
