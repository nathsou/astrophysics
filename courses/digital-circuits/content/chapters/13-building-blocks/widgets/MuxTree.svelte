<!--
  A multiplexer as a tree of 2:1 multiplexers. Click the data inputs to change them; set the select bits
  with the buttons. The first level is controlled by S0, the next by S1, and so on: the select bits, read as
  a binary number, name the data input that reaches the output.

    ::mux-tree{n="13.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import TreeSvg from './TreeSvg.svelte';
  import { evalMux } from './mux';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const INITIAL = [0, 1, 1, 0, 1, 0, 0, 1];
  let k = $state(3);
  let data = $state<number[]>([...INITIAL]);
  let sbits = $state<number[]>([1, 0, 1]);

  const sel = $derived(sbits.slice(0, k).reduce((s, b, i) => s + (b << i), 0));
  const names = $derived(Array.from({ length: k }, (_, i) => `S${i}`));
  const y = $derived(evalMux(data, sel));
  const bin = $derived(
    Array.from({ length: k }, (_, i) => sbits[k - 1 - i])
      .map((b) => (b ? 1 : 0))
      .join(''),
  );

  function flip(i: number) {
    data = data.map((v, j) => (j === i ? 1 - v : v));
  }
  function setSel(i: number) {
    sbits = sbits.map((b, j) => (j === i ? 1 - b : b));
  }
  function setK(v: number) {
    k = v;
  }
  function reset() {
    k = 3;
    data = [...INITIAL];
    sbits = [1, 0, 1];
  }
</script>

<Widget title="A multiplexer is a tree" subtitle="Data in on the left, one path to the output" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Number of data inputs"
      value={k}
      onchange={setK}
      options={[
        { value: 1, label: '2:1' },
        { value: 2, label: '4:1' },
        { value: 3, label: '8:1' },
      ]}
    />
    <div class="sel ui" role="group" aria-label="Select inputs">
      {#each { length: k } as _, ii (ii)}
        {@const i = k - 1 - ii}
        <button type="button" class:on={sbits[i]} aria-pressed={!!sbits[i]} onclick={() => setSel(i)} aria-label="S{i}: {sbits[i]}. Press to change.">
          <span class="nm">S{i}</span><span class="bv">{sbits[i]}</span>
        </button>
      {/each}
    </div>
  {/snippet}

  <div class="mt">
    <TreeSvg
      {k}
      leaves={data}
      {sel}
      selNames={names}
      onleaf={flip}
      label="A {1 << k}-to-1 multiplexer built from {(1 << k) - 1} two-way multiplexers. The select bits {bin} choose data input D{sel}, which is {data[sel]}, so the output is {y}."
    />
    <p class="read ui" role="status">
      Select <b>{bin}</b> = {sel}, so <b>Y = D{sel} = {y}</b>. The other {(1 << k) - 1} data inputs are ignored.
    </p>
  </div>
</Widget>

<style>
  .mt {
    display: grid;
    gap: 0.6rem;
  }
  .sel {
    display: inline-flex;
    gap: 4px;
  }
  .sel button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--pn);
    color: var(--ink-2);
    font: inherit;
    font-size: 0.82rem;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .sel button .bv {
    font-family: var(--font-mono);
    font-weight: 700;
    min-width: 1ch;
    color: var(--sig-low);
  }
  .sel button.on {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .sel button.on .bv {
    color: var(--sig-high);
  }
  .sel button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .read {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    text-align: center;
  }
  .read b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
</style>
