<!--
  Experiment: how does vocabulary size change what an n-gram model can do? Train BPE on the
  training split at several sizes, then train Kneser–Ney bigram and trigram models on the tokens and
  measure validation cross-entropy in bits per *character*, so different tokenisers are comparable.
-->
<script lang="ts">
  import { BpeTokeniser, BpeTrainer, COURSE_PATTERN } from '@lm/core/tokenise';
  import { NGramModel, NGramStats } from '@lm/core/ngram';
  import { crossEntropy } from '@lm/core';
  import { loadCorpus } from '$lib/data/corpus';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  const SIZES = [256, 512, 1024, 2048, 4096, 8192];
  type Row = { V: number; bytesPerToken: number; bigram: number; trigram: number; tokens: number };
  let rows: Row[] = $state([]);
  let status = $state('');
  let running = $state(false);

  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    running = true;
    rows = [];
    const text = await loadCorpus('shakespeare');
    const split = Math.floor(text.length * 0.9);
    const train = text.slice(0, split), val = text.slice(split);
    status = 'Training BPE on the training split…';
    await tick();
    const trainer = new BpeTrainer(train, COURSE_PATTERN);
    for (const V of SIZES) {
      const merges = V - 256;
      while (trainer.merges.length < merges) {
        for (let i = 0; i < 250 && trainer.merges.length < merges; i++) trainer.step();
        status = `Training BPE: ${trainer.merges.length} / ${merges} merges`;
        await tick();
      }
      status = `V = ${V}: encoding and counting n-grams…`;
      await tick();
      const tok = new BpeTokeniser({ pattern: COURSE_PATTERN, merges: trainer.merges.slice(0, merges), special: {} });
      const a = tok.encode(train), b = tok.encode(val);
      const stats = new NGramStats(a, tok.vocabSize, 3);
      // Total surprisal over validation tokens, divided by the number of validation characters.
      const bitsPerChar = (n: number) => {
        const r = crossEntropy(new NGramModel(stats, n, { kind: 'kn', d: 0.75 }), b, { start: 1 });
        return (r.crossEntropy * r.count) / val.length;
      };
      rows = [...rows, { V, bytesPerToken: val.length / b.length, bigram: bitsPerChar(2), trigram: bitsPerChar(3), tokens: b.length }];
      await tick();
    }
    status = '';
    running = false;
  }

  const xAxis = { type: 'log' as const, domain: [256, 8192] as [number, number], label: 'Vocabulary size V (log scale)', format: (v: number) => String(v), tickValues: SIZES };
</script>

<Widget
  title="Bigger vocabulary, shorter sequences, longer reach"
  subtitle="BPE tokenisers of six sizes, trained on the training split. For each, Kneser–Ney bigram and trigram models are trained on the tokens and scored in bits per character on held-out text."
  caption="V = 256 means no merges: the model sees raw bytes, identical to Chapter 2’s character model for this ASCII corpus. The dashed line is Chapter 2’s best character model (6-gram, 2.22 bits/char)."
>
  {#snippet controls()}
    <Button variant="primary" onclick={run} disabled={running}>{rows.length ? 'Run again' : 'Run the experiment'}</Button>
    {#if status}<span class="status">{status}</span>{:else if !rows.length}<span class="status">Takes a few seconds; everything runs in your browser.</span>{/if}
  {/snippet}

  <div class="two">
    <div>
      <div class="ttl">Compression: bytes per token (validation)</div>
      <Plot label="Bytes per token against vocabulary size" height={240} x={xAxis} y={{ domain: [0, 3.5], label: 'bytes / token', ticks: 4 }}>
        {#snippet marks({ sx, sy })}
          {#if rows.length}
            <path class="line" stroke="var(--series-1)" d={'M' + rows.map((r) => `${sx(r.V)},${sy(r.bytesPerToken)}`).join('L')} />
            {#each rows as r (r.V)}<circle class="dot" cx={sx(r.V)} cy={sy(r.bytesPerToken)} r="4" fill="var(--series-1)" />{/each}
          {/if}
        {/snippet}
        {#snippet tooltip({ x })}
          {@const r = rows.length ? rows.reduce((a, b) => (Math.abs(Math.log(b.V / x)) < Math.abs(Math.log(a.V / x)) ? b : a)) : null}
          {#if r}<div class="num">V = {r.V}: {r.bytesPerToken.toFixed(2)} bytes/token · {r.tokens.toLocaleString('en-GB')} tokens</div>{/if}
        {/snippet}
      </Plot>
    </div>
    <div>
      <div class="ttl">Validation cross-entropy, bits per character</div>
      <Legend items={[{ label: 'Bigram on tokens', color: 'var(--series-2)' }, { label: 'Trigram on tokens', color: 'var(--series-3)' }]} />
      <Plot label="Validation bits per character against vocabulary size" height={216} x={xAxis} y={{ domain: [2, 3.7], label: 'bits / char', ticks: 4 }}>
        {#snippet marks({ sx, sy })}
          <line x1={sx(256)} x2={sx(8192)} y1={sy(2.22)} y2={sy(2.22)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
          {#each [{ k: 'bigram', c: 'var(--series-2)' }, { k: 'trigram', c: 'var(--series-3)' }] as s (s.k)}
            {#if rows.length}
              <path class="line" stroke={s.c} d={'M' + rows.map((r) => `${sx(r.V)},${sy(r[s.k as 'bigram' | 'trigram'])}`).join('L')} />
              {#each rows as r (r.V)}<circle class="dot" cx={sx(r.V)} cy={sy(r[s.k as 'bigram' | 'trigram'])} r="4" fill={s.c} />{/each}
            {/if}
          {/each}
        {/snippet}
        {#snippet tooltip({ x })}
          {@const r = rows.length ? rows.reduce((a, b) => (Math.abs(Math.log(b.V / x)) < Math.abs(Math.log(a.V / x)) ? b : a)) : null}
          {#if r}<div class="num">V = {r.V}: bigram {r.bigram.toFixed(3)} · trigram {r.trigram.toFixed(3)} bits/char</div>{/if}
        {/snippet}
      </Plot>
    </div>
  </div>
  {#if !rows.length && !running}<p class="status">Press “Run the experiment”.</p>{/if}
</Widget>

<style>
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 760px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .ttl {
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  .status {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
