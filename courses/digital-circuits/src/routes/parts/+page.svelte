<!--
  The parts bin: every part the course adds, with its symbol, whether you have your own version, its schematic
  (the reference or yours), its specification and a live "Test it". "Use my parts" switches every chapter circuit
  between your versions and the references.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { base } from '$app/paths';
  import { replaceState } from '$app/navigation';
  import Schematic from '$lib/bench/Schematic.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Glyph from '$lib/bench/editor/Glyph.svelte';
  import { nav } from '$lib/state/nav.svelte';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import { PARTS, referenceOf } from '$lib/partsbin/parts';
  import { symbolCircuit } from '$lib/partsbin/symbol';
  import { checkPart, type PartResult } from '$lib/partsbin/verify';
  import { partsBin } from '$lib/partsbin/store.svelte';
  import { partsResolver } from '$lib/partsbin/store-core';
  import { tableFor } from '$lib/components/exercise/circuit/spec';
  import type { PartGroup, PartSpec } from '$lib/partsbin/types';
  import type { Circuit } from '$lib/sim/netlist/types';

  const GROUPS: PartGroup[] = ['Transistors and gates', 'Building blocks', 'Arithmetic', 'Memory and time', 'The computer', 'Talking to the world'];
  const chapterHref = (n: number) => ALL_ENTRIES.find((e) => e.kind === 'chapter' && e.number === String(n));

  let openId = $state<string | null>(null);
  let dialog: HTMLDialogElement | undefined = $state();
  let tab = $state<'reference' | 'yours'>('reference');
  let testing = $state(false);
  let result = $state.raw<PartResult | null>(null);
  let importNote = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const open = $derived(openId ? PARTS.find((p) => p.id === openId) : undefined);
  const counts = $derived({ mine: PARTS.filter((p) => partsBin.has(p.id)).length, real: PARTS.filter((p) => p.status === 'reference').length, total: PARTS.length });
  const parts = $derived(partsBin.resolver());
  const shown = $derived.by<Circuit | undefined>(() => {
    if (!open) return undefined;
    if (tab === 'yours' && partsBin.mine[open.id]) return partsBin.mine[open.id]!.circuit;
    return referenceOf(open.id);
  });
  const table = $derived(open ? tableFor({ id: open.id, part: open.id }, partsResolver(false)) : undefined);
  const symbols = new Map<string, Circuit>();
  const symbolOf = (p: PartSpec) => {
    let c = symbols.get(p.id);
    if (!c) symbols.set(p.id, (c = symbolCircuit(p)));
    return c;
  };

  async function show(id: string) {
    openId = id;
    result = null;
    tab = partsBin.has(id) ? 'yours' : 'reference';
    replaceState(`${location.pathname}#${id}`, {});
    await tick();
    dialog?.showModal();
  }
  function closed() {
    openId = null;
    if (location.hash) replaceState(location.pathname + location.search, {});
  }
  async function test() {
    if (!open) return;
    testing = true;
    result = null;
    await new Promise((r) => setTimeout(r, 30));
    const c = shown;
    try {
      result = checkPart(open, c, tab === 'yours' ? partsBin.resolver(true) : partsResolver(false));
    } catch (e) {
      result = { pass: false, problems: [e instanceof Error ? e.message : String(e)] };
    }
    testing = false;
  }

  function download() {
    const blob = new Blob([partsBin.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'parts-bin.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function upload(ev: Event) {
    const file = (ev.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const r = partsBin.importJson(await file.text());
      importNote = `Imported ${r.imported.length} part${r.imported.length === 1 ? '' : 's'}${r.skipped.length ? `; skipped ${r.skipped.map((s) => `${s.id} (${s.reason})`).join(', ')}` : ''}.`;
    } catch (e) {
      importNote = e instanceof Error ? e.message : String(e);
    }
    if (fileInput) fileInput.value = '';
  }

  onMount(() => {
    nav.pageTitle = 'Parts bin';
    partsBin.load();
    const id = location.hash.slice(1);
    if (id && PARTS.some((p) => p.id === id)) void show(id);
  });
  const pinText = (p: PartSpec) => `${p.pins.filter((x) => x.dir === 'in').length} in, ${p.pins.filter((x) => x.dir === 'out').length} out`;
</script>

<svelte:head><title>Parts bin · Digital Circuits</title></svelte:head>

<article class="bin">
  <header>
    <p class="kicker ui">Through-line</p>
    <h1>The parts bin</h1>
    <p class="lede">Every part you build in an exercise that passes its checker goes here as a black box with fixed pins. Later chapters build from the bin: by Part V the whole CPU is made of your own parts. Every part also has a reference implementation, so skipping an exercise never blocks a later chapter.</p>
    <div class="bar ui">
      <Toggle label="Use my parts" checked={partsBin.useMine} onchange={(v) => (partsBin.useMine = v)} />
      <span class="count num">{counts.mine} of {counts.real} parts are yours</span>
      <span class="grow"></span>
      <button type="button" onclick={download} disabled={!counts.mine}><Glyph name="download" size={15} /> Export</button>
      <button type="button" onclick={() => fileInput?.click()}><Glyph name="upload" size={15} /> Import</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={upload} hidden aria-label="Import a parts bin file" />
    </div>
    <p class="note ui" role="status">{importNote}</p>
    <p class="hint ui">
      {#if partsBin.useMine}Circuits in the chapters use your version of a part when you have one, and the reference otherwise.{:else}Circuits in the chapters use the reference parts, whatever you have built.{/if}
    </p>
  </header>

  {#each GROUPS as g (g)}
    {@const list = PARTS.filter((p) => p.group === g)}
    {#if list.length}
      <section aria-labelledby="g-{g.replace(/\W+/g, '-')}">
        <h2 id="g-{g.replace(/\W+/g, '-')}" class="ui">{g}</h2>
        <ul class="grid">
          {#each list as p (p.id)}
            {@const mine = partsBin.has(p.id)}
            {@const ch = chapterHref(p.chapter)}
            <li>
              <button type="button" class="card" class:planned={p.status === 'planned'} class:mine onclick={() => show(p.id)} id={p.id} aria-label="{p.name}: {p.status === 'planned' ? 'planned' : mine ? 'yours' : 'reference'}">
                <span class="sym" aria-hidden="true"><Schematic circuit={symbolOf(p)} scale={0.9} interactive={false} live={false} /></span>
                <span class="name">{p.name}</span>
                <span class="meta ui">
                  <span class="chip" class:yours={mine} class:plan={p.status === 'planned'}>{p.status === 'planned' ? 'planned' : mine ? 'yours' : 'reference'}</span>
                  <span>Ch. {p.chapter}</span>
                  <span>{pinText(p)}</span>
                </span>
              </button>
              {#if ch?.available}<a class="chap ui" href="{base}{ch.href}">Chapter {p.chapter}</a>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</article>

<dialog bind:this={dialog} onclose={closed} class="detail" aria-labelledby="dlg-title">
  {#if open}
    <form method="dialog" class="x ui"><button aria-label="Close"><Glyph name="close" size={18} /></button></form>
    <h2 id="dlg-title">{open.name}</h2>
    <p class="ui sub">Chapter {open.chapter} · {open.pins.filter((p) => p.dir === 'in').map((p) => p.name).join(' ')} → {open.pins.filter((p) => p.dir === 'out').map((p) => p.name).join(' ')}</p>
    <p>{open.description}</p>
    {#if open.status === 'planned'}
      <p class="ui plan-note">This part is planned: it appears here now so you can see where the course is going, and gets its reference implementation and checker with its chapter.</p>
    {:else}
      <div class="tabs ui" role="tablist" aria-label="Which version to show">
        <button role="tab" aria-selected={tab === 'reference'} class:on={tab === 'reference'} onclick={() => ((tab = 'reference'), (result = null))}>Reference</button>
        <button role="tab" aria-selected={tab === 'yours'} class:on={tab === 'yours'} disabled={!partsBin.has(open.id)} onclick={() => ((tab = 'yours'), (result = null))}>Yours{partsBin.has(open.id) ? '' : ' (not built yet)'}</button>
      </div>
      {#if shown}
        <div class="schem"><Schematic circuit={shown} {parts} scale={1} interactive={false} live={false} label="{open.name} schematic" /></div>
        {#if open.engine && open.engine !== 'digital'}<p class="ui small">This reference is drawn with transistors ({open.engine === 'switch' ? 'switch-level engine' : 'analogue engine'}). Inside gate-level circuits it stands in as a single gate.</p>{/if}
      {/if}
      {#if table}
        <table class="tt num" aria-label="Truth table">
          <thead><tr>{#each table.inputs as n (n)}<th>{n}</th>{/each}<th class="gap"></th>{#each table.outputs as n (n)}<th>{n}</th>{/each}</tr></thead>
          <tbody>
            {#each table.rows as r, i (i)}
              <tr>{#each r.inputs as v, k (k)}<td>{v}</td>{/each}<td class="gap"></td>{#each r.outputs as v, k (k)}<td>{v ?? '–'}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="ui small">Specification: {open.check?.kind === 'seq' ? 'a clocked machine, checked cycle by cycle against a model of the part' : 'too many inputs to list; every combination (or a seeded sample of thousands) is checked'}.</p>
      {/if}
      <div class="test ui">
        <button type="button" class="go" onclick={test} disabled={testing}>{testing ? 'Testing…' : 'Test it'}</button>
        {#if partsBin.has(open.id)}
          {@const m = partsBin.mine[open.id]!}
          <span class="small">Yours: {m.gates ?? '?'} gates, about {m.transistors ?? '?'} transistors.</span>
          <button type="button" onclick={() => (partsBin.remove(open!.id), (tab = 'reference'), (result = null))}>Remove mine</button>
        {/if}
      </div>
      <div class="res ui" role="status" aria-live="polite">
        {#if result}
          <p class:ok={result.pass} class:bad={!result.pass}>
            <strong>{result.pass ? '✓ Passes its checker.' : '✗ Fails its checker.'}</strong>
            {#if result.comb}{result.comb.checked} {result.comb.sampled ? 'sampled ' : ''}input combinations{:else if result.seq}{result.seq.cycles} clock cycles{result.seq.proven ? ', every input sequence' : ''}{/if}
            {#if result.cost}· {result.cost.gates} gates, about {result.cost.transistors} transistors, depth {result.cost.depth}{/if}
          </p>
          {#each result.problems as p (p)}<p class="prob">{p}</p>{/each}
          {#if result.comb?.failures[0]}
            {@const f = result.comb.failures[0]}
            <p class="prob">With {Object.entries(f.inputs).map(([k, v]) => `${k}=${v}`).join(' ')}: {f.wrong.map((n) => `${n} should be ${f.expected[n]}, got ${f.got[n]}`).join('; ')}.</p>
          {/if}
          {#if result.seq?.counterexample}
            {@const c = result.seq.counterexample}
            <p class="prob">Diverges at cycle {c.cycle + 1} ({c.phase}): {c.wrong.map((n) => `${n} should be ${c.expected[n]}, got ${c.got[n]}`).join('; ')}.</p>
          {/if}
        {/if}
      </div>
    {/if}
  {/if}
</dialog>

<style>
  .bin {
    max-width: 62rem;
    margin: 0 auto;
    padding: 1.5rem 16px 3rem;
  }
  .kicker {
    margin: 0;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.7rem;
    color: var(--accent);
  }
  h1 {
    margin: 0.1rem 0 0.4rem;
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 4vw, 2.3rem);
    letter-spacing: -0.02em;
  }
  .lede {
    max-width: 44rem;
    color: var(--ink-2);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .grow {
    flex: 1;
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  .bar button,
  .go,
  .test button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.8rem;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink);
    min-height: 2.2rem;
    cursor: pointer;
  }
  .bar button:hover:not(:disabled),
  .test button:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .bar button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .note,
  .hint {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  h2 {
    margin: 2rem 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--ink-3);
  }
  .grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
    gap: 0.7rem;
  }
  .grid li {
    position: relative;
    margin: 0;
  }
  .card {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 5.2rem auto auto;
    gap: 0.35rem;
    justify-items: center;
    text-align: center;
    padding: 0.7rem 0.6rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .card:hover {
    border-color: var(--copper);
  }
  .card.mine {
    box-shadow: inset 3px 0 0 var(--ok), var(--shadow);
  }
  .card.planned {
    background: var(--surface-2);
    border-style: dashed;
    color: var(--ink-2);
  }
  .sym {
    display: grid;
    place-items: center;
    width: 100%;
    overflow: hidden;
  }
  .sym :global(svg) {
    max-height: 5rem;
  }
  .name {
    font-weight: 700;
    font-size: 0.9rem;
    line-height: 1.2;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.2rem 0.5rem;
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .chip {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--ink-2);
  }
  .chip.yours {
    color: var(--ok);
  }
  .chip.plan {
    color: var(--mute);
  }
  .chap {
    position: absolute;
    right: 0.4rem;
    top: 0.3rem;
    font-size: 0.66rem;
    color: var(--accent);
  }
  .detail {
    width: min(56rem, calc(100% - 24px));
    max-height: calc(100% - 24px);
    padding: 1rem 1.2rem 1.2rem;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink);
    box-shadow: var(--shadow-lg);
  }
  .detail::backdrop {
    background: color-mix(in srgb, #000 45%, transparent);
  }
  .detail h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.4rem;
    letter-spacing: -0.01em;
    text-transform: none;
    color: var(--ink);
  }
  .x {
    position: absolute;
    right: 0.6rem;
    top: 0.6rem;
    margin: 0;
  }
  .x button {
    border: 0;
    background: none;
    color: var(--ink-2);
    cursor: pointer;
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    place-items: center;
    border-radius: 6px;
  }
  .x button:hover {
    background: var(--pn);
  }
  .sub {
    margin: 0.1rem 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-3);
  }
  .tabs {
    display: flex;
    gap: 0.3rem;
    margin: 0.6rem 0;
  }
  .tabs button {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 999px;
    padding: 0.25rem 0.9rem;
    font: inherit;
    font-size: 0.82rem;
    color: var(--ink-2);
    cursor: pointer;
  }
  .tabs button.on {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    font-weight: 700;
  }
  .tabs button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .schem {
    overflow: auto;
    max-height: 26rem;
    padding: 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  .plan-note {
    padding: 0.5rem 0.8rem;
    border-left: 3px solid var(--mute);
    background: var(--surface-2);
    font-size: 0.85rem;
  }
  .tt {
    border-collapse: collapse;
    font-size: 0.8rem;
    margin: 0.6rem 0;
  }
  .tt th,
  .tt td {
    padding: 0.1rem 0.6rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .tt th {
    color: var(--ink-3);
  }
  .tt .gap {
    width: 0.6rem;
    padding: 0;
    border-bottom-color: transparent;
  }
  .test {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.6rem;
  }
  .go {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
  }
  .res p {
    margin: 0.4rem 0 0;
    padding: 0.35rem 0.7rem;
    border-left: 3px solid var(--line-strong);
    font-size: 0.85rem;
  }
  .res p.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .res p.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .res p.prob {
    border-color: var(--bad);
  }
</style>
