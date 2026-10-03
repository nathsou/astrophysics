<script lang="ts">
  /** Write your own sentence; the AI teacher says what works and what to fix. */
  import type { Compose } from '$lib/exercises/types';
  import { settings } from '$lib/state/settings.svelte';
  import { askTutor, tag, TutorError } from '$lib/tutor/tutor';
  import { composeSystem } from '$lib/tutor/prompts';
  import { levelLabel } from '$lib/tutor/known';
  import Rich from './Rich.svelte';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import TutorGate from './TutorGate.svelte';
  import { onDestroy } from 'svelte';

  let { data, report }: { data: Compose; id: string; report: (ok: boolean) => void } = $props();
  let text = $state('');
  let busy = $state(false);
  let result = $state<{ verdict: string; better: string; explain: string } | null>(null);
  let error = $state('');
  let showExamples = $state(false);
  let checkedText = $state('');
  let alive = true;
  let controller: AbortController | null = null;
  onDestroy(() => { alive = false; controller?.abort(); });
  $effect(() => { if (text !== checkedText) result = null; });

  async function check(e: Event) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    busy = true;
    error = '';
    result = null;
    checkedText = text;
    controller = new AbortController();
    try {
      const out = await askTutor({
        system: composeSystem(data.task, data.target, levelLabel(settings.data.start)),
        messages: [{ role: 'user', content: text.trim() }],
        effort: 'medium',
        signal: controller.signal,
      });
      if (!alive) return;
      result = { verdict: tag(out, 'verdict').toLowerCase(), better: tag(out, 'better'), explain: tag(out, 'explain') || out };
      report(result.verdict.startsWith('correct'));
    } catch (err) {
      if (alive) error = err instanceof TutorError ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

<p class="task"><Rich text={data.task} /></p>
{#if data.hints?.length}<ul class="hints ui">{#each data.hints as h (h)}<li><Rich text={h} /></li>{/each}</ul>{/if}
{#if !settings.tutorEnabled}
  <TutorGate what="Feedback on your own sentences" />
  {#if data.examples?.length}
    <button class="btn small ghost" onclick={() => (showExamples = !showExamples)}>{showExamples ? 'Hide' : 'Show'} example answers</button>
    {#if showExamples}<ul class="ex">{#each data.examples as x (x)}<li><Zh text={x} /></li>{/each}</ul>{/if}
  {/if}
{:else}
  <form class="ui" onsubmit={check}>
    <textarea bind:value={text} readonly={busy} rows="2" placeholder="Write in characters or pinyin…" aria-label="Your sentence"></textarea>
    <button class="btn primary" disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Check my sentence'}</button>
  </form>
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if result}
    <div class="result {result.verdict.split(/\W/)[0]}">
      <p class="v ui">{result.verdict.startsWith('correct') ? '对！ That works.' : result.verdict.startsWith('almost') ? '差不多！ Almost.' : 'Not quite yet.'}</p>
      {#if result.better}<p class="better"><Zh text={result.better} size="md" play={false} /><PlayButton text={result.better} small /></p>{/if}
      <p><Rich text={result.explain} /></p>
    </div>
  {/if}
  {#if data.examples?.length}
    <button class="btn small ghost" onclick={() => (showExamples = !showExamples)}>{showExamples ? 'Hide' : 'Show'} example answers</button>
    {#if showExamples}<ul class="ex">{#each data.examples as x (x)}<li><Zh text={x} /></li>{/each}</ul>{/if}
  {/if}
{/if}

<style>
  .task {
    margin: 0 0 0.5rem;
  }
  .hints {
    margin: 0 0 0.8rem;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  form {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  textarea {
    width: 100%;
    font-size: 1.05rem;
    padding: 0.55rem 0.8rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    resize: vertical;
  }
  .result {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border-radius: 12px;
    background: var(--pn);
  }
  .result.correct {
    background: var(--jade-soft);
  }
  .result.almost {
    background: var(--gold-soft);
  }
  .v {
    margin: 0;
    font-weight: 700;
  }
  .better {
    margin: 0.3rem 0;
  }
  .result p:last-child {
    margin-bottom: 0;
  }
  .ex {
    margin: 0.4rem 0 0;
  }
  .err {
    color: var(--bad);
    font-size: 0.88rem;
  }
</style>
