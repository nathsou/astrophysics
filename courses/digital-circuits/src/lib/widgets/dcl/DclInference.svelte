<!--
  The inference viewer: write DCL on the left and watch, on the right, the gates it becomes.

    ::dcl-inference{src="designs/counter.dcl"}
    ::dcl-inference{code="module Not(a: bit) -> (y: bit) { y = !a }" title="A first module"}

  The netlist updates as you type. Hover a line to light its gates; hover a gate to mark the line it came from.
  Below the drawing, a readout of what each construct cost: `if` becomes multiplexers, `+` becomes a chain of
  adders, `reg` becomes flip-flops.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import DclEditor from '$lib/hdl/editor/DclEditor.svelte';
  import type { Analysis, ConstructInfo } from '$lib/hdl/editor/analysis';
  import type { Analyzer } from '$lib/hdl/editor/client';
  import type { FormatOutcome } from '$lib/hdl/editor';
  import type { Circuit } from '$lib/sim/netlist/types';
  import type { Lowered } from '$lib/hdl/lower';
  import CircuitView from './CircuitView.svelte';
  import Problems from './Problems.svelte';
  import Readout from './Readout.svelte';
  import Tabs from './Tabs.svelte';
  import { designFile, designSource } from './designs';
  import { Probe } from './probe.svelte';
  import type { Op } from './rtlDriver.svelte';

  let {
    src,
    code: inlineCode,
    top,
    title,
    subtitle,
    caption,
    n,
    maxLines = 26,
    maxElements = 250,
    tab: initialTab,
  }: {
    src?: string;
    code?: string;
    top?: string;
    title?: string;
    subtitle?: string;
    caption?: string;
    n?: string | number;
    maxLines?: number;
    /** Designs with more elements than this are not drawn (the readout still works). */
    maxElements?: number;
    /** The tab shown first on a narrow screen: code, circuit or cost. */
    tab?: string;
  } = $props();

  const original = untrack(() => inlineCode ?? (src ? designSource(src) : undefined) ?? '// design not found\n');
  const file = untrack(() => designFile(src));
  const uid = $props.id();

  let code = $state(original);
  let analysis: Analysis | undefined = $state.raw();
  let good: Analysis | undefined = $state.raw();
  let pending = $state(true);
  let tab = $state(untrack(() => initialTab ?? 'code'));
  let editor: DclEditor | undefined = $state();
  let view: CircuitView | undefined = $state();
  let status = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let clock = $state(0);
  let analyzerReady: Promise<Analyzer> | undefined;
  const probe = new Probe();
  /** What the reader did to the drawing since the last change of the source, replayed on the new circuit. */
  let history: Op[] = $state.raw([]);

  const circuit: { circuit: Circuit; lowered: Lowered } | undefined = $derived(good?.circuit && good.lowered ? { circuit: good.circuit, lowered: good.lowered } : undefined);
  const stale = $derived(!!analysis && !analysis.ok);
  const hasClock = $derived(!!circuit?.lowered.ports.some((p) => p.clock));

  async function analyze(text: string): Promise<Analysis | undefined> {
    pending = true;
    analyzerReady ??= import('$lib/hdl/editor/client').then((m) => m.getAnalyzer());
    return (await analyzerReady).run({ source: text, file, top, circuit: { maxElements } }, uid);
  }

  function onanalysis(a: Analysis) {
    pending = false;
    analysis = a;
    if (a.ok) {
      good = a;
      history = [];
      clock = 0;
    }
  }

  function say(text: string) {
    status = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ''), 2500);
  }
  function onformat(o: FormatOutcome) {
    say(o === 'changed' ? 'Formatted.' : o === 'unchanged' ? 'Already formatted.' : 'Cannot format: fix the syntax errors first.');
  }
  function reveal(offset: number) {
    tab = 'code';
    queueMicrotask(() => editor?.reveal(offset));
  }
  function tick() {
    history = [...history, { op: 'tick' }];
    clock++;
    view?.apply({ op: 'tick' });
  }
  function resetGates() {
    history = [];
    clock = 0;
    view?.apply({ op: 'reset' });
  }
  function toProbe(c: ConstructInfo | null) {
    probe.fromConstruct(good?.lowered, c);
  }

  const errors = $derived(analysis?.diagnostics.filter((d) => d.severity === 'error').length ?? 0);
  const panes = $derived([
    { id: 'code', label: 'Code', narrowOnly: true, badge: errors ? String(errors) : undefined },
    { id: 'circuit', label: 'Netlist', narrowOnly: true },
    { id: 'cost', label: 'What it costs', narrowOnly: true },
  ]);
