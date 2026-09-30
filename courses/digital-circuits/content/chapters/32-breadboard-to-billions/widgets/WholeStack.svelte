<!--
  Figure 32.6, the closing figure: the whole stack, battery at the bottom and chip at the top, each layer linked to
  the chapters that built it and (where it has one) the number of transistors in a typical instance, on a log scale.

    ::whole-stack{n="32.6" caption="…"}
-->
<script lang="ts">
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { findEntry } from '$lib/content/registry';
  import { LAYERS, magnitude } from './stack';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let active = $state<string>('cpu');
  const MAX = 12;
  const short = (v: number) => (v >= 1e9 ? `${Number((v / 1e9).toPrecision(3))} billion` : v >= 1000 ? v.toLocaleString('en-GB') : `${v}`);
  const links = (slugs: string[]) =>
    slugs.map((s) => {
      const e = findEntry('chapter', s);
      return { slug: s, n: e?.number ?? '?', title: e?.title ?? s, href: e?.available ? `${base}${e.href}` : undefined };
    });
</script>

<Widget {n} title="The whole stack" subtitle="From a battery to a chip: eleven layers, each built from the one below" kind="Figure" live={false} {caption}>
  <ol class="ws ui">
    {#each LAYERS as l, i (l.id)}
      {@const m = magnitude(l)}
      <li class:on={active === l.id} class="layer">
        <button type="button" class="head" aria-expanded={active === l.id} onclick={() => (active = l.id)} onmouseenter={() => (active = l.id)} onfocus={() => (active = l.id)}>
          <span class="idx">{i + 1}</span>
          <span class="name">{l.name}</span>
          <span class="made">{l.made}</span>
          <span class="bar" aria-hidden="true">{#if m !== undefined}<span class="fill" style:width="{Math.max(2, (m / MAX) * 100)}%"></span>{/if}</span>
          <span class="count">{#if l.transistors !== undefined}{short(l.transistors)}{:else}<span class="none">—</span>{/if}</span>
        </button>
        {#if active === l.id}
          <div class="more">
            <p>{l.idea}</p>
            {#if l.example}<p class="ex">{short(l.transistors!)} transistors: {l.example}.</p>{/if}
            <p class="ch">
              {#each links(l.chapters) as c, k (c.slug)}{k ? ' ' : ''}{#if c.href}<a href={c.href} title={c.title}>Ch {c.n}</a>{:else}<span title="{c.title} (not yet available)">Ch {c.n}</span>{/if}{/each}
            </p>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
  <p class="ui scale">Bars: transistors in one typical instance of the layer, on a logarithmic scale from 1 to a trillion. Battery, hardware language and FPGA have no count: they are not made of a fixed number of transistors.</p>
</Widget>

<style>
  .ws {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.3rem;
  }
  .layer {
    margin: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    overflow: hidden;
  }
  .layer.on {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .head {
    display: grid;
    grid-template-columns: 1.6rem 9rem minmax(0, 1fr) minmax(4rem, 22%) 6.5rem;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.4rem 0.7rem;
    border: 0;
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-size: 0.86rem;
    text-align: left;
    cursor: pointer;
  }
  .head:focus-visible {
    outline: 2px solid var(--copper);
    outline-offset: -2px;
  }
  .idx {
    display: inline-grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: var(--line);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .on .idx {
    background: var(--copper);
    color: var(--panel);
  }
  .name {
    font-weight: 650;
  }
  .made {
    color: var(--ink-2);
    font-size: 0.8rem;
    min-width: 0;
  }
  .bar {
    height: 0.55rem;
    background: var(--pn);
    border-radius: 2px;
    display: block;
    position: relative;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--series-3);
    border-radius: 2px;
  }
  .on .fill {
    background: var(--copper);
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-align: right;
  }
  .none {
    color: var(--mute);
  }
  .more {
    padding: 0 0.7rem 0.6rem 2.9rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .more p {
    margin: 0.15rem 0;
  }
  .ex {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .ch {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
  }
  .ch a,
  .ch span {
    font-size: 0.8rem;
    font-weight: 600;
  }
  .ch a {
    color: var(--copper-ink);
  }
  .ch span {
    color: var(--mute);
  }
  .scale {
    margin: 0.7rem 0 0;
    font-size: 0.76rem;
    color: var(--mute);
  }
  @media (max-width: 40rem) {
    .head {
      grid-template-columns: 1.6rem minmax(0, 1fr) auto;
      grid-template-areas:
        'i n c'
        '. m m'
        '. b b';
      row-gap: 0.15rem;
    }
    .idx {
      grid-area: i;
    }
    .name {
      grid-area: n;
    }
    .count {
      grid-area: c;
    }
    .made {
      grid-area: m;
    }
    .bar {
      grid-area: b;
    }
    .more {
      padding-left: 0.9rem;
    }
  }
</style>
