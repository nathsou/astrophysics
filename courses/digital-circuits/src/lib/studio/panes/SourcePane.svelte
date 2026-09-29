<!--
  The source pane: a text editor with line numbers and error markers, an example picker, and the Fit button.
  The editor is a plain textarea that grows to its content inside one scrolling box, so the gutter and the
  highlight layer scroll with it and need no synchronising. A design language other than equations (DCL)
  plugs in as another adapter: this pane only edits text and shows the adapter's errors.
-->
<script lang="ts">
  import type { Studio } from '../studio.svelte';
  import Icon from '../../components/ui/Icon.svelte';

  let { studio, readonly = false, examples = true }: { studio: Studio; readonly?: boolean; examples?: boolean } = $props();

  const LH = 20;
  const lines = $derived(studio.source.split('\n'));
  const errorLines = $derived(new Map(studio.errors.filter((e) => e.line > 0).map((e) => [e.line, e])));
  const generalErrors = $derived(studio.errors.filter((e) => e.line <= 0));
  const selLines = $derived(studio.probe.lines);
  const hovLines = $derived(studio.hoverProbe.lines);
  const widest = $derived(Math.max(20, ...lines.map((l) => l.length)));
  let ta: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    void studio.source;
    if (ta) {
      ta.style.height = '0px';
      ta.style.height = `${Math.max(lines.length * LH + 16, ta.scrollHeight)}px`;
    }
  });

  function oninput(ev: Event) {
    studio.setSource((ev.currentTarget as HTMLTextAreaElement).value);
  }

  /** The output defined on the line the caret is on, if exactly one. */
  function caretSelect() {
    if (!ta || !studio.fit) return;
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const outs = Object.entries(studio.fit.outputLine).filter(([, l]) => l === line).map(([n]) => n);
    if (outs.length === 1 && !(studio.selected?.kind === 'output' && studio.selected.name === outs[0])) studio.selected = { kind: 'output', name: outs[0]! };
  }

  const badge = $derived(
    studio.status === 'error'
      ? { text: `${studio.errors.filter((e) => e.severity !== 'warning').length} error${studio.errors.length === 1 ? '' : 's'}`, cls: 'bad' }
      : studio.status === 'edited'
        ? { text: 'edited by hand', cls: 'warn' }
        : studio.status === 'stale'
          ? { text: 'fitting…', cls: 'warn' }
          : { text: 'fitted', cls: 'ok' },
  );
</script>

