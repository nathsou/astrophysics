<!--
  Sampling the next token: logits → softmax (with temperature) → a categorical distribution, sampled
  by the inverse-CDF method: draw u ~ Uniform(0, 1) and take the token whose cumulative interval contains it.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { params } from '$lib/state/params.svelte';

  const TOKENS = [' the', ' a', ' his', ' my', ' that', ' thy'];
  const LOGITS = [2.1, 1.3, 0.9, 0.6, 0.1, -0.4];
  const T = $derived(params.get('prob.temperature', 1));
  const p = $derived.by(() => {
    const z = LOGITS.map((l) => l / Math.max(T, 1e-3));
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  });
  const cdf = $derived(p.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []));
  const entropy = $derived(-p.reduce((a, v) => a + (v > 0 ? v * Math.log2(v) : 0), 0));

  let rng = mulberry32(7);
  let u = $state<number | null>(null);
  let counts = $state(new Array(TOKENS.length).fill(0));
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const pick = (x: number) => cdf.findIndex((c) => x < c);

  function draw(n: number) {
    const c = [...counts];
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = rng();
      c[Math.max(0, pick(last))]!++;
    }
    u = last;
    counts = c;
  }
  function clear() {
    counts = new Array(TOKENS.length).fill(0);
    u = null;
    rng = mulberry32(7);
  }
  const chosen = $derived(u === null ? -1 : pick(u));
  const color = (i: number) => `var(--series-${i + 1})`;
</script>

<Widget
  title="Sampling a token"
  subtitle="“My lord, I will not see …”: six candidate continuations with fixed logits. Temperature reshapes the distribution; sampling draws u uniformly from [0, 1) and picks the token whose slice of the cumulative bar contains it."
  onreset={() => {
    params.set('prob.temperature', 1);
    clear();
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="temperature T" min={0.05} max={3} step={0.01} log value={T} oninput={(v) => (params.set('prob.temperature', v), clear())} format={(v) => v.toFixed(2)} /></div>
    <Button variant="primary" onclick={() => draw(1)}>Sample 1</Button>
    <Button onclick={() => draw(1000)}>Sample 1,000</Button>
    <Button variant="ghost" onclick={clear}>Clear</Button>
  {/snippet}

  <div class="cum ui" role="img" aria-label="Cumulative distribution as a bar from 0 to 1">
    {#each p as v, i (i)}
      <div class="seg" class:on={i === chosen} style:width="{v * 100}%" style:background={color(i)} title="{TOKENS[i]}: {v.toFixed(3)}">
        {#if v > 0.07}<span>{TOKENS[i]!.trim()}</span>{/if}
      </div>
    {/each}
    {#if u !== null}<div class="u" style:left="{u * 100}%"><span>u = {u.toFixed(3)}</span></div>{/if}
  </div>
  <div class="ticks ui"><span>0</span><span>1</span></div>

  <table class="dist num ui">
    <thead><tr><th>token</th><th>logit</th><th>P = softmax(logit / T)</th><th>sampled frequency{total ? ` (n = ${total.toLocaleString('en-GB')})` : ''}</th></tr></thead>
    <tbody>
      {#each TOKENS as t, i (t)}
        <tr class:on={i === chosen}>
          <td><span class="sw" style:background={color(i)}></span><code>"{t}"</code></td>
          <td>{LOGITS[i]!.toFixed(1)}</td>
          <td><span class="bar" style:width="{p[i]! * 60}%" style:background={color(i)}></span>{p[i]!.toFixed(3)}</td>
          <td>{#if total}<span class="bar hollow" style:width="{(counts[i]! / total) * 60}%" style:border-color={color(i)}></span>{(counts[i]! / total).toFixed(3)}{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note ui">
    Entropy of the distribution: <strong class="num">{entropy.toFixed(2)} bits</strong>{T < 0.3 ? ' — nearly deterministic: the top token almost always wins.' : T > 2 ? ' — close to uniform over the six tokens (2.58 bits).' : '.'}
    With 1,000 samples, frequencies land within about ±0.03 of the probabilities: the standard error of a frequency is √(p(1 − p)/n).
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .cum {
    position: relative;
    display: flex;
    height: 2.2rem;
    border-radius: 6px;
    overflow: visible;
    margin-top: 1.4rem;
    gap: 2px;
  }
  .seg {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--on-accent);
    font: 600 0.72rem var(--font-mono);
    opacity: 0.85;
    min-width: 1px;
  }
  .seg:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg.on {
    opacity: 1;
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .u {
    position: absolute;
    top: -0.5rem;
    bottom: -0.3rem;
    width: 2px;
    background: var(--ink);
  }
  .u span {
    position: absolute;
    top: -1.2rem;
    left: 50%;
    transform: translateX(-50%);
    font: 600 0.7rem var(--font-mono);
    white-space: nowrap;
  }
  .ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--ink-3);
    margin: 0.2rem 0 0.8rem;
  }
  .dist {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .dist th {
    text-align: left;
    font-weight: 600;
    color: var(--ink-2);
    font-size: 0.72rem;
  }
  .dist td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .dist tr.on td {
    background: var(--surface-2);
  }
  .bar {
    display: inline-block;
    height: 10px;
    vertical-align: middle;
    margin-right: 0.4rem;
    border-radius: 0 3px 3px 0;
  }
  .bar.hollow {
    background: transparent;
    border: 2px solid;
    box-sizing: border-box;
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
