<script lang="ts">
  /**
   * A short dialogue. Play it through, or shadow it: each line plays, then the course waits for
   * you to say it back before moving on (the single most useful speaking drill there is).
   */
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import Zh from './Zh.svelte';
  import PlayButton from './PlayButton.svelte';
  import Icon from '../ui/Icon.svelte';

  let { title = null, lines }: { title?: string | null; lines: { who: string; zh: string; en?: string }[] } = $props();

  const speakers = $derived([...new Set(lines.map((l) => l.who))]);
  let showEn = $state<boolean | null>(null);
  const englishShown = $derived(showEn ?? settings.data.translations);
  let revealed = $state<Set<number>>(new Set());
  let current = $state(-1);
  let mode = $state<'idle' | 'play' | 'shadow'>('idle');
  let yourTurn = $state(false);

  async function run(kind: 'play' | 'shadow') {
    if (mode !== 'idle') {
      mode = 'idle';
      speech.stop();
      current = -1;
      yourTurn = false;
      return;
    }
    mode = kind;
    for (let i = 0; i < lines.length; i++) {
      if (mode !== kind) return;
      current = i;
      const start = performance.now();
      await speech.say(lines[i]!.zh);
      if (mode !== kind) return;
      if (kind === 'shadow') {
        yourTurn = true;
        const pause = Math.max(1500, (performance.now() - start) * 1.4);
        await new Promise((r) => setTimeout(r, pause));
        yourTurn = false;
      } else await new Promise((r) => setTimeout(r, 400));
    }
    mode = 'idle';
    current = -1;
  }
</script>

<figure class="dialogue card">
  <figcaption class="ui">
    <span class="title">{title ?? 'Dialogue'}</span>
    <span class="tools">
      <button class="btn small" onclick={() => run('play')} disabled={mode === 'shadow'}>
        <Icon name={mode === 'play' ? 'stop' : 'play'} size={14} />{mode === 'play' ? 'Stop' : 'Play'}
      </button>
      <button class="btn small" onclick={() => run('shadow')} disabled={mode === 'play'} title="Each line plays, then pauses so you can say it back">
        <Icon name={mode === 'shadow' ? 'stop' : 'mic'} size={14} />{mode === 'shadow' ? 'Stop' : 'Shadow'}
      </button>
      <button class="btn small ghost" aria-pressed={englishShown} onclick={() => (showEn = !englishShown)}>
        <Icon name="eye" size={14} />English
      </button>
    </span>
  </figcaption>
  <ol>
    {#each lines as l, i (i)}
      <li class:right={speakers.indexOf(l.who) % 2 === 1} class:current={current === i}>
        <span class="who ui">{l.who}</span>
        <div class="bubble">
          <div class="line"><Zh text={l.zh} size="md" play={false} /><PlayButton text={l.zh} small /></div>
          {#if l.en}
            {#if englishShown || revealed.has(i)}
              <p class="en">{l.en}</p>
            {:else}
              <button class="reveal ui" onclick={() => (revealed = new Set([...revealed, i]))}>Show English</button>
            {/if}
          {/if}
          {#if current === i && yourTurn}<p class="turn ui"><Icon name="mic" size={14} /> Your turn: say it back</p>{/if}
        </div>
      </li>
    {/each}
  </ol>
</figure>

<style>
  .dialogue {
    margin: 1.6rem 0;
    padding: 0.8rem 1rem 1rem;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  .title {
    font-weight: 700;
    font-size: 0.9rem;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }
  li {
    display: grid;
    justify-items: start;
    gap: 0.15rem;
  }
  li.right {
    justify-items: end;
  }
  .who {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--mute);
    padding: 0 0.6rem;
  }
  .bubble {
    max-width: min(34rem, 92%);
    background: var(--pn);
    border-radius: 16px 16px 16px 4px;
    padding: 0.45rem 0.8rem 0.5rem;
    transition: box-shadow 150ms, background-color 150ms;
  }
  .right .bubble {
    border-radius: 16px 16px 4px 16px;
    background: var(--accent-soft);
  }
  .current .bubble {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.2rem;
  }
  .en {
    margin: 0.15rem 0 0;
    font-size: 0.92rem;
    color: var(--ink-2);
    font-style: italic;
  }
  .reveal {
    margin-top: 0.15rem;
    border: none;
    background: none;
    padding: 0;
    font-size: 0.78rem;
    color: var(--mute);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .turn {
    margin: 0.3rem 0 0;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent-ink);
    animation: pulse 1s ease-in-out infinite alternate;
  }
  @keyframes pulse {
    from {
      opacity: 0.55;
    }
  }
</style>
