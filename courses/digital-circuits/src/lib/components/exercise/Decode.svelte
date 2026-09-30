<!--
  A ```decode block: a configuration the reader cannot see the source of (a PROM's fuse map, a PLA's two planes, a
  GAL22V10's JEDEC rows, or the cells and routing of a small vFPGA-S bitstream) and a question: what does it compute?
  The answer is an expression, a truth table or a DCL module, and Check compares it with what the configured device
  does, on every input combination.

    id: ch25/read-the-planes
    device: pla
    source: |          # hidden: the configuration is fitted from it
      X = !A & B | …
    inputs: [A, B, C]
    outputs: [X, Y]
    answers: [expression, table]
    solution: |
      X = …

  See decode/model.ts for the fields, the views and the checker.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import Mismatch from './parts/Mismatch.svelte';
  import Verdict from './parts/Verdict.svelte';
  import './parts/exercise.css';
  import DclEditor from '$lib/hdl/editor/DclEditor.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { artifactOf, checkDecode, dclTemplate, type Answer, type AnswerMode, type Artifact, type Bit, type DecodeInput, type DecodeOutcome } from './decode/model';

  let { spec }: { spec: DecodeInput } = $props();

  const uid = $props.id();
  const modes = $derived<AnswerMode[]>(spec.answers ?? ['expression', 'table']);
  const n = $derived(spec.inputs.length);
  const rows = $derived(Array.from({ length: 1 << n }, (_, v) => v));

  interface Draft {
    mode: AnswerMode;
    text: string;
    dcl: string;
    table: Record<string, (Bit | null)[]>;
  }
  const fresh = (): Draft => ({
    mode: untrack(() => modes)[0]!,
    text: untrack(() => spec.outputs.map((o) => `${o} = `).join('\n')),
    dcl: untrack(() => dclTemplate(spec)),
    table: untrack(() => Object.fromEntries(spec.outputs.map((o) => [o, Array.from({ length: 1 << spec.inputs.length }, () => null)]))),
  });
  let draft = $state<Draft>(untrack(() => ({ ...fresh(), ...progress.draft<Partial<Draft>>(spec.id, {}) })));
  let outcome = $state.raw<DecodeOutcome | null>(null);
  let showSolution = $state(false);
  let stale = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // The configuration is made in the browser from the hidden source (SSR shows it too: it is cheap and pure).
  let artifact = $state.raw<Artifact | null>(null);
  let broken = $state('');
  try {
    artifact = untrack(() => artifactOf(spec));
  } catch (e) {
    broken = e instanceof Error ? e.message : String(e);
  }

  onMount(() => {
    progress.load();
    draft = { ...draft, ...progress.draft<Partial<Draft>>(spec.id, {}) };
    return () => clearTimeout(saveTimer);
  });
  let lastKey = '';
  $effect(() => {
    const snapshot = $state.snapshot(draft);
    // Changing the form of the answer is not changing the answer.
    const key = JSON.stringify([snapshot.text, snapshot.dcl, snapshot.table]);
    untrack(() => {
      if (key !== lastKey) stale = true;
      lastKey = key;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => progress.saveDraft(spec.id, snapshot), 400);
    });
  });

  function check() {
    const answer: Answer = { mode: draft.mode, text: draft.mode === 'dcl' ? draft.dcl : draft.text, table: draft.table };
    outcome = checkDecode(spec, answer);
    stale = false;
    if (outcome.pass) progress.markSolved(spec.id);
  }
  function cycle(o: string, v: number) {
    const cur = draft.table[o]![v];
    draft.table[o]![v] = cur === null || cur === undefined ? 0 : cur === 0 ? 1 : 0;
  }
  const bitsOf = (v: number) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);
  let tabButtons: HTMLButtonElement[] = $state([]);
  function tabKey(ev: KeyboardEvent, i: number) {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    const j = (i + d + modes.length) % modes.length;
    draft.mode = modes[j]!;
    tabButtons[j]?.focus();
  }
  const label: Record<AnswerMode, string> = { expression: 'Expression', table: 'Truth table', dcl: 'DCL module' };
</script>

<ExerciseFrame id={spec.id} kind="Decode" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="decode">
    {#if broken}
      <p class="ex-bad">{broken}</p>
    {:else if artifact}
      <section class="artifact" aria-label={artifact.title}>
        <h4 class="ui">{artifact.title}</h4>
        {#each artifact.legend as l (l)}<p class="ex-note">{@html l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')}</p>{/each}
        {#each artifact.grids as g (g.title)}
          {@const first = g.rows[0]?.bits ?? ''}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="scroll" tabindex="0" role="region" aria-label={g.title}>
            <table class="grid num">
              <caption>{g.title}</caption>
              <thead>
                <tr>
                  <th class="sticky">{g.headLabel ?? ''}</th>
                  {#each g.heads as h, hi (hi)}
                    <th colspan={h.span ?? 1} scope="col">{h.label}</th>
                  {/each}
                  {#if g.rows.some((r) => r.note)}<th class="note" scope="col"></th>{/if}
                </tr>
              </thead>
              <tbody>
                {#each g.rows as r (r.label + r.bits)}
                  <tr>
                    <th scope="row" class="sticky">{r.label}</th>
                    {#each [...r.bits] as b, i (i)}
                      {#if b === ' '}<td class="gap"></td>{:else}<td class:one={b === '1'} class:pair={i < (g.pairCols ?? 0) && i % 2 === 0}>{b}</td>{/if}
                    {/each}
                    {#if g.rows.some((q) => q.note)}<td class="note">{r.note ?? ''}</td>{/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if first.includes(' ')}<p class="ex-note">The gap separates the AND plane from the OR plane.</p>{/if}
        {/each}
        {#each artifact.listings as l (l.title)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="scroll" tabindex="0" role="region" aria-label={l.title}>
            <table class="list">
              <caption>{l.title}</caption>
              <thead><tr>{#each l.head as h (h)}<th scope="col">{h}</th>{/each}</tr></thead>
              <tbody>
                {#each l.rows as r, i (i)}
                  <tr>{#each r as c, j (j)}<td class:mono={j > 0 || l.title !== 'Pads'}>{c}</td>{/each}</tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if l.caption}<p class="ex-note">{l.caption}</p>{/if}
        {/each}
      </section>
    {/if}

    <section class="answer" aria-label="Your answer">
      {#if modes.length > 1}
        <div class="tabs ui" role="tablist" aria-label="Form of the answer">
          {#each modes as m, i (m)}
            <button bind:this={tabButtons[i]} type="button" role="tab" id="{uid}-tab-{m}" aria-selected={draft.mode === m} aria-controls="{uid}-panel" tabindex={draft.mode === m ? 0 : -1} class:on={draft.mode === m} onclick={() => (draft.mode = m)} onkeydown={(ev) => tabKey(ev, i)}>{label[m]}</button>
          {/each}
        </div>
      {/if}
      <div id="{uid}-panel" role={modes.length > 1 ? 'tabpanel' : undefined} aria-labelledby={modes.length > 1 ? `${uid}-tab-${draft.mode}` : undefined}>
        {#if draft.mode === 'expression'}
          <label class="ex-note" for="{uid}-expr">One equation for each output, over {spec.inputs.join(', ')}: for example <code>{spec.outputs[0]} = {spec.inputs[0]} & !{spec.inputs[1] ?? spec.inputs[0]} | …</code> (<code>!</code> not, <code>&</code> and, <code>|</code> or, <code>^</code> xor).</label>
          <textarea id="{uid}-expr" class="expr" bind:value={draft.text} rows={spec.outputs.length + 1} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="{uid}-expr-keys"></textarea>
          <p id="{uid}-expr-keys" class="ex-note">Press Escape, then Tab, to leave the box.</p>
        {:else if draft.mode === 'table'}
          <p class="ex-note">Press a cell to set it: empty, then 0, then 1, then 0 again.</p>
          <div class="scroll">
            <table class="tt num">
              <caption class="sr">Truth table of the outputs: one row for each input combination</caption>
              <thead>
                <tr>
                  {#each spec.inputs as i (i)}<th scope="col">{i}</th>{/each}
                  {#each spec.outputs as o (o)}<th scope="col" class="out">{o}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each rows as v (v)}
                  <tr>
                    {#each bitsOf(v) as b, i (i)}<td class="in">{b}</td>{/each}
                    {#each spec.outputs as o (o)}
                      {@const cur = draft.table[o]?.[v]}
                      <td class="out">
                        <button type="button" class:set={cur !== null && cur !== undefined} aria-label="{spec.inputs.map((name, i) => `${name}=${bitsOf(v)[i]}`).join(' ')}: {o} is {cur === null || cur === undefined ? 'not set' : cur}" onclick={() => cycle(o, v)}>{cur === null || cur === undefined ? '·' : cur}</button>
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="ex-note">Write a module named <code>Decoded</code> with these ports (every one a <code>bit</code>, the names in lower case). It is run against the device for every input combination.</p>
          <DclEditor bind:doc={draft.dcl} minLines={5} maxLines={14} label="DCL module Decoded" />
        {/if}
      </div>
    </section>

    <div class="ex-bar ui">
      <button type="button" class="check" onclick={check}><Icon name="check" size={15} /> Check</button>
      <button type="button" onclick={() => (draft = { ...fresh(), mode: draft.mode })}>Clear my answer</button>
    </div>

    <div class="out ui">
      {#if outcome}
        <Verdict ok={outcome.pass}>
          {#if outcome.pass}Your answer does what the configuration does, for all {outcome.compared.toLocaleString('en-GB')} input combinations.{:else if outcome.problems.length}Nothing to check yet.{:else}Not the same function.{/if}
          {#if stale}<span class="ex-note"> (you have changed it since)</span>{/if}
        </Verdict>
        {#each outcome.problems as p (p)}<p class="ex-bad">{p}</p>{/each}
        {#if outcome.rows.length}<Mismatch rows={outcome.rows} caption="Inputs, what the configuration gives, and what your answer says" />{/if}
        {#if outcome.pass && spec.explain}<div class="ex-explain">{@html spec.explain}</div>{/if}
      {/if}
    </div>

    {#if spec.solution}
      <div class="ex-solution ui">
        <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
        {#if showSolution}<pre class="ex-code">{spec.solution}</pre>{/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .decode {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  h4 {
    margin: 0 0 0.2rem;
    font-size: 0.9rem;
  }
  .artifact {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }
  .scroll {
    overflow-x: auto;
    max-width: 100%;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
  }
  .scroll:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  table {
    border-collapse: collapse;
    font-size: 0.72rem;
  }
  caption {
    text-align: left;
    padding: 0.25rem 0.5rem;
    font-family: var(--font-ui);
    font-size: 0.76rem;
    color: var(--ink-3);
  }
  caption.sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  th,
  td {
    padding: 0.05rem 0.25rem;
    text-align: center;
    font-weight: 500;
  }
  thead th {
    color: var(--ink-2);
    background: var(--surface-2);
    border-left: 1px solid var(--line);
    font-size: 0.68rem;
  }
  .grid td {
    font-family: var(--font-mono);
    min-width: 0.85rem;
    color: var(--ink-3);
  }
  .grid td.pair {
    border-left: 1px solid var(--line);
  }
  .grid td.one {
    color: var(--ink);
    font-weight: 800;
    background: var(--surface-2);
  }
  .grid td.gap {
    min-width: 0.5rem;
    background: var(--line);
    padding: 0;
  }
  .grid td.note {
    text-align: left;
    white-space: nowrap;
    font-family: var(--font-ui);
    color: var(--ink-3);
    padding-left: 0.6rem;
  }
  th.sticky {
    position: sticky;
    left: 0;
    background: var(--surface-2);
    text-align: left;
    white-space: nowrap;
    font-family: var(--font-mono);
    padding: 0.05rem 0.5rem;
    border-right: 1px solid var(--line);
    z-index: 1;
  }
  .list th,
  .list td {
    padding: 0.15rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--line);
  }
  .list td.mono {
    font-family: var(--font-mono);
  }
  .tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 0.4rem;
    flex-wrap: wrap;
  }
  .tabs button {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-2);
    font: inherit;
    font-size: 0.82rem;
    padding: 0.3rem 0.8rem;
    min-height: 2.3rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .tabs button.on {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    font-weight: 700;
  }
  .tabs button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .expr {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 0.86rem;
    line-height: 1.5;
    resize: vertical;
  }
  .expr:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .tt {
    font-size: 0.82rem;
  }
  .tt th,
  .tt td {
    padding: 0.1rem 0.6rem;
    border: 1px solid var(--line);
  }
  .tt td.in {
    font-family: var(--font-mono);
    color: var(--ink-3);
  }
  .tt button {
    min-width: 2.3rem;
    min-height: 2.3rem;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-3);
    font-family: var(--font-mono);
    font-size: 0.95rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .tt button.set {
    color: var(--ink);
    font-weight: 800;
    border-color: var(--line-strong);
  }
  .tt button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
</style>
