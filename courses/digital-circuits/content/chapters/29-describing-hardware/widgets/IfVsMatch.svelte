<!--
  An `if` chain and a `match` that make the same choice, compiled by the real compiler and counted.

    ::if-vs-match{n="29.4" caption="…"}

  Slide the number of choices from 2 to 16 and compare the depth (the longest path, in gates) and the size (in
  two-input gate equivalents) of the two. The DCL source of each is shown, so the reader sees what was compiled.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { SELECTOR_BITS, measure, pickSource, type Measure } from './ifmatch';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let k = $state<number>(3);
  const arms = $derived(2 ** k);

  // Compiled once per size, on the reader's first use (the compiler is fast, but there is no need to run it in SSR
  // for sizes nobody looks at); the default size is shown from the start.
  const cache = new Map<string, Measure>();
  function get(style: 'if' | 'match', kk: number): Measure {
    const key = `${style}${kk}`;
    let m = cache.get(key);
    if (!m) cache.set(key, (m = measure(style, kk)));
    return m;
  }
  const chain = $derived(get('if', k));
  const parallel = $derived(get('match', k));
  const maxDepth = $derived(Math.max(...SELECTOR_BITS.map((b) => get('if', b).depth)));
  const maxSize = $derived(Math.max(...SELECTOR_BITS.map((b) => get('if', b).gateEquivalents)));

  const rows = $derived([
    { name: 'if … else if … else', short: 'if chain', m: chain, colour: 'var(--sig-high)', source: pickSource('if', k) },
    { name: 'match', short: 'match', m: parallel, colour: 'var(--accent)', source: pickSource('match', k) },
  ]);
  const summary = $derived(
    `With ${arms} choices of 8 bits: the if chain is ${chain.depth} gates deep and ${chain.gateEquivalents} gate equivalents; the match is ${parallel.depth} deep and ${parallel.gateEquivalents}.`,
  );
</script>

<Widget {n} title="A chain, or one big multiplexer?" subtitle="The same choice among 2, 4, 8 or 16 inputs of 8 bits, written two ways" kind="Interactive" {caption} onreset={() => (k = 3)} live={false}>
  {#snippet controls()}
    <Slider label="Number of choices" bind:value={k} min={1} max={4} step={1} format={(v) => `${2 ** v}`} />
  {/snippet}

  <div class="ivm">
    <div class="cols">
      {#each rows as r (r.short)}
        <section aria-label={r.name}>
          <h5 class="ui">{r.name}</h5>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre class="src" tabindex="0"><code>{r.source.trim()}</code></pre>
        </section>
      {/each}
    </div>

    <div class="bars ui" role="group" aria-label={summary}>
      <div class="metric">
        <h5>Depth: gates on the longest path</h5>
        {#each rows as r (r.short)}
          <div class="bar-row">
            <span class="who">{r.short}</span>
            <span class="track"><span class="fill" style:width="{(r.m.depth / maxDepth) * 100}%" style:background={r.colour}></span></span>
            <b>{r.m.depth}</b>
          </div>
        {/each}
      </div>
      <div class="metric">
        <h5>Size: two-input gate equivalents</h5>
        {#each rows as r (r.short)}
          <div class="bar-row">
            <span class="who">{r.short}</span>
            <span class="track"><span class="fill" style:width="{(r.m.gateEquivalents / maxSize) * 100}%" style:background={r.colour}></span></span>
            <b>{r.m.gateEquivalents}</b>
          </div>
        {/each}
      </div>
    </div>
    <p class="ui note">
      The chain has {chain.muxes} multiplexers ({arms - 1} rows of 8) and one comparison per arm; the match has none, only
      AND and OR gates. Each extra arm adds one step to the chain and hardly any to the match.
    </p>
  </div>
</Widget>

<style>
  .ivm {
    display: grid;
    gap: 0.9rem;
    min-width: 0;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }
  @media (max-width: 42rem) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  section {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .src {
    margin: 0;
    padding: 0.6rem 0.75rem;
    max-height: 15rem;
    overflow: auto;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    line-height: 1.5;
    white-space: pre;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem 1.4rem;
  }
  @media (max-width: 42rem) {
    .bars {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .bar-row {
    display: grid;
    grid-template-columns: 4.6rem minmax(0, 1fr) 2.6rem;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
    font-size: 0.8rem;
  }
  .who {
    color: var(--ink-2);
  }
  .track {
    display: block;
    height: 0.85rem;
    background: var(--line);
    border-radius: 4px;
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 4px;
    transition: width 0.25s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
  b {
    font-family: var(--font-mono);
    text-align: right;
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
</style>