<div class="src">
  <div class="bar ui">
    {#if examples && studio.adapter}
      <label class="pick">
        <span class="sr">Example design</span>
        <select value={studio.exampleId ?? ''} onchange={(ev) => studio.loadExample((ev.currentTarget as HTMLSelectElement).value)} aria-label="Example design">
          {#if !studio.exampleId}<option value="" disabled>Your design</option>{/if}
          {#each studio.adapter.examples as ex (ex.id)}<option value={ex.id}>{ex.title}</option>{/each}
        </select>
      </label>
    {/if}
    <span class="state {badge.cls}" role="status">{badge.text}</span>
    <span class="grow"></span>
    <label class="auto" title="Fit automatically after each edit">
      <input type="checkbox" bind:checked={studio.auto} /> auto
    </label>
    <button type="button" class="fit" onclick={() => studio.fitNow()} disabled={!studio.stale && studio.status !== 'error' && studio.status !== 'edited' && studio.status !== 'ok'}>
      <Icon name="play" size={12} /> Fit
    </button>
  </div>

  <div class="box">
    <div class="ed" style:--lh="{LH}px" style:--ch="{widest}">
      <div class="gutter" aria-hidden="true">
        {#each lines as _, i (i)}
          {@const n = i + 1}
          <button type="button" tabindex="-1" class="ln" class:err={errorLines.has(n)} class:sel={selLines.has(n)} class:hov={hovLines.has(n)} onclick={() => studio.select({ kind: 'line', line: n })} onpointerenter={() => studio.hover({ kind: 'line', line: n })} onpointerleave={() => studio.hover(null)}>
            {#if errorLines.has(n)}<span class="dot"></span>{/if}{n}
          </button>
        {/each}
      </div>
      <div class="code">
        <div class="layer" aria-hidden="true">
          {#each lines as _, i (i)}
            {@const n = i + 1}
            <div class="row" class:sel={selLines.has(n)} class:hov={hovLines.has(n) && !selLines.has(n)} class:err={errorLines.has(n)} title={errorLines.get(n)?.message}></div>
          {/each}
        </div>
        <textarea
          bind:this={ta}
          value={studio.source}
          {oninput}
          onclick={caretSelect}
          onkeyup={(ev) => (ev.key.startsWith('Arrow') || ev.key === 'Home' || ev.key === 'End' || ev.key === 'PageUp' || ev.key === 'PageDown') && caretSelect()}
          {readonly}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          wrap="off"
          rows={lines.length}
          aria-label="{studio.adapter?.name ?? 'Device'} source: {studio.adapter?.language ?? ''}"
          aria-invalid={studio.hasErrors}
          aria-describedby="src-errors"
        ></textarea>
      </div>
    </div>
  </div>

  <div class="msgs ui" id="src-errors" aria-live="polite">
    {#each generalErrors as e, i (i)}
      <p class="msg" class:warn={e.severity === 'warning'}><span class="tag">{e.severity === 'warning' ? 'warning' : 'error'}</span>{e.message}</p>
    {/each}
    {#each [...errorLines.values()] as e (e.line + e.message)}
      <button type="button" class="msg line" class:warn={e.severity === 'warning'} onclick={() => ta?.focus()}><span class="tag">line {e.line}</span>{e.message}</button>
    {/each}
  </div>
  {#if studio.adapter}
    <details class="help ui">
      <summary>{studio.adapter.language}</summary>
      {#each studio.adapter.syntax as l, i (i)}<p class:code={/^\s{2}|^[A-Z!#][^ ]*\s{2,}/.test(l) || l.startsWith('#')}>{l}</p>{/each}
    </details>
  {/if}
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
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.8rem;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
  }
  select {
    max-width: 14rem;
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
  }
  .state {
    font-family: var(--font-mono);
    font-size: 0.72rem;
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
  .fit:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .box {
    flex: 1;
    min-height: 8rem;
    overflow: auto;
    background: light-dark(#fffdf8, #0a1019);
  }
  .ed {
    display: flex;
    min-width: 100%;
    width: max-content;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: var(--lh);
  }
  .gutter {
    position: sticky;
    left: 0;
    z-index: 2;
    flex: none;
    padding: 8px 0;
    background: light-dark(#f3ecdd, #0e1520);
    border-right: 1px solid var(--line);
    text-align: right;
    min-width: 2.6rem;
  }
  .ln {
    display: block;
    width: 100%;
    height: var(--lh);
    line-height: var(--lh);
    padding: 0 0.5rem 0 0.9rem;
    border: 0;
    background: transparent;
    color: var(--mute);
    font: inherit;
    text-align: right;
    cursor: pointer;
    position: relative;
  }
  .ln:hover {
    color: var(--fg);
  }
  .ln.sel {
    color: var(--phosphor-ink);
    font-weight: 700;
  }
  .ln.hov {
    color: var(--copper-ink);
  }
  .ln.err {
    color: var(--bad);
    font-weight: 700;
  }
  .dot {
    position: absolute;
    left: 0.3rem;
    top: 50%;
    width: 6px;
    height: 6px;
    margin-top: -3px;
    border-radius: 50%;
    background: var(--bad);
  }
  .code {
    position: relative;
    flex: 1;
    min-width: calc(var(--ch) * 1ch + 3rem);
    padding: 8px 0;
  }
  .layer {
    position: absolute;
    inset: 8px 0 0 0;
    pointer-events: none;
  }
  .row {
    height: var(--lh);
  }
  .row.sel {
    background: var(--term-hl-strong);
    box-shadow: inset 3px 0 0 var(--phosphor);
  }
  .row.hov {
    background: var(--term-hl);
  }
  .row.err {
    background: var(--bad-soft);
    box-shadow: inset 3px 0 0 var(--bad);
  }
  textarea {
    position: relative;
    display: block;
    width: 100%;
    margin: 0;
    padding: 0 0.7rem;
    border: 0;
    outline: 0;
    resize: none;
    overflow: hidden;
    background: transparent;
    color: var(--fg);
    font: inherit;
    line-height: var(--lh);
    white-space: pre;
    tab-size: 2;
    caret-color: var(--copper);
  }
  textarea:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .msgs {
    font-size: 0.78rem;
    max-height: 7rem;
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
  .help {
    border-top: 1px solid var(--line);
    padding: 0.3rem 0.7rem;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .help summary {
    cursor: pointer;
    color: var(--mute);
  }
  .help p {
    margin: 0.25rem 0;
  }
  .help p.code {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    white-space: pre-wrap;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
