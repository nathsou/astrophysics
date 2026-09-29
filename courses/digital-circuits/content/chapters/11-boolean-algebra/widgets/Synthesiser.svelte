<!--
  Truth table to circuit: edit the output column of a 2–4 input truth table and read off the sum of
  products (or product of sums), and the gate circuit it becomes, drawn by the Schematic and running on the
  digital engine. Click an input toggle in the drawing, or a row of the table, to see which term fires.
  The synthesis is in synth.ts and the drawing in layout.ts.

    ::synthesiser{n="11.3" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import type { ParamValue } from '$lib/sim/netlist/types';
  import LiveDag from './LiveDag.svelte';
  import { layoutDag } from './layout';
  import { NAMES, PRESETS, bitOf, expressionText, ones, outsOfPreset, synthesise, tokens, zeros, type Form } from './synth';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let inputs = $state(3);
  let presetId = $state<string | null>('majority');
  let outs = $state<number[]>(outsOfPreset(PRESETS.find((p) => p.id === 'majority')!));
  let form = $state<Form>('sop');
  let current = $state<number[]>([0, 0, 0, 0]);
  let generation = $state(0);

  const synth = $derived(synthesise(inputs, outs, form));
  const row = $derived(current.slice(0, inputs).reduce((m, b) => (m << 1) | b, 0));
  const preset = $derived(PRESETS.find((p) => p.id === presetId));
  const circuit = $derived.by(() => {
    void generation;
    const values = untrack(() => Object.fromEntries(NAMES.map((nm, v) => [nm, !!current[v]])));
    return layoutDag(synth.dag, { title: 'Synthesised circuit', values });
  });

  function setPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    presetId = id;
    inputs = p.n;
    outs = outsOfPreset(p);
    generation++;
  }
  function setInputs(k: number) {
    presetId = null;
    inputs = k;
    outs = Array.from({ length: 2 ** k }, (_, m) => outs[m] ?? 0);
    current = [0, 0, 0, 0];
    generation++;
  }
  function flip(m: number) {
    presetId = null;
    outs = outs.map((o, i) => (i === m ? 1 - o : o));
  }
  function showRow(m: number) {
    current = [0, 1, 2, 3].map((v) => (v < inputs ? bitOf(m, v, inputs) : 0));
    generation++;
  }
  function onparam(id: string, key: string, value: ParamValue) {
    const v = NAMES.findIndex((nm) => id === `in_${nm}`);
    if (v >= 0 && key === 'on') current[v] = value ? 1 : 0;
  }
  function reset() {
    setPreset('majority');
    form = 'sop';
    current = [0, 0, 0, 0];
    generation++;
  }
  const rows = $derived(Array.from({ length: 2 ** inputs }, (_, m) => m));
  const explain = $derived(
    form === 'sop'
      ? `One AND for each of the ${ones(outs).length} rows with a 1, joined by one OR.`
      : form === 'pos'
        ? `One OR for each of the ${zeros(outs).length} rows with a 0, joined by one AND.`
        : 'The same function after simplification (Chapter 12 explains how).',
  );
</script>

