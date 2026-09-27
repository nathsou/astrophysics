<!--
  Sinusoidal positional encodings (Vaswani et al., 2017): each position is a vector of sines and
  cosines at geometrically spaced frequencies, and the similarity of two positions depends only on
  the distance between them.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';
  import { params } from '$lib/state/params.svelte';

  const T = 64;
  const d = $derived(Math.round(params.get('pe.dim', 64) / 2) * 2);
  const base = $derived(params.get('pe.base', 10000));

  /** PE[pos, 2i] = sin(pos / base^(2i/d)),  PE[pos, 2i+1] = cos(pos / base^(2i/d)). */
  const pe = $derived.by(() => {
    const m = new Float32Array(T * d);
    for (let pos = 0; pos < T; pos++) {
      for (let i = 0; i < d / 2; i++) {
        const w = pos / base ** ((2 * i) / d);
        m[pos * d + 2 * i] = Math.sin(w);
        m[pos * d + 2 * i + 1] = Math.cos(w);
      }
    }
    return m;
  });
  const sim = $derived.by(() => {
    const s = new Float32Array(T * T);
    for (let a = 0; a < T; a++)
      for (let b = 0; b < T; b++) {
        let dot = 0;
        for (let k = 0; k < d; k++) dot += pe[a * d + k]! * pe[b * d + k]!;
        s[a * T + b] = dot / (d / 2);
      }
    return s;
  });
  let hover = $state<{ row: number; col: number; value: number } | null>(null);
</script>

<Widget
  title="Sinusoidal position encodings"
  subtitle="Left: the encoding of each position (rows) across the dimensions (columns) — fast oscillations on the left, slow ones on the right. Right: how similar every pair of positions is (normalised dot product)."
  onreset={() => {
    params.set('pe.dim', 64);
    params.set('pe.base', 10000);
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="dimensions d" min={8} max={128} step={2} value={d} oninput={(v) => params.set('pe.dim', v)} format={(v) => String(Math.round(v))} /></div>
    <div class="ctl"><Slider label="base" min={10} max={100000} step={1} log value={base} oninput={(v) => params.set('pe.base', v)} format={(v) => Math.round(v).toLocaleString('en-GB')} /></div>
  {/snippet}

  <div class="two">
    <figure>
      <Heatmap values={pe} rows={T} cols={d} ramp="diverging" range={[-1, 1]} maxWidth={320} rowTitle="position" colTitle="dimension" label="Sinusoidal positional encoding matrix" format={(v) => v.toFixed(2)} />
    </figure>
    <figure>
      <Heatmap values={sim} rows={T} cols={T} ramp="diverging" range={[-1, 1]} maxWidth={320} rowTitle="position" colTitle="position" label="Similarity of positions" onhover={(c) => (hover = c)} format={(v) => v.toFixed(2)} />
    </figure>
  </div>
  <p class="note ui">
    {#if hover}Positions {hover.row} and {hover.col} (distance {Math.abs(hover.row - hover.col)}): similarity {hover.value.toFixed(3)}. Every other pair at this distance has exactly the same value.{:else}Hover the right-hand matrix. Its stripes run parallel to the diagonal: the similarity of two positions depends only on how far apart they are, not on where they are. A rotation (Appendix A) maps each position's encoding to the next one's, which is what lets attention compute relative offsets — and the idea behind rotary embeddings (Chapter 18).{/if}
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 13rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  figure {
    margin: 0;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
