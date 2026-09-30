<!--
  The product-term allocator of one function block. Set how many product terms each macrocell needs; the course's
  real allocator (src/lib/pld/cpld/allocator.ts) steers the 40 slots. A slot is amber when its own macrocell uses it,
  copper with an arrow when it is lent to a neighbour, and dashed when it is free.

    ::allocator-lab{n="27.3" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { MAX_DEMAND, MCS, SCENARIOS, SLOTS, allocate, describeMc, rearrange } from './allocator-lab';

  let { n, caption, scenario: start = 'wide' }: { n?: string | number; caption?: string; scenario?: string } = $props();

  const first = () => SCENARIOS.find((s) => s.id === untrack(() => start)) ?? SCENARIOS[1]!;
  let id = $state(first().id);
  let demand = $state<number[]>([...first().demand]);
  let note = $state('');

  const scenario = $derived(SCENARIOS.find((s) => s.id === id));
  const res = $derived(allocate(demand));
  const total = $derived(demand.reduce((a, b) => a + b, 0));

  function pick(v: string) {
    const s = SCENARIOS.find((x) => x.id === v)!;
    id = v;
    demand = [...s.demand];
    note = '';
  }
  function bump(mc: number, by: number) {
    demand = demand.map((d, i) => (i === mc ? Math.max(0, Math.min(MAX_DEMAND, d + by)) : d));
    id = '';
    note = '';
  }
  function fitter() {
    const moved = rearrange(demand);
    if (!moved) {
      note = `No arrangement works: ${total} terms do not fit in ${MCS * SLOTS} slots, or an output is too wide for any macrocell.`;
      return;
    }
    const same = moved.every((d, i) => d === demand[i]);
    demand = moved;
    id = '';
    note = same ? 'The fitter would leave the outputs where they are.' : 'The fitter moved the outputs to different macrocells.';
  }
  function reset() {
    pick(first().id);
  }
  const arrow = (from: number, to: number) => (to > from ? '↓' : '↑');
  const label = $derived(res.ok ? `Fits with ${res.borrowed} borrowed terms` : `Does not fit: ${res.message}`);
</script>

<Widget {n} title="Product-term steering" subtitle="One function block: 8 macrocells, 5 term slots each" {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented label="Scenario" size="sm" value={id} onchange={pick} options={SCENARIOS.map((s) => ({ value: s.id, label: s.label, title: s.story }))} />
    <button type="button" class="fitter ui" onclick={fitter} title="Ask the fitter's placement search to move the outputs so that the allocation works, with as little borrowing as possible">Let the fitter place them</button>
  {/snippet}

  <div class="al">
    <p class="story ui">{scenario?.story ?? 'Your own demand. Use the − and + buttons: each macrocell owns five slots, and a slot can go to the macrocell above or below it in the chain.'}</p>

    <ol class="rows" aria-label="Macrocells of the function block">
      {#each Array.from({ length: MCS }, (_, i) => i) as m (m)}
        {@const v = res.ok ? res.mcs[m] : undefined}
        {@const over = demand[m]! > (m === 0 || m === MCS - 1 ? 10 : 15)}
        <li class="row" class:idle={demand[m] === 0} class:bad={!res.ok && res.failing === m}>
          <span class="mc">MC{m}</span>
          <span class="step" role="group" aria-label="Terms needed by macrocell {m}">
            <button type="button" onclick={() => bump(m, -1)} disabled={demand[m] === 0} aria-label="Fewer terms for macrocell {m}">−</button>
            <output class:over aria-label="{demand[m]} terms needed">{demand[m]}</output>
            <button type="button" onclick={() => bump(m, 1)} disabled={demand[m] === MAX_DEMAND} aria-label="More terms for macrocell {m}">+</button>
          </span>
          <span class="slots" role="img" aria-label={v ? describeMc(v) : 'slots'}>
            {#each Array.from({ length: SLOTS }, (_, s) => s) as s (s)}
              {@const sl = v?.slots[s]}
              <span class="slot" class:own={sl?.kind === 'own'} class:lent={sl?.kind === 'lent'} class:off={!sl || sl.kind === 'off'} title={sl?.kind === 'lent' ? `Slot ${s}: steered to MC${sl.to}` : sl?.kind === 'own' ? `Slot ${s}: its own OR gate` : `Slot ${s}: free`}>
                {#if sl?.kind === 'lent'}{arrow(m, sl.to)}{/if}
              </span>
            {/each}
          </span>
          <span class="what ui">
            {#if v}
              {describeMc(v)}
              {#if v.demand > 0}<b class="ns" class:slow={v.borrowed > 0}>{v.tpd.toFixed(1)} ns</b>{/if}
            {:else if !res.ok && res.failing === m}
              <b class="err">needs {res.needed}, can collect {res.available}</b>
            {:else}
              {demand[m] === 0 ? 'idle' : ''}
            {/if}
          </span>
        </li>
      {/each}
    </ol>

    <div class="verdict ui" class:ok={res.ok} class:no={!res.ok} role={res.ok ? 'status' : 'alert'} aria-live="polite">
      {#if res.ok}
        <b>Fits.</b> {total} terms in {MCS * SLOTS} slots; {res.borrowed} borrowed. A macrocell that borrows pays 1.0 ns more (8.5 ns pin to pin instead of 7.5 ns).
      {:else}
        <b>Does not fit.</b> Macrocell {res.failing} {res.message.replace(/^macrocell \d+ of the block /, '')}.
      {/if}
      {#if note}<span class="note">{note}</span>{/if}
    </div>
    <span class="sr" aria-live="polite">{label}</span>
  </div>
</Widget>

<style>
  .al {
    display: grid;
    gap: 0.7rem;
    padding: 0.9rem 1rem 1rem;
  }
  .story {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .fitter {
    padding: 0.28rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .fitter:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 2.6rem auto auto minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    border: 1px solid transparent;
  }
  .row.idle {
    opacity: 0.75;
  }
  .row.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .mc {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .step {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    overflow: hidden;
    background: var(--panel);
  }
  .step button {
    width: 1.7rem;
    height: 1.7rem;
    border: 0;
    background: var(--pn);
    color: var(--fg);
    font: inherit;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .step button:hover:not(:disabled) {
    color: var(--copper-ink);
  }
  .step button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .step output {
    min-width: 1.8rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }
  .step output.over {
    color: var(--bad);
    font-weight: 700;
  }
  .slots {
    display: inline-flex;
    gap: 3px;
  }
  .slot {
    width: 1.55rem;
    height: 1.55rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    display: inline-grid;
    place-items: center;
    font-size: 0.85rem;
    line-height: 1;
    font-weight: 700;
  }
  .slot.own {
    background: var(--sig-high);
    border-color: var(--sig-high);
  }
  .slot.lent {
    background: var(--copper-soft);
    border: 2px solid var(--copper);
    color: var(--copper-ink);
  }
  .slot.off {
    border-style: dashed;
    border-color: var(--line);
    background: transparent;
  }
  .what {
    font-size: 0.8rem;
    color: var(--ink-2);
    min-width: 0;
  }
  .ns {
    margin-left: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--ok);
  }
  .ns.slow {
    color: var(--maybe);
  }
  .err {
    color: var(--bad);
  }
  .verdict {
    font-size: 0.86rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border-left: 3px solid;
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.no {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .note {
    display: block;
    margin-top: 0.25rem;
    color: var(--ink-2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: 2.4rem auto minmax(0, 1fr);
    }
    .what {
      grid-column: 1 / -1;
      padding-left: 0.2rem;
    }
    .slot {
      width: 1.4rem;
      height: 1.4rem;
    }
  }
</style>
