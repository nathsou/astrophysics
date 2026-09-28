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

<ExerciseFrame id={spec.id} kind="Write a proof" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution} solutionLabel="Compare with a model proof">
  <textarea bind:value={text} oninput={save} rows={Math.max(6, text.split('\n').length + 1)} placeholder="Write your proof here. Plain text is fine; use $…$ for maths if you like." aria-label="Your proof"></textarea>
  {#if spec.rubric?.length}
    <fieldset class="rubric ui">
      <legend>Check your proof</legend>
      {#each spec.rubric as r, i (i)}
        <label><input type="checkbox" bind:checked={ticks[i]} onchange={save} /> <span>{@html r}</span></label>
      {/each}
    </fieldset>
  {/if}
  <div class="tutor ui">
    <button onclick={() => ask('feedback')} disabled={busy || (mounted && !text.trim())}><Icon name="question" size={14} /> Feedback on my proof</button>
    <button onclick={() => ask('hint')} disabled={busy}><Icon name="tip" size={14} /> Nudge me</button>
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
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--page);
    color: var(--ink);
    resize: vertical;
  }
  .rubric {
    margin: 0.75rem 0 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.8rem 0.6rem;
    font-size: 0.85rem;
  }
  legend {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 650;
    color: var(--ink-3);
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
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.65rem;
    cursor: pointer;
  }
  .tutor button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tutor .link {
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
    font-size: 1rem;
  }
  .reply :global(p) {
    margin: 0 0 0.6rem;
  }
  .who {
    font-size: 0.7rem !important;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
    color: var(--accent);
    margin-bottom: 0.2rem !important;
  }
</style>
