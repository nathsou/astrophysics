<!--
  The JTAG TAP controller:

    ::jtag-tap{}

  "Drive it": the 16-state machine moves on every TCK according to TMS; press TMS 0 or TMS 1 (five ones reach
  Test-Logic-Reset from anywhere). "Watch a programming run": the real sequence that programs a vCPLD-32,
  clock by clock, with TMS, TDI and TDO.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '../../components/ui/Widget.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import TapDiagram from '../chips/TapDiagram.svelte';
  import JtagPanel from '../panes/JtagPanel.svelte';
  import { TAP_STATES, nextTapState, type TapState } from '../../pld/cpld/jtag';
  import { cpldAdapter, type CpldChip } from '../adapters/cpld';
  import { findExample } from '../examples';

  let { title, caption, n, mode: startMode = 'drive' }: { title?: string; caption?: string; n?: number | string; mode?: 'drive' | 'run' } = $props();

  let mode = $state<'drive' | 'run'>(untrack(() => startMode));
  let tap = $state<TapState>('Test-Logic-Reset');
  let last = $state<{ from: TapState; tms: 0 | 1 } | null>(null);
  let trail = $state<TapState[]>(['Test-Logic-Reset']);
  let log = $state<string[]>([]);

  function clock(tms: 0 | 1) {
    const from = tap;
    tap = nextTapState(from, tms);
    last = { from, tms };
    trail = [...trail.slice(-13), tap];
    log = [...log.slice(-19), String(tms)];
  }
  function reset() {
    for (let i = 0; i < 5; i++) clock(1);
  }
  const bits = $derived.by(() => {
    const ex = findExample('cpld32', 'counter')!;
    const r = cpldAdapter.program(ex.source);
    return r.ok ? (r.fit.chip as CpldChip).bits : undefined;
  });
  const hint = $derived(
    tap === 'Shift-DR' || tap === 'Shift-IR'
      ? 'Shifting: the selected register moves one place towards TDO on every TCK while TMS stays 0. TMS = 1 leaves through Exit1.'
      : tap === 'Test-Logic-Reset'
        ? 'The reset state. Five TCKs with TMS = 1 lead here from anywhere. TMS = 0 leaves for Run-Test/Idle.'
        : tap === 'Run-Test/Idle'
          ? 'Waiting; programming pulses are timed here. TMS = 1 starts a scan: first the data register column, then (another 1) the instruction column.'
          : tap === 'Update-DR' || tap === 'Update-IR'
            ? 'The shifted value is latched into the register’s output (the instruction takes effect, the row is programmed).'
            : tap === 'Capture-DR' || tap === 'Capture-IR'
              ? 'The register loads its parallel inputs before shifting starts.'
              : 'Every state has exactly two exits, chosen by TMS.',
  );
</script>

<Widget title={title ?? 'The TAP controller'} kind="JTAG" {caption} {n} wide>
  <div class="jt ui">
    <Segmented size="sm" label="Mode" bind:value={mode} options={[{ value: 'drive', label: 'Drive it' }, { value: 'run', label: 'Watch a programming run' }]} />
    {#if mode === 'drive'}
      <div class="drive">
        <div class="dia"><TapDiagram state={tap} {last} {trail} /></div>
        <div class="side">
          <p class="now">State <strong>{tap}</strong></p>
          <div class="btns" role="group" aria-label="Clock the TAP">
            <button type="button" onclick={() => clock(0)}>TCK with TMS = 0</button>
            <button type="button" onclick={() => clock(1)}>TCK with TMS = 1</button>
            <button type="button" onclick={reset}>Reset (5 × TMS = 1)</button>
          </div>
          <p class="hint" aria-live="polite">{hint}</p>
          <p class="log">TMS so far: <code>{log.join('') || '–'}</code></p>
          <p class="ex">Try to reach <em>Shift-DR</em> from reset (0, 1, 0, 0), and <em>Shift-IR</em> (0, 1, 1, 0, 0). All sixteen states: {TAP_STATES.length}.</p>
        </div>
      </div>
    {:else}
      <JtagPanel bitsOverride={bits} />
    {/if}
  </div>
</Widget>

<style>
  .jt {
    padding: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .drive {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 800px) {
    .drive {
      grid-template-columns: minmax(0, 1.2fr) minmax(14rem, 1fr);
    }
  }
  .now {
    margin: 0 0 0.5rem;
    color: var(--ink-2);
    font-size: 0.85rem;
  }
  .now strong {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .btns button {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .btns button:hover {
    border-color: var(--copper);
  }
  .hint,
  .ex,
  .log {
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  code {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
</style>
