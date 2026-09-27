<!--
  A word-level bigram model of a tiny, editable corpus, drawn as a Markov chain. Edges are
  transition probabilities P(next | current); a random walk generates text one edge at a time.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { sampleIndex, mulberry32 } from '@lm/core';
  import { impl } from '$lib/exercise/impl.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  const DEFAULT = 'the cat sat on the mat . the dog sat on the log . the cat saw the dog . the dog saw a cat on the mat .';
  let corpus = $state(DEFAULT);
  let current = $state('.');
  let walk = $state<string[]>([]);
  let hoverEdge = $state<string | null>(null);
  let running = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  const rng = mulberry32(Date.now() & 0xffff);

  const model = $derived.by(() => {
    const ws = corpus.toLowerCase().split(/\s+/).filter(Boolean);
    const types = [...new Set(ws)];
    const counts = new Map<string, Map<string, number>>();
    for (let i = 0; i + 1 < ws.length; i++) {
      const row = counts.get(ws[i]!) ?? new Map<string, number>();
      row.set(ws[i + 1]!, (row.get(ws[i + 1]!) ?? 0) + 1);
      counts.set(ws[i]!, row);
    }
    const probs = new Map<string, { to: string; p: number; c: number }[]>();
    for (const [from, row] of counts) {
      const tot = [...row.values()].reduce((a, b) => a + b, 0);
      probs.set(from, [...row].map(([to, c]) => ({ to, p: c / tot, c })).sort((a, b) => b.p - a.p));
    }
    return { types, probs, tokens: ws.length };
  });

  // Circular layout.
  const W = 560, H = 360, R = 140;
  const pos = $derived(new Map(model.types.map((t, i) => [t, { x: W / 2 + R * 1.45 * Math.cos((2 * Math.PI * i) / model.types.length - Math.PI / 2), y: H / 2 + R * Math.sin((2 * Math.PI * i) / model.types.length - Math.PI / 2) }])));

  function edgePath(a: string, b: string): string {
    const p = pos.get(a)!, q = pos.get(b)!;
    if (a === b) return `M${p.x - 8},${p.y - 16} C${p.x - 40},${p.y - 70} ${p.x + 40},${p.y - 70} ${p.x + 8},${p.y - 16}`;
    // Curve away from the centre so a→b and b→a do not overlap.
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = 0.18 * len;
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    // Stop short of the target node.
    const ex = q.x - (q.x - cx) * (22 / Math.hypot(q.x - cx, q.y - cy)), ey = q.y - (q.y - cy) * (22 / Math.hypot(q.x - cx, q.y - cy));
    return `M${p.x},${p.y} Q${cx},${cy} ${ex},${ey}`;
  }

  const sample = $derived(impl.get('lm.sampleIndex', sampleIndex));

  function step() {
    const out = model.probs.get(current);
    if (!out?.length) {
      current = model.types[0] ?? '.';
      return;
    }
    const i = sample(out.map((o) => o.p), rng());
    current = out[i]!.to;
    walk = [...walk.slice(-40), current];
  }

  function toggleRun() {
    running = !running;
    clearInterval(timer);
    if (running) timer = setInterval(step, 550);
  }
  onDestroy(() => clearInterval(timer));

  const outgoing = $derived(model.probs.get(current) ?? []);
</script>

<Widget
  title="A bigram model is a Markov chain"
  subtitle="Each word is a state; each arrow is P(next | current), estimated by counting. Step the random walk, or edit the corpus and watch the probabilities change."
  onreset={() => {
    corpus = DEFAULT;
    walk = [];
    current = '.';
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={step}>Step</Button>
    <Button onclick={toggleRun}>{running ? 'Pause' : 'Run'}</Button>
    <Button variant="ghost" onclick={() => (walk = [])}>Clear text</Button>
    {#if impl.isMine('lm.sampleIndex')}<span class="mine">sampling with your sampleIndex</span>{/if}
  {/snippet}

  <div class="layout">
    <svg viewBox="0 0 {W} {H}" class="graph" role="img" aria-label="Directed graph of word transitions">
      <defs>
        <marker id="mc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
        </marker>
        <marker id="mc-arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--series-2)" />
        </marker>
      </defs>
      {#if model.types.length <= 18}
        {#each [...model.probs] as [from, outs] (from)}
          {#each outs as o (o.to)}
            {@const hot = from === current}
            {@const key = `${from}→${o.to}`}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <path
              d={edgePath(from, o.to)}
              class="edge"
              class:hot
              class:dim={hoverEdge !== null && hoverEdge !== key}
              stroke-width={1 + o.p * 4}
              marker-end={hot ? 'url(#mc-arrow-hot)' : 'url(#mc-arrow)'}
              onpointerenter={() => (hoverEdge = key)}
              onpointerleave={() => (hoverEdge = null)}
            >
              <title>P({o.to} | {from}) = {o.c}/{Math.round(o.c / o.p)} = {o.p.toFixed(2)}</title>
            </path>
          {/each}
        {/each}
        {#each model.types as t (t)}
          {@const p = pos.get(t)!}
          <g class="node" class:cur={t === current} transform="translate({p.x},{p.y})">
            <circle r="21" />
            <text dy="0.35em" text-anchor="middle">{t}</text>
          </g>
        {/each}
      {:else}
        <text x={W / 2} y={H / 2} text-anchor="middle" class="warn">{model.types.length} word types — too many to draw. Try a shorter corpus.</text>
      {/if}
    </svg>

    <div class="side">
      <div class="k">From <code>{current}</code>, the next word is…</div>
      <ul class="dist">
        {#each outgoing as o (o.to)}
          <li>
            <code>{o.to}</code>
            <span class="bar"><span style:width="{o.p * 100}%"></span></span>
            <span class="num">{o.c}/{Math.round(o.c / o.p)}</span>
          </li>
        {:else}
          <li class="k">no outgoing transitions (end of corpus)</li>
        {/each}
      </ul>
      <div class="k">Generated</div>
      <p class="walk">{walk.join(' ') || '—'}</p>
    </div>
  </div>

  <label class="corpus">
    <span>Corpus ({model.tokens} tokens, {model.types.length} types)</span>
    <textarea bind:value={corpus} rows="2" spellcheck="false"></textarea>
  </label>
</Widget>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .graph {
    width: 100%;
    height: auto;
  }
  .edge {
    fill: none;
    stroke: var(--axis);
    transition: stroke 150ms, opacity 150ms;
    cursor: help;
  }
  .edge.hot {
    stroke: var(--series-2);
  }
  .edge.dim {
    opacity: 0.25;
  }
  .node circle {
    fill: var(--surface);
    stroke: var(--rule-strong);
    stroke-width: 1.5;
  }
  .node text {
    font-size: 12px;
    font-family: var(--font-mono);
    fill: var(--ink);
  }
  .node.cur circle {
    fill: var(--accent-soft);
    stroke: var(--series-2);
    stroke-width: 2.5;
  }
  .warn {
    fill: var(--ink-2);
    font-size: 13px;
  }
  .k {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-bottom: 0.3rem;
  }
  .dist {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  .dist li {
    display: grid;
    grid-template-columns: 3.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .bar {
    height: 10px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--series-2);
    border-radius: 0 3px 3px 0;
  }
  .walk {
    font-family: var(--font-body);
    font-size: 1rem;
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    min-height: 3.2rem;
    margin: 0;
  }
  .corpus {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.75rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  textarea {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    resize: vertical;
  }
  .mine {
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.5rem;
    border-radius: 99px;
  }
</style>
