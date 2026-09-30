<!--
  Put the lines of a proof in order (Parsons problem). Distractor lines must be left out.
  `swappable` lists groups of line indices that may appear in any order among themselves.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { progress } from '$lib/state/progress.svelte';
  import { rng } from './types';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    lines: string[];
    distractors?: string[];
    swappable?: number[][];
  }
  let { spec }: { spec: Spec } = $props();

  interface Line {
    key: number;
    html: string;
    /** Position in the correct proof, or −1 for a distractor. */
    pos: number;
  }

  const all: Line[] = [...spec.lines.map((html, i) => ({ key: i, html, pos: i })), ...(spec.distractors ?? []).map((html, i) => ({ key: 1000 + i, html, pos: -1 }))];
  // Deterministic shuffle so SSR and hydration agree.
  const r = rng(spec.id.length * 7919 + spec.lines.length);
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  let pool = $state<Line[]>(shuffled);
  let proof = $state<Line[]>([]);
  let feedback = $state<{ ok: boolean; text: string; wrongAt?: number } | null>(null);

  onMount(() => {
    const saved = progress.draft<number[]>(spec.id, []);
    if (saved.length) {
      proof = saved.map((k) => all.find((l) => l.key === k)).filter((l): l is Line => !!l);
      pool = shuffled.filter((l) => !saved.includes(l.key));
    }
  });

  function save() {
    progress.saveDraft(spec.id, proof.map((l) => l.key));
    feedback = null;
  }
  function add(l: Line) {
    pool = pool.filter((x) => x !== l);
    proof = [...proof, l];
    save();
  }
  function remove(l: Line) {
    proof = proof.filter((x) => x !== l);
    pool = [...pool, l];
    save();
  }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= proof.length) return;
    const next = [...proof];
    [next[i], next[j]] = [next[j]!, next[i]!];
    proof = next;
    save();
  }

  /** Rank of a line position, merging swappable groups into one rank. */
  function rank(pos: number): number {
    for (const g of spec.swappable ?? []) if (g.includes(pos)) return Math.min(...g);
    return pos;
  }

  function check() {
    for (let i = 0; i < proof.length; i++) {
      if (proof[i]!.pos < 0) {
        feedback = { ok: false, text: `Line ${i + 1} does not belong in this proof.`, wrongAt: i };
        return;
      }
    }
    for (let i = 0; i < proof.length; i++) {
      const expected = rank(i);
      if (rank(proof[i]!.pos) !== expected) {
        feedback = { ok: false, text: `The first ${i} line${i === 1 ? ' is' : 's are'} right; line ${i + 1} is out of place.`, wrongAt: i };
        return;
      }
    }
    if (proof.length < spec.lines.length) {
      feedback = { ok: false, text: `So far so good — ${spec.lines.length - proof.length} more line${spec.lines.length - proof.length > 1 ? 's' : ''} to place.` };
      return;
    }
    feedback = { ok: true, text: 'That is a complete, correctly ordered proof.' };
    progress.markSolved(spec.id);
  }
</script>

<ExerciseFrame id={spec.id} kind="Order the proof" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  <div class="cols">
    <div class="col">
      <p class="lbl ui">Available lines <span>(click to use)</span></p>
      <ul class="pool">
        {#each pool as l (l.key)}
          <li animate:flip={{ duration: 180 }}><button class="line" onclick={() => add(l)}>{@html l.html}</button></li>
        {/each}
        {#if pool.length === 0}<li class="empty ui">All lines used.</li>{/if}
      </ul>
    </div>
    <div class="col">
      <p class="lbl ui">Your proof</p>
      <ol class="proof">
        {#each proof as l, i (l.key)}
          <li animate:flip={{ duration: 180 }} class:wrong={feedback?.wrongAt === i}>
            <span class="n ui">{i + 1}</span>
            <div class="line static">{@html l.html}</div>
            <span class="tools ui">
              <button onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button onclick={() => move(i, 1)} disabled={i === proof.length - 1} aria-label="Move down">↓</button>
              <button onclick={() => remove(l)} aria-label="Remove">×</button>
            </span>
          </li>
        {/each}
        {#if proof.length === 0}<li class="empty ui">Build the proof here, line by line.</li>{/if}
      </ol>
    </div>
  </div>
  <div class="row ui">
    <button class="check" onclick={check} disabled={proof.length === 0}>Check</button>
    {#if feedback}<span class:ok={feedback.ok} class:bad={!feedback.ok}>{feedback.ok ? '✓' : '→'} {feedback.text}</span>{/if}
  </div>
  {#if feedback?.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
</ExerciseFrame>

<style>
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 720px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .lbl {
    margin: 0 0 0.35rem !important;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 650;
    color: var(--ink-3);
  }
  .lbl span {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  ul,
  ol {
    list-style: none;
    margin: 0 !important;
    padding: 0;
    display: grid;
    gap: 0.4rem;
    align-content: start;
    min-height: 3rem;
  }
  li {
    margin: 0 !important;
  }
  .line {
    display: block;
    width: 100%;
    text-align: left;
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.45;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
    cursor: pointer;
  }
  .line :global(p) {
    margin: 0;
  }
  button.line:hover {
    background: var(--pn);
    border-color: var(--copper);
  }
  .proof li {
    display: grid;
    grid-template-columns: 1.4rem 1fr auto;
    align-items: center;
    gap: 0.3rem;
  }
  .proof li.wrong .line {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .static {
    cursor: default;
    background: var(--surface-2);
  }
  .n {
    font-size: 0.75rem;
    color: var(--ink-3);
    text-align: right;
  }
  .tools {
    display: flex;
    gap: 0.15rem;
  }
  .tools button {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius-sm);
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .tools button:disabled {
    opacity: 0.3;
  }
  .proof li.empty {
    display: block;
  }
  .empty {
    font-size: 0.8rem;
    color: var(--ink-3);
    padding: 0.6rem;
    border: 2px dashed var(--rule-strong);
    border-radius: var(--radius-sm);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.8rem;
    font-size: 0.85rem;
  }
  .check {
    border: 1px solid var(--ok);
    background: var(--ok);
    color: var(--on-accent);
    border-radius: var(--radius-sm);
    padding: 0.26rem 0.9rem;
    cursor: pointer;
    font-weight: 700;
  }
  .check:disabled {
    opacity: 0.5;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
  }
  .explain {
    margin-top: 0.75rem;
    padding: 0.6rem 0.9rem 0.1rem;
    border-radius: var(--radius-sm);
    background: var(--ok-soft);
    border-left: 3px solid var(--ok);
  }
  .explain :global(p) {
    margin: 0 0 0.6rem;
  }
</style>
