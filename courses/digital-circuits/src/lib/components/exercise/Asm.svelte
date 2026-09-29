<!--
  An ```asm block: write an Octet or RV32I program in a text editor with line numbers, assemble it (errors point at
  the line and column), run it on the reference interpreter with the board's LEDs, hex display and console, and
  check it against the tests (final registers, memory, LEDs, console text).

    id: ch23/double
    isa: octet
    start: |
      LD R0, [x]
      HLT
      x: .byte 0
    tests:
      - { name: "21", setup: { mem: { x: 21 } }, expect: { regs: { R0: 42 } } }
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { assembleSource, checkAsm, runOnce, type AsmInput, type AsmOutcome, type RunView } from './asm/run';

  let { spec }: { spec: AsmInput } = $props();

  const uid = $props.id();
  const isa = $derived(spec.isa ?? 'octet');
  let source = $state(untrack(() => progress.draft<string>(spec.id, spec.start ?? '')));
  let outcome = $state.raw<AsmOutcome | null>(null);
  let view = $state.raw<RunView | null>(null);
  let runError = $state('');
  let switches = $state(0);
  let buttons = $state(0);
  let adc = $state(0);
  let typed = $state('');
  let showSolution = $state(false);
  let stale = $state(false);
  let ta: HTMLTextAreaElement | undefined = $state();
  let gutter: HTMLDivElement | undefined = $state();
  onMount(() => {
    progress.load();
    source = progress.draft<string>(spec.id, source);
  });

  const lines = $derived(source.split('\n'));
  const errorLines = $derived(new Map((outcome?.diagnostics ?? []).filter((d) => d.severity === 'error').map((d) => [d.line, d.message])));
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function edited() {
    stale = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => progress.saveDraft(spec.id, source), 400);
  }
  function scroll() {
    if (gutter && ta) gutter.scrollTop = ta.scrollTop;
  }
  /** Tab inserts spaces; Escape (then Tab) leaves the box, so the keyboard is never trapped. */
  let escaped = false;
  function key(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      escaped = true;
      return;
    }
    if (ev.key === 'Tab' && !ev.shiftKey && !escaped && ta) {
      ev.preventDefault();
      const { selectionStart: s, selectionEnd: e } = ta;
      source = source.slice(0, s) + '    ' + source.slice(e);
      requestAnimationFrame(() => ta!.setSelectionRange(s + 4, s + 4));
      edited();
      return;
    }
    escaped = false;
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      run();
    }
  }
  /** Put the cursor on a line and column (from an error message). */
  function goto(line: number, column: number) {
    if (!ta) return;
    const before = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(before + column - 1, before + column - 1);
  }

  function assemble() {
    const a = assembleSource(isa, source);
    return a;
  }
  function run() {
    runError = '';
    const a = assemble();
    outcome = { pass: false, diagnostics: a.diagnostics, size: a.size, results: [], violations: [] };
    if (!a.ok) {
      view = null;
      return;
    }
    try {
      view = runOnce(isa, a.program!, { switches, buttons, adc, input: typed }, spec.maxSteps ?? 100_000);
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
    }
  }
  function check() {
    progress.saveDraft(spec.id, source);
    const r = checkAsm(spec, source);
    outcome = r;
    stale = false;
    if (r.pass) progress.markSolved(spec.id);
    if (r.diagnostics.every((d) => d.severity !== 'error')) {
      try {
        const a = assemble();
        if (a.ok) view = runOnce(isa, a.program!, { switches, buttons, adc, input: typed }, spec.maxSteps ?? 100_000);
      } catch {
        /* the test results say what went wrong */
      }
    }
  }
  const hex = (n: number, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');
  const failing = $derived(outcome?.results.filter((r) => !r.pass) ?? []);
</script>

<ExerciseFrame id={spec.id} kind="Assembly" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="asm">
    <div class="meta ui">
      <span class="isa">{isa === 'octet' ? 'Octet' : 'RV32I'}</span>
      <span class="muted">{lines.length} line{lines.length === 1 ? '' : 's'}</span>
      {#if spec.maxBytes}<span class="muted">limit {spec.maxBytes} bytes</span>{/if}
    </div>
    <div class="editor">
      <div class="gutter num" bind:this={gutter} aria-hidden="true">
        {#each lines as _, i (i)}<div class:err={errorLines.has(i + 1)}>{i + 1}</div>{/each}
      </div>
      <textarea
        bind:this={ta}
        bind:value={source}
        oninput={edited}
        onscroll={scroll}
        onkeydown={key}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        wrap="off"
        rows={Math.min(24, Math.max(8, lines.length + 1))}
        aria-label="{isa === 'octet' ? 'Octet' : 'RV32I'} assembly source"
        aria-describedby="{uid}-keys"
      ></textarea>
    </div>
    <p id="{uid}-keys" class="keys ui">Tab indents; press Escape then Tab to leave the box. Ctrl+Enter runs.</p>

    <div class="bar ui">
      <button type="button" class="run" onclick={run}><Icon name="play" size={14} /> Run</button>
      <button type="button" class="check" onclick={check}><Icon name="check" size={15} /> Check</button>
      <button type="button" onclick={() => ((source = spec.start ?? ''), edited())}>Start again</button>
    </div>

    <details class="inputs ui">
      <summary>Board inputs</summary>
      <div class="ins">
        <label>Switches (0–255)<input type="number" min="0" max="255" bind:value={switches} /></label>
        <label>Buttons (0–15)<input type="number" min="0" max="15" bind:value={buttons} /></label>
        <label>ADC (0–255)<input type="number" min="0" max="255" bind:value={adc} /></label>
        <label>Console input<input type="text" bind:value={typed} /></label>
      </div>
    </details>

    <div class="out ui" role="status" aria-live="polite">
      {#if outcome?.diagnostics.length}
        <ul class="diag">
          {#each outcome.diagnostics as d, i (i)}
            <li class={d.severity}>
              <button type="button" onclick={() => goto(d.line, d.column)}>line {d.line}, column {d.column}</button>
              {d.message}
            </li>
          {/each}
        </ul>
      {/if}
      {#if runError}<p class="prob">{runError}</p>{/if}
      {#if view}
        <div class="board" aria-label="The board after the run">
          <div class="leds" role="img" aria-label="LEDs: {view.leds.toString(2).padStart(8, '0')}">
            {#each Array.from({ length: 8 }, (_, i) => 7 - i) as b (b)}<span class="dot" class:on={(view.leds >> b) & 1}></span>{/each}
          </div>
          <div class="hexd num" aria-label="Hex display">{hex(view.hex, isa === 'octet' ? 2 : 4)}</div>
          <pre class="console" aria-label="Console output">{view.consoleText || ' '}</pre>
        </div>
        <p class="run muted">{view.reason}. {view.steps} instructions, {view.cycles} cycles. {view.regs.map((r) => `${r.name}=${r.value}`).join('  ')}</p>
      {/if}
      {#if outcome && outcome.results.length}
        <div class="verdict" class:ok={outcome.pass} class:bad={!outcome.pass}>
          <strong>{outcome.pass ? '✓ All tests pass.' : `✗ ${failing.length} of ${outcome.results.length} test${outcome.results.length === 1 ? '' : 's'} fail.`}</strong>
          {#if stale}<span class="muted"> (you have edited the program since)</span>{/if}
        </div>
        <ul class="tests">
          {#each outcome.results as r (r.name)}
            <li class:ok={r.pass}>
              <span class="mark">{r.pass ? '✓' : '✗'}</span> <strong>{r.name}</strong> <span class="muted">{r.steps} instructions, {r.cycles} cycles</span>
              {#each r.failures as f (f)}<div class="f">{f}</div>{/each}
            </li>
          {/each}
        </ul>
        {#each outcome.violations as v (v)}<p class="prob">{v}</p>{/each}
        {#if outcome.pass && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
      {/if}
    </div>

    {#if spec.solution}
      <div class="sol ui">
        <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
        {#if showSolution}<pre class="code">{spec.solution}</pre>{/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .asm {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .meta {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    font-size: 0.78rem;
    font-family: var(--font-ui);
  }
  .isa {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
  }
  .muted {
    color: var(--ink-3);
  }
  .editor {
    display: flex;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    overflow: hidden;
    min-width: 0;
  }
  .editor:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .gutter {
    flex: none;
    width: 2.6rem;
    padding: 0.5rem 0.4rem 0.5rem 0;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--ink-3);
    background: var(--surface-2);
    border-right: 1px solid var(--line);
    overflow: hidden;
    user-select: none;
  }
  .gutter .err {
    color: var(--bad);
    font-weight: 800;
  }
  textarea {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.6rem;
    border: 0;
    resize: vertical;
    background: transparent;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.5;
    tab-size: 4;
    outline: none;
    white-space: pre;
    overflow: auto;
  }
  .keys {
    margin: 0;
    font-size: 0.74rem;
    color: var(--ink-3);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .bar button,
  .sol button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.8rem;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--ink);
    min-height: 2.3rem;
    cursor: pointer;
  }
  .bar button:hover,
  .sol button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .bar .check {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
  }
  .inputs {
    font-size: 0.82rem;
  }
  .inputs summary {
    cursor: pointer;
    color: var(--ink-2);
    font-weight: 600;
  }
  .ins {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem;
    margin-top: 0.4rem;
  }
  .ins label {
    display: grid;
    gap: 0.15rem;
    font-size: 0.76rem;
    color: var(--ink-3);
  }
  .ins input {
    font: inherit;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink);
    min-width: 0;
  }
  .diag {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
    font-size: 0.82rem;
  }
  .diag li {
    padding: 0.25rem 0.6rem;
    border-left: 3px solid var(--bad);
    background: var(--bad-soft);
    border-radius: var(--radius-sm);
  }
  .diag li.warning {
    border-color: var(--warn, var(--copper));
    background: var(--surface-2);
  }
  .diag button {
    border: 0;
    background: none;
    font: inherit;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    margin-top: 0.4rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .leds {
    display: flex;
    gap: 0.3rem;
  }
  .dot {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--surface);
  }
  .dot.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 8px var(--sig-high-glow, transparent);
  }
  .hexd {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 1.2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--scope-bg, #111);
    color: var(--phosphor, #6f6);
  }
  .console {
    flex: 1;
    min-width: 8rem;
    margin: 0;
    padding: 0.25rem 0.5rem;
    min-height: 1.6rem;
    max-height: 7rem;
    overflow: auto;
    background: var(--scope-bg, #111);
    color: var(--phosphor, #6f6);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border-radius: 4px;
  }
  .run {
    margin: 0.3rem 0 0;
    font-size: 0.76rem;
  }
  .verdict {
    margin-top: 0.4rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--line-strong);
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .tests {
    list-style: none;
    padding: 0;
    margin: 0.3rem 0 0;
    font-size: 0.84rem;
  }
  .tests li {
    margin: 0.2rem 0;
  }
  .mark {
    color: var(--bad);
    font-weight: 800;
  }
  .tests li.ok .mark {
    color: var(--ok);
  }
  .f {
    margin-left: 1.4rem;
    color: var(--bad);
    font-size: 0.8rem;
  }
  .prob {
    color: var(--bad);
    font-size: 0.84rem;
  }
  .code {
    margin: 0.5rem 0 0;
    padding: 0.6rem 0.8rem;
    border-left: 3px solid var(--ok);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    overflow-x: auto;
  }
  .explain {
    margin-top: 0.5rem;
    padding: 0.5rem 0.8rem 0.1rem;
    border-left: 3px solid var(--ok);
    background: var(--surface-2);
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
</style>
