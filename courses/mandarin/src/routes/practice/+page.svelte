<script lang="ts">
  /** The practice arcade: every game and drill in one place, independent of the lessons. */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import ToneTrainer from '$lib/widgets/ToneTrainer.svelte';
  import ToneMirror from '$lib/widgets/ToneMirror.svelte';
  import NumberGame from '$lib/widgets/NumberGame.svelte';
  import DirectionMap from '$lib/widgets/DirectionMap.svelte';
  import FamilyTree from '$lib/widgets/FamilyTree.svelte';
  import CharBuilder from '$lib/widgets/CharBuilder.svelte';
  import WordBlitz from '$lib/widgets/WordBlitz.svelte';
  import MeasureWords from '$lib/widgets/MeasureWords.svelte';
  import WritePractice from '$lib/widgets/WritePractice.svelte';
  import PinyinChart from '$lib/widgets/PinyinChart.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const GAMES = [
    { id: 'blitz', title: 'Word blitz', zh: '快', icon: 'flame', text: '60 seconds of rapid-fire meanings from your own deck.', best: ['blitz-see', 'blitz-hear'] },
    { id: 'tones', title: 'Tone detective', zh: '声', icon: 'speaker', text: 'Hear a syllable, name the tone. Adapts to your confusions.', best: ['tones-single'] },
    { id: 'pairs', title: 'Tone pairs', zh: '调', icon: 'speaker', text: 'The tones of two-syllable words, the real thing.', best: ['tones-pairs'] },
    { id: 'mirror', title: 'Tone mirror', zh: '镜', icon: 'mic', text: 'Say it; see your pitch drawn over the target.', best: [] },
    { id: 'numbers', title: 'Number drills', zh: '数', icon: 'sparkle', text: 'Numbers, prices, times, dates and phone numbers, endlessly.', best: [] },
    { id: 'measure', title: 'Measure words', zh: '个', icon: 'cards', text: '一本书, 一杯茶: pick the right measure word.', best: ['measure'] },
    { id: 'write', title: 'Writing', zh: '写', icon: 'brush', text: 'Write characters from your deck, stroke by stroke.', best: [] },
    { id: 'map', title: 'Town map', zh: '路', icon: 'map', text: '左边, 右边, 前面, 后面: find the building.', best: [] },
    { id: 'family', title: 'Family tree', zh: '家', icon: 'chat', text: 'Who is 爸爸的妈妈? Follow the chain.', best: [] },
    { id: 'builder', title: 'Character builder', zh: '字', icon: 'lightbulb', text: 'Combine parts into characters. Find them all.', best: [] },
    { id: 'chart', title: 'Pinyin chart', zh: '音', icon: 'book', text: 'Every syllable of Mandarin, in all four tones.', best: [] },
  ];
  const current = $derived(page.url.hash.slice(1) || null);
  const game = $derived(GAMES.find((g) => g.id === current));
  const bestOf = (keys: string[]) => Math.max(-1, ...keys.map((k) => progress.data.best[k] ?? -1));
</script>

<svelte:head><title>Practice · Mandarin, Out Loud</title></svelte:head>

<div class="page">
  <h1>Practice</h1>
  <p class="ui lead">Short games that train one skill each. Five minutes of any of them is time well spent.</p>

  <div class="grid">
    {#each GAMES as g (g.id)}
      {@const b = bestOf(g.best)}
      <a class="game card" id={g.id} class:on={current === g.id} href="#{g.id}" onclick={(e) => { e.preventDefault(); goto(`#${g.id}`, { replaceState: true, noScroll: true }); }}>
        <span class="gzh zh-font">{g.zh}</span>
        <span class="gt">{g.title}</span>
        <span class="gd ui">{g.text}</span>
        {#if b >= 0}<span class="best ui">Best: {b}</span>{/if}
      </a>
    {/each}
  </div>

  {#if game}
    <section class="stage" aria-label={game.title}>
      <h2><Icon name={game.icon} size={20} /> {game.title}</h2>
      {#key game.id}
        {#if game.id === 'blitz'}<WordBlitz />
        {:else if game.id === 'tones'}<ToneTrainer count={15} />
        {:else if game.id === 'pairs'}<ToneTrainer mode="pairs" count={12} />
        {:else if game.id === 'mirror'}<ToneMirror items="妈,麻,马,骂,汤,糖,躺,烫,你好,谢谢,老师,中国,再见" />
        {:else if game.id === 'numbers'}
          <NumberGame kinds="number" max={99999} count={8} />
          <NumberGame kinds="price,time" count={8} />
          <NumberGame kinds="date,phone,age" count={6} />
        {:else if game.id === 'measure'}<MeasureWords />
        {:else if game.id === 'write'}<WritePractice />
        {:else if game.id === 'map'}<DirectionMap />
        {:else if game.id === 'family'}<FamilyTree />
        {:else if game.id === 'builder'}<CharBuilder />
        {:else if game.id === 'chart'}<PinyinChart />
        {/if}
      {/key}
    </section>
  {/if}
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 60rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .lead {
    color: var(--ink-2);
    margin: 0 0 1.2rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
    gap: 0.6rem;
  }
  .game {
    position: relative;
    display: grid;
    align-content: start;
    gap: 0.2rem;
    padding: 0.9rem 1rem;
    color: var(--fg);
    text-decoration: none;
    transition: border-color 120ms, transform 120ms;
  }
  .game:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .game.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .gzh {
    font-size: 1.8rem;
    color: var(--accent);
    line-height: 1.1;
  }
  .gt {
    font-weight: 650;
  }
  .gd {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .best {
    position: absolute;
    top: 0.7rem;
    right: 0.8rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--gold);
  }
  .stage {
    margin-top: 1.8rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    max-width: 46rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.4rem;
    margin: 0 0 0.4rem;
  }
</style>
