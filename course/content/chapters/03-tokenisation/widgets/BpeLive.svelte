<!--
  Watch byte-pair encoding learn: each step merges the most frequent adjacent pair in the corpus.
  Shows the next candidate, the merge history, the running compression and a sample re-tokenised.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { BpeTokeniser, BpeTrainer, COURSE_PATTERN, type MergeStep } from '@lm/core/tokenise';
  import { loadCorpus } from '$lib/data/corpus';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';

  const SAMPLE = 'KING HENRY: Once more unto the breach, dear friends, once more;';
  let source: 'shakespeare' | 'custom' = $state('shakespeare');
  let custom = $state('low lower lowest newer newest wider widest low low lower newest newest');
  let trainer: BpeTrainer | null = $state(null);
  let version = $state(0); // bumps after each batch of merges so derived views refresh
  let running = $state(false);
  let history: { merges: number; bpt: number }[] = $state([]);

  async function reset() {
    running = false;
    const text = source === 'shakespeare' ? await loadCorpus('shakespeare') : custom;
    trainer = new BpeTrainer(text, COURSE_PATTERN);
    history = [{ merges: 0, bpt: 1 }];
    version++;
  }
  onMount(reset);

  async function advance(n: number) {
    if (!trainer || running) return;
    running = true;
    const target = trainer.merges.length + n;
    while (running && trainer.merges.length < target) {
      const batch = Math.min(Math.max(1, Math.ceil(n / 60)), target - trainer.merges.length);
      let done = false;
      for (let i = 0; i < batch; i++) if (!trainer.step()) done = true;
      history = [...history, { merges: trainer.merges.length, bpt: trainer.totalBytes / trainer.totalTokens }];
      version++;
      if (done) break;
      await new Promise((r) => setTimeout(r, n > 20 ? 16 : 250));
    }
    running = false;
  }

  const tok = $derived.by(() => {
    void version;
    return trainer ? new BpeTokeniser({ pattern: COURSE_PATTERN, merges: [...trainer.merges], special: {} }) : null;
  });
  const next = $derived.by(() => {
    void version;
    return trainer?.peek() ?? null;
  });
  const recent = $derived.by((): MergeStep[] => {
    void version;
    return trainer ? trainer.steps.slice(-12).reverse() : [];
  });
  const mergeCount = $derived.by(() => {
    void version;
    return trainer?.merges.length ?? 0;
  });
  const sampleText = $derived(source === 'shakespeare' ? SAMPLE : custom.split(' ').slice(0, 8).join(' '));
  const sampleTokens = $derived(tok ? tok.encode(sampleText) : []);
  const show = (id: number) => tok?.show(id) ?? '';
</script>

<Widget
  title="Watch BPE learn"
  subtitle="Start from raw UTF-8 bytes. Each step finds the most frequent adjacent pair of tokens in the whole corpus and fuses it into a new token."
  onreset={reset}
>
  {#snippet controls()}
    <Segmented
      label="Corpus"
      size="sm"
      options={[
        { value: 'shakespeare', label: 'TinyShakespeare' },
        { value: 'custom', label: 'Your text' },
      ]}
      bind:value={source}
      onchange={reset}
    />
    <Button variant="primary" onclick={() => advance(1)} disabled={!trainer || running}>Merge once</Button>
    <Button onclick={() => advance(10)} disabled={!trainer || running}>+10</Button>
    <Button onclick={() => advance(200)} disabled={!trainer || running}>+200</Button>
    {#if running}<Button variant="ghost" onclick={() => (running = false)}>Stop</Button>{/if}
  {/snippet}

  {#if source === 'custom'}
    <textarea bind:value={custom} rows="2" spellcheck="false" onchange={reset} aria-label="Training text"></textarea>
  {/if}

  {#if trainer && tok}
    <div class="grid">
      <div>
        <div class="k">Next merge</div>
        {#if next}
          <div class="next">
            <code>{show(next.pair[0])}</code> + <code>{show(next.pair[1])}</code> →
            <code class="new">{show(next.pair[0])}{show(next.pair[1])}</code>
            <span class="muted num">occurs {next.count.toLocaleString('en-GB')}×, becomes token {256 + mergeCount}</span>
          </div>
        {:else}
          <div class="muted">No pairs left to merge.</div>
        {/if}

        <div class="k">Recent merges ({mergeCount} so far · vocabulary {256 + mergeCount})</div>
        <ol class="hist" reversed start={mergeCount}>
          {#each recent as s (s.id)}
            <li><code>{show(s.pair[0])}</code>+<code>{show(s.pair[1])}</code> → <code class="new">{show(s.id)}</code> <span class="muted num">{s.count.toLocaleString('en-GB')}</span></li>
          {:else}
            <li class="muted">none yet — every token is a single byte</li>
          {/each}
        </ol>
      </div>
      <div>
        <div class="k">Sample, re-tokenised ({sampleTokens.length} tokens for {[...sampleText].length} characters)</div>
        <div class="tokens">
          {#each sampleTokens as id, i (i)}<span class="tk" class:alt={i % 2 === 1}>{show(id)}</span>{/each}
        </div>
        <div class="k">Compression: bytes per token over the whole corpus</div>
        <Plot
          label="Bytes per token against number of merges"
          height={170}
          margin={{ top: 8, right: 12, bottom: 36, left: 40 }}
          x={{ domain: [0, Math.max(10, history.at(-1)?.merges ?? 10)], label: 'merges', nice: true, ticks: 4 }}
          y={{ domain: [1, Math.max(1.5, (history.at(-1)?.bpt ?? 1) * 1.1)], label: 'bytes / token', ticks: 4, nice: true }}
        >
          {#snippet marks({ sx, sy })}
            <path class="line" stroke="var(--series-1)" d={'M' + history.map((h) => `${sx(h.merges)},${sy(h.bpt)}`).join('L')} />
          {/snippet}
          {#snippet tooltip({ x })}
            {@const h = history.reduce((a, b) => (Math.abs(b.merges - x) < Math.abs(a.merges - x) ? b : a))}
            <div class="num">{h.merges} merges · {h.bpt.toFixed(2)} bytes/token</div>
          {/snippet}
        </Plot>
      </div>
    </div>
  {:else}
    <p class="muted">Loading corpus…</p>
  {/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 1.5rem;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .k {
    font-size: 0.74rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0.35rem;
  }
  .muted {
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  code {
    white-space: pre;
  }
  .next {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    padding: 0.5rem 0.7rem;
    background: var(--accent-soft);
    border-radius: 8px;
  }
  .new {
    background: color-mix(in srgb, var(--series-2) 22%, var(--surface)) !important;
  }
  .hist {
    margin: 0;
    padding-left: 2.6rem;
    font-size: 0.8rem;
    display: grid;
    gap: 2px;
    max-height: 16rem;
    overflow: auto;
  }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 1px;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .tk {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    white-space: pre;
    padding: 0.1rem 0.25rem;
    margin-right: 1px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent-2) 12%, var(--surface));
  }
  .tk.alt {
    background: color-mix(in srgb, var(--accent-2) 24%, var(--surface));
  }
  textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    margin-bottom: 0.5rem;
  }
</style>
