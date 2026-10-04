<!--
  The counterexample viewer: a trace as a table of states (one row per step, one column per variable), values
  that changed marked in red pencil, the lanes of who moved at each step, and the cycle of a lasso marked.
  Step through it with the slider or the arrow keys; `onstep` reports the selected step (programs highlight the
  statement in the editor).
-->
<script lang="ts">
  import type { Trace } from '$lib/fv/engines';

  let { trace, onstep, caption }: { trace: Trace; onstep?: (i: number) => void; caption?: string } = $props();

  let current = $state(0);
  const steps = $derived(trace.steps);
  const names = $derived([...new Set(steps.flatMap((s) => s.state.values.map((v) => v.name)))]);
  const value = (i: number, name: string) => steps[i]?.state.values.find((v) => v.name === name)?.value;
  const changed = (i: number, name: string) => i > 0 && value(i, name) !== value(i - 1, name);
  const actors = $derived([...new Set(steps.map((s) => s.actor).filter((a): a is string => !!a && a !== 'stutter'))]);
  const actorLabel = (a: string) => {
    const s = steps.find((x) => x.actor === a);
    const text = s?.label ?? a;
    return text.includes(':') ? text.split(':')[0]! : text.replace(/\(.*$/, '');
  };
  $effect(() => {
    onstep?.(current);
  });
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') current = Math.min(steps.length - 1, current + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') current = Math.max(0, current - 1);
    else return;
    e.preventDefault();
  }
</script>

<figure class="trace">
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
  {#if actors.length > 1}
    <div class="lanes ui" role="img" aria-label="Who moves at each step">
      {#each actors as a (a)}
        <div class="lane">
          <span class="who">{actorLabel(a)}</span>
          {#each steps as s, i (i)}<span class="cell" class:on={s.actor === a} class:cur={i === current} class:loop={trace.loopsTo !== undefined && i >= trace.loopsTo}></span>{/each}
        </div>
      {/each}
    </div>
  {/if}
  <div class="controls ui">
    <input type="range" min="0" max={steps.length - 1} bind:value={current} aria-label="Step" />
    <span class="pos">step {current} of {steps.length - 1}</span>
  </div>
  <div class="scroll" tabindex="0" role="grid" aria-label="Counterexample trace" onkeydown={key}>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>step</th>
          {#each names as n (n)}<th class="mono">{n}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each steps as s, i (i)}
          {#if trace.loopsTo !== undefined && i === trace.loopsTo}
            <tr class="loop-start"><td colspan={names.length + 2}>↻ the cycle: from here on, the run repeats forever</td></tr>
          {/if}
          <tr class:cur={i === current} onclick={() => (current = i)}>
            <td class="n">{i}</td>
            <td class="label">{s.label ?? 'start'}</td>
            {#each names as n (n)}<td class="mono" class:changed={changed(i, n)}>{value(i, n) ?? ''}</td>{/each}
          </tr>
        {/each}
        {#if trace.loopsTo !== undefined}
          <tr class="loop-end"><td colspan={names.length + 2}>↺ and back to step {trace.loopsTo}, forever</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</figure>

<style>
  .trace {
    margin: 0;
    font-size: 0.84rem;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.4rem;
  }
  .lanes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 0.5rem;
    overflow-x: auto;
  }
  .lane {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .who {
    flex: none;
    width: 6.5rem;
    font-size: 0.75rem;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell {
    flex: none;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 2px;
    background: var(--pn);
  }
  .cell.loop {
    background: color-mix(in srgb, var(--cti) 10%, var(--pn));
  }
  .cell.on {
    background: var(--trace);
  }
  .cell.cur {
    outline: 2px solid var(--fg);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
  }
  .controls input {
    flex: 1;
    accent-color: var(--trace);
  }
  .pos {
    font-size: 0.78rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .scroll {
    overflow: auto;
    max-height: 22rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-ui);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--pn);
    font-size: 0.72rem;
    text-transform: none;
    text-align: left;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--line-strong);
    white-space: nowrap;
  }
  td {
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .n {
    color: var(--mute);
  }
  .label {
    color: var(--ink-2);
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  td.changed {
    color: var(--pencil);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--pencil) 60%, transparent);
    text-underline-offset: 3px;
  }
  tr.cur td {
    background: var(--gold-soft);
  }
  tbody tr {
    cursor: pointer;
  }
  .loop-start td,
  .loop-end td {
    font-style: italic;
    color: var(--cti);
    background: color-mix(in srgb, var(--cti) 7%, transparent);
  }
</style>