<Widget title="Truth table to circuit" n={fig} {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented size="sm" label="Number of inputs" value={inputs} onchange={setInputs} options={[2, 3, 4].map((k) => ({ value: k, label: `${k} inputs` }))} />
    <Segmented size="sm" label="Examples" value={presetId ?? ''} onchange={setPreset} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
    <Segmented
      size="sm"
      label="Form"
      bind:value={form}
      options={[
        { value: 'sop', label: 'Sum of products', title: 'Canonical: one AND per row with a 1' },
        { value: 'pos', label: 'Product of sums', title: 'Canonical: one OR per row with a 0' },
        { value: 'min', label: 'Minimised', title: 'Smallest sum of products (Quine–McCluskey)' },
      ]}
    />
  {/snippet}

  <div class="sy ui">
    <div class="tt" role="group" aria-label="Truth table. Click an output to change it, or a row to set the inputs of the circuit.">
      <div class="head" aria-hidden="true">
        {#each NAMES.slice(0, inputs) as nm (nm)}<span>{nm}</span>{/each}
        <span class="out">Y</span>
      </div>
      {#each rows as m (m)}
        <div class="tr" class:current={m === row}>
          <button type="button" class="in" onclick={() => showRow(m)} aria-label="Row {m}: {NAMES.slice(0, inputs).map((nm, v) => `${nm} = ${bitOf(m, v, inputs)}`).join(', ')}. Set the circuit's inputs to this row." aria-pressed={m === row}>
            {#each NAMES.slice(0, inputs) as nm, v (nm)}<span>{bitOf(m, v, inputs)}</span>{/each}
          </button>
          <button type="button" class="y" class:one={outs[m]} onclick={() => flip(m)} aria-pressed={!!outs[m]} aria-label="Output for row {m}: {outs[m]}. Click to change.">{outs[m]}</button>
        </div>
      {/each}
    </div>

    <div class="right">
      <div class="expr" role="status" aria-label="Expression: Y = {expressionText(synth)}">
        <span class="lhs">Y =</span>
        {#each tokens(synth) as t, i (i)}{#if t.t === 'lit'}<span class="lit" class:neg={t.neg}>{t.name}</span>{:else}<span class="op">{t.text}</span>{/if}{/each}
      </div>
      <p class="why">{explain}{#if preset && presetId}{' '}{preset.note}{/if}</p>
      <p class="cost">
        <b>{synth.gates}</b> gate{synth.gates === 1 ? '' : 's'}{#if synth.inverters}{' '}({synth.inverters} inverter{synth.inverters === 1 ? '' : 's'}){/if}, <b>{synth.gateInputs}</b> gate inputs.
        Row {row} gives Y = <b class:hi={outs[row]}>{outs[row]}</b>.
      </p>
      <LiveDag {circuit} scale={1.1} {onparam} label="Circuit for Y = {expressionText(synth)}" />
    </div>
  </div>
</Widget>

<style>
  .sy {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 1rem 1.6rem;
    align-items: start;
  }
  @media (max-width: 40rem) {
    .sy {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tt {
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.86rem;
    width: max-content;
    max-width: 100%;
  }
  .head,
  .tr {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }
  .head span {
    min-width: 1.7rem;
    text-align: center;
    color: var(--mute);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    padding: 0.1rem 0;
  }
  .head .out {
    margin-left: 0.7rem;
    min-width: 2.2rem;
  }
  .in {
    display: flex;
    gap: 2px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .in span {
    min-width: 1.7rem;
    text-align: center;
    padding: 0.2rem 0;
    background: color-mix(in srgb, var(--pn) 75%, transparent);
    color: var(--ink-2);
    border-radius: 3px;
  }
  .in:hover span {
    background: var(--pn);
  }
  .tr.current .in span {
    background: var(--copper-soft);
    color: var(--fg);
    box-shadow: inset 0 0 0 1px var(--copper);
  }
  .y {
    margin-left: 0.7rem;
    min-width: 2.2rem;
    font: inherit;
    font-weight: 700;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--sig-low);
    cursor: pointer;
  }
  .y.one {
    color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 12%, var(--panel));
    border-color: var(--sig-high);
  }
  .y:hover {
    border-color: var(--copper);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .right {
    min-width: 0;
    display: grid;
    gap: 0.6rem;
  }
  .expr {
    font-family: var(--font-mono);
    font-size: 0.98rem;
    line-height: 1.7;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    white-space: pre;
  }
  .lhs {
    color: var(--mute);
    margin-right: 0.5rem;
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
  }
  .why,
  .cost {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .cost b {
    font-family: var(--font-mono);
  }
  .cost b.hi {
    color: var(--sig-high);
  }
</style>
