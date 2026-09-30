<!--
  Appendix F's table of every diagnostic the DCL front end can emit:

    ::diagnostics-table{n="F.4"}

  One row per code, grouped by the stage of the compiler that reports it. Opening a row shows the messages of
  that code (extracted from the compiler's source), a small design that provokes one, what the compiler says
  about that design (the real diagnostic, produced when the page is built) and the usual fix. The search box
  filters by code, message or meaning.
-->
<script module lang="ts">
  import { check, renderDiagnostics, renderTestResult, runTests } from '$lib/hdl';
  import { highlightDclHtml } from '$lib/hdl/editor/highlightHtml';
  import { DIAGNOSTICS, STAGES, type DiagnosticDoc, type Stage } from './diagnostics';
  import { EMITTED } from './diagnostics.gen';

  interface Row extends DiagnosticDoc {
    severity: 'error' | 'warning';
    messages: string[];
    html: string;
    output: string;
    text: string;
  }

  /** What the compiler says about an example, as the text of its diagnostics. */
  function said(d: DiagnosticDoc): string {
    const file = 'example.dcl';
    if (d.test) {
      const r = runTests(d.example, { file });
      return r.results
        .filter((t) => !t.passed)
        .map((t) => renderTestResult(r.source, t))
        .join('\n\n');
    }
    const { diagnostics } = check(d.example, { file });
    const mine = diagnostics.filter((x) => x.code === d.code);
    return renderDiagnostics(d.example, mine.length ? mine : diagnostics);
  }

  const rows: Row[] = DIAGNOSTICS.map((d) => {
    const e = EMITTED.find((x) => x.code === d.code);
    const messages = e?.messages ?? d.messages ?? [];
    const output = said(d);
    return {
      ...d,
      severity: e?.severity ?? 'error',
      messages,
      html: highlightDclHtml(d.example),
      output,
      text: `${d.code} ${d.meaning} ${messages.join(' ')}`.toLowerCase(),
    };
  });

  const firstSentence = (s: string): string => {
    const m = /^.*?\.(\s|$)/.exec(s);
    return (m ? m[0] : s).trim();
  };
</script>

<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import '../../a-reference/widgets/appendix.css';

  let { n }: { n?: string | number } = $props();

  let query = $state('');
  let stage = $state<'all' | Stage>('all');
  const uid = $props.id();

  const shown = $derived(
    rows.filter((r) => (stage === 'all' || r.stage === stage) && (query.trim() === '' || r.text.includes(query.trim().toLowerCase()))),
  );
  const groups = $derived(STAGES.map((s) => ({ stage: s, rows: shown.filter((r) => r.stage === s) })).filter((g) => g.rows.length));
</script>

<Widget title="Diagnostics" {n} kind="Reference" live={false} caption="Every code the front end can report, {rows.length} in all. Open a row to see the messages, a design that provokes one, and what the compiler says about it.">
  {#snippet controls()}
    <div class="bar">
      <label class="ap-label" for="{uid}-q">
        Search
        <input id="{uid}-q" class="ap-input" type="search" placeholder="code, message or word" bind:value={query} autocomplete="off" spellcheck="false" />
      </label>
      <label class="ap-label" for="{uid}-s">
        Stage
        <select id="{uid}-s" class="ap-input" bind:value={stage}>
          <option value="all">All stages</option>
          {#each STAGES as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </label>
      <p class="count" aria-live="polite">{shown.length} of {rows.length} codes</p>
    </div>
  {/snippet}

  <div class="table">
    {#each groups as g (g.stage)}
      <section aria-labelledby="{uid}-{g.stage}">
        <h5 id="{uid}-{g.stage}">{g.stage}</h5>
        {#each g.rows as r (r.code)}
          <details class="row" open={query.trim() !== '' && shown.length <= 3}>
            <summary>
              <code class="code">{r.code}</code>
              <span class="sev {r.severity}">{r.severity}</span>
              <span class="what">{firstSentence(r.meaning)}</span>
            </summary>
            <div class="body">
              <p>{r.meaning}</p>
              <h6>Messages</h6>
              <ul class="msgs">
                {#each r.messages as m (m)}<li><code>{m}</code></li>{/each}
              </ul>
              <h6>An example</h6>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              <div class="code-block">{@html r.html}</div>
              <h6>What the compiler says</h6>
              <pre class="said" tabindex="0" role="region" aria-label="Compiler output"><code>{r.output}</code></pre>
              <h6>The usual fix</h6>
              <p>{r.fix}</p>
            </div>
          </details>
        {/each}
      </section>
    {/each}
    {#if !groups.length}<p class="none">No code matches “{query}”.</p>{/if}
  </div>
</Widget>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem 1rem;
  }
  .bar label {
    flex: 1 1 12rem;
  }
  .count {
    margin: 0;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--mute);
    align-self: center;
  }
  .table {
    padding: 0.5rem 0.9rem 0.9rem;
    display: grid;
    gap: 0.9rem;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  h6 {
    margin: 0.8rem 0 0.25rem;
    font-family: var(--font-ui);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .row {
    border-top: 1px solid var(--line);
  }
  .row:last-child {
    border-bottom: 1px solid var(--line);
  }
  summary {
    display: grid;
    grid-template-columns: minmax(9.5rem, max-content) max-content 1fr;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.5rem 0.2rem;
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  summary:hover {
    background: var(--copper-soft);
  }
  summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  @media (max-width: 40rem) {
    summary {
      grid-template-columns: 1fr max-content;
    }
    .what {
      grid-column: 1 / -1;
    }
  }
  .code {
    font-family: var(--font-mono);
    font-size: 0.84rem;
    color: var(--fg);
    font-weight: 600;
  }
  .sev {
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    color: var(--mute);
  }
  .sev.warning {
    color: var(--maybe);
    border-color: var(--maybe);
    background: var(--maybe-soft);
  }
  .body {
    padding: 0.2rem 0.4rem 0.9rem 0.9rem;
    font-family: var(--font-ui);
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .body p {
    margin: 0.2rem 0;
  }
  .msgs {
    margin: 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.15rem;
  }
  .msgs code {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
  .code-block :global(pre) {
    margin: 0;
    font-size: 0.8rem;
    overflow-x: auto;
  }
  .said {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.45;
    overflow-x: auto;
    color: var(--fg);
  }
  .none {
    color: var(--mute);
    font-family: var(--font-ui);
    font-size: 0.9rem;
  }
</style>
