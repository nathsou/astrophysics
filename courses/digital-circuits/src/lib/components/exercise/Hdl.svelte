<!--
  An ```hdl block: write DCL to a specification in the course's editor (diagnostics as you type), and press Check.
  The design is run against hidden `test` blocks and compared with a hidden reference design on the RTL simulator:
  every input combination when the inputs are few enough, then random ones; a clocked design from power-up on every
  short input sequence and on random ones. A mismatch comes back as a table of inputs, expected outputs and what
  your design gave.

    id: ch29/priority-encoder
    top: PriorityEncoder
    start: |
      module PriorityEncoder(req: bits<4>) -> (valid: bit, index: bits<2>) { … }
    reference: |
      module PriorityEncoder(…) { … }
    tests: |
      test "highest wins" { … }
    solution: |
      module PriorityEncoder(…) { … }

  See check.ts for the fields and the checker.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import Mismatch from './parts/Mismatch.svelte';
  import Verdict from './parts/Verdict.svelte';
  import './parts/exercise.css';
  import DclEditor from '$lib/hdl/editor/DclEditor.svelte';
  import Problems from '$lib/widgets/dcl/Problems.svelte';
  import TestsPanel from '$lib/widgets/dcl/TestsPanel.svelte';
  import { highlightDclHtml } from '$lib/hdl/editor/highlightHtml';
  import type { Analysis, TestOutcome } from '$lib/hdl/editor/analysis';
  import type { Analyzer } from '$lib/hdl/editor/client';
  import type { FormatOutcome } from '$lib/hdl/editor';
  import { progress } from '$lib/state/progress.svelte';
  import type { HdlInput, HdlOutcome } from './hdl/check';

  let { spec }: { spec: HdlInput } = $props();

  const uid = $props.id();
  let code = $state(untrack(() => progress.draft<string>(spec.id, spec.start)));
  let analysis: Analysis | undefined = $state.raw();
  let pending = $state(true);
  let editor: DclEditor | undefined = $state();
  let outcome = $state.raw<HdlOutcome | null>(null);
  let stale = $state(false);
  let checking = $state(false);
  let status = $state('');
  let showSolution = $state(false);
  let tests: TestOutcome[] | undefined = $state.raw();
  let testing = $state(false);
  let analyzer: Analyzer | undefined;
  let analyzerReady: Promise<Analyzer> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    progress.load();
    code = progress.draft<string>(spec.id, code);
    return () => {
      clearTimeout(saveTimer);
      clearTimeout(statusTimer);
      void analyzer;
    };
  });

  function getAnalyzer(): Promise<Analyzer> {
    analyzerReady ??= import('$lib/hdl/editor/client').then((m) => (analyzer = m.getAnalyzer()));
    return analyzerReady;
  }
  async function analyze(text: string): Promise<Analysis | undefined> {
    pending = true;
    return (await getAnalyzer()).run({ source: text, file: `${spec.top}.dcl`, top: spec.top }, uid);
  }
  function onanalysis(a: Analysis) {
    pending = false;
    analysis = a;
    tests = undefined;
  }
  $effect(() => {
    // Every edit: remember it, and mark the verdict as out of date.
    const text = code;
    untrack(() => {
      stale = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => progress.saveDraft(spec.id, text), 400);
    });
  });

  function say(text: string) {
    status = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ''), 2500);
  }
  function onformat(o: FormatOutcome) {
    say(o === 'changed' ? 'Formatted.' : o === 'unchanged' ? 'Already formatted.' : 'Cannot format: fix the syntax errors first.');
  }
  function reveal(offset: number) {
    queueMicrotask(() => editor?.reveal(offset));
  }
  async function runTests() {
    testing = true;
    const a = await (await getAnalyzer()).run({ source: code, file: `${spec.top}.dcl`, top: spec.top, tests: true }, `${uid}-tests`);
    testing = false;
    tests = a?.testOutcomes ?? [];
  }
  async function check() {
    checking = true;
    progress.saveDraft(spec.id, code);
    // Let the button paint first: the check runs on the page's thread.
    await new Promise((r) => setTimeout(r, 0));
    const { checkHdl } = await import('./hdl/check');
    outcome = checkHdl(spec, code);
    stale = false;
    checking = false;
    if (outcome.pass) progress.markSolved(spec.id);
  }

  const errors = $derived(analysis?.diagnostics.filter((d) => d.severity === 'error').length ?? 0);
  const eq = $derived(outcome?.equivalence);
  const solutionHtml = $derived(spec.solution ? highlightDclHtml(spec.solution) : '');
</script>

<ExerciseFrame id={spec.id} kind="HDL" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="hdl">
    <DclEditor
      bind:this={editor}
      bind:doc={code}
      {analyze}
      {onanalysis}
      {onformat}
      minLines={spec.height ?? 8}
      maxLines={Math.max(spec.height ?? 14, 14)}
      label="DCL source: module {spec.top}"
    />
    <Problems {analysis} {pending} onreveal={reveal} />

    <div class="ex-bar ui">
      <button type="button" class="check" onclick={check} disabled={checking}><Icon name="check" size={15} /> {checking ? 'Checking…' : 'Check'}</button>
      <button type="button" onclick={runTests} disabled={testing || errors > 0}>Run my tests</button>
      <button type="button" onclick={() => onformat(editor?.format() ?? 'error')} title="Format the code (Shift+Alt+F)">Format</button>
      <button type="button" onclick={() => (code = spec.start)} disabled={code === spec.start}>Start again</button>
      <span class="ex-note status" role="status" aria-live="polite">{status}</span>
    </div>

    {#if tests || testing}
      <TestsPanel outcomes={tests} running={testing} onreveal={reveal} />
    {/if}

    <div class="out ui" id="{uid}-out">
      {#if outcome}
        <Verdict ok={outcome.pass}>
          {#if outcome.pass}Passes every hidden test and matches the reference.{:else if outcome.problems.length || outcome.diagnostics.some((d) => d.severity === 'error')}Not checked: the design has problems.{:else}Not yet.{/if}
          {#if stale}<span class="ex-note"> (you have edited it since)</span>{/if}
        </Verdict>
        {#each outcome.diagnostics.filter((d) => d.severity === 'error') as d, i (i)}
          <p class="ex-bad">line {d.span.line}: {d.message}</p>
        {/each}
        {#each outcome.problems as p (p)}<p class="ex-bad">{p}</p>{/each}
        {#if outcome.tests.length}
          <ul class="ex-list" aria-label="Hidden tests">
            {#each outcome.tests as t (t.name)}
              <li class:ok={t.passed}>
                <span class="mark">{t.passed ? '✓' : '✗'}</span> <strong>{t.name}</strong>
                {#if !t.passed}<div class="f">{t.message}</div>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if eq}
          <p class="ex-note">
            {#if eq.pass}
              Compared with the reference design: {#if eq.kind === 'exhaustive'}all {eq.vectors.toLocaleString('en-GB')} input combinations agree{:else if eq.kind === 'random'}{eq.vectors.toLocaleString('en-GB')} random input vectors agree (too many inputs to try them all){:else}{eq.vectors.toLocaleString('en-GB')} clock cycles from power-up agree, on every short input sequence and on random ones{/if}.
            {:else}
              {#if eq.sequential}The clocked design differs from the reference. The last cycles before the first mismatch (outputs are compared before and after each clock edge):{:else}The design differs from the reference on {eq.mismatches.toLocaleString('en-GB')} of {eq.vectors.toLocaleString('en-GB')} {eq.kind === 'exhaustive' ? 'input combinations' : 'random vectors'}. The first:{/if}
            {/if}
          </p>
          {#if !eq.pass && eq.rows.length}
            <Mismatch
              rows={eq.rows.map((r) => ({ ...r, step: r.cycle === undefined ? undefined : `cycle ${r.cycle + 1}, ${r.phase === 'before' ? 'before' : 'after'} the edge` }))}
              caption={eq.sequential ? 'Inputs held in each cycle, and the outputs expected and given' : 'Inputs, expected outputs, and what your design gave'}
            />
          {/if}
        {/if}
        {#if outcome.pass && spec.explain}<div class="ex-explain">{@html spec.explain}</div>{/if}
      {/if}
    </div>

    {#if spec.solution}
      <div class="ex-solution ui">
        <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
        {#if showSolution}<div class="sol">{@html solutionHtml}</div>{/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .hdl {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .status {
    margin: 0;
  }
  .sol {
    margin-top: 0.5rem;
    border-left: 3px solid var(--ok);
    overflow-x: auto;
  }
  .sol :global(pre) {
    margin: 0;
    padding: 0.6rem 0.8rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    background: var(--surface-2) !important;
  }
</style>
