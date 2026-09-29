<!--
  A DCL design you can edit, simulate and look inside:

    ::dcl-playground{src="designs/counter.dcl" top="Counter"}
    ::dcl-playground{code="module Not(a: bit) -> (y: bit) { y = !a }"}

  The editor checks as you type (diagnostics, hover, completion). Beside it: inputs to drive and outputs to
  read on the RTL simulator, the file's tests with the waveform of a failure, and the lowered netlist drawn as
  gates on the digital engine, in step with the simulator. Hovering a line lights its gates; hovering a gate
  marks its source.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import DclEditor from '$lib/hdl/editor/DclEditor.svelte';
  import type { Analysis, TestOutcome } from '$lib/hdl/editor/analysis';
  import type { Analyzer } from '$lib/hdl/editor/client';
  import type { Circuit } from '$lib/sim/netlist/types';
  import type { Lowered } from '$lib/hdl/lower';
  import type { FormatOutcome } from '$lib/hdl/editor';
  import CircuitView from './CircuitView.svelte';
  import Problems from './Problems.svelte';
  import SimPanel from './SimPanel.svelte';
  import Tabs from './Tabs.svelte';
  import TestsPanel from './TestsPanel.svelte';
  import { designFile, designSource } from './designs';
  import { Probe } from './probe.svelte';
  import { RtlDriver } from './rtlDriver.svelte';

  let {
    src,
    code: inlineCode,
    top,
    title,
    subtitle,
    caption,
    n,
    tests = true,
    circuit: withCircuit = true,
    maxLines = 30,
    tab: initialTab,
  }: {
    /** A reference design: `designs/counter.dcl`. */
    src?: string;
    /** Or the source itself. */
    code?: string;
    /** The module to simulate (default: the `top` module, or the last one). */
    top?: string;
    title?: string;
    subtitle?: string;
    caption?: string;
    n?: string | number;
    /** Show the Tests tab and its button. */
    tests?: boolean;
    /** Show the Circuit tab. */
    circuit?: boolean;
    maxLines?: number;
    /** The tab shown first on a narrow screen: code, run, circuit or tests. */
    tab?: string;
  } = $props();

  const original = untrack(() => inlineCode ?? (src ? designSource(src) : undefined) ?? '// design not found\n');
  const file = untrack(() => designFile(src));
  const uid = $props.id();

  let code = $state(original);
  let analysis: Analysis | undefined = $state.raw();
  let pending = $state(true);
  let stale = $state(false);
  let tab = $state(untrack(() => initialTab ?? 'code'));
  let editor: DclEditor | undefined = $state();
  let view: CircuitView | undefined = $state();
  let status = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let outcomes: TestOutcome[] | undefined = $state.raw();
  let testing = $state(false);
  let circuit: { circuit: Circuit; lowered: Lowered } | undefined = $state.raw();
  let circuitError = $state('');

  const driver = new RtlDriver();
  const probe = new Probe();
  let analyzer: Analyzer | undefined;
  let analyzerReady: Promise<Analyzer> | undefined;

  function getAnalyzer(): Promise<Analyzer> {
    analyzerReady ??= import('$lib/hdl/editor/client').then((m) => (analyzer = m.getAnalyzer()));
    return analyzerReady;
  }

  // The editor's checker: also produces the design to simulate and the circuit to draw.
  async function analyze(text: string): Promise<Analysis | undefined> {
    pending = true;
    const a = await (await getAnalyzer()).run({ source: text, file, top, design: true, circuit: withCircuit ? { maxElements: 300 } : undefined }, uid);
    return a;
  }

  function onanalysis(a: Analysis) {
    pending = false;
    analysis = a;
    if (a.ok && a.design) {
      driver.load(a.design);
      stale = false;
    } else stale = true;
    if (a.ok) {
      circuitError = a.circuitError ?? (withCircuit && !a.circuit ? 'This design has no circuit to draw.' : '');
      circuit = a.circuit && a.lowered ? { circuit: a.circuit, lowered: a.lowered } : undefined;
    }
    // The results of the last test run no longer describe this text.
    if (outcomes) outcomes = undefined;
  }

  async function runTests() {
    testing = true;
    tab = 'tests';
    const a = await (await getAnalyzer()).run({ source: code, file, top, tests: true }, `${uid}-tests`);
    testing = false;
    outcomes = a?.testOutcomes ?? [];
  }

  function say(text: string) {
    status = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ''), 2500);
  }
  function onformat(o: FormatOutcome) {
    say(o === 'changed' ? 'Formatted.' : o === 'unchanged' ? 'Already formatted.' : 'Cannot format: fix the syntax errors first.');
  }
  function reset() {
    code = original;
    outcomes = undefined;
    say('Restored the original code.');
  }

  function reveal(offset: number) {
    tab = 'code';
    queueMicrotask(() => editor?.reveal(offset));
  }

  let pg: HTMLDivElement | undefined = $state();
  onMount(() => {
    // Beside the code, the simulator is the default view (there is no Code tab then).
    const ro = new ResizeObserver(([e]) => {
      if (e && e.contentRect.width >= 736 && tab === 'code') tab = 'run';
    });
    if (pg) ro.observe(pg);
    return () => {
      ro.disconnect();
      clearTimeout(statusTimer);
      void analyzer;
    };
  });

  const errors = $derived(analysis?.diagnostics.filter((d) => d.severity === 'error').length ?? 0);
  const panes = $derived([
    { id: 'code', label: 'Code', narrowOnly: true, badge: errors ? String(errors) : undefined },
    { id: 'run', label: 'Simulate' },
    { id: 'circuit', label: 'Circuit', hidden: !withCircuit },
    { id: 'tests', label: 'Tests', hidden: !tests },
  ]);
  const problems = $derived(analysis?.diagnostics.length ?? 0);
