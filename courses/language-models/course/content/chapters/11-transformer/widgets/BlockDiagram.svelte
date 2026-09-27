<!--
  The Transformer block as a residual stream with two branches. Hover a component for what it does
  and the shapes involved; switch between the pre-norm (GPT-2 and later) and post-norm (2017) layouts.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  type Part = 'embed' | 'ln1' | 'attn' | 'add1' | 'ln2' | 'mlp' | 'add2' | 'lnf' | 'head';
  let layout = $state<'pre' | 'post'>('pre');
  let active = $state<Part>('attn');

  const INFO: Record<Part, { title: string; eq: string; text: string }> = {
    embed: { title: 'Embeddings', eq: 'x₀ = E[tokens] + P[positions]   (B, T, C)', text: 'Each token becomes a C-dimensional vector: its token embedding plus a learned embedding of its position. This is the start of the residual stream.' },
    ln1: { title: 'LayerNorm 1', eq: 'LN(x) = γ ⊙ (x − μ) / σ + β   per position', text: 'Standardises each position’s vector before attention reads it, so the branch sees inputs of a predictable scale however large the stream grows.' },
    attn: { title: 'Multi-head attention', eq: 'softmax(QKᵀ/√d + M) V · W_O   (B, T, C)', text: 'The only place positions exchange information: each position reads from earlier ones (Chapter 10).' },
    add1: { title: 'Residual add', eq: 'x ← x + Attention(LN(x))', text: 'The branch’s output is added to the stream, not substituted for it. Gradients flow straight through the addition, so even deep stacks train.' },
    ln2: { title: 'LayerNorm 2', eq: 'LN(x)', text: 'Normalises again before the MLP.' },
    mlp: { title: 'MLP (feed-forward)', eq: 'W₂ · GELU(W₁ · x)   C → 4C → C', text: 'Computation within each position, applied identically at every position. About two-thirds of the parameters live here.' },
    add2: { title: 'Residual add', eq: 'x ← x + MLP(LN(x))', text: 'The MLP’s result is added to the stream too. A block has read from the stream twice and written to it twice.' },
    lnf: { title: 'Final LayerNorm', eq: 'LN(x_L)', text: 'Pre-norm models end with one more normalisation, since the stream itself is never normalised on its way through the blocks.' },
    head: { title: 'Output layer (unembedding)', eq: 'logits = LN(x_L) · Eᵀ   (B, T, V)', text: 'Projects each position onto the vocabulary. GPT-2 reuses the token embedding matrix E here (weight tying).' },
  };

  const X = 170; // x of the residual stream
  const hover = (p: Part) => () => (active = p);
</script>

<Widget
  title="Inside a Transformer block"
  subtitle="The residual stream runs straight up the middle; each block adds to it twice. Hover a component. The shaded box repeats L times."
  onreset={() => {
    layout = 'pre';
    active = 'attn';
  }}
