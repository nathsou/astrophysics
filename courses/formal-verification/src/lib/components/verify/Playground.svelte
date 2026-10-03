<!--
  The Workbench: a Vouch editor with its verdicts beside it. Each verdict is a badge; selecting a violated one shows
  its counterexample, and stepping through a program trace highlights the statement in the editor. Used full-page
  (/workbench) and inline in chapters (`::workbench{example="peterson"}` or with the code as the directive body).
-->
<script lang="ts">
  import { base } from '$app/paths';
  import VouchEditor from './VouchEditor.svelte';
  import Badge from './Badge.svelte';
  import TraceView from './TraceView.svelte';
  import type { RangedVerdict, VerdictsPayload } from './lsp';

  let {
    code,
    name = 'workbench',
    title,
    caption,
    minLines = 12,
    wide = true,
    locked = [],
    onverdicts,
  }: {
    code: string;
    name?: string;
    title?: string;
    caption?: string;
    minLines?: number;
    wide?: boolean;
    locked?: [number, number][];
    onverdicts?: (p: VerdictsPayload) => void;
  } = $props();

  let editor: VouchEditor | undefined = $state();
  let payload = $state<VerdictsPayload | undefined>();
  let selected = $state<RangedVerdict | undefined>();
  let running = $state(false);
  let edited = $state(false);

  const all = $derived(payload?.verdicts.flatMap((d) => d.verdicts.map((v) => ({ ...v, decl: d.decl }))) ?? []);
  const summary = $derived({
    ok: all.filter((v) => v.status === 'verified').length,
    bad: all.filter((v) => v.status === 'violated').length,
    other: all.filter((v) => v.status !== 'verified' && v.status !== 'violated').length,
  });

  function onVerdicts(p: VerdictsPayload) {
    payload = p;
    // Keep the selection if the same property is still reported; otherwise show the first violation.
    const flat = p.verdicts.flatMap((d) => d.verdicts);
    selected = flat.find((v) => selected && v.subject === selected.subject && v.status === 'violated') ?? flat.find((v) => v.status === 'violated');
    onverdicts?.(p);
  }

  async function verifyNow() {
    running = true;
    try {
      await editor?.verify();
    } finally {
      running = false;
    }
  }

  function onstep(i: number) {
    const span = selected?.trace?.steps[i]?.span;
    if (span && editor) {
      const text = editor.getValue();
      const before = text.slice(0, span.start).split('\n');
      editor.reveal(before.length - 1, before.at(-1)!.length);
    }
  }
</script>

<figure class="workbench" class:wide>
  {#if title}
    <header class="ui">
      <span class="kicker">Workbench</span>
      <span class="title">{title}</span>
      <a class="open" href="{base}/workbench/?code={encodeURIComponent(code)}" title="Open in the full Workbench">↗</a>
    </header>
  {/if}
  <div class="grid">
    <div class="left">
      <VouchEditor bind:this={editor} value={code} {name} {minLines} {locked} maxHeight="34rem" onverdicts={onVerdicts} onselect={(v) => (selected = v)} onchange={() => (edited = true)} />
      <div class="bar ui">
        <button type="button" class="verify" onclick={verifyNow} disabled={running}>{running ? 'Checking…' : 'Check now'}</button>
        <span class="hint">Checks run by themselves when you pause typing · <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> · F12 definition · F2 rename</span>
        {#if edited}<button type="button" class="reset" onclick={() => { editor?.setValue(code); edited = false; }}>Reset</button>{/if}
      </div>
    </div>
    <div class="right" aria-live="polite">
      {#if !payload}
        <p class="waiting ui">The checks appear here.</p>
      {:else if !all.length}
        <p class="waiting ui">Nothing to check yet: add an invariant, a property, or a function with a contract.</p>
      {:else}
        <p class="summary ui">
          {#if summary.ok}<span class="vchip ok">✓ {summary.ok}</span>{/if}
          {#if summary.bad}<span class="vchip bad">✗ {summary.bad}</span>{/if}
          {#if summary.other}<span class="vchip maybe">? {summary.other}</span>{/if}
        </p>
        <div class="verdicts">
          {#each all as v, i (i)}
            <div class="v" class:sel={selected?.subject === v.subject && selected?.engine === v.engine}>
              <Badge verdict={v} compact={!wide} />
              {#if v.trace}<button type="button" class="show ui" onclick={() => (selected = v)}>Show the counterexample</button>{/if}
            </div>
          {/each}
        </div>
        {#if selected?.trace}
          <TraceView trace={selected.trace} {onstep} caption={`Counterexample: ${selected.subject}`} />
        {/if}
      {/if}
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .workbench {
    margin: 1.8rem 0;
    padding: 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    margin-bottom: 0.6rem;
  }
  .kicker {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
  }
  .title {
    font-weight: 600;
    flex: 1;
  }
  .open {
    text-decoration: none;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 0.8rem;
  }
  .workbench:not(.wide) .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.45rem;
    font-size: 0.78rem;
  }
  .hint {
    color: var(--mute);
    flex: 1;
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 0.25em;
  }
  button {
    font: inherit;
    cursor: pointer;
  }
  .verify {
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .verify:disabled {
    opacity: 0.6;
  }
  .reset {
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
  }
  .right {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .waiting {
    color: var(--mute);
    font-size: 0.88rem;
    margin: 0.4rem 0;
  }
  .summary {
    display: flex;
    gap: 0.4rem;
    margin: 0;
  }
  .verdicts {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .v.sel :global(.badge) {
    box-shadow: 0 0 0 2px var(--gold);
  }
  .show {
    margin: 0.2rem 0 0 0.2rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--pencil);
    font-size: 0.8rem;
    text-decoration: underline;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
