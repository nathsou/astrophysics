<!--
  Cross-entropy made visible: a validation passage coloured by the model's surprisal at each
  character, −log₂ P(x_t | context). The chapter's headline metric is the average of these colours.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { params, focus } from '$lib/state/params.svelte';
  import { theme } from '$lib/state/theme.svelte';
  import { colorAt, inkOn } from '$lib/gfx/colormap';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { charData, model, smoothingFrom, SMOOTHING_LABELS, type CharData, type SmoothingKind } from '../shared';

  const LEN = 360;
  const MAX_BITS = 8;
  let data = $state<CharData | null>(null);
  let order = $state(3);
  let kind = $state<SmoothingKind>('addk');
  let start = $state(1000);
  let hover = $state<number | null>(null);

  onMount(async () => {
    data = await charData();
  });

  const smoothing = $derived(smoothingFrom(kind, { k: params.get('smooth.k', 0.1), lambda: params.get('smooth.lambda', 0.8), d: params.get('smooth.d', 0.75) }));

  const rows = $derived.by(() => {
    if (!data) return [];
    const m = model(data, order, smoothing);
    const ids = data.val;
    const out: { id: number; p: number; bits: number; top: { id: number; p: number }[] }[] = [];
    for (let t = start; t < start + LEN && t < ids.length; t++) {
      const ctx = ids.slice(Math.max(0, t - m.contextLength), t);
      const dist = m.distribution(ctx);
      const p = dist[ids[t]!]!;
      const top = [...dist.keys()].filter((j) => dist[j]! > 0).sort((a, b) => dist[b]! - dist[a]!).slice(0, 5).map((j) => ({ id: j, p: dist[j]! }));
      out.push({ id: ids[t]!, p, bits: p > 0 ? -Math.log2(p) : Infinity, top });
    }
    return out;
  });

  const mean = $derived(rows.reduce((a, r) => a + r.bits, 0) / Math.max(rows.length, 1));
  const zeros = $derived(rows.filter((r) => r.p === 0).length);
  const bg = (bits: number) => (Number.isFinite(bits) ? colorAt('sequential', theme.resolved, Math.min(bits, MAX_BITS) / MAX_BITS) : 'var(--critical)');
  const fg = (bits: number) => (Number.isFinite(bits) ? inkOn('sequential', theme.resolved, Math.min(bits, MAX_BITS) / MAX_BITS) : '#fff');
  const show = (id: number) => data?.vocab.show(id) ?? '';
  const h = $derived(hover !== null ? rows[hover] : null);
</script>

<Widget
  title="Surprisal, character by character"
  subtitle="A passage the model never saw during training, shaded by −log₂ P(character | context). Dark means surprised. The average shading is the cross-entropy."
>
  {#snippet controls()}
    <div class="grp">
      <span class="lbl">Order n</span>
      <Segmented label="Order" size="sm" options={[1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) }))} bind:value={order} />
    </div>
    <div class="grp">
      <span class="lbl">Smoothing</span>
      <Segmented label="Smoothing" size="sm" options={(['mle', 'addk', 'kn'] as const).map((v) => ({ value: v, label: SMOOTHING_LABELS[v] }))} bind:value={kind} />
    </div>
    <Button onclick={() => (start = Math.floor(Math.random() * ((data?.val.length ?? 10000) - LEN)))}>Another passage</Button>
  {/snippet}

  {#if !data}
    <p class="k">Counting n-grams…</p>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="summary" onpointerenter={() => focus.set('H', 'surprisal')} onpointerleave={() => focus.set(null)}>
      <span class="big num">{Number.isFinite(mean) ? mean.toFixed(3) : '∞'}</span>
      <span>bits per character on this passage</span>
      {#if Number.isFinite(mean)}<span class="pp">perplexity {(2 ** mean).toFixed(2)}</span>{/if}
      {#if zeros}<span class="zero">{zeros} character{zeros > 1 ? 's' : ''} given probability 0 → infinite cross-entropy</span>{/if}
    </div>
    <div class="layout">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <pre class="text" onpointerleave={() => (hover = null)}>{#each rows as r, i (i)}<span
            class="c"
            class:zero={r.p === 0}
            class:hl={hover === i}
            style:background={bg(r.bits)}
            style:color={fg(r.bits)}
            onpointerenter={() => (hover = i)}>{data.vocab.chars[r.id]}</span
          >{/each}</pre>
      <aside>
        {#if h}
          <div class="k">Actual next character <code>{show(h.id)}</code></div>
          <div class="num stat">P = {h.p < 1e-4 ? h.p.toExponential(2) : (h.p * 100).toFixed(2) + '%'} · surprisal {Number.isFinite(h.bits) ? h.bits.toFixed(2) + ' bits' : '∞'}</div>
          <div class="k">What the model expected</div>
          <ul class="dist">
            {#each h.top as t (t.id)}
              <li class:actual={t.id === h.id}><code>{show(t.id)}</code><span class="bar"><span style:width="{t.p * 100}%"></span></span><span class="num">{(t.p * 100).toFixed(1)}%</span></li>
            {/each}
          </ul>
        {:else}
          <p class="k">Hover a character for its probability and the model’s top guesses.</p>
        {/if}
        <div class="scale">
          <span class="num">0</span>
          <span class="ramp" style:background="linear-gradient(to right, {[0, 0.25, 0.5, 0.75, 1].map((t) => colorAt('sequential', theme.resolved, t)).join(',')})"></span>
          <span class="num">{MAX_BITS}+ bits</span>
        </div>
      </aside>
    </div>
  {/if}
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl,
  .k {
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .k {
    margin: 0.2rem 0 0.35rem;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3rem 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.85rem;
    color: var(--ink-2);
    cursor: help;
  }
  .big {
    font-size: 1.8rem;
    font-weight: 650;
    color: var(--ink);
  }
  .pp {
    color: var(--ink);
  }
  .zero {
    color: var(--critical);
    font-weight: 600;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14rem;
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .text {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.75;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .c {
    padding: 0.1em 0;
    cursor: help;
  }
  .c.hl {
    outline: 2px solid var(--ink);
    outline-offset: -1px;
  }
  .c.zero {
    text-decoration: underline wavy;
  }
  .stat {
    font-size: 0.8rem;
    margin-bottom: 0.6rem;
  }
  .dist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .dist li {
    display: grid;
    grid-template-columns: 1.8rem 1fr 3rem;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.78rem;
  }
  .dist li.actual code {
    background: var(--accent-soft);
  }
  .bar {
    height: 9px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--series-1);
    border-radius: 0 3px 3px 0;
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .ramp {
    width: 90px;
    height: 8px;
    border-radius: 4px;
  }
</style>
