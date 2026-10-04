<!--
  Heap diagrams linked to assertions: objects as boxes, pointer fields as arrows, variables as labels. Each conjunct
  of the assertion is a chip; hovering it highlights its footprint. The separating conjunction holds when every
  conjunct holds and the footprints are disjoint. Click a pointer field, then an object (or null), to redirect it.
-->
<script lang="ts">
  import { parseAtom, show, star, type CHeap } from './heap';

  let { heap: h0, assertion: a0, caption }: { heap: CHeap; assertion: string[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let heap = $state<CHeap>(structuredClone(h0));
  // svelte-ignore state_referenced_locally
  let text = $state(a0.join(' ** '));
  let hover = $state<number | undefined>();
  let picking = $state<{ obj?: string; field?: string; v?: string } | undefined>();

  const parsed = $derived.by(() => {
    try {
      return { atoms: text.split(/\*\*|∗/).map((s) => s.trim()).filter(Boolean).map(parseAtom), error: '' };
    } catch (e) {
      return { atoms: [], error: (e as Error).message };
    }
  });
  const res = $derived(star(heap, parsed.atoms));
  const hot = $derived(new Set(hover !== undefined ? (res.parts[hover]?.cells ?? []) : []));
  const overlap = $derived(new Set(res.overlap));

  const W = 120;
  const GAP = 50;
  const x = (i: number) => 20 + i * (W + GAP);
  const fieldY = (k: number) => 66 + k * 26;
  const objIndex = (id: string) => heap.objs.findIndex((o) => o.id === id);
  const H = $derived(84 + Math.max(...heap.objs.map((o) => Object.keys(o.fields).length)) * 26 + 40);
  const width = $derived(x(heap.objs.length) + 10);

  function pick(obj: string, field: string) {
    if (typeof heap.objs.find((o) => o.id === obj)!.fields[field] === 'number') return;
    picking = { obj, field };
  }
  function pickVar(v: string) {
    picking = { v };
  }
  function to(target: string | null) {
    if (!picking) return;
    if (picking.v) heap.vars[picking.v] = target;
    else {
      const o = heap.objs.find((x) => x.id === picking!.obj)!;
      o.fields[picking.field!] = target;
    }
    heap = { ...heap };
    picking = undefined;
  }
  function reset() {
    heap = structuredClone(h0);
    text = a0.join(' ** ');
    picking = undefined;
  }
</script>

<figure class="hd">
  <div class="svgwrap">
    <svg viewBox="0 0 {width} {H}" style="min-width: {Math.min(width, 520)}px" role="img" aria-label="The heap">
      <defs><marker id="hd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="ah" /></marker></defs>
      {#each heap.objs as o, i (o.id)}
        {@const fs = Object.keys(o.fields)}
        {@const names = Object.entries(heap.vars).filter(([, t]) => t === o.id).map(([v]) => v)}
        <text class="oid" x={x(i) + W / 2} y="30" text-anchor="middle">{o.id}{names.length ? `  ← ${names.join(', ')}` : ''}</text>
        {#each fs as f, k (f)}
          {@const c = `${o.id}.${f}`}
          <g class="field" class:hot={hot.has(c)} class:clash={overlap.has(c)} class:pickable={typeof o.fields[f] !== 'number'} role="button" tabindex="0" onclick={() => pick(o.id, f)} onkeydown={(e) => e.key === 'Enter' && pick(o.id, f)}>
            <rect x={x(i)} y={fieldY(k) - 18} width={W} height="26" />
            <text class="fname" x={x(i) + 8} y={fieldY(k)}>{f}</text>
            <text class="fval" x={x(i) + W - 8} y={fieldY(k)} text-anchor="end">{typeof o.fields[f] === 'number' ? show(o.fields[f]!) : o.fields[f] === null ? 'null' : '•'}</text>
          </g>
          {#if typeof o.fields[f] === 'string'}
            {@const j = objIndex(o.fields[f] as string)}
            {@const sx = x(i) + W - 14}
            {@const sy = fieldY(k) - 5}
            {#if j > i}
              <path class="ptr" d="M{sx} {sy} C {sx + 30} {sy}, {x(j) - 30} 54, {x(j)} 60" marker-end="url(#hd-arrow)" />
            {:else}
              <path class="ptr" d="M{sx} {sy} C {sx + 30} {sy + 60}, {x(j) + W / 2} {H - 10}, {x(j) + W / 2} {fieldY(Object.keys(heap.objs[j]!.fields).length - 1) + 10}" marker-end="url(#hd-arrow)" />
            {/if}
          {/if}
        {/each}
      {/each}
    </svg>
  </div>
  <div class="vars ui">
    {#each Object.entries(heap.vars) as [v, t] (v)}
      <button type="button" class="var" class:picking={picking?.v === v} onclick={() => pickVar(v)}><code>{v}</code> → {t ?? 'null'}</button>
    {/each}
  </div>
  {#if picking}
    <p class="ui pickbar">Redirect {picking.v ?? `${picking.obj}.${picking.field}`} to:
      {#each heap.objs as o (o.id)}<button type="button" onclick={() => to(o.id)}>{o.id}</button>{/each}
      <button type="button" onclick={() => to(null)}>null</button>
      <button type="button" onclick={() => (picking = undefined)}>cancel</button>
    </p>
  {:else}
    <p class="ui hint">Click a variable or a pointer field (•) to redirect it.</p>
  {/if}
  <label class="ui lab" for="hd-assert">Assertion (conjuncts joined by **)</label>
  <input id="hd-assert" bind:value={text} spellcheck="false" autocomplete="off" />
  {#if parsed.error}<p class="err ui">{parsed.error}</p>{/if}
  <div class="chips">
    {#each parsed.atoms as _, i (i)}
      {@const p = res.parts[i]!}
      <button type="button" class="chip ui" class:bad={!p.ok} onmouseenter={() => (hover = i)} onmouseleave={() => (hover = undefined)} onfocus={() => (hover = i)} onblur={() => (hover = undefined)}>
        <code>{text.split(/\*\*|∗/)[i]?.trim()}</code>
        <span class="st">{p.ok ? '✓' : '✗'}</span>
        <span class="fp">{p.cells.length ? `${p.cells.length} cell${p.cells.length === 1 ? '' : 's'}` : 'no cells'}</span>
        {#if p.reason}<span class="why">{p.reason}</span>{/if}
      </button>
    {/each}
  </div>
  <p class="verdict ui" class:ok={res.holds} class:bad={!res.holds}>
    {#if res.holds}
      ✓ The assertion holds: every conjunct holds, and their footprints are disjoint.{#if res.unclaimed.length} Cells it does not describe: {res.unclaimed.join(', ')}.{/if}
    {:else if res.overlap.length}
      ✗ The separating conjunction fails: {res.overlap.join(', ')} {res.overlap.length === 1 ? 'is' : 'are'} claimed by two conjuncts. ∗ requires disjoint parts of the heap.
    {:else}
      ✗ A conjunct does not hold.
    {/if}
  </p>
  <button type="button" class="reset ui" onclick={reset}>Reset</button>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .hd {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .svgwrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .oid {
    font-family: var(--font-mono);
    font-size: 12px;
    fill: var(--ink-2);
  }
  .field rect {
    fill: var(--panel);
    stroke: var(--line-strong);
  }
  .field.pickable {
    cursor: pointer;
  }
  .field.hot rect {
    fill: color-mix(in srgb, var(--seal) 28%, var(--panel));
    stroke: var(--seal);
    stroke-width: 2;
  }
  .field.clash rect {
    fill: color-mix(in srgb, var(--pencil) 25%, var(--panel));
    stroke: var(--pencil);
    stroke-width: 2;
  }
  .fname,
  .fval {
    font-family: var(--font-mono);
    font-size: 12px;
    fill: var(--fg);
  }
  .fname {
    fill: var(--ink-2);
  }
  .ptr {
    fill: none;
    stroke: var(--ink-blue);
    stroke-width: 1.6;
  }
  .ah {
    fill: var(--ink-blue);
  }
  .vars {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.5rem 0 0.2rem;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    padding: 0.18rem 0.55rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .var.picking {
    border-color: var(--gold);
  }
  .hd code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .pickbar,
  .hint {
    font-size: 0.8rem;
    color: var(--ink-2);
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .hint {
    color: var(--mute);
  }
  .lab {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  input {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.3rem 0.45rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .err {
    color: var(--pencil);
    font-size: 0.8rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .chip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: baseline;
    border-color: var(--seal);
  }
  .chip.bad {
    border-color: var(--pencil);
  }
  .st {
    font-weight: 700;
    color: var(--seal);
  }
  .bad .st,
  .why {
    color: var(--pencil);
  }
  .fp {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .why {
    font-size: 0.75rem;
  }
  .verdict {
    margin: 0.6rem 0 0.3rem;
    font-size: 0.86rem;
    font-weight: 600;
  }
  .verdict.ok {
    color: var(--seal);
  }
  .verdict.bad {
    color: var(--pencil);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
