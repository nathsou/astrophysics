<!--
  The lookup-table explorer: a multiplexer whose data inputs are constants. The select inputs are the
  inputs of a function (A is the most significant), and each constant is the function's value in one row of
  its truth table. Click the bits, or pick a function, and the same circuit becomes a different function;
  the configuration word, the number of functions it could have been and the smallest expression follow.

    ::lut-explorer{n="13.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import TreeSvg from './TreeSvg.svelte';
  import { LUT_NAMES, PRESETS, functionCount, hexWord, lutValue, minimalTerms, presetBits, rowInputs, rowOf, wordOf, type Lit } from './mux';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let k = $state(3);
  let presetId = $state<string | null>('xor');
  let bits = $state<number[]>(presetBits(PRESETS.find((p) => p.id === 'xor')!, 3));
  let inputs = $state<number[]>([1, 0, 0, 0]);

  const names = $derived(LUT_NAMES.slice(0, k));
  const x = $derived(inputs.slice(0, k));
  const row = $derived(rowOf(x));
  const y = $derived(lutValue(bits, x));
  const terms = $derived(minimalTerms(bits, k));
  const preset = $derived(PRESETS.find((p) => p.id === presetId));
  const available = $derived(PRESETS.filter((p) => p.ks.includes(k)));
  // The tree's select S0 is the last input (C in a 3-input table), S(k−1) is A.
  const selNames = $derived(Array.from({ length: k }, (_, i) => names[k - 1 - i]!));
  const labels = $derived(Array.from({ length: 1 << k }, (_, m) => rowInputs(m, k).join('')));

  function setK(v: number) {
    k = v;
    const still = PRESETS.find((p) => p.id === presetId && p.ks.includes(v));
    const use = still ?? PRESETS.find((p) => p.id === 'xor')!;
    presetId = use.id;
    bits = presetBits(use, v);
  }
  function setPreset(id: string) {
    presetId = id;
    bits = presetBits(PRESETS.find((p) => p.id === id)!, k);
  }
  function flip(i: number) {
    presetId = null;
    bits = bits.map((b, j) => (j === i ? 1 - b : b));
  }
  function setInput(v: number) {
    inputs = inputs.map((b, j) => (j === v ? 1 - b : b));
  }
  function reset() {
    k = 3;
    presetId = 'xor';
    bits = presetBits(PRESETS.find((p) => p.id === 'xor')!, 3);
    inputs = [1, 0, 0, 0];
  }
  const litText = (l: Lit) => names[l.v]!;
</script>

<Widget title="A lookup table is a multiplexer" subtitle="Set the bits and the circuit becomes any function of its inputs" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Number of inputs"
      value={k}
      onchange={setK}
      options={[
        { value: 2, label: '2 inputs' },
        { value: 3, label: '3 inputs' },
        { value: 4, label: '4 inputs' },
      ]}
    />
    <Segmented size="sm" label="Functions" value={presetId ?? ''} onchange={setPreset} options={available.map((p) => ({ value: p.id, label: p.label }))} />
  {/snippet}

  <div class="lut">
    <div class="tree">
      <TreeSvg
        {k}
        leaves={bits}
        sel={row}
        {selNames}
        leafTitle="bit "
        {labels}
        onleaf={flip}
        output="Y"
        label="A lookup table with {k} inputs: a {1 << k}-to-1 multiplexer whose data inputs are the stored bits {bits.join('')}. Inputs {x.join('')} select row {row}, which holds {y}."
      />
    </div>
    <div class="side ui">
      <div class="ins" role="group" aria-label="Inputs of the function">
        {#each names as nm, v (nm)}
          <button type="button" class:on={inputs[v]} aria-pressed={!!inputs[v]} onclick={() => setInput(v)} aria-label="Input {nm}: {inputs[v]}. Press to change.">
            <span class="nm">{nm}</span><span class="bv">{inputs[v]}</span>
          </button>
        {/each}
        <span class="arrow" aria-hidden="true">→</span>
        <span class="y" class:on={y} role="status" aria-label="Output Y is {y}">Y = {y}</span>
      </div>
      <dl class="facts">
        <dt>Row</dt>
        <dd>{x.join('')} is row {row}, so Y is the stored bit number {row}.</dd>
        <dt>Stored bits</dt>
        <dd><code>{[...bits].reverse().join('')}</code> = <code>{hexWord(bits)}</code> = {wordOf(bits)}</dd>
        <dt>Could have been</dt>
        <dd>any of {functionCount(k).toLocaleString('en-GB')} functions of {k} inputs (2<sup>{1 << k}</sup> bit patterns)</dd>
        <dt>Smallest formula</dt>
        <dd class="expr">
          Y =
          {#if terms.length === 0}<span class="lit">0</span>
          {:else if terms.length === 1 && terms[0]!.length === 0}<span class="lit">1</span>
          {:else}
            {#each terms as t, ti (ti)}{#if ti}<wbr /><span class="op">+</span>{/if}{#each t as l, li (li)}{#if li}<span class="op">·</span>{/if}<span class="lit" class:neg={l.neg}>{litText(l)}</span>{/each}{/each}
          {/if}
        </dd>
      </dl>
      {#if preset}<p class="note">{preset.note}</p>{:else}<p class="note">Your own function: click a bit to change it.</p>{/if}
    </div>
  </div>
</Widget>

<style>
  .lut {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem 1.4rem;
    align-items: start;
  }
  @media (max-width: 46rem) {
    .lut {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tree {
    min-width: 0;
  }
  .side {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .ins {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ins button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--pn);
    color: var(--ink-2);
    font: inherit;
    font-size: 0.85rem;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
  }
  .ins button .bv {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--sig-low);
  }
  .ins button.on {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .ins button.on .bv {
    color: var(--sig-high);
  }
  .ins button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .arrow {
    color: var(--mute);
    margin: 0 0.3rem;
  }
  .y {
    font-family: var(--font-mono);
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    color: var(--sig-low);
    background: var(--pn);
  }
  .y.on {
    color: var(--sig-high);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.35rem 0.9rem;
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .facts dt {
    color: var(--mute);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding-top: 0.12rem;
  }
  .facts dd {
    margin: 0;
    color: var(--ink-2);
  }
  .facts code {
    font-family: var(--font-mono);
    color: var(--fg);
    background: var(--pn);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
    overflow-wrap: anywhere;
  }
  .expr {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .lit {
    font-weight: 600;
  }
  .lit.neg {
    text-decoration: overline;
    text-decoration-thickness: 1.5px;
  }
  .op {
    color: var(--mute);
    margin: 0 0.12em;
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--mute);
    line-height: 1.5;
  }
</style>
