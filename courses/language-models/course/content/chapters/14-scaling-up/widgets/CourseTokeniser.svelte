<!--
  CourseGPT's tokeniser: how compression grew with the number of merges while it was trained on
  TinyStories, and how it cuts any text you type (in-domain text is cheap, other text is not).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { BpeTokeniser } from '@lm/core/tokenise';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { courseTokeniser } from '$lib/models/coursegpt';
  import { DATA } from '../data';

  const PRESETS = [
    { label: 'TinyStories', text: 'Once upon a time, there was a little girl named Lily. She loved to play with her big red ball in the park.' },
    { label: 'Shakespeare', text: 'ROMEO: But soft, what light through yonder window breaks? It is the east, and Juliet is the sun!' },
    { label: 'Technical', text: 'The GPU’s tensor cores multiply bfloat16 matrices with float32 accumulation.' },
    { label: 'French', text: 'Il était une fois une petite fille qui aimait jouer dans le jardin.' },
  ];

  let tok = $state<BpeTokeniser | null>(null);
  let error = $state('');
  let text = $state(PRESETS[0]!.text);
  let showIds = $state(false);
  onMount(() => {
    courseTokeniser().then((t) => (tok = t), (e: Error) => (error = e.message));
  });

  const ids = $derived(tok ? tok.encode(text) : []);
  const pieces = $derived(tok ? ids.map((i) => tok!.decode([i]).replaceAll('\n', '↵')) : []);
  const bytes = $derived(new TextEncoder().encode(text).length);
  const curve = DATA.tokeniser.merge_curve;
  const meta = DATA.tokeniser.meta;
  const maxMerges = curve.at(-1)![0];
</script>

<Widget
  title="CourseGPT’s tokeniser"
  subtitle="Byte-level BPE with 8,192 tokens, trained on 100 MB of TinyStories. Left: bytes per token as merges were learned. Right: type anything and see how it is cut."
  onreset={() => (text = PRESETS[0]!.text)}
>
  {#snippet controls()}
    <Toggle bind:checked={showIds} label="Show ids" />
  {/snippet}

  <div class="two">
    <div>
      <Plot label="Bytes per token against the number of merges" height={220} x={{ domain: [0, maxMerges], label: 'merges learned', ticks: 5 }} y={{ domain: [1, 4.5], label: 'bytes per token', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-1)" d={'M' + curve.map(([m, b]) => `${sx(m)},${sy(b)}`).join('L')} />
        {/snippet}
      </Plot>
      <p class="note ui">
        TinyStories has only about 21,500 distinct words and word pieces, so compression saturates: the first 2,000 merges take it from 1 to 3.7 bytes per token, while the last 3,000 add only 0.05. The whole training split becomes {(meta.train.tokens / 1e6).toFixed(0)} million tokens ({meta.train.bytes_per_token.toFixed(2)} bytes each).
      </p>
    </div>
    <div>
      <textarea bind:value={text} rows="3" spellcheck="false" aria-label="Text to tokenise"></textarea>
      <div class="presets">
        {#each PRESETS as p (p.label)}<button class="chip" class:on={p.text === text} onclick={() => (text = p.text)}>{p.label}</button>{/each}
      </div>
      {#if error}
        <p class="muted">{error}</p>
      {:else if tok}
        <p class="stats ui"><strong class="num">{ids.length}</strong> tokens · <strong class="num">{(bytes / Math.max(1, ids.length)).toFixed(2)}</strong> bytes per token</p>
        <div class="tokens">
          {#each pieces as p, i (i)}<span class="tk" class:alt={i % 2 === 1} title="id {ids[i]}">{showIds ? ids[i] : p}</span>{/each}
        </div>
      {:else}
        <p class="muted">Loading the tokeniser…</p>
      {/if}
    </div>
  </div>
</Widget>

<style>
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
  .note,
  .muted {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .note {
    margin: 0.4rem 0 0;
  }
  textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    resize: vertical;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0.4rem 0;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.18rem 0.6rem;
    font-size: 0.74rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .stats {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.3rem 0;
  }
  .stats strong {
    color: var(--ink);
  }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 1px;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .tk {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: pre;
    padding: 0.12rem 0.3rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent-2) 12%, var(--surface));
  }
  .tk.alt {
    background: color-mix(in srgb, var(--accent-2) 24%, var(--surface));
  }
</style>
