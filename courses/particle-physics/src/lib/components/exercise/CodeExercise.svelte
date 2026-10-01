<!--
  A code exercise: edit TypeScript against hidden tests, run them in a worker, and (when a `hook` is named)
  offer the passing code to the pipeline as "my code" (src/lib/hep/hooks.ts, src/lib/code/mine.ts).
  Spec: { id, title, prompt, starter, tests, solution (reference code), hook?, hints? }.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { runExercise } from '$lib/code/runner';
  import { saveMine } from '$lib/code/mine';
  import type { RunReport } from '$lib/code/protocol';
  import CodeEditor from './CodeEditor.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import Icon from '../ui/Icon.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    starter: string;
    tests: string;
    /** Reference solution source (shown on request, and used by the test suite). */
    solution?: string;
    /** The pipeline hook this code feeds, e.g. "reco.circleFit". */
    hook?: string;
  }
  let { spec }: { spec: Spec } = $props();

  let code = $state(spec.starter);
  let editor: CodeEditor | undefined;
  let running = $state(false);
  let report = $state<RunReport | null>(null);
  let mounted = $state(false);

  onMount(() => {
    progress.load();
    const saved = progress.draft<string | null>(spec.id, null);
    if (saved !== null && saved !== spec.starter) {
      code = saved;
      editor?.setValue(saved);
    }
    mounted = true;
  });

  const passed = $derived(report?.ok && report.results.length > 0 && report.results.every((r) => r.passed));
  const solutionHtml = $derived(spec.solution ? `<pre class="solution-code"><code>${escape(spec.solution)}</code></pre>` : undefined);

  function escape(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function run() {
    if (running) return;
    running = true;
    progress.saveDraft(spec.id, code);
    report = await runExercise(spec, code);
    running = false;
    if (passed) {
      progress.markSolved(spec.id);
      if (spec.hook) saveMine(spec.hook, spec.id, code);
    }
  }
  function reset() {
    code = spec.starter;
    editor?.setValue(spec.starter);
    report = null;
    progress.saveDraft(spec.id, spec.starter);
  }
</script>

<ExerciseFrame id={spec.id} kind="Code" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={solutionHtml} solutionLabel="Show the reference solution">
  <div class="code-ex">
    <CodeEditor bind:this={editor} value={code} path="{spec.id}.ts" onchange={(c) => (code = c)} onrun={run} minLines={10} label="Your code" />
    <div class="bar ui">
      <button class="run" onclick={run} disabled={running}><Icon name="play" size={14} /> {running ? 'Running…' : 'Run tests'}</button>
      <button onclick={reset}><Icon name="reset" size={14} /> Reset</button>
      <span class="hint">Ctrl/⌘ + Enter runs the tests</span>
      {#if spec.hook && mounted && progress.isSolved(spec.id)}
        <span class="mine" title="The Control Room can run your version in the pipeline">Saved as <code>{spec.hook}</code>: use it in the Control Room</span>
      {/if}
    </div>
    {#if report}
      {#if !report.ok}
        <Verdict ok={false}>{report.error}</Verdict>
      {:else}
        <Verdict ok={!!passed}>{passed ? `All ${report.results.length} tests pass.` : `${report.results.filter((r) => !r.passed).length} of ${report.results.length} tests fail.`}</Verdict>
        <ul class="results ui">
          {#each report.results as r}
            <li class:ok={r.passed}>
              <span class="mark">{r.passed ? '✓' : '✗'}</span> {r.name}
              {#if r.error}<pre>{r.error}</pre>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if report.logs.length}<pre class="logs">{report.logs.join('\n')}</pre>{/if}
    {/if}
  </div>
</ExerciseFrame>

<style>
  .code-ex {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.82rem;
  }
  .bar button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
  }
  .bar .run {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 600;
  }
  .hint,
  .mine {
    color: var(--mute);
    font-size: 0.75rem;
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.82rem;
  }
  .results li {
    padding: 0.15rem 0;
    color: var(--bad);
  }
  .results li.ok {
    color: var(--ok);
  }
  .results pre,
  .logs {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: pre-wrap;
    margin: 0.2rem 0 0.2rem 1.2rem;
    color: var(--ink-2);
  }
  .mark {
    font-family: var(--font-mono);
  }
</style>
