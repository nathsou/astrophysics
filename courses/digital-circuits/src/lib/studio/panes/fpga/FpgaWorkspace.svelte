<!--
  The FPGA workspace: source (the DCL editor), the chip view with its replays and the virtual board, the logic view,
  the bits and the report, around one selection. It sits inside a `.studio` container, so it lays itself out by its
  own width (panes side by side from 900 px, tabs below), like the workspace of the other devices.

  `views` picks the panes: source, chip, logic, bits, report, replay (the placement and routing tabs of the chip
  view), board (the virtual board under the chip), hand (the by-hand mode for vFPGA-S).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import FpgaChip from '../../chips/vfpga/FpgaChip.svelte';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import FpgaSource from './FpgaSource.svelte';
  import FpgaLogic from './FpgaLogic.svelte';
  import FpgaBits from './FpgaBits.svelte';
  import FpgaReport from './FpgaReport.svelte';
  import ReplayBar from './ReplayBar.svelte';
  import BoardPanel from './BoardPanel.svelte';
  import HandPanel from './HandPanel.svelte';
  import FpgaDetails from './FpgaDetails.svelte';
  import Icon from '../../../components/ui/Icon.svelte';

  let {
    session,
    views = ['source', 'chip', 'logic', 'bits', 'report', 'replay', 'board', 'hand'],
    compact = false,
    autofit = true,
  }: { session: FpgaSession; views?: string[]; compact?: boolean; autofit?: boolean } = $props();

  const want = (v: string) => views.includes(v);
  const hand = $derived(session.mode === 'hand');
  const canHand = $derived(want('hand'));
  let chipView = $state<'design' | 'place' | 'route'>('design');
  let active = $state(untrack(() => (session.mode === 'hand' ? 'hand' : 'chip')));
  let wasHand = untrack(() => hand);
  $effect(() => {
    // Switching mode brings its main pane forward on narrow screens.
    const h = hand;
    if (h !== wasHand) {
      wasHand = h;
      active = h ? 'hand' : 'source';
    }
  });

  const tabs = $derived(
    (hand
      ? [
          canHand && { id: 'hand', label: 'By hand' },
          want('chip') && { id: 'chip', label: 'Chip' },
          want('bits') && { id: 'bits', label: 'Bits' },
        ]
      : [
          want('source') && { id: 'source', label: 'Source' },
          want('chip') && { id: 'chip', label: 'Chip' },
          want('board') && { id: 'board', label: 'Board' },
          want('logic') && { id: 'logic', label: 'Logic' },
          want('bits') && { id: 'bits', label: 'Bits' },
          want('report') && { id: 'report', label: 'Report' },
        ]
    ).filter((t): t is { id: string; label: string } => !!t),
  );
  $effect(() => {
    if (!tabs.some((t) => t.id === active)) active = tabs[0]?.id ?? 'chip';
  });
  $effect(() => {
    if (!want('replay') && chipView !== 'design') chipView = 'design';
    if (chipView !== 'design' && hand) chipView = 'design';
  });

  onMount(() => {
    if (autofit && !hand && !session.result && session.status === 'idle') void session.fit();
  });

  function download() {
    const r = session.result;
    if (!r) return;
    const url = URL.createObjectURL(new Blob([r.bitstream as BlobPart], { type: 'application/octet-stream' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${r.designName || 'design'}.${r.size.toLowerCase()}.bit` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<div class="fw">
  {#if tabs.length > 1}
    <div class="tabs ui" role="tablist" aria-label="Panes">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={active === t.id} class:on={active === t.id} onclick={() => (active = t.id)}>{t.label}</button>
      {/each}
    </div>
  {/if}

  <div class="cols">
    {#if hand ? canHand : want('source') || want('report')}
      <div class="col left" class:solo={hand || !(want('source') && want('report'))}>
        {#if hand}
          <section class="pane" class:active={active === 'hand'} aria-label="By hand">
            <header class="ph ui"><h4>By hand</h4><span>vFPGA-S: set the bits yourself</span></header>
            <div class="pb"><HandPanel {session} {compact} /></div>
          </section>
        {:else}
          {#if want('source')}
            <section class="pane" class:active={active === 'source'} aria-label="Source">
              <header class="ph ui"><h4>Source</h4><span>DCL</span></header>
              <div class="pb"><FpgaSource {session} /></div>
            </section>
          {/if}
          {#if want('report')}
            <section class="pane info" class:active={active === 'report'} aria-label="Report">
              <header class="ph ui"><h4>Report</h4><span>{session.result ? `${session.result.report.timing.fmaxMHz.toFixed(1)} MHz` : ''}</span></header>
              <div class="pb"><FpgaReport {session} /></div>
            </section>
          {/if}
        {/if}
      </div>
    {/if}

    {#if want('chip')}
      <div class="col mid">
        <section class="pane chip" class:active={active === 'chip'} aria-label="Chip view">
          <header class="ph ui">
            {#if want('replay') && !hand}
              <div class="mini" role="tablist" aria-label="Chip, placement or routing">
                <button type="button" role="tab" aria-selected={chipView === 'design'} class:on={chipView === 'design'} onclick={() => (chipView = 'design')}>Chip</button>
                <button type="button" role="tab" aria-selected={chipView === 'place'} class:on={chipView === 'place'} onclick={() => ((chipView = 'place'), session.replay.setMode('place'))}>Placement</button>
                <button type="button" role="tab" aria-selected={chipView === 'route'} class:on={chipView === 'route'} onclick={() => ((chipView = 'route'), session.replay.setMode('route'))}>Routing</button>
              </div>
            {:else}<h4>Chip</h4>{/if}
            <span>{hand ? 'vFPGA-S' : (session.result?.deviceName ?? '')}</span>
            <span class="grow"></span>
            {#if session.result && !hand}
              <button type="button" class="dl" onclick={download} title="Download the bitstream file"><Icon name="download" size={12} /> Bitstream</button>
            {/if}
          </header>
          <div class="pb chipbody">
            <FpgaChip {session} view={chipView} {compact} handEdits={hand} />
          </div>
          {#if chipView !== 'design' && !hand}<ReplayBar {session} kind={chipView} />{/if}
          {#if chipView === 'design' && !hand}<FpgaDetails {session} />{/if}
        </section>
        {#if want('board') && !hand && chipView === 'design'}
          <section class="pane board" class:active={active === 'board'} aria-label="Virtual board">
            <header class="ph ui"><h4>Board</h4><span>runs the decoded bitstream</span></header>
            <div class="pb"><BoardPanel {session} {compact} /></div>
          </section>
        {/if}
      </div>
    {:else if want('board') && !hand}
      <div class="col mid">
        <section class="pane board" class:active={active === 'board'} aria-label="Virtual board">
          <header class="ph ui"><h4>Board</h4></header>
          <div class="pb"><BoardPanel {session} {compact} /></div>
        </section>
      </div>
    {/if}

    {#if want('logic') || want('bits')}
      <div class="col right" class:solo={hand || !(want('logic') && want('bits'))}>
        {#if want('logic') && !hand}
          <section class="pane" class:active={active === 'logic'} aria-label="Logic view">
            <header class="ph ui"><h4>Logic</h4><span>hierarchy and gates</span></header>
            <div class="pb"><FpgaLogic {session} /></div>
          </section>
        {/if}
        {#if want('bits')}
          <section class="pane" class:active={active === 'bits'} aria-label="Bits view">
            <header class="ph ui"><h4>Bits</h4><span>configuration frames</span></header>
            <div class="pb"><FpgaBits {session} /></div>
          </section>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .fw {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  .grow {
    flex: 1;
  }
  .dl {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
  }
  .dl:hover {
    border-color: var(--copper);
  }
  .chipbody {
    display: flex;
    flex-direction: column;
  }
  :global(.studio .col.left .pane:first-child:not(:last-child)) {
    flex: 1.7 1 0;
  }
  :global(.studio .col.left .pane.info) {
    flex: 1 1 0;
  }
  :global(.studio .pane.board) {
    flex: 0 0 auto;
    max-height: 55%;
    overflow: auto;
  }
  :global(.studio .pane.board .pb) {
    flex: none;
  }

  @container studio (max-width: 899px) {
    :global(.studio .pane.board.active) {
      flex: 1 1 0;
      max-height: none;
    }
  }
  @container studio (max-width: 1149px) {
    :global(.studio.compact .pane.board.active) {
      flex: 1 1 0;
      max-height: none;
    }
  }
</style>
