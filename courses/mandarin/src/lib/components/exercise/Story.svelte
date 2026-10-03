<script lang="ts">
  /**
   * A graded reader. Every word is tappable; the English is one tap away but hidden by default,
   * because guessing from context is the skill being trained. Questions follow.
   */
  import type { Story } from '$lib/exercises/types';
  import { speech } from '$lib/audio/speech.svelte';
  import { annotate } from '$lib/zh/annotate';
  import { deck } from '$lib/srs/deck.svelte';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import Choose from './Choose.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, id, report }: { data: Story; id: string; report: (ok: boolean) => void } = $props();
  let shown = $state<Set<number>>(new Set());
  let reading = $state(-1);
  let stop = false;

  async function readAll() {
    if (reading >= 0) {
      stop = true;
      speech.stop();
      reading = -1;
      return;
    }
    stop = false;
    for (let i = 0; i < data.paragraphs.length && !stop; i++) {
      reading = i;
      await speech.say(data.paragraphs[i]!.zh);
    }
    reading = -1;
  }

  const words = $derived(new Set(data.paragraphs.flatMap((p) => annotate(p.zh).flatMap((t) => (t.w && t.s ? [t.w] : [])))));
  const known = $derived([...words].filter((w) => deck.has(w)).length);

  function onDone(ok: boolean) {
    report(ok);
  }
</script>

<article class="story">
  <header>
    {#if data.zh}<h4><Zh text={data.zh} size="md" play={false} /></h4>{/if}
    <div class="tools ui">
      <button class="btn small" onclick={readAll}><Icon name={reading >= 0 ? 'stop' : 'play'} size={14} />{reading >= 0 ? 'Stop' : 'Read it to me'}</button>
      {#if deck.counts().total > 0}<span class="known" title="Words in this story that are in your review deck">{known}/{words.size} words in your deck</span>{/if}
    </div>
  </header>
  {#each data.paragraphs as p, i (i)}
    <div class="para" class:reading={reading === i}>
      <p class="zh"><Zh text={p.zh} size="md" play={false} /><PlayButton text={p.zh} small /></p>
      {#if p.en}
        {#if shown.has(i)}
          <p class="en">{p.en}</p>
        {:else}
          <button class="reveal ui" onclick={() => (shown = new Set([...shown, i]))}>English</button>
        {/if}
      {/if}
    </div>
  {/each}
</article>
{#if data.questions?.length}
  <div class="questions">
    <p class="ui qh">Did you follow it?</p>
    <Choose data={{ items: data.questions }} {id} report={onDone} />
  </div>
{:else}
  <p class="finish ui"><button class="btn small" onclick={() => onDone(true)}><Icon name="check" size={14} />I’ve read it</button></p>
{/if}

<style>
  .story header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  h4 {
    margin: 0;
  }
  .tools {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }
  .known {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .para {
    padding: 0.2rem 0.6rem;
    margin: 0 -0.6rem;
    border-radius: 10px;
    transition: background-color 200ms;
  }
  .para.reading {
    background: var(--gold-soft);
  }
  .zh {
    margin: 0.3rem 0 0;
    line-height: 2.1;
  }
  .en {
    margin: 0 0 0.4rem;
    color: var(--ink-2);
    font-style: italic;
    font-size: 0.95rem;
  }
  .reveal {
    border: none;
    background: none;
    padding: 0;
    margin-bottom: 0.3rem;
    font-size: 0.75rem;
    color: var(--mute);
    text-decoration: underline dotted;
    cursor: pointer;
  }
  .questions {
    margin-top: 1.2rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--line-strong);
  }
  .qh {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
</style>
