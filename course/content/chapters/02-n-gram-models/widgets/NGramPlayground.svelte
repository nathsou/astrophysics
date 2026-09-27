<script lang="ts">
  import { onMount } from 'svelte';
  import { sampleIndex, mulberry32 } from '@lm/core';
  import { impl } from '$lib/exercise/impl.svelte';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { charData, model, smoothingFrom, SMOOTHING_LABELS, type CharData, type SmoothingKind } from '../shared';

  let data: CharData | null = $state(null);
  let order = $state(4);
  let kind: SmoothingKind = $state('kn');
  let prompt = $state('ROMEO:\n');
  let seed = $state(1);
  let out: { id: number; ctx: number[]; top: { id: number; p: number }[]; p: number }[] = $state([]);
  let promptIds: number[] = $state([]);
  let selected: number | null = $state(null);
  let copied: Set<number> = $state(new Set());
  let busy = $state(false);
  let checked = $state(false);

  onMount(async () => {
    data = await charData();
    generate();
  });

  const smoothing = $derived(smoothingFrom(kind, { k: params.get('smooth.k', 0.1), lambda: params.get('smooth.lambda', 0.8), d: params.get('smooth.d', 0.75) }));
  const m = $derived(data ? model(data, order, smoothing) : null);
  const sample = $derived(impl.get('lm.sampleIndex', sampleIndex));

  function encodePrompt(): number[] {
    if (!data) return [];
    return [...prompt].filter((c) => data!.vocab.chars.includes(c)).map((c) => data!.vocab.encode(c)[0]!);
  }

  async function generate(steps = 400) {
    if (!data || !m || busy) return;
    busy = true;
    copied = new Set();
    checked = false;
    selected = null;
    promptIds = encodePrompt();
    const rng = mulberry32(seed);
    const seq = [...promptIds];
    const res: typeof out = [];
    for (let i = 0; i < steps; i++) {
      const ctx = seq.slice(Math.max(0, seq.length - m.contextLength));
      const dist = m.distribution(ctx);
      const id = sample(dist, rng());
      const top = [...dist.keys()].filter((j) => dist[j]! > 0).sort((a, b) => dist[b]! - dist[a]!).slice(0, 8).map((j) => ({ id: j, p: dist[j]! }));
      res.push({ id, ctx, top, p: dist[id]! });
      seq.push(id);
      if (i % 50 === 49) {
        out = [...res];
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    out = res;
    busy = false;
  }

  /** Mark generated characters that sit inside a ≥ 15-character passage copied verbatim from training. */
  function findCopies() {
    if (!data) return;
    const trainText = data.vocab.decode(data.train);
    const gen = data.vocab.decode(out.map((o) => o.id));
    const W = 15;
    const marks = new Set<number>();
    for (let i = 0; i + W <= gen.length; i++) if (trainText.includes(gen.slice(i, i + W))) for (let j = i; j < i + W; j++) marks.add(j);
    copied = marks;
    checked = true;
  }

  const show = (id: number) => data?.vocab.show(id) ?? '';
  const sel = $derived(selected !== null ? out[selected] : null);
  const tableInfo = $derived(data ? `${data.stats.table(order).codes.length.toLocaleString('en-GB')} distinct ${order}-grams` : '');
</script>

<Widget
  title="Generating Shakespeare with n-grams"
  subtitle="Pick the order n and a smoothing method, then generate. Click any generated character to see the context the model used and the distribution it sampled from."
  onreset={() => {
    order = 4;
    kind = 'kn';
    prompt = 'ROMEO:\n';
    seed = 1;
    generate();
  }}
>
  {#snippet controls()}
    <div class="grp">
      <span class="lbl">Order n</span>
      <Segmented label="Order" size="sm" options={[1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) }))} bind:value={order} onchange={() => generate()} />
    </div>
    <div class="grp">
      <span class="lbl">Smoothing</span>
      <Segmented label="Smoothing" size="sm" options={(['mle', 'addk', 'interp', 'kn'] as const).map((v) => ({ value: v, label: SMOOTHING_LABELS[v] }))} bind:value={kind} onchange={() => generate()} />
    </div>
    <label class="grp">
      <span class="lbl">Prompt</span>
      <input bind:value={prompt} spellcheck="false" />
    </label>
    <Button variant="primary" onclick={() => generate()} disabled={!data || busy}>Generate</Button>
    <Button onclick={() => ((seed += 1), generate())} disabled={!data || busy}>New sample</Button>
    <Button variant="ghost" onclick={findCopies} disabled={!out.length}>Highlight copied text</Button>
  {/snippet}

  {#if !data}
    <p class="muted">Counting n-grams in 1 million characters…</p>
  {:else}
    <div class="meta">
      {tableInfo} · seed {seed}
      {#if impl.isMine('lm.sampleIndex')} · <span class="mine">your sampleIndex</span>{/if}
      {#if copied.size || checked}· <span class="copy-key">highlighted</span> = inside a 15+ character passage that appears verbatim in the training text ({Math.round((copied.size / Math.max(1, out.length)) * 100)}% of output){/if}
    </div>
    <div class="layout">
      <pre class="gen"><span class="prompt">{data.vocab.decode(promptIds)}</span>{#each out as o, i (i)}<span
            class="c"
            class:sel={selected === i}
            class:copied={copied.has(i)}
            role="button"
            tabindex="-1"
            onclick={() => (selected = i)}
            onkeydown={() => {}}>{data.vocab.chars[o.id]}</span
          >{/each}</pre>
      <aside class="inspect">
        {#if sel}
          <div class="k">Context ({sel.ctx.length} of n − 1 = {order - 1} characters)</div>
          <div class="ctx">{#each sel.ctx as c, j (j)}<span>{show(c)}</span>{/each}<span class="q">?</span></div>
          <div class="k">P(next | context) — top 8</div>
          <ul class="dist">
            {#each sel.top as t (t.id)}
              <li class:picked={t.id === sel.id}>
                <code>{show(t.id)}</code>
                <span class="bar"><span style:width="{t.p * 100}%"></span></span>
                <span class="num">{(t.p * 100).toFixed(1)}%</span>
              </li>
            {/each}
          </ul>
          <div class="k">Sampled <code>{show(sel.id)}</code> with probability {(sel.p * 100).toFixed(2)}%</div>
        {:else}
          <p class="k">Click a generated character to inspect the prediction behind it.</p>
          <p class="k">Try n = 1, 3, 5 and 8. Watch the text go from letter soup, to word-like, to fluent — and then check how much of the fluent text is copied.</p>
        {/if}
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
  .lbl {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  input {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    width: 9rem;
  }
  .muted,
  .meta {
    font-size: 0.78rem;
    color: var(--ink-3);
  }
  .meta {
    margin-bottom: 0.5rem;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .gen {
    margin: 0;
    padding: 0.8rem 1rem;
    background: var(--surface-2);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.55;
    white-space: pre-wrap;
    max-height: 22rem;
    overflow: auto;
  }
  .prompt {
    color: var(--ink-3);
  }
  .c {
    cursor: pointer;
    border-radius: 2px;
  }
  .c:hover {
    background: var(--term-hl);
  }
  .c.sel {
    background: var(--term-hl-strong);
    outline: 1px solid var(--accent-2);
  }
  .c.copied,
  .copy-key {
    background: color-mix(in srgb, var(--series-2) 28%, transparent);
  }
  .copy-key {
    padding: 0 0.3rem;
    border-radius: 3px;
    color: var(--ink);
  }
  .mine {
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.4rem;
    border-radius: 99px;
    color: var(--ink);
  }
  .k {
    font-size: 0.76rem;
    color: var(--ink-2);
    margin: 0.2rem 0 0.35rem;
  }
  .ctx {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-bottom: 0.6rem;
  }
  .ctx span {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    background: var(--surface-2);
    padding: 0 0.25rem;
    border-radius: 3px;
  }
  .ctx .q {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .dist {
    list-style: none;
    margin: 0 0 0.5rem;
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
  .dist li.picked code {
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
</style>
