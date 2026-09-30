<!--
  Measured: features of a top-k sparse autoencoder trained on CourseGPT's residual stream (after block 4). For
  each feature, the validation contexts where it fires most (token shading = activation) and the tokens its
  decoder direction promotes directly through the unembedding.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { DATA, show } from '../data';

  const S = DATA.sae;
  let i = $state(0);
  const f = $derived(S?.features[i]);
  const maxAct = $derived(f ? Math.max(...f.examples.flatMap((e) => e.acts), 1e-6) : 1);
</script>

<Widget
  title="Features of a sparse autoencoder"
  subtitle={S ? `${S.m.toLocaleString('en-GB')} features, ${S.k} active per token, trained on the residual stream after block ${S.layer}. These ${S.features.length} were picked at random among features that fire on 0.01–3% of tokens. What does each one detect?` : ''}
  kind="Measured"
>
  {#snippet controls()}
    {#if S}
      <Button size="sm" onclick={() => (i = (i + S.features.length - 1) % S.features.length)}>← Previous</Button>
      <span class="count ui num">{i + 1} / {S.features.length}</span>
      <Button size="sm" onclick={() => (i = (i + 1) % S.features.length)}>Next →</Button>
    {/if}
  {/snippet}

  {#if S && f}
    <p class="meta ui">Feature <strong class="num">#{f.id}</strong> · fires on <strong class="num">{(f.density * 100).toFixed(2)}%</strong> of tokens · directly promotes: {#each f.promotes as t, j (j)}<code>{show(t)}</code>{' '}{/each}</p>
    <div class="examples">
      {#each f.examples as e, j (j)}
        <p class="ex">{#each e.tokens as t, k (k)}<span class="t" style:background={e.acts[k]! > 0 ? `color-mix(in srgb, var(--series-5) ${Math.round((e.acts[k]! / maxAct) * 80)}%, transparent)` : undefined} title={e.acts[k]! > 0 ? e.acts[k]!.toFixed(2) : undefined}>{t.replace(/\n/g, '↵')}</span>{/each}</p>
      {/each}
    </div>
  {:else}
    <p class="muted">Run <code>uv run lmc ch26 sae</code> and <code>uv run lmc ch26 summary</code>.</p>
  {/if}
</Widget>

<style>
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .meta {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0 0 0.5rem;
  }
  .examples {
    display: grid;
    gap: 0.3rem;
  }
  .ex {
    margin: 0;
    font-size: 0.82rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface-2);
    border-radius: 5px;
    white-space: pre-wrap;
  }
  .t {
    border-radius: 2px;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
</style>
