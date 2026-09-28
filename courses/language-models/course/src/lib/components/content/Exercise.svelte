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
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const passedCount = $derived(report?.results.filter((r) => r.passed).length ?? 0);
  const total = $derived(report?.results.length ?? 0);
  const allPassed = $derived(!!report?.ok && total > 0 && passedCount === total);

  onMount(async () => {
    const saved = await get<SavedExercise>('exercises', spec.id);
    if (saved) {
      code = saved.code;
      editor?.setValue(saved.code);
      passedEver = saved.passed;
      if (saved.useMine && saved.passed && spec.provides) toggleMine(true, false);
    }
    loaded = true;
  });

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => put('exercises', spec.id, { code, passed: passedEver, useMine, updatedAt: Date.now() } satisfies SavedExercise), 400);
  }

  async function run() {
    if (running) return;
    running = true;
    report = await runExercise(spec, code);
    running = false;
    if (allPassed) passedEver = true;
    else if (useMine) toggleMine(false);
    save();
  }

  function reset() {
    if (code !== spec.starter && !confirm('Replace your code with the starter code?')) return;
    code = spec.starter;
    editor?.setValue(spec.starter);
    report = null;
    save();
  }

  function toggleMine(on: boolean, persist = true) {
    installError = null;
    if (!spec.provides) return;
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
    <span class="kind"><Icon name="exercises" size={14} /> Exercise</span>
    <h4>{spec.title}</h4>
    {#if passedEver}
      <span class="badge ok"><Icon name="check" size={13} /> Solved</span>
    {:else if report}
      <span class="badge">{passedCount}/{total} passing</span>
    {/if}
  </header>

  <div class="cell">
    <span class="nb in" aria-hidden="true"></span>
    <div class="cell-body">
      <CodeEditor bind:this={editor} value={code} path="/exercises/{spec.id}/solution.ts" onchange={(c) => ((code = c), save())} onrun={run} label="Exercise: {spec.title}" />
    </div>
  </div>

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
      <Toggle checked={useMine} disabled={!passedEver} onchange={(v) => toggleMine(v)} label="Use my code in this chapter’s widgets" />
    {/if}
  </div>

  {#if installError}<p class="err ui">{installError}</p>{/if}

  {#if hintsShown}
    <ol class="hints">
      {#each spec.hints!.slice(0, hintsShown) as h, i (i)}<li>{@html h}</li>{/each}
    </ol>
  {/if}

  {#if report}
    <div class="results" aria-live="polite">
      <span class="nb out" aria-hidden="true"></span>
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
    <div class="cell solution">
      <div class="cell-body">
        <div class="sol-label ui">Reference solution</div>
        <CodeEditor value={spec.solution} path="/exercises/{spec.id}/reference.ts" readonly typescript={false} minLines={4} label="Reference solution" />
      </div>
    </div>
  {/if}
</section>

<style>
  .exercise {
    margin: 2.5rem 0;
    position: relative;
    counter-increment: cell;
  }
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    padding: 0 0 0.6rem;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font: 500 0.7rem var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
  }
  h4 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 1.1rem !important;
    letter-spacing: -0.02em;
    flex: 1;
  }
  .cell {
    position: relative;
  }
  .cell-body {
    background: var(--pn);
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
    overflow: hidden;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: 500 0.72rem var(--font-mono);
    padding: 0.1rem 0.5rem;
    border-radius: 3px;
    background: var(--pn);
    color: var(--ink-2);
  }
  .badge.ok {
    background: color-mix(in srgb, var(--good) 16%, var(--bg));
    color: var(--good);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0 0.35rem;
  }
  .toolbar kbd {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    opacity: 0.75;
    margin-left: 0.2rem;
  }
  .spacer {
    flex: 1;
  }
  .hints {
    margin: 0.4rem 0 0.75rem;
    padding: 0.6rem 0.8rem 0.6rem 2rem;
    border-left: 3px solid var(--tip);
    background: color-mix(in srgb, var(--tip) 8%, var(--bg));
    border-radius: 0 var(--radius) var(--radius) 0;
    font-size: 0.95rem;
  }
  .results {
    position: relative;
    margin-top: 0.6rem;
    padding: 0.2rem 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
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
    background: var(--pn);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .fail-all {
    color: var(--ink);
  }
  .yay {
    margin: 0.6rem 0 0 !important;
    color: var(--good);
    font-weight: 500;
  }
  .err {
    margin: 0.4rem 0 0.6rem !important;
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
    background: var(--pn);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    max-height: 14rem;
    overflow: auto;
  }
  .solution {
    margin-top: 0.75rem;
  }
  .solution .cell-body {
    border-left-color: var(--mute);
  }
  .sol-label {
    font: 500 0.68rem var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-3);
    padding: 0.5rem 1rem 0;
  }
</style>
