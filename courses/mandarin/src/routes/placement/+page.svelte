<script lang="ts">
  /**
   * A three-minute placement check: tones and pinyin, then HSK 1, then HSK 2. It recommends a
   * starting point; nothing is locked either way.
   */
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { settings, START_DEFAULTS, type StartPoint } from '$lib/state/settings.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { hskWords } from '$lib/zh/lexicon';
  import { speech } from '$lib/audio/speech.svelte';
  import { shuffle } from '$lib/exercises/shuffle';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  type Q = { band: 'sounds' | 'hsk1' | 'hsk2'; prompt: string; audio?: string; zh?: string; options: string[]; answer: number };
  const QS: Q[] = [
    { band: 'sounds', prompt: 'Which tone do you hear?', audio: '马', options: ['1st (high)', '2nd (rising)', '3rd (dipping)', '4th (falling)'], answer: 2 },
    { band: 'sounds', prompt: 'Which tone do you hear?', audio: '是', options: ['1st (high)', '2nd (rising)', '3rd (dipping)', '4th (falling)'], answer: 3 },
    { band: 'sounds', prompt: 'Which pinyin matches what you hear?', audio: '七', options: ['chī', 'qī', 'xī', 'jī'], answer: 1 },
    { band: 'hsk1', prompt: 'What does this mean?', zh: '谢谢', options: ['hello', 'thank you', 'goodbye', 'sorry'], answer: 1 },
    { band: 'hsk1', prompt: 'What does this mean?', zh: '我们明天去学校。', options: ['We went to school yesterday.', 'We are going to school tomorrow.', 'We are at school today.'], answer: 1 },
    { band: 'hsk1', prompt: 'Choose the right word: 我家___三口人。', options: ['是', '有', '在'], answer: 1 },
    { band: 'hsk1', prompt: 'Choose the right word: 这个苹果多少___？', options: ['钱', '个', '人'], answer: 0 },
    { band: 'hsk1', prompt: 'What do you hear?', audio: '现在下午三点半。', options: ['It’s 3:30 pm now.', 'It’s 13:00 now.', 'It’s 3 am now.'], answer: 0 },
    { band: 'hsk2', prompt: 'What does this mean?', zh: '我去过上海两次。', options: ['I’m going to Shanghai twice.', 'I’ve been to Shanghai twice.', 'I went to Shanghai for two days.'], answer: 1 },
    { band: 'hsk2', prompt: 'Choose the right word: 我家___学校很近。', options: ['从', '离', '到'], answer: 1 },
    { band: 'hsk2', prompt: 'Choose the right word: 他说汉语说___很好。', options: ['的', '得', '了'], answer: 1 },
    { band: 'hsk2', prompt: 'What does this mean?', zh: '虽然很累，但是我很高兴。', options: ['Because I’m tired, I’m happy.', 'Although I’m tired, I’m happy.', 'I’m tired and unhappy.'], answer: 1 },
  ];

  let i = $state(0);
  let picks = $state<number[]>([]);
  let result = $state<StartPoint | null>(null);
  const q = $derived(QS[i]);
  const order = $derived(q ? shuffle(q.options.map((_, k) => k), `placement:${i}`) : []);

  $effect(() => {
    if (q?.audio && !result) return speech.schedule(q.audio, 200);
  });

  function score(band: Q['band']) {
    return QS.filter((x, k) => x.band === band && picks[k] === x.answer).length;
  }
  function pick(k: number) {
    picks = [...picks, k];
    if (i + 1 < QS.length) i++;
    else decide();
  }
  function decide() {
    const s = score('sounds'),
      a = score('hsk1'),
      b = score('hsk2');
    result = s < 2 && a < 3 ? 'new' : a < 3 ? 'pinyin' : b < 3 ? 'hsk1' : 'hsk2';
    i = QS.length;
  }
  function skip() {
    result = 'new';
    i = QS.length;
  }
  const LABEL: Record<StartPoint, [string, string, string]> = {
    new: ['Start with the sounds', 'Lesson 1 builds your ear for the tones; it pays off in every lesson after.', '01-four-tones'],
    pinyin: ['Start with characters', 'Your ear for tones is there; lesson 4 opens up how characters work.', '04-how-characters-work'],
    hsk1: ['Start with everyday Mandarin', 'Begin Part 3 at lesson 6; skim quickly through what you know.', '06-hello'],
    hsk2: ['Start with HSK 2', 'Go to lesson 16. Adding the HSK 1 words to your deck will catch any gaps.', '16-what-happened'],
  };
  let addHsk1 = $state(true);
  function accept() {
    if (!result) return;
    settings.update({ start: result, ...START_DEFAULTS[result] });
    if (result === 'hsk2' && addHsk1) deck.add(hskWords(settings.data.list, 1).map((w) => w.w), 'placement');
    void goto(`${base}/learn/${LABEL[result][2]}/`);
  }
</script>

<svelte:head><title>Placement check · Mandarin, Out Loud</title></svelte:head>

<div class="page">
  <h1>Placement check</h1>
  {#if q}
    <p class="ui lead">Twelve quick questions, from sounds to HSK 2. Guessing is fine. If you've never studied Chinese, <button class="link" onclick={skip}>skip straight to the start</button>.</p>
    <div class="card box">
      <div class="top ui"><span>{i + 1} / {QS.length}</span><span class="band">{q.band === 'sounds' ? 'Sounds' : q.band === 'hsk1' ? 'HSK 1' : 'HSK 2'}</span></div>
      <p class="prompt"><Zh text={q.prompt} pinyin="hide" play={false} /></p>
      {#if q.audio}<div class="audio"><PlayButton text={q.audio} /><PlayButton text={q.audio} slow /></div>{/if}
      {#if q.zh}<p class="zh"><Zh text={q.zh} size="lg" pinyin="hide" play={false} /></p>{/if}
      <div class="opts">
        {#each order as k (k)}
          <button class="opt" onclick={() => pick(k)}><Zh text={q.options[k]!} pinyin="hide" plain play={false} /></button>
        {/each}
        <button class="opt idk ui" onclick={() => pick(-1)}>I don't know</button>
      </div>
    </div>
  {:else if result}
    <div class="card box">
      <p class="ui small">Sounds {score('sounds')}/3 · HSK 1 {score('hsk1')}/5 · HSK 2 {score('hsk2')}/4</p>
      <h2>{LABEL[result][0]}</h2>
      <p>{LABEL[result][1]}</p>
      {#if result === 'hsk2'}<label class="ui chk"><input type="checkbox" bind:checked={addHsk1} /> Add all HSK 1 words to my review deck</label>{/if}
      <div class="row">
        <button class="btn primary" onclick={accept}>Sounds good <Icon name="arrow" size={15} /></button>
        <a class="btn ghost" href="{base}/">Choose myself</a>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 40rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .lead {
    color: var(--ink-2);
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent-ink);
    text-decoration: underline;
    cursor: pointer;
    font-size: inherit;
  }
  .box {
    padding: 1.1rem 1.3rem;
  }
  .top {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .band {
    font-weight: 700;
    color: var(--accent-ink);
  }
  .prompt {
    font-size: 1.1rem;
  }
  .audio {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }
  .opts {
    display: grid;
    gap: 0.45rem;
  }
  .opt {
    text-align: left;
    padding: 0.6rem 0.9rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
    font-family: var(--font-body);
    font-size: 1rem;
  }
  .opt:hover {
    border-color: var(--accent);
  }
  .idk {
    color: var(--mute);
    font-size: 0.88rem;
    border-style: dashed;
  }
  .small {
    font-size: 0.8rem;
    color: var(--mute);
  }
  .chk {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.9rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
