<!--
  Measured: one validation story through the 8-expert, top-2 model, each token coloured by the expert its
  router ranked first, layer by layer.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { DATA } from '../data';

  const S = DATA.story;
  let layer = $state(0);
  const show = (t: string) => t.replaceAll('\n', '↵ ');
  const counts = $derived(S ? Array.from({ length: 8 }, (_, e) => S.experts[layer]!.filter((x) => x === e).length) : []);
</script>

<Widget
  title="Which expert reads which token?"
  subtitle="A story from the validation set through the 8-expert model. Each token is coloured by the expert its router ranked first in the chosen layer."
  kind="Measured"
>
  {#snippet controls()}
    {#if S}<div class="sl"><Slider label="Layer" min={1} max={S.experts.length} step={1} value={layer + 1} oninput={(v) => (layer = Math.round(v) - 1)} format={(v) => String(Math.round(v))} /></div>{/if}
  {/snippet}
  {#if !S}
    <p class="muted">Run <code>uv run lmc ch19 routing</code> and <code>summary</code>.</p>
  {:else}
    <p class="story">{#each S.tokens as t, i (i)}<span class="t" style:background="color-mix(in srgb, var(--series-{S.experts[layer]![i]! + 1}) 32%, transparent)" title="expert {S.experts[layer]![i]}">{show(t)}</span>{/each}</p>
    <div class="key ui">{#each counts as c, e (e)}<span><span class="sw" style:background="var(--series-{e + 1})"></span>E{e}: {c}</span>{/each}</div>
  {/if}
</Widget>

<style>
  .sl {
    flex: 0 1 12rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .story {
    font-size: 0.92rem;
    line-height: 1.9;
    margin: 0;
    white-space: pre-wrap;
  }
  .t {
    border-radius: 3px;
    padding: 0.05rem 0;
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    font-size: 0.75rem;
    color: var(--ink-2);
    margin-top: 0.6rem;
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.3rem;
  }
</style>
