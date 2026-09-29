<!-- The fitter's report: utilisation with meters, tables, and the timing statements. -->
<script lang="ts">
  import type { ReportSection } from '../types';
  let { sections }: { sections: ReportSection[] } = $props();
  /** Rows that only repeat a meter (same label, nothing to add) are left out. */
  const rowsOf = (s: ReportSection) => (s.rows ?? []).filter((r) => !(s.meter?.some((m) => m.label.toLowerCase() === r.label.toLowerCase()) && !r.note));
</script>

<div class="report ui">
  {#each sections as s (s.title)}
    <section>
      <h5>{s.title}</h5>
      {#if s.meter}
        <div class="meters">
          {#each s.meter as m (m.label)}
            <div class="meter" title="{m.label}: {m.used} of {m.of}">
              <span class="name">{m.label}</span>
              <span class="bar" role="meter" aria-label={m.label} aria-valuemin="0" aria-valuemax={m.of} aria-valuenow={m.used}>
                <span class="fill" style:width="{Math.min(100, (100 * m.used) / Math.max(1, m.of))}%" class:full={m.used >= m.of}></span>
              </span>
              <span class="num">{m.used}/{m.of}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#if rowsOf(s).length}
        <dl>
          {#each rowsOf(s) as r, i (i)}
            <div class="r {r.level ?? ''}">
              {#if r.label}<dt>{r.label}</dt>{/if}
              <dd><strong>{r.value}</strong>{#if r.note}<span class="rnote">{r.note}</span>{/if}</dd>
            </div>
          {/each}
        </dl>
      {/if}
      {#if s.table}
        <div class="scroll">
          <table class:mono={s.table.mono}>
            <thead><tr>{#each s.table.head as h, i (i)}<th>{h}</th>{/each}</tr></thead>
            <tbody>
              {#each s.table.rows as row, i (i)}<tr>{#each row as cell, j (j)}<td>{cell}</td>{/each}</tr>{/each}
            </tbody>
          </table>
        </div>
      {/if}
      {#if s.text}<p class="text">{s.text}</p>{/if}
    </section>
  {/each}
</div>

<style>
  .report {
    padding: 0.5rem 0.8rem 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    overflow: auto;
    height: 100%;
    background: var(--panel);
  }
  section {
    margin: 0 0 1rem;
  }
  h5 {
    margin: 0.4rem 0 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--copper-ink);
    font-weight: 600;
  }
  .meters {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }
  .meter {
    display: grid;
    grid-template-columns: 7.5rem 1fr 3.4rem;
    align-items: center;
    gap: 0.5rem;
  }
  .bar {
    height: 0.55rem;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--copper), var(--sig-high));
    border-radius: 99px;
  }
  .fill.full {
    background: var(--maybe);
  }
  .num {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-align: right;
    color: var(--fg);
  }
  dl {
    margin: 0;
  }
  .r {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    gap: 0.5rem;
    padding: 0.18rem 0;
    border-bottom: 1px dotted var(--line);
  }
  dt {
    color: var(--mute);
  }
  dd {
    margin: 0;
    color: var(--fg);
  }
  .rnote {
    display: block;
    color: var(--mute);
    font-size: 0.72rem;
  }
  .r.ok strong {
    color: var(--ok);
  }
  .r.warn strong {
    color: var(--maybe);
  }
  .r.bad strong {
    color: var(--bad);
  }
  .scroll {
    overflow: auto;
    max-height: 22rem;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.74rem;
  }
  table.mono {
    font-family: var(--font-mono);
  }
  th,
  td {
    padding: 0.2rem 0.5rem;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--line);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--pn);
    color: var(--mute);
    font-weight: 600;
  }
  .text {
    margin: 0.3rem 0 0;
    line-height: 1.5;
  }
  @media (max-width: 480px) {
    .r {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .meter {
      grid-template-columns: 6rem 1fr 3rem;
    }
  }
</style>
