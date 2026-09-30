<!--
  The FPGA source pane: the DCL editor (CodeMirror, checked as you type), the example picker, the device size and
  the Fit button, with a progress bar that shows the stage the flow is in. Hovering a line lights its gates, cells and
  nets in the other views, and what is selected elsewhere is marked here.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import DclEditor from '../../../hdl/editor/DclEditor.svelte';
  import { FPGA_EXAMPLES, fpgaExample } from '../../fpga/examples';
  import { FLOW_STAGES } from '../../fpga/types';
  import type { FpgaSession, SizeChoice } from '../../fpga/session.svelte';
  import Icon from '../../../components/ui/Icon.svelte';
  import Segmented from '../../../components/ui/Segmented.svelte';

  let { session, examples = true, sizes = true, readonly = false }: { session: FpgaSession; examples?: boolean; sizes?: boolean; readonly?: boolean } = $props();

  let editor: DclEditor | undefined = $state();
  let lastLine = 0;
  let sizeChoice = $state<SizeChoice>('auto');
  $effect(() => {
    sizeChoice = session.size;
  });

  /** Source ranges of the lines in the probes (whole lines, without their indentation). */
  const ranges = $derived.by(() => {
    const lines = new Set([...session.probe.lines, ...session.hoverProbe.lines]);
    if (!lines.size) return [];
    const out: { from: number; to: number }[] = [];
    let offset = 0;
    session.source.split('\n').forEach((text, i) => {
      const n = i + 1;
      if (lines.has(n)) {
        const start = offset + (text.length - text.trimStart().length);
        const end = offset + text.trimEnd().length;
        if (end > start) out.push({ from: start, to: end });
      }
      offset += text.length + 1;
    });
    return out;
  });

  // The editor owns the text while typing; the session's text wins when it changes from outside (an example).
  let doc = $state(untrack(() => session.source));
  $effect(() => {
    const s = session.source;
    if (s !== doc) doc = s;
  });
  $effect(() => {
    if (doc !== session.source) session.setSource(doc);
  });

  // What is selected elsewhere (a cell, a gate, a module): show its source in the editor.
  $effect(() => {
    const sel = session.selected;
    const lines = [...session.probe.lines];
    if (!sel || sel.kind === 'line' || !lines.length || !editor) return;
    const line = Math.min(...lines);
    let offset = 0;
    const text = untrack(() => session.source).split('\n');
    for (let i = 0; i < line - 1 && i < text.length; i++) offset += text[i]!.length + 1;
    editor.reveal(offset);
  });

  function onpointer(hit: { offset: number; line: number; gutter?: boolean } | null) {
    lastLine = hit?.line ?? 0;
    session.hover(hit ? { kind: 'line', line: hit.line } : null);
  }

  const errors = $derived(session.analysis?.diagnostics.filter((d) => d.severity === 'error') ?? []);
  const stages = FLOW_STAGES;
  const info = $derived(fpgaExample(session.exampleId));
  const badge = $derived(
    session.status === 'running'
      ? { text: 'fitting…', cls: 'warn' }
      : session.status === 'error'
        ? { text: session.error?.stage ? `failed in ${session.error.stage}` : 'failed', cls: 'bad' }
        : session.hasErrors
          ? { text: `${errors.length} error${errors.length === 1 ? '' : 's'}`, cls: 'bad' }
          : session.result && session.stale
            ? { text: 'changed since the last fit', cls: 'warn' }
            : session.result
              ? { text: `fitted on ${session.result.deviceName}`, cls: 'ok' }
              : { text: 'not fitted', cls: '' },
  );
</script>

