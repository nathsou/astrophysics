<!--
  Write a proof yourself. Support: a hint ladder, a self-check rubric, the model proof, and (with
  the learner's own API key) Socratic feedback from Claude.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { tutorSettings } from '$lib/tutor/settings.svelte';
  import { askTutor, TutorError } from '$lib/tutor/tutor';
  import { htmlToText, renderReply } from '$lib/tutor/render';
  import Icon from '../ui/Icon.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    rubric?: string[];
    /** Extra context for the tutor (plain text). */
    tutor?: string;
  }
  let { spec }: { spec: Spec } = $props();

  let text = $state('');
  let ticks = $state<boolean[]>([]);
  let reply = $state('');
  let busy = $state(false);
  let error = $state('');
  let controller: AbortController | null = null;
  let mounted = $state(false);

  onMount(() => {
    tutorSettings.load();
    const d = progress.draft(spec.id, { text: '', ticks: [] as boolean[] });
    text = d.text;
    ticks = d.ticks;
    mounted = true;
  });

  function save() {
    progress.saveDraft(spec.id, { text, ticks });
    const rubric = spec.rubric ?? [];
    if (rubric.length && text.trim().length > 20 && rubric.every((_, i) => ticks[i])) progress.markSolved(spec.id);
  }

  async function ask(mode: 'feedback' | 'hint') {
    if (!tutorSettings.enabled) {
      tutorSettings.open = true;
      return;
    }
    busy = true;
    error = '';
    reply = '';
    controller = new AbortController();
    try {
      await askTutor(
        {
          mode,
          statement: htmlToText(spec.prompt ?? ''),
          attempt: text,
          solution: spec.solution ? htmlToText(spec.solution) : undefined,
          rubric: spec.rubric?.map(htmlToText),
          context: spec.tutor,
        },
        (chunk) => (reply += chunk),
        controller.signal,
      );
    } catch (e) {
      error = e instanceof TutorError ? e.message : String(e);
    } finally {
      busy = false;
      controller = null;
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="Write a proof" completionLabel="Self-reviewed" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution} solutionLabel="Compare with a model proof">
  <textarea bind:value={text} oninput={save} rows={Math.max(6, text.split('\n').length + 1)} placeholder="Write your proof here. Plain text is fine; use $…$ for maths if you like." aria-label="Your proof"></textarea>
  {#if spec.rubric?.length}
    <fieldset class="rubric ui">
      <legend>Self-review: these checks do not verify the proof automatically</legend>
      {#each spec.rubric as r, i (i)}
        <label><input type="checkbox" bind:checked={ticks[i]} onchange={save} /> <span>{@html r}</span></label>
      {/each}
    </fieldset>
  {/if}
  <div class="tutor ui">
    <button onclick={() => ask('feedback')} disabled={busy || (mounted && !text.trim())}><Icon name="question" size={14} /> AI feedback (optional)</button>
    <button onclick={() => ask('hint')} disabled={busy}><Icon name="tip" size={14} /> AI nudge (optional)</button>
    {#if busy}<button class="stop" onclick={() => controller?.abort()}>Stop</button>{/if}
    <span class="spacer"></span>
    <button class="link" onclick={() => (tutorSettings.open = true)}>{mounted && tutorSettings.enabled ? 'Tutor settings' : 'Set up the AI tutor'}</button>
  </div>
  {#if error}<p class="error ui">{error}</p>{/if}
  {#if reply}
    <div class="reply" aria-live="polite">
      <p class="who ui">Tutor</p>
      {@html renderReply(reply)}
    </div>
  {/if}
</ExerciseFrame>

<style>
  textarea {
    width: 100%;
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.55;
    padding: 0.6rem 0.75rem;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--ink);
    resize: vertical;
  }
  .rubric {
    margin: 0.75rem 0 0;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.8rem 0.6rem;
    font-size: 0.85rem;
  }
  legend {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
    color: var(--ink-2);
    padding: 0 0.3rem;
  }
  .rubric label {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin: 0.3rem 0;
  }
  .rubric label :global(p) {
    display: inline;
    margin: 0;
  }
  .tutor {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    font-size: 0.82rem;
  }
  .tutor button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 2px solid var(--fg);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.2rem 0.7rem;
    cursor: pointer;
    font-weight: 700;
  }
  .tutor button:hover:not(:disabled) {
    background: var(--fx-yellow);
    color: var(--fx-ink);
  }
  .tutor button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tutor .link,
  .tutor .link:hover:not(:disabled) {
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }
  .spacer {
    flex: 1;
  }
  .error {
    color: var(--bad);
    font-size: 0.85rem;
  }
  .reply {
    margin-top: 0.75rem;
    padding: 0.6rem 0.9rem 0.2rem;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    border-left: 6px solid var(--fx-yellow);
    font-size: 1rem;
  }
  .reply :global(p) {
    margin: 0 0 0.6rem;
  }
  .who {
    font-family: var(--font-mono);
    font-size: 0.68rem !important;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 0.2rem !important;
  }
</style>
