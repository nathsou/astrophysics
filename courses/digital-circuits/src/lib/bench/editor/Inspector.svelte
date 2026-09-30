<!--
  The inspector: what is selected and how to change it. One part shows its name, label and parameters;
  several parts or a wire show the actions that apply; with nothing selected it shows the circuit.
-->
<script lang="ts">
  import { getDef, pinsOf, withDefaults } from '../../sim/netlist/catalog';
  import type { ParamValue } from '../../sim/netlist/types';
  import ParamField from './ParamField.svelte';
  import Toggle from '../../components/ui/Toggle.svelte';
  import Glyph from './Glyph.svelte';
  import type { Bench } from './bench.svelte';

  let { bench }: { bench: Bench } = $props();

  const selected = $derived(bench.selectedComponents);
  const one = $derived(selected.length === 1 && !bench.selection.wires.size ? selected[0]! : undefined);
  const def = $derived(one ? getDef(one.type) : undefined);
  const params = $derived(one && def ? withDefaults(def, one.params) : {});
  const pins = $derived(one && def ? pinsOf(def, params) : []);
  const many = $derived(selected.length + bench.selection.wires.size);

  const netName = $derived.by(() => {
    if (bench.selection.wires.size !== 1 || !bench.conn) return undefined;
    const n = bench.conn.wireNet[[...bench.selection.wires][0]!];
    return n === undefined ? undefined : (bench.conn.netNames[n] ?? `net ${n}`);
  });

  let idText = $state('');
  let idBad = $state(false);
  $effect(() => {
    idText = one?.id ?? '';
  });
  function commitId() {
    if (!one) return;
    if (idText.trim() === one.id) return;
    if (!bench.rename(one.id, idText)) {
      idBad = true;
      idText = one.id;
      setTimeout(() => (idBad = false), 900);
    }
  }
</script>

