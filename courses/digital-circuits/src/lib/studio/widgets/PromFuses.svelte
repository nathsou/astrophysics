<!--
  Blow the fuses of a small PROM to make a decoder:

    ::prom-fuses{example="seven-segment"}

  A virgin 4-input, 7-output PROM (16 words). Every word must read as the target truth table; click a fuse to
  blow it (with its programming pulse): a blown fuse reads 1 and cannot be repaired. The address switches
  select a word and the display shows what the PROM now says.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '../../components/ui/Widget.svelte';
  import Icon from '../../components/ui/Icon.svelte';
  import { Studio } from '../studio.svelte';
  import { promAdapter, type PromFit } from '../adapters/prom';
  import { findExample } from '../examples';
  import PromChip from '../chips/PromChip.svelte';
  import SevenSeg from '../chips/SevenSeg.svelte';
  import { digitMask, segmentMask } from './SegmentDecoder';
  import type { EditAction } from '../types';

  let { example = 'seven-segment', title, caption, n }: { example?: string; title?: string; caption?: string; n?: string | number } = $props();

  const ex = $derived(findExample('prom', example) ?? findExample('prom', 'seven-segment')!);
  const goal = $derived.by(() => {
    const r = promAdapter.program(ex.source);
    if (!r.ok) throw new Error('example does not fit');
    return r.fit as PromFit;
  });
  const studio = new Studio({ device: 'prom', example: untrack(() => ex.id), blank: true });
  // A virgin part of the goal's shape, with the goal's names.
  const shape = $derived(goal.chip);
  $effect(() => {
    const g = goal;
    untrack(() => {
      const blankFit = g.edit!({ type: 'reset' });
      studio.load({ device: 'prom', example: ex.id, fit: blankFit });
    });
  });

  const fit = $derived(studio.fit as PromFit | null);
  const target = $derived(goal.chip.target ?? []);
  const wrong = $derived(fit ? fit.chip.prom.verify(target).map((d) => d.address) : []);
  const total = $derived(target.length);
  const blown = $derived(fit ? fit.chip.prom.fuses.reduce((a, b) => a + b, 0) : 0);
  const address = $derived(Object.keys(studio.inputs).reduce((a, k) => a * 2 + (studio.inputs[k] ?? 0), 0));
  const outs = $derived(shape.outputs.map((o) => studio.run?.signals[o]));
  const want = $derived(shape.outputs.length === 7 ? target[address] ?? 0 : 0);
  const isSeg = $derived(shape.outputs.length === 7 && shape.inputs.length === 4);
  const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fuseId = (a: EditAction) => (a.type === 'blow' ? `${a.word}:${a.column}` : '');
  function show() {
    studio.programAnimated(fuseId, reduced(), goal.programSteps);
  }
  onMount(() => () => studio.destroy());
  const done = $derived(fit !== null && wrong.length === 0 && blown > 0);
</script>

<Widget title={title ?? `Blow the fuses: ${goal.title}`} kind="Program a PROM" {caption} {n} wide>
  <div class="pf ui">
    <div class="top">
      <div class="sw" role="group" aria-label="Address">
        <span class="cap">Address</span>
        {#each shape.inputs as name (name)}
          <button type="button" role="switch" aria-checked={studio.inputs[name] === 1} class:on={studio.inputs[name] === 1} onclick={() => studio.toggleInput(name)}><span>{name}</span><b>{studio.inputs[name] ?? 0}</b></button>
        {/each}
        <span class="addr">= {address}</span>
      </div>
      {#if isSeg}
        <div class="disp" aria-live="polite">
          <SevenSeg segments={segmentMask(outs)} size={44} />
          <span class="cap">the PROM says</span>
        </div>
        <div class="disp">
          <SevenSeg segments={want && address < 16 ? digitMask(address) : 0} size={44} />
          <span class="cap">it should say</span>
        </div>
      {/if}
      <div class="score" class:done role="status">
        <strong>{total - wrong.length} of {total}</strong> words right
        <span class="sub">{blown} fuses blown{done ? ' · programmed!' : ''}</span>
      </div>
      <div class="btns">
        <button type="button" onclick={show} disabled={studio.programming}><Icon name="bolt" size={13} /> Program it for me</button>
        <button type="button" onclick={() => studio.resetDevice()}><Icon name="reset" size={13} /> New part</button>
      </div>
    </div>
    {#if fit}
      <PromChip {fit} probe={studio.probe} hover={studio.hoverProbe} run={studio.run} onselect={(r) => studio.select(r)} onhover={(r) => studio.hover(r)} onedit={(a) => studio.blow(a, fuseId(a))} flash={studio.flash} editable compact title={done ? `Programmed: ${blown} fuses blown` : blown ? `${blown} fuses blown` : 'Virgin PROM: every fuse intact'} />
    {/if}
    <details class="tt">
      <summary>The truth table to program</summary>
      <pre>{ex.source.split('\n').filter((l) => !/^\s*(#|\/\/)/.test(l)).join('\n')}</pre>
    </details>
  </div>
</Widget>

<style>
  .pf {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.7rem;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.2rem;
  }
  .sw {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  .sw button {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    padding: 0.2rem 0.25rem 0.2rem 0.6rem;
    border-radius: 99px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font-family: var(--font-mono);
    cursor: pointer;
  }
  .sw button b {
    display: inline-grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 99px;
    background: var(--surface-3);
    color: var(--sig-low);
    font-weight: 500;
  }
  .sw button.on {
    border-color: var(--sig-high);
  }
  .sw button.on b {
    background: var(--sig-high);
    color: #1b1204;
    box-shadow: 0 0 8px var(--sig-high-glow);
    font-weight: 700;
  }
  .addr {
    font-family: var(--font-mono);
    color: var(--mute);
    font-size: 0.8rem;
  }
  .disp {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
  }
  .score {
    font-size: 0.85rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
  }
  .score strong {
    color: var(--fg);
    font-size: 1rem;
  }
  .score.done strong {
    color: var(--ok);
  }
  .sub {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .btns {
    display: flex;
    gap: 0.4rem;
    margin-left: auto;
  }
  .btns button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .btns button:hover:not(:disabled) {
    border-color: var(--copper);
  }
  .btns button:disabled {
    opacity: 0.5;
  }
  .tt {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .tt summary {
    cursor: pointer;
    color: var(--mute);
  }
  .tt pre {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    margin: 0.4rem 0 0;
    overflow: auto;
  }
</style>
