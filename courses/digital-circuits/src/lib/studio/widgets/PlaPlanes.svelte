<!--
  Program a PLA by hand:

    ::pla-planes{example="full-adder"}

  A virgin PLA (every fuse intact, so every product term is x·x̄ = 0). Click crossings in the AND plane to
  choose the literals of each product term, and in the OR plane to choose which outputs add it up. The table
  compares the array with the goal on every input combination. Hover a product term to light it across both
  planes.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '../../components/ui/Widget.svelte';
  import Icon from '../../components/ui/Icon.svelte';
  import { Studio } from '../studio.svelte';
  import { blankPla, plaAdapter, type PlaDeviceFit } from '../adapters/pla';
  import { findExample } from '../examples';
  import PlaChip from '../chips/PlaChip.svelte';
  import type { EditAction } from '../types';

  let { example = 'full-adder', title, caption, n }: { example?: string; title?: string; caption?: string; n?: number | string } = $props();

  const ex = $derived(findExample('pla', example) ?? findExample('pla', 'full-adder')!);
  const goal = $derived.by(() => {
    const r = plaAdapter.program(ex.source);
    if (!r.ok) throw new Error('example does not fit');
    return r.fit as PlaDeviceFit;
  });
  const names = $derived({ inputs: goal.network.inputs, outputs: goal.network.outputs.map((o) => o.name) });
  const studio = new Studio({ device: 'pla', example: untrack(() => ex.id), blank: true });
  $effect(() => {
    const nm = names;
    untrack(() => studio.load({ device: 'pla', example: ex.id, fit: blankPla(nm.inputs, nm.outputs) }));
  });

  const fit = $derived(studio.fit as PlaDeviceFit | null);
  const rows = $derived.by(() => {
    if (!fit) return [];
    const want = goal.runner();
    const have = fit.runner();
    const ins = names.inputs;
    const out: { inputs: number[]; want: (0 | 1)[]; have: (0 | 1)[]; ok: boolean }[] = [];
    for (let m = 0; m < 2 ** ins.length; m++) {
      const v: Record<string, number> = {};
      ins.forEach((name, i) => (v[name] = (m >> (ins.length - 1 - i)) & 1));
      const w = want.evaluate(v);
      const h = have.evaluate(v);
      const wv = names.outputs.map((o) => (w.signals[o] === 1 ? 1 : 0) as 0 | 1);
      const hv = names.outputs.map((o) => (h.signals[o] === 1 ? 1 : 0) as 0 | 1);
      out.push({ inputs: ins.map((_, i) => (m >> (ins.length - 1 - i)) & 1), want: wv, have: hv, ok: wv.every((x, i) => x === hv[i]) });
    }
    return out;
  });
  const right = $derived(rows.filter((r) => r.ok).length);
  const terms = $derived(fit ? fit.chip.info.filter((t) => t.kind !== 'false' && t.outputs.length > 0).length : 0);
  const goalTerms = $derived(goal.chip.info.filter((t) => t.kind !== 'false' && t.outputs.length > 0).length);
  const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fuseId = (a: EditAction) => (a.type === 'toggle' ? (a.plane === 'and' ? `and:${a.term}:${a.input}:${a.literal}` : a.plane === 'or' ? `or:${a.term}:${a.output}` : `pol:${a.output}`) : '');
  const show = () => studio.programAnimated(fuseId, reduced(), goal.programSteps);
  onMount(() => () => studio.destroy());
  const done = $derived(rows.length > 0 && right === rows.length && terms > 0);
</script>

<Widget title={title ?? `Program a PLA: ${goal.title}`} kind="Program a PLA" {caption} {n} wide>
  <div class="pp ui">
    <div class="top">
      <div class="score" class:done role="status"><strong>{right} of {rows.length}</strong> rows right <span class="sub">{terms} product terms in use{done ? ` · the fitter used ${goalTerms}` : ''}</span></div>
      <div class="btns">
        <button type="button" onclick={show} disabled={studio.programming}><Icon name="bolt" size={13} /> Show a solution</button>
        <button type="button" onclick={() => studio.resetDevice()}><Icon name="reset" size={13} /> New part</button>
      </div>
    </div>
    <div class="body">
      {#if fit}
        <div class="chip"><PlaChip {fit} probe={studio.probe} hover={studio.hoverProbe} run={studio.run} onselect={(r) => studio.select(r)} onhover={(r) => studio.hover(r)} onedit={(a) => studio.blow(a, fuseId(a))} flash={studio.flash} editable compact title={done ? 'Programmed PLA' : terms ? 'PLA in progress' : 'Virgin PLA: click crossings'} /></div>
      {/if}
      <div class="tt">
        <table>
          <thead><tr>{#each names.inputs as i (i)}<th>{i}</th>{/each}<th class="sep"></th>{#each names.outputs as o (o)}<th>{o}</th>{/each}<th></th></tr></thead>
          <tbody>
            {#each rows as r, k (k)}
              <tr class:bad={!r.ok}>
                {#each r.inputs as v, i (i)}<td>{v}</td>{/each}
                <td class="sep"></td>
                {#each r.have as v, o (o)}<td class:diff={v !== r.want[o]}>{v}{#if v !== r.want[o]}<small>({r.want[o]})</small>{/if}</td>{/each}
                <td class="mark">{r.ok ? '✓' : '✗'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="hint">Outputs show what the array gives; in brackets, what it should give.</p>
      </div>
    </div>
  </div>
</Widget>

<style>
  .pp {
    padding: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
    align-items: center;
  }
  .score {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .score strong {
    font-size: 1rem;
    color: var(--fg);
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
  .body {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 900px) {
    .body {
      grid-template-columns: minmax(0, 1fr) 15rem;
    }
  }
  .tt table {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    width: 100%;
  }
  th,
  td {
    padding: 0.12rem 0.4rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  th {
    color: var(--mute);
    font-weight: 500;
  }
  .sep {
    width: 0.6rem;
    border-bottom: 0;
  }
  tr.bad {
    background: var(--bad-soft);
  }
  td.diff {
    color: var(--bad);
    font-weight: 700;
  }
  td small {
    color: var(--mute);
    font-weight: 400;
  }
  .mark {
    color: var(--ok);
  }
  tr.bad .mark {
    color: var(--bad);
  }
  .hint {
    font-size: 0.72rem;
    color: var(--mute);
    margin: 0.4rem 0 0;
  }
</style>