>
  {#snippet controls()}
    <Segmented label="Layout" size="sm" options={[{ value: 'pre', label: 'Pre-norm (GPT-2 onwards)' }, { value: 'post', label: 'Post-norm (2017)' }] as { value: 'pre' | 'post'; label: string }[]} bind:value={layout} />
  {/snippet}

  <div class="layout">
    <svg viewBox="0 0 340 520" role="img" aria-label="Diagram of a {layout}-norm Transformer block">
      <defs>
        <marker id="bd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--ink-2)" /></marker>
      </defs>
      <rect x="20" y="118" width="300" height="300" rx="12" class="repeat" />
      <text x="30" y="136" class="lab small">× L blocks</text>
      <!-- residual stream -->
      <line x1={X} y1="490" x2={X} y2="40" class="stream" marker-end="url(#bd-arrow)" />
      <text x={X + 8} y="455" class="lab small muted">residual stream</text>

      <!-- embeddings -->
      <g class="part" class:on={active === 'embed'} role="presentation" onpointerenter={hover('embed')}>
        <rect x={X - 60} y="470" width="120" height="30" rx="6" />
        <text x={X} y="490" text-anchor="middle" class="lab">embeddings</text>
      </g>

      {#each [{ y: 380, ln: 'ln1', f: 'attn', add: 'add1', label: 'attention' }, { y: 240, ln: 'ln2', f: 'mlp', add: 'add2', label: 'MLP' }] as br (br.f)}
        {@const pre = layout === 'pre'}
        <!-- branch path: from the stream, out to the right, through LN (pre) and the function, back to ⊕ -->
        <path d="M{X},{br.y + 20} L{X + 100},{br.y + 20} L{X + 100},{br.y - 70} L{X + 12},{br.y - 70}" class="branch" marker-end="url(#bd-arrow)" />
        {#if pre}
          <g class="part" class:on={active === br.ln} role="presentation" onpointerenter={hover(br.ln as Part)}>
            <rect x={X + 62} y={br.y - 6} width="76" height="24" rx="5" class="norm" />
            <text x={X + 100} y={br.y + 10} text-anchor="middle" class="lab small">LayerNorm</text>
          </g>
        {/if}
        <g class="part" class:on={active === br.f} role="presentation" onpointerenter={hover(br.f as Part)}>
          <rect x={X + 52} y={br.y - 52} width="96" height="32" rx="6" class={br.f} />
          <text x={X + 100} y={br.y - 31} text-anchor="middle" class="lab">{br.label}</text>
        </g>
        <g class="part" class:on={active === br.add} role="presentation" onpointerenter={hover(br.add as Part)}>
          <circle cx={X} cy={br.y - 70} r="11" class="plus" />
          <text x={X} y={br.y - 65} text-anchor="middle" class="lab">+</text>
        </g>
        {#if !pre}
          <g class="part" class:on={active === br.ln} role="presentation" onpointerenter={hover(br.ln as Part)}>
            <rect x={X - 38} y={br.y - 106} width="76" height="24" rx="5" class="norm" />
            <text x={X} y={br.y - 90} text-anchor="middle" class="lab small">LayerNorm</text>
          </g>
        {/if}
      {/each}

      {#if layout === 'pre'}
        <g class="part" class:on={active === 'lnf'} role="presentation" onpointerenter={hover('lnf')}>
          <rect x={X - 45} y="84" width="90" height="24" rx="5" class="norm" />
          <text x={X} y="100" text-anchor="middle" class="lab small">final LayerNorm</text>
        </g>
      {/if}
      <g class="part" class:on={active === 'head'} role="presentation" onpointerenter={hover('head')}>
        <rect x={X - 60} y="14" width="120" height="30" rx="6" />
        <text x={X} y="34" text-anchor="middle" class="lab">output → logits</text>
      </g>
    </svg>

    <div class="card ui">
      <h5>{INFO[active].title}</h5>
      <p class="eq">{INFO[active].eq}</p>
      <p>{INFO[active].text}</p>
      {#if layout === 'post'}
        <p class="note">In the original post-norm layout, LayerNorm sits <em>on</em> the stream, after each addition: x ← LN(x + f(x)). Every gradient must then pass through 2L normalisations on its way down, which makes deep post-norm models hard to train without a learning-rate warm-up.</p>
      {:else}
        <p class="note">In the pre-norm layout each branch normalises its own input, and the stream is a pure sum: x_L = x₀ + Σ (branch outputs). There is an unobstructed path from the loss to the embeddings.</p>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 1.5rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    max-width: 21rem;
    justify-self: center;
  }
  .repeat {
    fill: color-mix(in srgb, var(--series-7) 6%, transparent);
    stroke: color-mix(in srgb, var(--series-7) 40%, transparent);
    stroke-dasharray: 5 4;
  }
  .stream {
    stroke: var(--ink);
    stroke-width: 3;
  }
  .branch {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.5;
  }
  .part {
    cursor: pointer;
  }
  .part rect {
    fill: var(--surface);
    stroke: var(--ink-2);
    stroke-width: 1.2;
  }
  .part rect.attn {
    fill: color-mix(in srgb, var(--series-1) 25%, var(--surface));
  }
  .part rect.mlp {
    fill: color-mix(in srgb, var(--series-2) 25%, var(--surface));
  }
  .part rect.norm {
    fill: color-mix(in srgb, var(--series-3) 20%, var(--surface));
  }
  .part .plus {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .part.on rect,
  .part.on .plus {
    stroke: var(--ink);
    stroke-width: 2.5;
  }
  .lab {
    font: 600 12px var(--font-ui);
    fill: var(--ink);
    pointer-events: none;
  }
  .small {
    font-size: 10px;
  }
  .muted {
    fill: var(--ink-3);
    font-weight: 400;
  }
  .card h5 {
    margin: 0 0 0.3rem;
    font-size: 0.95rem;
  }
  .card p {
    font-size: 0.84rem;
    margin: 0 0 0.5rem;
  }
  .eq {
    font-family: var(--font-mono);
    font-size: 0.8rem !important;
    background: var(--surface-2);
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
  }
  .note {
    color: var(--ink-2);
    font-size: 0.8rem !important;
  }
</style>
