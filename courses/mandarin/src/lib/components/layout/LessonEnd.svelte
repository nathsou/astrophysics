<script lang="ts">
  /** End of a lesson: its words, and "mark complete", which sends them to the review deck. */
  import { base } from '$app/paths';
  import { progress } from '$lib/state/progress.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { lookup } from '$lib/zh/lexicon';
  import Zh from '../zh/Zh.svelte';
  import Icon from '../ui/Icon.svelte';

  let { slug, words }: { slug: string; words: string[] } = $props();
  const done = $derived(!!progress.data.completed[slug]);
  const reviewable = $derived(words.filter((w) => lookup(w)));
  const newToDeck = $derived(reviewable.filter((w) => !deck.has(w)).length);
  let added = $state<number | null>(null);

  function complete() {
    progress.complete(slug);
    added = deck.add(reviewable, slug);
  }
</script>

<section class="end card">
  <h2>Lesson complete?</h2>
  {#if reviewable.length}
    <p>This lesson taught {reviewable.length} words. Finishing it adds them to your review deck, where spaced repetition brings each one back just before you would forget it.</p>
    <div class="words">
      {#each reviewable as w (w)}<span class="w" class:in={deck.has(w)}><Zh text={w} play={false} /></span>{/each}
    </div>
  {:else}
    <p>No new vocabulary here: this lesson is about sounds and skills.</p>
  {/if}
  <div class="row ui">
    {#if done}
      <span class="ok"><Icon name="check" size={16} /> Completed{added !== null ? `: ${added} new card${added === 1 ? '' : 's'} in your deck` : ''}</span>
      {#if newToDeck > 0}<button class="btn small" onclick={() => (added = deck.add(reviewable, slug))}>Add the {newToDeck} missing words</button>{/if}
      <a class="btn small" href="{base}/review/"><Icon name="cards" size={15} /> Review now</a>
      <button class="btn small ghost" onclick={() => progress.uncomplete(slug)}>Mark as not done</button>
    {:else}
      <button class="btn primary" onclick={complete}><Icon name="check" size={16} /> Mark complete{reviewable.length ? ' and add the words' : ''}</button>
    {/if}
  </div>
</section>

<style>
  .end {
    margin-top: 3rem;
    padding: 1.2rem 1.4rem;
  }
  h2 {
    margin: 0 0 0.4rem;
    font-size: 1.3rem;
  }
  p {
    margin: 0 0 0.8rem;
    color: var(--ink-2);
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
    margin-bottom: 1rem;
  }
  .w {
    padding: 0 0.3rem;
    border-radius: 6px;
  }
  .w.in {
    background: var(--jade-soft);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--jade);
    font-weight: 650;
    margin-right: 0.5rem;
  }
</style>