</script>

{#snippet controls()}
  <div class="bar ui" role="toolbar" aria-label="Editor tools">
    <button class="tool" type="button" onclick={() => onformat(editor?.format() ?? 'error')} title="Format the code (Shift+Alt+F)">Format</button>
    <button class="tool" type="button" onclick={() => { code = original; say('Restored the original code.'); }} disabled={code === original}>Reset code</button>
    <span class="status" role="status" aria-live="polite">{status}</span>
  </div>
{/snippet}

<Widget title={title ?? file} {subtitle} {caption} {n} kind="Inference viewer" live={false} {controls}>
  <div class="inf" data-tab={tab}>
    <div class="tabbar"><Tabs tabs={panes} bind:value={tab} label="Views" idPrefix="{uid}-tab" /></div>

    <div class="pane pane-code" id="{uid}-tab-panel-code" role="tabpanel" aria-labelledby="{uid}-tab-code">
      <DclEditor
        bind:this={editor}
        bind:doc={code}
        {analyze}
        {onanalysis}
        {onformat}
        {maxLines}
        delay={250}
        probe={probe.ranges}
        onpointer={(h) => probe.fromSource(good?.lowered, h)}
        label="DCL source of {title ?? file}"
      />
      <Problems {analysis} {pending} onreveal={reveal} />
    </div>

    <div class="pane pane-circuit" id="{uid}-tab-panel-circuit" role="tabpanel" aria-labelledby="{uid}-tab-circuit">
      <div class="draw">
        {#if circuit}
          {#if stale}<p class="stale ui">The source has errors: showing the last version that compiled.</p>{/if}
          <CircuitView
            bind:this={view}
            circuit={circuit.circuit}
            lowered={circuit.lowered}
            highlight={probe.ids}
            replay={history}
            dim={stale}
            label="Gate-level circuit of {title ?? file}"
            onhover={(id) => probe.fromElement(circuit?.lowered, id)}
          />
          <div class="ctl ui">
            {#if hasClock}
              <button class="tool primary" type="button" onclick={tick}>Step clock</button>
              <button class="tool" type="button" onclick={resetGates}>Reset</button>
              <span class="cyc">cycle {clock}</span>
            {/if}
            <span class="hint">Flip the switches to drive the gates. Hover a gate to see its line.</span>
          </div>
        {:else if good?.circuitError}
          <p class="note ui">{good.circuitError[0]!.toUpperCase() + good.circuitError.slice(1)}: this design is too big to draw gate by gate. The readout below still counts what it becomes.</p>
        {:else}
          <p class="note ui">{pending ? 'Building the netlist…' : 'Fix the errors in the source to see the gates.'}</p>
        {/if}
      </div>
    </div>

    <div class="pane pane-cost" id="{uid}-tab-panel-cost" role="tabpanel" aria-labelledby="{uid}-tab-cost">
      {#if good}
        <Readout analysis={good} source={good.source} onprobe={toProbe} onreveal={reveal} />
      {:else}
        <p class="note ui">{pending ? 'Compiling…' : 'Nothing compiled yet.'}</p>
      {/if}
    </div>
  </div>
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
  .inf {
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
    align-content: start;
  }
  .inf[data-tab='code'] .pane-code,
  .inf[data-tab='circuit'] .pane-circuit,
  .inf[data-tab='cost'] .pane-cost {
    display: grid;
  }
  .draw {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-width: 0;
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }
  .cyc {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  .hint {
    color: var(--mute);
    font-size: 0.76rem;
  }
  .note {
    color: var(--mute);
    font-size: 0.85rem;
    margin: 0.4rem 0;
  }
  .stale {
    margin: 0;
    font-size: 0.8rem;
    color: var(--maybe);
  }
  @container (min-width: 46rem) {
    .inf {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      grid-template-rows: auto auto 1fr;
      align-items: start;
      column-gap: 1.1rem;
    }
    .tabbar {
      display: none;
    }
    .pane-code {
      display: grid;
      grid-column: 1;
      grid-row: 1 / span 3;
    }
    .pane-circuit {
      display: grid;
      grid-column: 2;
      grid-row: 1;
    }
    .pane-cost {
      display: grid;
      grid-column: 2;
      grid-row: 2;
      border-top: 1px solid var(--line);
      padding-top: 0.8rem;
    }
  }
</style>
