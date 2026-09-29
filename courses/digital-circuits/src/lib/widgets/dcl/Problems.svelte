<!-- The compiler's diagnostics for the source, as a list; each jumps to its place in the editor. -->
<script lang="ts">
  import type { Analysis } from '$lib/hdl/editor/analysis';

  let { analysis, pending = false, onreveal }: {
    analysis: Analysis | undefined;
    pending?: boolean;
    onreveal?: (offset: number) => void;
  } = $props();

  const errors = $derived(analysis?.diagnostics.filter((d) => d.severity === 'error').length ?? 0);
  const warnings = $derived(analysis?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0);
</script>

<div class="problems ui" role="status" aria-live="polite">
  {#if !analysis}
    <p class="ok">{pending ? 'Checking…' : 'Not checked yet.'}</p>
  {:else if analysis.diagnostics.length === 0}
    <p class="ok"><span class="dot"></span>No errors or warnings.</p>
  {:else}
    <p class="sum" class:bad={errors > 0}>
      {#if errors}{errors} {errors === 1 ? 'error' : 'errors'}{/if}{#if errors && warnings}, {/if}{#if warnings}{warnings} {warnings === 1 ? 'warning' : 'warnings'}{/if}
    </p>
    <ul>
      {#each analysis.diagnostics as d, i (i)}
        <li class={d.severity}>
          <button type="button" onclick={() => onreveal?.(d.span.start)}>
            <span class="where">{d.span.line}:{d.span.col}</span>
            <span class="msg">
              <strong>{d.message}</strong>{#if d.label && d.label !== d.message}<span class="label">: {d.label}</span>{/if}
              {#each d.notes ?? [] as n (n)}<span class="extra">note: {n}</span>{/each}
              {#each d.help ?? [] as h (h)}<span class="extra help">help: {h}</span>{/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .problems {
    font-size: 0.82rem;
  }
  p {
    margin: 0.3rem 0;
  }
  .ok {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--mute);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 6px var(--phosphor-glow);
  }
  .sum {
    font-weight: 600;
    color: var(--maybe);
  }
  .sum.bad {
    color: var(--bad);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
    max-height: 14rem;
    overflow: auto;
  }
  li {
    border-left: 4px solid var(--mute);
    border-radius: 4px;
    background: var(--panel);
    border-top: 1px solid var(--line);
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  li.error {
    border-left-color: var(--bad);
  }
  li.warning {
    border-left-color: var(--maybe);
  }
  button {
    display: flex;
    width: 100%;
    gap: 0.7rem;
    text-align: left;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
  }
  button:hover {
    background: var(--pn);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .where {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    flex: none;
    padding-top: 0.1rem;
  }
  .msg {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .label {
    color: var(--ink-2);
  }
  .extra {
    color: var(--ink-2);
    font-size: 0.78rem;
  }
  .extra.help {
    color: var(--copper-ink);
  }
</style>
