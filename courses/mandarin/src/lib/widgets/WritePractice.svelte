<script lang="ts">
  /** Writing practice with characters from your deck (or HSK 1): see the meaning, write it. */
  import { deck } from '$lib/srs/deck.svelte';
  import { hskWords } from '$lib/zh/lexicon';
  import { settings } from '$lib/state/settings.svelte';
  import { shuffle } from '$lib/exercises/shuffle';
  import Exercise from '$lib/components/exercise/Exercise.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let round = $state(0);
  const chars = $derived.by(() => {
    void round;
    const mine = [...new Set(Object.values(deck.data.cards).flatMap((c) => [...c.word]))];
    const pool = mine.length >= 8 ? mine : [...new Set([...mine, ...hskWords(settings.data.list, 1).flatMap((w) => [...w.w])])];
    return shuffle(pool.filter((c) => /\p{Script=Han}/u.test(c)), Date.now() % 1e6).slice(0, 5).join('');
  });
</script>

{#key chars}
  <Exercise kind="write" id="practice/write" data={{ title: 'Five characters', chars }} />
{/key}
<button class="btn" onclick={() => round++}><Icon name="shuffle" size={15} />Five different characters</button>
