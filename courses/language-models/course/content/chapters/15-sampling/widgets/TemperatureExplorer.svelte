<!--
  Temperature on real CourseGPT distributions: the top tokens' probabilities at temperature T, the
  entropy as T varies, and how much probability sits in the long tail of the vocabulary.
-->
<script lang="ts">
  import { entropyBits, softmaxT } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { DATA, expand, show } from '../data';

  const dists = DATA.distributions ?? [];
  let key = $state(dists[1]?.key ?? '');
  let T = $state(1);
  const d = $derived(dists.find((x) => x.key === key) ?? dists[0]);
  const full = $derived(d ? expand(d) : null);
  const p = $derived(full ? softmaxT(full.logits, T) : new Float64Array());
  const TOP = 12;
  const tail = $derived(p.slice(d?.logits.length ?? 0).reduce((a, b) => a + b, 0));
  const beyondTop = $derived(1 - p.slice(0, TOP).reduce((a, b) => a + b, 0));
  const H = $derived(entropyBits(p));
  const curve = $derived(full ? Array.from({ length: 60 }, (_, i) => 0.05 * 1.07 ** i).map((t) => [t, entropyBits(softmaxT(full.logits, t))] as const) : []);
  const Hmax = Math.log2(8192);
  const pct = (x: number) => (x < 0.001 ? `${(x * 100).toFixed(3)}%` : `${(x * 100).toFixed(1)}%`);
</script>

<Widget
  title="Temperature reshapes the distribution"
  subtitle="CourseGPT’s real next-token distributions after four prompts. Divide the logits by T before the softmax: below 1 the distribution sharpens towards the top token, above 1 it flattens towards the whole vocabulary."
  onreset={() => (T = 1)}
>
  {#snippet controls()}
    <Segmented label="Prompt" size="sm" options={dists.map((x) => ({ value: x.key, label: `…${x.prompt.split(' ').slice(-3).join(' ')}` }))} bind:value={key} />
    <div class="sl"><Slider label="Temperature T" min={0.05} max={3} log value={T} oninput={(v) => (T = v)} /></div>
  {/snippet}

  {#if !d || !full}
    <p class="muted">Run <code>uv run lmc ch15 distributions</code> and <code>uv run lmc ch15 summary</code>.</p>
  {:else}
    <p class="prompt">“{d.prompt}<span class="cursor">▍</span>”</p>
    <div class="two">
      <div class="bars">
        {#each Array.from({ length: TOP }, (_, i) => i) as i (i)}
          <div class="tok">{show(full.labels[i]!)}</div>
          <div class="track"><div class="bar" style:width="{p[i]! * 100}%"></div></div>
          <div class="pc num">{pct(p[i]!)}</div>
        {/each}
        <div class="tok muted">other {(8192 - TOP).toLocaleString('en-GB')}</div>
        <div class="track"><div class="bar rest" style:width="{beyondTop * 100}%"></div></div>
        <div class="pc num">{pct(beyondTop)}</div>
      </div>
      <div>
        <Plot label="Entropy against temperature" height={200} x={{ type: 'log', domain: [0.05, 3], label: 'temperature T', tickValues: [0.1, 0.3, 1, 3] }} y={{ domain: [0, Hmax], label: 'entropy (bits)', ticks: 4 }}>
          {#snippet marks({ sx, sy })}
            <line x1={0} x2={sx(3)} y1={sy(Hmax)} y2={sy(Hmax)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
            <path class="line" stroke="var(--series-1)" d={'M' + curve.map(([t, h]) => `${sx(Math.min(3, t))},${sy(h)}`).join('L')} />
            <circle cx={sx(T)} cy={sy(H)} r="5" fill="var(--series-1)" />
          {/snippet}
        </Plot>
        <div class="stats ui">
          <span>entropy <strong class="num">{H.toFixed(2)}</strong> bits ≈ <strong class="num">{2 ** H < 100 ? (2 ** H).toFixed(1) : Math.round(2 ** H).toLocaleString('en-GB')}</strong> equally likely choices</span>
          <span>mass outside the top 200 tokens: <strong class="num">{pct(tail)}</strong></span>
        </div>
      </div>
    </div>
  {/if}
</Widget>

<style>
  .sl {
    flex: 1 1 14rem;
  }
  .muted {
    color: var(--ink-3);
  }
  .prompt {
    font-size: 0.92rem;
    margin: 0 0 0.6rem;
  }
  .cursor {
    color: var(--accent-2);
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(4rem, max-content) minmax(0, 1fr) 4rem;
    gap: 0.2rem 0.5rem;
    align-items: center;
    font-size: 0.78rem;
    align-content: start;
  }
  .tok {
    font-family: var(--font-mono);
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 0.85rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .bar {
    height: 100%;
    background: var(--series-1);
    border-radius: 3px;
    transition: width 120ms;
  }
  .bar.rest {
    background: var(--ink-3);
  }
  .pc {
    text-align: right;
    color: var(--ink-2);
  }
  .stats {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.5rem;
  }
  .stats strong {
    color: var(--ink);
  }
</style>
