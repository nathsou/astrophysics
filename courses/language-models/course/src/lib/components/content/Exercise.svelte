<!--
  An in-browser coding exercise: edit TypeScript, run the tests in a sandboxed worker, get hints,
  reveal the solution, and — once passing — swap your implementation into the page's widgets.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExerciseSpec } from '$lib/content/types';
  import type { RunReport } from '$lib/exercise/protocol';
  import { runExercise } from '$lib/exercise/runner';
  import { impl } from '$lib/exercise/impl.svelte';
  import { get, put, type SavedExercise } from '$lib/lab/db';
  import CodeEditor from '$lib/exercise/CodeEditor.svelte';
  import Button from '../ui/Button.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import Icon from '../ui/Icon.svelte';

  let { spec }: { spec: ExerciseSpec } = $props();

  // svelte-ignore state_referenced_locally
  let code = $state(spec.starter);
  let loaded = $state(false);
  let running = $state(false);
  let report = $state<RunReport | null>(null);
  let passedEver = $state(false);
  let hintsShown = $state(0);
  let showSolution = $state(false);
  let useMine = $state(false);
  let installError = $state<string | null>(null);
  let editor = $state<ReturnType<typeof CodeEditor> | undefined>();
  let testedCode = $state<string | null>(null);

  const passedCount = $derived(report?.results.filter((r) => r.passed).length ?? 0);
  const total = $derived(report?.results.length ?? 0);
  const allPassed = $derived(testedCode === code && !!report?.ok && total > 0 && passedCount === total);

  onMount(async () => {
    const saved = await get<SavedExercise>('exercises', spec.id);
    if (saved) {
      code = saved.code;
      editor?.setValue(saved.code);
      passedEver = saved.passed;
      // Saved completion is history, not permission to run unverified code.
      // Run tests on the restored draft before installing it into widgets.
    }
    loaded = true;
  });

  function save() {
    void put('exercises', spec.id, { code, passed: passedEver, useMine, updatedAt: Date.now() } satisfies SavedExercise);
  }

  async function run() {
    if (running) return;
    running = true;
    const submitted = code;
    const nextReport = await runExercise(spec, submitted);
    running = false;
    if (code !== submitted) return;
    testedCode = submitted;
    report = nextReport;
    if (allPassed) passedEver = true;
    else if (useMine) toggleMine(false);
    save();
  }

  function edit(next: string) {
    code = next;
    report = null;
    testedCode = null;
    if (useMine) toggleMine(false, false);
    save();
  }

  function reset() {
    if (code !== spec.starter && !confirm('Replace your code with the starter code?')) return;
    edit(spec.starter);
    editor?.setValue(spec.starter);
    report = null;
    save();
  }

  function toggleMine(on: boolean, persist = true) {
    installError = null;
    if (!spec.provides) return;
    if (on && !allPassed) return;
    if (on) {
      try {
        impl.install(spec.id, code, spec.provides);
        useMine = true;
      } catch (e) {
        installError = e instanceof Error ? e.message : String(e);
        useMine = false;
      }
    } else {
      impl.uninstall(spec.id);
      useMine = false;
    }
    if (persist) save();
  }
</script>

