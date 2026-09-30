<!--
  The memory hierarchy, with real orders of magnitude: what each level is made of, how long it takes to answer,
  and how much it holds, on logarithmic bars. Scale the latencies to human time (1 ns = 1 s) to feel them, and
  set the hit rates of the caches to see the average access time. The numbers are hierarchy.ts (tested).

    ::memory-hierarchy{n="20.8" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { DEFAULT_HITS, LEVELS, cachedAmat, humanSeconds, levelOf, size, time, words } from './hierarchy';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let human = $state(false);
  let h1 = $state(DEFAULT_HITS[0]! * 100);
  let h2 = $state(DEFAULT_HITS[1]! * 100);
  let h3 = $state(DEFAULT_HITS[2]! * 100);

  const avg = $derived(cachedAmat([h1 / 100, h2 / 100, h3 / 100]));
  const dram = levelOf('dram').latency;
  const lo = Math.log10(0.1e-9);
  const hi = Math.log10(20e-3);
  const clo = Math.log10(500);
  const chi = Math.log10(30 * 1024 ** 4);
  const bar = (v: number, a: number, b: number) => `${Math.max(2, Math.min(100, ((Math.log10(v) - a) / (b - a)) * 100))}%`;
</script>

<Widget title="The memory hierarchy" n={fig} {caption} kind="Interactive" onreset={() => { h1 = 95; h2 = 80; h3 = 70; human = false; }}>
  {#snippet controls()}
    <Toggle bind:checked={human} label="Scale to human time (1 ns = 1 s)" />
  {/snippet}
  <div class="mh ui">
    <table>
      <thead>
        <tr><th>Level</th><th>Made of</th><th>Transistors per bit</th><th class="bars">{human ? 'Time, if 1 ns were 1 s' : 'Time to answer'}</th><th class="bars">Capacity</th></tr>
      </thead>
      <tbody>
        {#each LEVELS as l (l.id)}
          <tr>
            <th scope="row" title={l.note}>{l.name}</th>
            <td>{l.tech}</td>
            <td class="cell">{l.cell}</td>
            <td class="bars"><span class="track"><span class="fill lat" style:width={bar(l.latency, lo, hi)}></span></span><b>{human ? words(humanSeconds(l.latency)) : time(l.latency)}</b></td>
            <td class="bars"><span class="track"><span class="fill cap" style:width={bar(l.capacity, clo, chi)}></span></span><b>{size(l.capacity)}</b></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="amat">
      <h5>Why it works: the average access time</h5>
      <div class="sl">
        <Slider label="L1 hit rate" bind:value={h1} min={50} max={100} step={0.5} format={(v) => `${v.toFixed(1)} %`} />
        <Slider label="L2 hit rate (of what misses L1)" bind:value={h2} min={0} max={100} step={1} format={(v) => `${v.toFixed(0)} %`} />
        <Slider label="L3 hit rate (of what misses L2)" bind:value={h3} min={0} max={100} step={1} format={(v) => `${v.toFixed(0)} %`} />
      </div>
      <p class="result" role="status">
        Average access time <b>{human ? words(humanSeconds(avg)) : time(avg)}</b>: {(dram / avg).toFixed(0)} times better than going to main memory every time ({human ? words(humanSeconds(dram)) : time(dram)}). AMAT = t<sub>L1</sub> + m<sub>1</sub>(t<sub>L2</sub> + m<sub>2</sub>(t<sub>L3</sub> + m<sub>3</sub> t<sub>DRAM</sub>)), with m = 1 − hit rate.
      </p>
    </div>
  </div>
</Widget>

<style>
  .mh {
    display: grid;
    gap: 1rem;
    padding: 0.8rem 1rem 1rem;
    min-width: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }
  thead th {
    color: var(--mute);
    font-weight: 500;
    font-size: 0.72rem;
  }
  tbody th {
    font-weight: 600;
    white-space: nowrap;
  }
  .cell {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .bars {
    min-width: 9rem;
  }
  .track {
    display: block;
    height: 0.55rem;
    background: var(--pn);
    border-radius: 3px;
    margin-bottom: 0.15rem;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .lat {
    background: var(--sig-high);
  }
  .cap {
    background: var(--sig-low);
  }
  .bars b {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    font-weight: 600;
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.86rem;
    font-family: var(--font-display);
  }
  .sl {
    display: grid;
    gap: 0.4rem;
    max-width: 30rem;
  }
  .result {
    margin: 0.5rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  @media (max-width: 52rem) {
    .mh :global(table) {
      display: block;
      overflow-x: auto;
    }
  }
</style>