<div class="inspector ui">
  {#if one && def}
    <header>
      <h3>{one.id}</h3>
      <span class="kind">{def.name}</span>
    </header>
    {#if def.description}<p class="desc">{def.description}</p>{/if}

    <div class="grid2">
      <label class="f">
        <span>ID</span>
        <input class="txt" class:bad={idBad} type="text" bind:value={idText} onblur={commitId} onkeydown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()} spellcheck="false" autocomplete="off" />
      </label>
      <label class="f">
        <span>Label</span>
        <input
          class="txt"
          type="text"
          value={one.label ?? ''}
          disabled={one.label === ''}
          placeholder={one.label === '' ? 'hidden' : 'automatic'}
          oninput={(ev) => bench.setLabel(one.id, ev.currentTarget.value === '' ? undefined : ev.currentTarget.value)}
          spellcheck="false"
          autocomplete="off"
          title="Text shown next to the part. Empty means the automatic label (id and value)."
        />
      </label>
    </div>

    <Toggle label="Show label" checked={one.label !== ''} onchange={(v) => bench.setLabel(one.id, v ? undefined : '')} />

    <div class="actions">
      <button type="button" onclick={() => bench.rotateSelected()} title="Rotate (R)"><Glyph name="rotate" size={16} />Rotate</button>
      <button type="button" onclick={() => bench.mirrorSelected()} title="Flip left–right (F)"><Glyph name="flip" size={16} />Flip</button>
      <button type="button" onclick={() => bench.duplicateSelected()} title="Duplicate (Ctrl+D)"><Glyph name="duplicate" size={16} />Copy</button>
      <button type="button" class="danger" onclick={() => bench.deleteSelected()} title="Delete (Del)"><Glyph name="trash" size={16} />Delete</button>
    </div>

    {#if def.params?.length}
      <div class="params">
        <h4 class="label-caps">Parameters</h4>
        {#each def.params as p (p.key)}
          <ParamField def={p} value={params[p.key] as ParamValue} onchange={(v) => bench.setParam(one.id, p.key, v)} />
        {/each}
      </div>
    {:else}
      <p class="none">This part has no parameters.</p>
    {/if}

    <div class="pins">
      <h4 class="label-caps">Pins</h4>
      <ul>
        {#each pins as p (p.name)}
          {@const key = `${one.id}.${p.name}`}
          {@const net = bench.conn?.pinNet.get(key)}
          {@const open = !!bench.conn?.unconnected.includes(key)}
          <li>
            <span class="pin">{p.name}</span>
            <span class="net" class:open>{net === undefined ? '' : open ? 'open' : (bench.conn?.netNames[net] ?? `net ${net}`)}</span>
          </li>
        {/each}
      </ul>
    </div>
  {:else if many > 0}
    <header>
      <h3>{selected.length ? `${selected.length} part${selected.length === 1 ? '' : 's'}` : ''}{selected.length && bench.selection.wires.size ? ' and ' : ''}{bench.selection.wires.size ? `${bench.selection.wires.size} wire${bench.selection.wires.size === 1 ? '' : 's'}` : ''}</h3>
      <span class="kind">selected</span>
    </header>
    {#if netName}<p class="desc">A wire on <strong>{netName}</strong>. Drag a segment sideways to move it, or redraw it as a single bend:</p>{/if}
    <div class="actions">
      {#if !selected.length && bench.selection.wires.size === 1}
        <button type="button" onclick={() => bench.tidyWire('h')} title="Route as an L, horizontal first"><Glyph name="wire" size={16} />Across, then down</button>
        <button type="button" onclick={() => bench.tidyWire('v')} title="Route as an L, vertical first"><Glyph name="wire" size={16} />Down, then across</button>
      {/if}
      {#if selected.length}
        <button type="button" onclick={() => bench.rotateSelected()} title="Rotate (R)"><Glyph name="rotate" size={16} />Rotate</button>
        <button type="button" onclick={() => bench.mirrorSelected()} title="Flip (F)"><Glyph name="flip" size={16} />Flip</button>
        <button type="button" onclick={() => bench.duplicateSelected()} title="Duplicate (Ctrl+D)"><Glyph name="duplicate" size={16} />Copy</button>
      {/if}
      <button type="button" class="danger" onclick={() => bench.deleteSelected()} title="Delete (Del)"><Glyph name="trash" size={16} />Delete</button>
    </div>
  {:else}
    <header>
      <h3>Circuit</h3>
      <span class="kind">{bench.circuit.components.length} parts · {bench.circuit.wires.length} wires</span>
    </header>
    <label class="f wide">
      <span>Title</span>
      <input class="txt" type="text" value={bench.circuit.title ?? ''} placeholder="Untitled circuit" oninput={(ev) => bench.setTitle(ev.currentTarget.value)} spellcheck="false" autocomplete="off" />
    </label>
    <p class="desc">Select a part to see its parameters. Drag from a pin to draw a wire; rotate with <kbd>R</kbd>, flip with <kbd>F</kbd>, delete with <kbd>Del</kbd>.</p>
    {#if bench.problems.length}
      <p class="warn">The {bench.engineKind} engine cannot run {bench.problems.slice(0, 4).join(', ')}{bench.problems.length > 4 ? '…' : ''}.</p>
    {/if}
  {/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    font-size: 0.84rem;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .kind {
    color: var(--mute);
    font-size: 0.78rem;
  }
  .desc {
    margin: 0;
    line-height: 1.45;
    color: var(--ink-2);
    font-size: 0.8rem;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    color: var(--mute);
    font-size: 0.72rem;
  }
  .f.wide {
    width: 100%;
  }
  .txt {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.25rem 0.45rem;
    min-width: 0;
    width: 100%;
  }
  .txt:focus {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 25%, transparent);
  }
  .txt.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .actions button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .actions .danger:hover {
    border-color: var(--bad);
    color: var(--bad);
  }
  .params,
  .pins {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--line);
  }
  h4 {
    margin: 0;
    font-size: 0.64rem;
    color: var(--mute);
  }
  .none {
    margin: 0;
    color: var(--mute);
    font-size: 0.8rem;
  }
  .pins ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.2rem 0.8rem;
  }
  .pins li {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
  }
  .pin {
    font-weight: 700;
  }
  .net {
    color: var(--mute);
  }
  .net.open {
    font-style: italic;
    opacity: 0.75;
  }
  .warn {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    background: var(--maybe-soft);
    color: var(--maybe);
    font-size: 0.8rem;
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.75em;
    padding: 0.05rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--pn);
  }
</style>
