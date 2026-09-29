<!--
  Multi-head, grouped-query and multi-query attention: which query heads share which key/value head,
  and what that does to the KV cache for real model shapes, contexts and batch sizes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  const MODELS = {
    course: { label: 'CourseGPT', layers: 8, heads: 8, d: 64, kv: [8, 4, 2, 1] },
    llama8: { label: 'Llama 3 8B', layers: 32, heads: 32, d: 128, kv: [32, 8, 4, 1] },
    llama70: { label: 'Llama 3 70B', layers: 80, heads: 64, d: 128, kv: [64, 8, 4, 1] },
  } as const;
  type Key = keyof typeof MODELS;
  let model = $state<Key>('llama8');
  let kv = $state(8);
  let logCtx = $state(13);
  let batch = $state(8);
  const M = $derived(MODELS[model]);
  const ctx = $derived(Math.round(2 ** logCtx));
  // Keys and values, every layer, every position, in bfloat16 (2 bytes).
  const bytes = $derived(2 * M.layers * ctx * kv * M.d * 2 * batch);
  const full = $derived(2 * M.layers * ctx * M.heads * M.d * 2 * batch);
  const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`);
  const name = $derived(kv === M.heads ? 'multi-head' : kv === 1 ? 'multi-query' : 'grouped-query');
  function choose(k: Key) {
    model = k;
    kv = MODELS[k].kv[1];
  }
</script>

<Widget
  title="Sharing keys and values"
  subtitle="Each query head needs keys and values, but they need not be its own. Groups of query heads can share one key/value head; the KV cache shrinks by the group size."
  onreset={() => {
    choose('llama8');
    logCtx = 13;
    batch = 8;
  }}
>
  {#snippet controls()}
    <Segmented label="Model" size="sm" options={Object.entries(MODELS).map(([value, m]) => ({ value: value as Key, label: m.label }))} value={model} onchange={choose} />
    <Segmented label="Key/value heads" size="sm" options={M.kv.map((v) => ({ value: v, label: v === M.heads ? `${v} (MHA)` : v === 1 ? '1 (MQA)' : `${v} (GQA)` }))} bind:value={kv} />
    <div class="sl"><Slider label="Context" min={9} max={17} step={0.5} value={logCtx} oninput={(v) => (logCtx = v)} format={() => ctx.toLocaleString('en-GB')} /></div>
    <div class="sl"><Slider label="Batch (users at once)" min={1} max={64} step={1} value={batch} oninput={(v) => (batch = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <div class="heads">
    <div class="row"><span class="lbl ui">query heads</span>{#each Array.from({ length: M.heads }, (_, i) => i) as i (i)}<span class="h" style:background="var(--series-{(Math.floor(i / (M.heads / kv)) % 8) + 1})"></span>{/each}</div>
    <div class="row"><span class="lbl ui">key/value heads</span>{#each Array.from({ length: kv }, (_, j) => j) as j (j)}<span class="h kv" style:background="var(--series-{(j % 8) + 1})" style:flex-grow={M.heads / kv}></span>{/each}</div>
  </div>
  <div class="stats ui">
    <span>{name} attention: {M.heads / kv} query head{M.heads / kv === 1 ? '' : 's'} per key/value head</span>
    <span>KV cache <strong class="num">{gb(bytes)}</strong>{#if kv < M.heads}{' '}instead of {gb(full)}{/if}</span>
    <span>per token per user: <strong class="num">{((2 * M.layers * kv * M.d * 2) / 1024).toFixed(0)} KB</strong></span>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .heads {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .lbl {
    width: 7.5rem;
    flex: none;
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .h {
    flex: 1 1 0;
    height: 1.4rem;
    border-radius: 3px;
  }
  .h.kv {
    height: 1.4rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .stats strong {
    color: var(--ink);
  }
</style>
