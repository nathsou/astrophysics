<!-- The results of a file's `test` blocks: pass or fail, with the failing `expect`, the values it read and the waveform. -->
<script lang="ts">
  import type { TestOutcome } from '$lib/hdl/editor/analysis';
  import Waveform from './Waveform.svelte';

  let { outcomes, running = false, onreveal }: {
    outcomes: TestOutcome[] | undefined;
    running?: boolean;
    /** Jump to the failing line. */
    onreveal?: (offset: number) => void;
  } = $props();

  const passed = $derived(outcomes?.filter((t) => t.passed).length ?? 0);
</script>

<div class="tests ui" aria-live="polite">
  {#if running}
    <p class="note">Running the tests…</p>
  {:else if !outcomes}
    <p class="note">Press <strong>Run tests</strong> to run the <code>test</code> blocks in this file.</p>
  {:else if outcomes.length === 0}
    <p class="note">This file has no <code>test</code> blocks, or it has errors, so none ran.</p>
  {:else}
    <p class="sum" class:bad={passed < outcomes.length}>{passed} of {outcomes.length} {outcomes.length === 1 ? 'test' : 'tests'} passed</p>
    <ul>
      {#each outcomes as t (t.name)}
        <li class:ok={t.passed} class:skip={t.skipped}>
          <div class="head">
            <span class="badge">{t.passed ? 'pass' : t.skipped ? 'skipped' : 'fail'}</span>
            <span class="tname">{t.name}</span>
            <span class="cyc">{t.cycles} {t.cycles === 1 ? 'cycle' : 'cycles'}</span>
          </div>
          {#each t.failures as f, i (i)}
            <div class="fail">
              <p>
                <button type="button" class="link" onclick={() => onreveal?.(f.from)}>line {f.line}</button>
                {f.message}, at cycle {f.cycle}
              </p>
              {#if f.values.length}
                <p class="vals">{#each f.values as v (v.name)}<span><b>{v.name}</b> = {v.value}</span>{/each}</p>
              {/if}
              {#if f.waveform}
                <div class="wv"><Waveform wave={f.waveform} /></div>
              {/if}
            </div>
          {/each}
          {#if !t.passed}
            <details>
              <summary>As the compiler prints it</summary>
              <pre>{t.text}</pre>
            </details>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tests {
    font-size: 0.86rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }
  .note {
    color: var(--mute);
    margin: 0.4rem 0;
  }
  .sum {
    margin: 0;
    font-weight: 600;
    color: var(--ok);
  }
  .sum.bad {
    color: var(--bad);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    border: 1px solid var(--line);
    border-left: 4px solid var(--bad);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    background: var(--panel);
  }
  li.ok {
    border-left-color: var(--ok);
  }
  li.skip {
    border-left-color: var(--mute);
  }
  .head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .badge {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.05rem 0.4rem;
    border-radius: 3px;
    background: var(--bad-soft);
    color: var(--bad);
  }
  .ok .badge {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .tname {
    font-weight: 500;
  }
  .cyc {
    margin-left: auto;
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .fail {
    margin-top: 0.4rem;
    display: grid;
    gap: 0.3rem;
  }
  .fail p {
    margin: 0;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    font-family: var(--font-mono);
    color: var(--copper-ink);
    text-decoration: underline;
    cursor: pointer;
  }
  .vals {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .wv {
    overflow-x: auto;
    padding: 0.2rem 0;
  }
  details {
    margin-top: 0.4rem;
    font-size: 0.8rem;
  }
  summary {
    cursor: pointer;
    color: var(--mute);
  }
  pre {
    margin: 0.3rem 0 0;
    padding: 0.5rem 0.7rem;
    overflow-x: auto;
    background: var(--pn);
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    line-height: 1.45;
  }
</style>