<div class="src">
  <div class="bar ui">
    {#if examples}
      <label class="pick">
        <span class="sr">Example design</span>
        <select value={session.exampleId ?? ''} onchange={(ev) => session.loadExample((ev.currentTarget as HTMLSelectElement).value)} aria-label="Example design">
          {#if !session.exampleId}<option value="" disabled>Your design</option>{/if}
          {#each FPGA_EXAMPLES as ex (ex.id)}<option value={ex.id}>{ex.title}</option>{/each}
        </select>
      </label>
    {/if}
    {#if sizes}
      <Segmented size="sm" label="Device size" options={[{ value: 'auto', label: 'Auto', title: 'The smallest device the design fits' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' }, { value: 'L', label: 'L' }]} bind:value={sizeChoice} onchange={(v) => (session.size = v)} />
    {/if}
    {#if session.tops.length > 1}
      <label class="pick">
        <span class="sr">Top module</span>
        <select value={session.top ?? session.analysis?.top ?? ''} onchange={(ev) => (session.top = (ev.currentTarget as HTMLSelectElement).value)} aria-label="Top module">
          {#each session.tops as t (t)}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    {/if}
    <span class="state {badge.cls}" role="status">{badge.text}</span>
    <span class="grow"></span>
    <label class="auto" title="Fit again after each edit"><input type="checkbox" bind:checked={session.auto} /> auto</label>
    {#if session.status === 'running'}
      <button type="button" class="fit stop" onclick={() => session.cancel()}><Icon name="close" size={12} /> Stop</button>
    {:else}
      <button type="button" class="fit" onclick={() => session.fit()} disabled={session.hasErrors && !session.analysis?.design}><Icon name="play" size={12} /> Fit</button>
    {/if}
  </div>

  {#if session.status === 'running' || session.doneStages.size}
    <div class="prog ui" class:idle={session.status !== 'running'} role="progressbar" aria-label="Fitting progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(session.progress * 100)}>
      <div class="track"><div class="fill" style:width="{session.progress * 100}%"></div></div>
      <ol>
        {#each stages as s (s.name)}
          {@const done = session.doneStages.has(s.name)}
          <li class:done class:now={session.runningStage === s.name} title={done && session.stageMs[s.name] !== undefined ? `${session.stageMs[s.name]!.toFixed(1)} ms` : s.label}>{s.label}</li>
        {/each}
      </ol>
    </div>
  {/if}

  {#if info?.heavy && session.status !== 'running' && !session.result}
    <p class="note ui">This design is large: fitting it on {info.size === 'L' ? 'vFPGA-L' : 'a bigger device'} takes several seconds in the worker.</p>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="box" onclick={() => lastLine > 0 && (session.selected = { kind: 'line', line: lastLine })}>
    <DclEditor bind:this={editor} bind:doc analyze={session.analyze} onanalysis={session.onanalysis} {onpointer} probe={ranges} {readonly} minLines={8} maxLines={400} label="DCL source for the vFPGA" />
  </div>

  <div class="msgs ui" aria-live="polite">
    {#if session.error}
      <p class="msg"><span class="tag">{session.error.stage ?? 'error'}</span>{session.error.message}</p>
    {/if}
    {#each errors.slice(0, 4) as d, i (i)}
      <button type="button" class="msg line" onclick={() => editor?.reveal(d.span.start)}><span class="tag">line {d.span.line}</span>{d.message}</button>
    {/each}
    {#if session.result?.report.warnings.length}
      {#each session.result.report.warnings as w, i (i)}<p class="msg warn"><span class="tag">warning</span>{w}</p>{/each}
    {/if}
  </div>
</div>

<style>
  .src {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--panel);
  }
  .bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.8rem;
  }
  .grow {
    flex: 1;
  }
  select {
    max-width: 12rem;
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
  }
  .state {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    border-radius: 99px;
    border: 1px solid var(--line-strong);
    color: var(--mute);
  }
  .state.ok {
    color: var(--ok);
    border-color: color-mix(in srgb, var(--ok) 45%, transparent);
  }
  .state.warn {
    color: var(--maybe);
    border-color: color-mix(in srgb, var(--maybe) 45%, transparent);
  }
  .state.bad {
    color: var(--bad);
    border-color: color-mix(in srgb, var(--bad) 45%, transparent);
  }
  .auto {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    color: var(--ink-2);
    font-size: 0.76rem;
  }
  .fit {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font: inherit;
    font-weight: 600;
    padding: 0.2rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }
  .fit.stop {
    background: transparent;
    color: var(--bad);
    border-color: var(--bad);
  }
  .fit:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .prog {
    padding: 0.35rem 0.6rem 0.4rem;
    border-bottom: 1px solid var(--line);
    background: var(--pn);
  }
  .prog.idle {
    opacity: 0.85;
  }
  .track {
    height: 5px;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--copper), var(--phosphor));
    transition: width 120ms linear;
  }
  ol {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 0.6rem;
    margin: 0.3rem 0 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--mute);
  }
  li.done {
    color: var(--ok);
  }
  li.now {
    color: var(--copper-ink);
    font-weight: 700;
  }
  .note {
    margin: 0;
    padding: 0.3rem 0.7rem;
    font-size: 0.76rem;
    color: var(--maybe);
    background: var(--maybe-soft);
  }
  .box {
    flex: 1;
    min-height: 8rem;
    overflow: auto;
  }
  .box :global(.cm-editor) {
    border-radius: 0;
  }
  .msgs {
    font-size: 0.78rem;
    max-height: 8rem;
    overflow: auto;
  }
  .msg {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    margin: 0;
    padding: 0.3rem 0.7rem;
    border: 0;
    border-top: 1px solid var(--line);
    background: var(--bad-soft);
    color: var(--fg);
    font: inherit;
    text-align: left;
  }
  .msg.warn {
    background: var(--maybe-soft);
  }
  button.msg {
    cursor: pointer;
  }
  .tag {
    flex: none;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--bad);
    font-weight: 700;
    text-transform: uppercase;
  }
  .warn .tag {
    color: var(--maybe);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
