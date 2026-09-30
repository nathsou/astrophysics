<!--
  The Device Studio workspace: source, chip, logic, bits and report panes around one shared selection.
  Wide (a container of 900px or more): the panes sit side by side; narrower: one pane at a time behind
  tabs. Used full-screen by /studio/ and, with `compact` and a `views` list, inside chapters.
-->
<script lang="ts">
  import './studio.css';
  import { untrack } from 'svelte';
  import { FPGA_DEVICE, type Studio } from './studio.svelte';
  import { listAdapters } from './adapters';
  import { getChip } from './registry';
  import './devices';
  import SourcePane from './panes/SourcePane.svelte';
  import ReportPane from './panes/ReportPane.svelte';
  import BitsPane from './panes/BitsPane.svelte';
  import LogicPane from './panes/LogicPane.svelte';
  import RunBar from './panes/RunBar.svelte';
  import Segmented from '../components/ui/Segmented.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import type { Ref } from './types';

  type ViewName = 'source' | 'chip' | 'logic' | 'bits' | 'report' | 'jtag';

  let {
    studio,
    views = ['source', 'chip', 'logic', 'bits', 'report'],
    compact = false,
    picker = true,
    byHand = true,
    openHref,
    onopen,
  }: {
    studio: Studio;
    views?: string[];
    compact?: boolean;
    /** Show the device picker. */
    picker?: boolean;
    /** Offer the by-hand mode on devices that support it. */
    byHand?: boolean;
    /** A link to the same design in the full Studio (for chapter widgets). */
    openHref?: string;
    onopen?: (ev: MouseEvent) => void;
  } = $props();

  const want = (v: ViewName) => views.includes(v);
  const fit = $derived(studio.fit);
  const Chip = $derived(getChip(studio.deviceId));
  const isCpld = $derived(fit?.chip !== undefined && (fit.chip as { kind?: string }).kind === 'cpld');
  const showJtag = $derived(isCpld && (want('jtag') || want('chip')));
  const showInfo = $derived(want('report'));
  let chipTab = $state<'chip' | 'jtag'>('chip');
  $effect(() => {
    if (chipTab === 'jtag' && !showJtag) chipTab = 'chip';
  });

  const tabs = $derived(
    [
      want('source') && { id: 'source', label: 'Source' },
      want('chip') && { id: 'chip', label: 'Chip' },
      want('logic') && { id: 'logic', label: 'Logic' },
      want('bits') && { id: 'bits', label: 'Bits' },
      showInfo && { id: 'info', label: 'Report' },
    ].filter((t): t is { id: string; label: string } => !!t),
  );
  let active = $state('chip');
  $effect(() => {
    if (!tabs.some((t) => t.id === active)) active = tabs[0]?.id ?? 'chip';
  });

  const adapters = listAdapters();
  const deviceOptions = [...adapters.map((a) => ({ value: a.id, label: a.short })), { value: FPGA_DEVICE, label: 'FPGA', title: 'The virtual FPGA: vFPGA-S, -M and -L' }];
  let deviceChoice = $state(untrack(() => studio.deviceId));
  $effect(() => {
    deviceChoice = studio.deviceId;
  });
  const isFpga = $derived(studio.deviceId === FPGA_DEVICE);
  const files = $derived(isFpga ? [] : (fit?.files ?? []));
  function pickDevice(v: string) {
    studio.load({ device: v });
  }

  // By hand: a virgin device you program yourself.
  const mode = $derived(studio.handEdited ? 'hand' : 'source');
  const canHand = $derived(byHand && !!studio.adapter?.blank);
  function setMode(m: 'source' | 'hand') {
    if (m === 'hand') studio.load({ device: studio.deviceId, blank: true });
    else studio.load({ device: studio.deviceId, example: studio.exampleId ?? undefined });
  }
  const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fuseId = (a: import('./types').EditAction): string => {
    if (a.type === 'blow') return `${a.word}:${a.column}`;
    if (a.type === 'toggle') return a.plane === 'and' ? `and:${a.term}:${a.input}:${a.literal}` : a.plane === 'or' ? `or:${a.term}:${a.output}` : `pol:${a.output}`;
    return '';
  };
  const canProgram = $derived(!!fit?.programSteps && !!fit.edit && !!studio.source.trim());
  function program() {
    // Programming replays the source's fuse pattern on a virgin device.
    if (mode === 'hand' && !studio.source.trim()) return;
    studio.programAnimated(fuseId, reducedMotion());
  }

  function download(f: { name: string; mime: string; text: string }) {
    const url = URL.createObjectURL(new Blob([f.text], { type: f.mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: f.name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const select = (r: Ref | null) => studio.select(r);
  const hover = (r: Ref | null) => studio.hover(r);
</script>

<div class="studio" class:compact>
  <div class="toolbar ui">
    {#if picker}
      <Segmented size="sm" label="Device" options={deviceOptions} bind:value={deviceChoice} onchange={pickDevice} />
    {:else}
      <span class="dev">{isFpga ? 'vFPGA' : studio.adapter?.name}</span>
    {/if}
    {#if canHand && !isFpga}
      <Segmented
        size="sm"
        label="Programming mode"
        value={mode}
        options={[
          { value: 'source', label: 'From source', title: 'Fit the source text to the device' },
          { value: 'hand', label: 'By hand', title: 'Start with a virgin device and set fuses yourself' },
        ]}
        onchange={setMode}
      />
    {/if}
    {#if canProgram && studio.source.trim() && !isFpga}
      <button type="button" class="tb" onclick={program} disabled={studio.programming} title="Blow the fuses of the source's design, one pulse at a time"><Icon name="bolt" size={13} /> Program</button>
    {/if}
    {#if studio.handEdited && studio.editable}
      <button type="button" class="tb" onclick={() => studio.resetDevice()}><Icon name="reset" size={13} /> New part</button>
    {/if}
    <span class="grow"></span>
    {#if fit && !isFpga}<span class="summary" title={fit.title}>{fit.summary}</span>{/if}
    {#each files as f (f.name)}
      <button type="button" class="tb" onclick={() => download(f)} title="Download {f.name}"><Icon name="download" size={13} /> {f.label}</button>
    {/each}
    {#if openHref}
      <a class="tb open" href={openHref} onclick={onopen}><Icon name="studio" size={13} /> Open in the Studio</a>
    {/if}
  </div>

  {#if isFpga}
    {#await import('./panes/fpga/FpgaHost.svelte') then m}
      <m.default {studio} {views} {compact} />
    {/await}
  {:else}
  {#if tabs.length > 1}
    <div class="tabs ui" role="tablist" aria-label="Panes">
      {#each tabs as t (t.id)}
        <button type="button" role="tab" aria-selected={active === t.id} class:on={active === t.id} onclick={() => (active = t.id)}>{t.label}</button>
      {/each}
    </div>
  {/if}

  <div class="cols">
    {#if want('source') || showInfo}
      <div class="col left" class:solo={!(want('source') && showInfo)}>
        {#if want('source')}
          <section class="pane" class:active={active === 'source'} aria-label="Source">
            <header class="ph ui"><h4>Source</h4><span>{studio.adapter?.language}</span></header>
            <div class="pb"><SourcePane {studio} /></div>
          </section>
        {/if}
        {#if showInfo}
          <section class="pane info" class:active={active === 'info'} aria-label="Report">
            <header class="ph ui"><h4>Report</h4></header>
            <div class="pb">{#if fit}<ReportPane sections={fit.report} />{/if}</div>
          </section>
        {/if}
      </div>
    {/if}
    {#if want('chip')}
      <div class="col mid">
        <section class="pane chip" class:active={active === 'chip'} aria-label="Chip view">
          <header class="ph ui">
            {#if showJtag}
              <div class="mini" role="tablist" aria-label="Chip or JTAG">
                <button type="button" role="tab" aria-selected={chipTab === 'chip'} class:on={chipTab === 'chip'} onclick={() => (chipTab = 'chip')}>Chip</button>
                <button type="button" role="tab" aria-selected={chipTab === 'jtag'} class:on={chipTab === 'jtag'} onclick={() => (chipTab = 'jtag')}>JTAG</button>
              </div>
            {:else}<h4>Chip</h4>{/if}
            <span>{fit?.title ?? ''}</span>
          </header>
          {#if chipTab === 'chip'}<RunBar {studio} {compact} />{/if}
          <div class="pb">
            {#if chipTab === 'jtag' && showJtag}
              {#await import('./panes/JtagPanel.svelte') then m}
                <m.default {studio} />
              {/await}
            {:else if fit && Chip}
              <Chip {fit} probe={studio.probe} hover={studio.hoverProbe} run={studio.run} onselect={select} onhover={hover} onedit={(a: import('./types').EditAction) => studio.blow(a, fuseId(a))} flash={studio.flash} editable={mode === 'hand' && studio.editable} {compact} />
            {:else}
              <p class="empty ui">{studio.errors.length ? 'Fix the errors in the source to see the chip.' : 'Nothing fitted yet.'}</p>
            {/if}
          </div>
        </section>
      </div>
    {/if}
    {#if want('logic') || want('bits')}
      <div class="col right" class:solo={!(want('logic') && want('bits'))}>
        {#if want('logic')}
          <section class="pane" class:active={active === 'logic'} aria-label="Logic view">
            <header class="ph ui"><h4>Logic</h4><span>two-level network</span></header>
            <div class="pb"><LogicPane {studio} /></div>
          </section>
        {/if}
        {#if want('bits')}
          <section class="pane" class:active={active === 'bits'} aria-label="Bits view">
            <header class="ph ui"><h4>Bits</h4><span>{fit?.bits.title ?? ''}</span></header>
            <div class="pb"><BitsPane {studio} /></div>
          </section>
        {/if}
      </div>
    {/if}
  </div>
  {/if}
</div>
