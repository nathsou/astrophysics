<script lang="ts">
  /**
   * A family tree around 我. Explore it by tapping, or switch to the quiz: follow a chain like
   * 爸爸的妈妈 ("dad's mum") and tap the right person.
   */
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { settings } from '$lib/state/settings.svelte';
  import { shuffle } from '$lib/exercises/shuffle';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  type P = { id: string; zh: string; en: string; row: number; col: number; side?: 'dad' | 'mum' };
  const PEOPLE: P[] = [
    { id: 'yeye', zh: '爷爷', en: 'grandpa (dad’s dad)', row: 0, col: 0 },
    { id: 'nainai', zh: '奶奶', en: 'grandma (dad’s mum)', row: 0, col: 1 },
    { id: 'waigong', zh: '外公', en: 'grandpa (mum’s dad)', row: 0, col: 3 },
    { id: 'waipo', zh: '外婆', en: 'grandma (mum’s mum)', row: 0, col: 4 },
    { id: 'baba', zh: '爸爸', en: 'dad', row: 1, col: 0.5 },
    { id: 'mama', zh: '妈妈', en: 'mum', row: 1, col: 3.5 },
    { id: 'gege', zh: '哥哥', en: 'older brother', row: 2, col: 0 },
    { id: 'jiejie', zh: '姐姐', en: 'older sister', row: 2, col: 1 },
    { id: 'wo', zh: '我', en: 'me', row: 2, col: 2 },
    { id: 'didi', zh: '弟弟', en: 'younger brother', row: 2, col: 3 },
    { id: 'meimei', zh: '妹妹', en: 'younger sister', row: 2, col: 4 },
    { id: 'erzi', zh: '儿子', en: 'son', row: 3, col: 1.5 },
    { id: 'nver', zh: '女儿', en: 'daughter', row: 3, col: 2.5 },
  ];
  const QUIZ: [string, string][] = [
    ['爸爸的爸爸', 'yeye'],
    ['爸爸的妈妈', 'nainai'],
    ['妈妈的爸爸', 'waigong'],
    ['妈妈的妈妈', 'waipo'],
    ['我的女儿', 'nver'],
    ['我哥哥的妹妹', 'jiejie'],
    ['奶奶的儿子', 'baba'],
    ['外婆的女儿', 'mama'],
    ['爸爸的女儿 (younger than me)', 'meimei'],
    ['妈妈的儿子 (older than me)', 'gege'],
    ['我女儿的哥哥', 'erzi'],
    ['爷爷的儿子的儿子 (younger than me)', 'didi'],
  ];

  let mode = $state<'explore' | 'quiz'>('explore');
  let sel = $state<string | null>(null);
  let order = $state<number[]>([]);
  let qi = $state(0);
  let right = $state(0);
  let wrong = $state<string | null>(null);
  let solved = $state(false);
  const q = $derived(QUIZ[order[qi] ?? 0]!);

  function startQuiz() {
    mode = 'quiz';
    order = shuffle(QUIZ.map((_, i) => i), Date.now() % 9973).slice(0, 8);
    qi = 0;
    right = 0;
    solved = false;
    sel = null;
  }
  function tap(p: P) {
    if (mode === 'explore') {
      sel = p.id;
      void speech.say(p.zh);
      return;
    }
    if (solved || qi >= order.length) return;
    if (p.id === q[1]) {
      solved = true;
      sel = p.id;
      if (!wrong) right++;
      sfx('right', settings.data.sounds);
      void speech.say(p.zh);
    } else {
      wrong = p.id;
      sfx('wrong', settings.data.sounds);
      setTimeout(() => (wrong = null), 450);
    }
  }
  function next() {
    qi++;
    solved = false;
    sel = null;
    if (qi < order.length) void speech.say(QUIZ[order[qi]!]![0]);
  }
  const current = $derived(PEOPLE.find((p) => p.id === sel));
</script>

<figure class="tree card">
  <div class="top ui">
    <div class="modes" role="radiogroup" aria-label="Mode">
      <button role="radio" aria-checked={mode === 'explore'} class:on={mode === 'explore'} onclick={() => ((mode = 'explore'), (sel = null))}>Explore</button>
      <button role="radio" aria-checked={mode === 'quiz'} class:on={mode === 'quiz'} onclick={startQuiz}>Who is it?</button>
    </div>
    {#if mode === 'quiz' && qi < order.length}<span class="score">{qi + 1} / {order.length} · {right} right</span>{/if}
  </div>
  {#if mode === 'quiz'}
    <div class="q">
      {#if qi < order.length}
        <Zh text={q[0]} size="md" play={false} /><PlayButton text={q[0]} small />
        {#if solved}<button class="btn small primary" onclick={next}>Next <Icon name="arrow" size={13} /></button>{/if}
      {:else}
        <p class="ui">{right} / {order.length} right first time. <button class="btn small" onclick={startQuiz}>Again</button></p>
      {/if}
    </div>
  {/if}
  <div class="grid">
    {#each PEOPLE as p (p.id)}
      <button
        class="person"
        class:me={p.id === 'wo'}
        class:sel={sel === p.id}
        class:wrong={wrong === p.id}
        style="grid-row: {p.row + 1}; grid-column: {Math.round(p.col * 2) + 1} / span 2"
        onclick={() => tap(p)}
      >
        <span class="zh-font">{p.zh}</span>
        {#if mode === 'explore' || solved}<span class="en">{p.en}</span>{/if}
      </button>
    {/each}
  </div>
  <p class="cap ui">
    {#if mode === 'explore'}
      {#if current}<Zh text={current.zh} play={false} /> means {current.en}.{:else}Tap anyone to hear what you call them.{/if}
    {:else}Follow the chain: 爸爸的妈妈 is "dad’s mum".{/if}
  </p>
</figure>

<style>
  .tree {
    margin: 1.6rem 0;
    padding: 1rem;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  .modes {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 2px;
  }
  .modes button {
    border: none;
    background: none;
    border-radius: 999px;
    padding: 0.25rem 0.85rem;
    font-weight: 600;
    font-size: 0.82rem;
    cursor: pointer;
    color: var(--mute);
  }
  .modes button.on {
    background: var(--fg);
    color: var(--bg);
  }
  .score {
    font-size: 0.8rem;
    color: var(--mute);
  }
  .q {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    margin-bottom: 0.4rem;
  }
  .q p {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    grid-auto-rows: minmax(3.6rem, auto);
    gap: 0.5rem 0.3rem;
  }
  .person {
    display: grid;
    place-items: center;
    align-content: center;
    padding: 0.3rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
    transition: border-color 120ms, background-color 120ms;
  }
  .person .zh-font {
    font-size: 1.3rem;
  }
  .en {
    font-family: var(--font-ui);
    font-size: 0.66rem;
    color: var(--mute);
    text-align: center;
    line-height: 1.2;
  }
  .person:hover {
    border-color: var(--accent);
  }
  .me {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .me .en {
    color: #fff;
  }
  .sel:not(.me) {
    background: var(--jade-soft);
    border-color: var(--jade);
  }
  .wrong {
    border-color: var(--accent);
    animation: shake 300ms;
  }
  .cap {
    margin: 0.7rem 0 0;
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  @keyframes shake {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
  @media (max-width: 520px) {
    .en {
      display: none;
    }
  }
</style>
