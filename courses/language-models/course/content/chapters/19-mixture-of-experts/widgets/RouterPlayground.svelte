<!--
  A router at work on a batch of 64 tokens: each token's scores for 8 experts, top-k routing, the load on each
  expert, the balancing loss, and the tokens dropped when experts have a fixed capacity. A "favouritism" slider
  adds a bias towards expert 0, as a router collapsing early in training would. Uses the learner's route().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(scores: number[], k: number) {
    const m = Math.max(...scores);
    const p = scores.map((s) => Math.exp(s - m));
    const z = p.reduce((a, b) => a + b, 0);
    const experts = p.map((_, i) => i).sort((a, b) => p[b]! - p[a]! || a - b).slice(0, k);
    const kept = experts.reduce((a, i) => a + p[i]!, 0);
    return { experts, gates: experts.map((i) => p[i]! / kept), probs: p.map((v) => v / z) };
  }
  const route = $derived(impl.get('moe.route', reference));
  const mine = $derived(impl.isMine('moe.route'));

  const E = 8, N = 64;
  const rng = mulberry32(11);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  const base = Array.from({ length: N }, () => Array.from({ length: E }, () => gauss()));
  let k = $state(2);
  let bias = $state(0);
  let factor = $state(1.25);

  const routed = $derived.by(() => {
    const scores = base.map((s) => s.map((v, e) => v + (e === 0 ? bias : 0)));
    return scores.map((s) => {
      let r: { experts: number[]; gates: number[] };
      try {
        r = route(s, k);
      } catch {
        r = reference(s, k);
      }
      return { ...r, probs: reference(s, k).probs };
    });
  });
  const cap = $derived(Math.max(1, Math.floor((factor * N * k) / E)));
  const load = $derived.by(() => {
    const f = new Array<number>(E).fill(0);
    for (const r of routed) for (const e of r.experts) f[e]!++;
    return f;
  });
  const dropped = $derived(load.reduce((a, c) => a + Math.max(0, c - cap), 0));
  const aux = $derived.by(() => {
    const P = new Array<number>(E).fill(0);
    for (const r of routed) r.probs.forEach((v, e) => (P[e]! += v / N));
    return E * load.reduce((a, c, e) => a + (c / (N * k)) * P[e]!, 0);
  });
  const maxLoad = $derived(Math.max(cap, ...load));
</script>

<Widget
  title="Routing a batch"
  subtitle="64 tokens, 8 experts. Each token goes to its k best-scoring experts. Every expert has room for a fixed number of tokens (the dashed line); tokens beyond it are dropped. Push the router’s favouritism towards expert 0 and watch the balancing loss rise."
  onreset={() => {
    k = 2;
    bias = 0;
    factor = 1.25;
  }}
>
  {#snippet controls()}
    <Segmented label="Top-k" size="sm" options={[1, 2, 4].map((v) => ({ value: v, label: `top-${v}` }))} bind:value={k} />
    <div class="sl"><Slider label="Favouritism for expert 0" min={0} max={4} step={0.05} value={bias} oninput={(v) => (bias = v)} /></div>
    <div class="sl"><Slider label="Capacity factor" min={1} max={3} step={0.05} value={factor} oninput={(v) => (factor = v)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your route().</p>{/if}
  <div class="loads">
    {#each load as c, e (e)}
      <div class="col">
        <div class="bar-area">
          <div class="bar" style:height="{(Math.min(c, cap) / maxLoad) * 100}%" style:background="var(--series-{e + 1})"></div>
          {#if c > cap}<div class="over" style:height="{((c - cap) / maxLoad) * 100}%" style:bottom="{(cap / maxLoad) * 100}%"></div>{/if}
          <div class="capline" style:bottom="{(cap / maxLoad) * 100}%"></div>
        </div>
        <span class="lbl ui">E{e} · {c}</span>
      </div>
    {/each}
  </div>
  <div class="stats ui">
    <span>balancing loss E·Σ f·P = <strong class="num">{aux.toFixed(2)}</strong> (1 when uniform)</span>
    <span>capacity <strong class="num">{cap}</strong> per expert</span>
    <span class:bad={dropped > 0}><strong class="num">{dropped}</strong> of {N * k} routing slots dropped</span>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .loads {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .col {
    text-align: center;
  }
  .bar-area {
    position: relative;
    height: 150px;
    border-bottom: 1px solid var(--rule);
  }
  .bar {
    position: absolute;
    bottom: 0;
    left: 15%;
    width: 70%;
    border-radius: 3px 3px 0 0;
  }
  .over {
    position: absolute;
    left: 15%;
    width: 70%;
    background: repeating-linear-gradient(45deg, var(--critical), var(--critical) 3px, transparent 3px, transparent 6px);
    opacity: 0.7;
  }
  .capline {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1.5px dashed var(--ink-2);
  }
  .lbl {
    font-size: 0.7rem;
    color: var(--ink-2);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.6rem;
  }
  .stats strong {
    color: var(--ink);
  }
  .bad strong {
    color: var(--critical);
  }
</style>
