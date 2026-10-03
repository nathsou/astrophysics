<script lang="ts">
  /** Early pictures and the characters they became. Tap a card to turn it over. */
  import { PICTOGRAPHS } from '$content/data/characters';
  import { lookup } from '$lib/zh/lexicon';
  import { annotate } from '$lib/zh/annotate';
  import { speech } from '$lib/audio/speech.svelte';

  let { only = '' }: { only?: string } = $props();
  const items = $derived(only ? PICTOGRAPHS.filter((p) => only.includes(p.ch)) : PICTOGRAPHS);
  let flipped = $state<Set<string>>(new Set());

  function flip(ch: string) {
    const next = new Set(flipped);
    if (next.has(ch)) next.delete(ch);
    else {
      next.add(ch);
      void speech.say(ch);
    }
    flipped = next;
  }
  const py = (ch: string) => annotate(ch)[0]?.s?.[0];
</script>

<figure class="pics">
  <div class="grid">
    {#each items as p (p.ch)}
      {@const s = py(p.ch)}
      <button class="pic" class:flipped={flipped.has(p.ch)} onclick={() => flip(p.ch)} aria-label={flipped.has(p.ch) ? `${p.ch}, ${lookup(p.ch)?.g ?? ''}` : `Picture: ${p.story} Tap to reveal.`}>
        <span class="face front">
          <svg viewBox="0 0 100 100" aria-hidden="true"><path d={p.sketch} /></svg>
          <span class="q ui">?</span>
        </span>
        <span class="face back">
          <span class="ch zh-font">{p.ch}</span>
          <span class="py t{s?.tone ?? 5}">{s?.py}</span>
          <span class="g">{p.story}</span>
        </span>
      </button>
    {/each}
  </div>
  <figcaption class="ui">Guess what each picture shows, then tap to see the character it became. <button class="link" onclick={() => (flipped = flipped.size ? new Set() : new Set(items.map((i) => i.ch)))}>{flipped.size ? 'Turn all back' : 'Reveal all'}</button></figcaption>
</figure>

<style>
  .pics {
    margin: 1.6rem 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.55rem;
  }
  .pic {
    position: relative;
    aspect-ratio: 4 / 5;
    border: none;
    padding: 0;
    background: none;
    cursor: pointer;
    perspective: 600px;
  }
  .face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.1rem;
    border-radius: 14px;
    border: 1.5px solid var(--line);
    backface-visibility: hidden;
    transition: transform 400ms ease;
    padding: 0.4rem;
  }
  .front {
    background: var(--gold-soft);
  }
  .back {
    background: var(--panel);
    transform: rotateY(180deg);
  }
  .flipped .front {
    transform: rotateY(-180deg);
  }
  .flipped .back {
    transform: rotateY(0);
  }
  svg {
    width: 76%;
  }
  path {
    fill: none;
    stroke: #8a5a1c;
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  :global([data-theme='dark']) path {
    stroke: var(--gold);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) path {
      stroke: var(--gold);
    }
  }
  .q {
    position: absolute;
    top: 0.4rem;
    right: 0.6rem;
    font-weight: 700;
    color: var(--gold);
  }
  .ch {
    font-size: 2.6rem;
    line-height: 1.1;
    color: var(--fg);
  }
  .py {
    font-family: var(--font-py);
    font-weight: 700;
    color: var(--tone);
  }
  .g {
    font-family: var(--font-body);
    font-size: 0.74rem;
    line-height: 1.3;
    color: var(--ink-2);
    text-align: center;
  }
  figcaption {
    margin-top: 0.6rem;
    font-size: 0.82rem;
    color: var(--mute);
  }
  .link {
    border: none;
    background: none;
    color: var(--accent-ink);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
  }
</style>