</script>

{#snippet controls()}
  <div class="bar ui" role="toolbar" aria-label="Editor tools">
    <button class="tool" type="button" onclick={() => onformat(editor?.format() ?? 'error')} title="Format the code (Shift+Alt+F)">Format</button>
    <button class="tool" type="button" onclick={reset} disabled={code === original}>Reset code</button>
    {#if tests}<button class="tool primary" type="button" onclick={runTests} disabled={testing || errors > 0}>Run tests</button>{/if}
    <span class="status" role="status" aria-live="polite">{status}</span>
  </div>
{/snippet}

<Widget title={title ?? file} {subtitle} {caption} {n} kind="DCL playground" live={false} {controls}>
  <div class="pg" data-tab={tab} bind:this={pg}>
    <div class="tabbar">
      <Tabs tabs={panes} bind:value={tab} label="Views" idPrefix="{uid}-tab" />
    </div>

    <div class="pane pane-code" id="{uid}-tab-panel-code" role="tabpanel" aria-labelledby="{uid}-tab-code">
      <DclEditor
        bind:this={editor}
        bind:doc={code}
        {analyze}
        {onanalysis}
        {onformat}
        {maxLines}
        probe={probe.ranges}
        onpointer={(h) => probe.fromSource(circuit?.lowered, h)}
        label="DCL source of {title ?? file}"
      />
      <Problems {analysis} {pending} onreveal={reveal} />
    </div>

    <div class="pane pane-run" id="{uid}-tab-panel-run" role="tabpanel" aria-labelledby="{uid}-tab-run">
      {#if stale && driver.ready}<p class="stale ui">The source has errors: this is the last version that compiled.</p>{/if}
      <SimPanel {driver} oninput={(name, value) => view?.apply({ op: 'set', name, value })} ontick={() => view?.apply({ op: 'tick' })} onreset={() => view?.apply({ op: 'reset' })} />
    </div>

    {#if withCircuit}
      <div class="pane pane-circuit" id="{uid}-tab-panel-circuit" role="tabpanel" aria-labelledby="{uid}-tab-circuit">
        {#if circuit}
          {#if analysis?.stats}
            <p class="stats ui">
              <span><b>{analysis.stats.gates}</b> gates</span><span><b>{analysis.stats.flipFlops}</b> flip-flops</span><span>depth <b>{analysis.stats.depth}</b></span>
              <span class="hint">Hover a line to light its gates, or a gate to mark its line. Flip the switches; press <em>Step clock</em> on the Simulate tab.</span>
            </p>
          {/if}
          <CircuitView
            bind:this={view}
            circuit={circuit.circuit}
            lowered={circuit.lowered}
            highlight={probe.ids}
            replay={driver.history}
            dim={stale}
            label="Gate-level circuit of {title ?? file}"
            onhover={(id) => probe.fromElement(circuit?.lowered, id)}
            oninput={(name, value) => driver.set(name, value)}
          />
        {:else}
          <p class="note ui">{circuitError || (pending ? 'Building the circuit…' : 'Fix the errors in the source to see its circuit.')}</p>
        {/if}
      </div>
    {/if}

    {#if tests}
      <div class="pane pane-tests" id="{uid}-tab-panel-tests" role="tabpanel" aria-labelledby="{uid}-tab-tests">
        <TestsPanel {outcomes} running={testing} onreveal={reveal} />
        {#if !outcomes && !testing}
          <button class="tool primary" type="button" onclick={runTests} disabled={errors > 0}>Run tests</button>
        {/if}
      </div>
    {/if}
  </div>
  <span class="sr" aria-live="polite">{problems ? `${problems} problems in the source` : ''}</span>
</Widget>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.5rem;
    flex: 1 1 100%;
  }
  .tool {
    height: 1.9rem;
    padding: 0 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .tool:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .tool:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tool:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .tool.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .tool.primary:hover:not(:disabled) {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .status {
    font-size: 0.78rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .pg {
    container-type: inline-size;
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .pane {
    display: none;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    gap: 0.6rem;
  }
  .pg[data-tab='code'] .pane-code,
  .pg[data-tab='run'] .pane-run,
  .pg[data-tab='circuit'] .pane-circuit,
  .pg[data-tab='tests'] .pane-tests {
    display: grid;
    align-content: start;
  }
  .stale {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--maybe);
  }
  .note {
    color: var(--mute);
    font-size: 0.85rem;
    margin: 0.4rem 0;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .stats b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .hint {
    flex: 1 1 100%;
    color: var(--mute);
    font-size: 0.76rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @container (min-width: 46rem) {
    .pg {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      grid-template-rows: auto auto 1fr;
      align-items: start;
      column-gap: 1.1rem;
    }
    .pane-code {
      display: grid;
      grid-column: 1;
      grid-row: 1 / span 3;
    }
    .tabbar {
      grid-column: 2;
      grid-row: 1;
    }
    .pane-run,
    .pane-circuit,
    .pane-tests {
      grid-column: 2;
      grid-row: 2;
    }
    /* The code tab does not exist beside the others: show the simulator instead. */
    .pg[data-tab='code'] .pane-run {
      display: grid;
      align-content: start;
    }
  }
</style>