<section class="exercise wide" aria-label="Exercise: {spec.title}">
  <header class="ui">
    <span class="kind"><Icon name="exercises" size={15} /> Exercise</span>
    <h4>{spec.title}</h4>
    {#if passedEver}
      <span class="badge ok"><Icon name="check" size={13} /> {allPassed ? 'Tests passed' : 'Previously passed'}</span>
    {:else if report}
      <span class="badge">{passedCount}/{total} passing</span>
    {/if}
  </header>

  <CodeEditor bind:this={editor} value={code} path="/exercises/{spec.id}/solution.ts" onchange={edit} onrun={run} label="Exercise: {spec.title}" />

  <div class="toolbar ui">
    <Button variant="primary" onclick={run} disabled={running || !loaded}>
      <Icon name="play" size={13} />
      {running ? 'Running…' : 'Run tests'}
      <kbd>⌘↵</kbd>
    </Button>
    <Button variant="ghost" onclick={reset}><Icon name="reset" size={14} /> Reset</Button>
    {#if spec.hints?.length}
      <Button variant="ghost" onclick={() => (hintsShown = Math.min(hintsShown + 1, spec.hints!.length))} disabled={hintsShown >= spec.hints.length}>
        <Icon name="tip" size={14} /> Hint {hintsShown ? `(${hintsShown}/${spec.hints.length})` : ''}
      </Button>
    {/if}
    <Button variant="ghost" onclick={() => (showSolution = !showSolution)}><Icon name="eye" size={14} /> {showSolution ? 'Hide' : 'Show'} solution</Button>
    <span class="spacer"></span>
    {#if spec.provides}
      <Toggle checked={useMine} disabled={!allPassed} onchange={(v) => toggleMine(v)} label="Use my code in this chapter’s widgets" />
    {/if}
  </div>

  {#if !report}<p class="ui">Run tests on this draft before using it in widgets. Previous completion does not verify edited code.</p>{/if}

  {#if installError}<p class="err ui">{installError}</p>{/if}

  {#if hintsShown}
    <ol class="hints">
      {#each spec.hints!.slice(0, hintsShown) as h, i (i)}<li>{@html h}</li>{/each}
    </ol>
  {/if}

  {#if report}
    <div class="results ui" aria-live="polite">
      {#if !report.ok}
        <div class="fail-all"><strong>Couldn’t run your code.</strong> {report.error}</div>
      {:else}
        <ul>
          {#each report.results as r (r.name)}
            <li class:pass={r.passed}>
              <span class="mark">{r.passed ? '✓' : '✗'}</span>
              <span class="name">{r.name}</span>
              {#if r.error}<code class="msg">{r.error}</code>{/if}
            </li>
          {/each}
        </ul>
        {#if allPassed}<p class="yay">All tests pass{spec.provides ? ' — you can now switch the widgets on this page to your implementation.' : '.'}</p>{/if}
      {/if}
      {#if report.logs.length}
        <details class="logs"><summary>Console output ({report.logs.length})</summary><pre>{report.logs.join('\n')}</pre></details>
      {/if}
    </div>
  {/if}

  {#if showSolution}
    <div class="solution">
      <div class="sol-label ui">Reference solution</div>
      <CodeEditor value={spec.solution} path="/exercises/{spec.id}/reference.ts" readonly typescript={false} minLines={4} label="Reference solution" />
    </div>
  {/if}
</section>

<style>
  .exercise {
    margin: 2rem 0;
    border: 1px solid color-mix(in srgb, var(--lab) 30%, var(--border));
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    background: color-mix(in srgb, var(--lab) 7%, var(--surface));
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
    color: var(--lab);
  }
  h4 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 0.95rem !important;
    flex: 1;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 99px;
    background: var(--surface-3);
    color: var(--ink-2);
  }
  .badge.ok {
    background: color-mix(in srgb, var(--good) 16%, var(--surface));
    color: var(--ink);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.75rem;
  }
  .toolbar kbd {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    opacity: 0.75;
    margin-left: 0.2rem;
  }
  .spacer {
    flex: 1;
  }
  .hints {
    margin: 0 1rem 0.75rem;
    padding: 0.6rem 0.8rem 0.6rem 2rem;
    background: color-mix(in srgb, var(--tip) 7%, var(--surface));
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
  }
  .results {
    border-top: 1px solid var(--border);
    padding: 0.65rem 1rem 0.75rem;
    font-size: 0.84rem;
  }
  .results ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }
  .results li {
    display: grid;
    grid-template-columns: 1.2rem 1fr;
    gap: 0 0.3rem;
  }
  .mark {
    font-weight: 700;
    color: var(--critical);
  }
  .pass .mark {
    color: var(--good);
  }
  .pass .name {
    color: var(--ink-2);
  }
  .msg {
    grid-column: 2;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
    background: var(--surface-2);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .fail-all {
    color: var(--ink);
  }
  .yay {
    margin: 0.6rem 0 0 !important;
    color: var(--ink);
    font-weight: 560;
  }
  .err {
    margin: 0 1rem 0.6rem !important;
    font-size: 0.82rem;
    color: var(--critical);
  }
  .logs {
    margin-top: 0.6rem;
  }
  .logs summary {
    cursor: pointer;
    color: var(--ink-2);
  }
  .logs pre {
    margin: 0.4rem 0 0;
    padding: 0.5rem 0.7rem;
    background: var(--surface-2);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    max-height: 14rem;
    overflow: auto;
  }
  .solution {
    border-top: 1px solid var(--border);
  }
  .sol-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
    color: var(--ink-3);
    padding: 0.5rem 1rem;
  }
</style>
