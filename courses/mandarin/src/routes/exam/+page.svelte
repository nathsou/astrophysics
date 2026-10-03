<script lang="ts">
  /**
   * Mock HSK papers. Listening items play twice, as in the real test; the text is only shown in
   * the review afterwards. The pass mark is 60%, as for the HSK.
   */
  import { HSK1 } from '$content/exams/hsk1';
  import { HSK2 } from '$content/exams/hsk2';
  import type { Paper, Question } from '$content/exams/types';
  import { speech } from '$lib/audio/speech.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const PAPERS = [HSK1, HSK2];
  let paper = $state<Paper | null>(null);
  let si = $state(0);
  let answers = $state<(number | boolean | null)[][]>([]);
  let finished = $state(false);
  let playing = $state<number | null>(null);
  const section = $derived(paper?.sections[si]);

  /** What is read aloud: speaker labels like 女： are not spoken. */
  const spoken = (zh: string) => zh.replace(/[男女]：/g, '');

  function begin(p: Paper) {
    paper = p;
    si = 0;
    answers = p.sections.map((s) => s.questions.map(() => null));
    finished = false;
    scrollTo({ top: 0 });
  }
  async function playTwice(i: number, zh: string) {
    playing = i;
    await speech.say(spoken(zh));
    if (playing !== i) return;
    await new Promise((r) => setTimeout(r, 1200));
    if (playing !== i) return;
    await speech.say(spoken(zh));
    if (playing === i) playing = null;
  }
  function answer(qi: number, v: number | boolean) {
    answers[si]![qi] = v;
  }
  function next() {
    speech.stop();
    playing = null;
    if (paper && si + 1 < paper.sections.length) {
      si++;
      scrollTo({ top: 0 });
    } else finish();
  }
  const isRight = (q: Question, a: number | boolean | null) => a !== null && a === q.answer;
  const score = $derived(paper ? paper.sections.map((s, i) => s.questions.filter((q, k) => isRight(q, answers[i]?.[k] ?? null)).length) : []);
  const total = $derived(paper ? paper.sections.reduce((n, s) => n + s.questions.length, 0) : 0);
  const got = $derived(score.reduce((a, b) => a + b, 0));
  function finish() {
    finished = true;
    if (paper) progress.setBest(`exam-${paper.id}`, got);
    scrollTo({ top: 0 });
  }
  const unanswered = $derived(section ? answers[si]!.filter((a) => a === null).length : 0);
</script>

<svelte:head><title>Mock exams · Mandarin, Out Loud</title></svelte:head>

<div class="page">
  {#if !paper}
    <h1>Mock exams</h1>
    <p class="ui lead">Practice papers in the formats of the HSK 1 and HSK 2 tests: listening (each item plays twice) and reading. Pictures are drawn with emoji. Use headphones, and don't look anything up: the point is to find your gaps.</p>
    <div class="papers">
      {#each PAPERS as p (p.id)}
        {@const best = progress.data.best[`exam-${p.id}`]}
        {@const n = p.sections.reduce((a, s) => a + s.questions.length, 0)}
        <div class="paper card">
          <span class="lvl zh-font">{p.level === 1 ? '一级' : '二级'}</span>
          <h2>{p.title}</h2>
          <p class="ui">{n} questions · about {p.minutes} minutes · {p.sections.filter((s) => s.skill === 'listening').length} listening and {p.sections.filter((s) => s.skill === 'reading').length} reading parts</p>
          {#if best !== undefined}<p class="ui best">Best score: {best} / {n} ({Math.round((best / n) * 100)}%)</p>{/if}
          <button class="btn primary" onclick={() => begin(p)}>Start</button>
        </div>
      {/each}
    </div>
    <p class="ui note">The real HSK 1 and 2 are scored out of 200, with 120 (60%) to pass. These papers use the same 60% line.</p>
  {:else if finished}
    <h1>{paper.title}: results</h1>
    <div class="result card" class:pass={got / total >= 0.6}>
      <p class="big">{got} / {total} <span class="pct">{Math.round((got / total) * 100)}%</span></p>
      <p class="ui">{got / total >= 0.6 ? '通过了！ That would be a pass.' : 'Not a pass yet: the review below shows where to focus.'}</p>
      <ul class="ui per">
        {#each paper.sections as s, i (i)}<li><span>{s.title}</span><strong>{score[i]} / {s.questions.length}</strong></li>{/each}
      </ul>
      <div class="row ui"><button class="btn" onclick={() => paper && begin(paper)}><Icon name="refresh" size={14} />Try again</button><button class="btn ghost" onclick={() => (paper = null)}>All papers</button></div>
    </div>
    <h2>Review</h2>
    {#each paper.sections as s, i (i)}
      <h3 class="ui">{s.title}</h3>
      <ol class="review">
        {#each s.questions as q, k (k)}
          {@const a = answers[i]?.[k] ?? null}
          <li class:ok={isRight(q, a)}>
            <span class="mark ui">{isRight(q, a) ? '✓' : '✗'}</span>
            <div>
              <p class="qz"><Zh text={q.zh} play={false} /> <PlayButton text={spoken(q.zh)} small /></p>
              {#if q.type === 'tf'}<p class="ui">Picture {q.picture}: {q.answer ? 'matches' : 'does not match'}{a !== null && a !== q.answer ? ' (you said the opposite)' : ''}</p>
              {:else if q.type === 'pictures'}<p class="ui">Answer: {q.pictures[q.answer]}{a !== null && a !== q.answer ? ` · you chose ${q.pictures[a as number]}` : ''}</p>
              {:else}{#if q.type === 'choose' && q.question}<p><Zh text={q.question} play={false} /></p>{/if}<p class="ui">Answer: <Zh text={q.options[q.answer]!} play={false} />{a !== null && a !== q.answer ? ' · you chose ' + q.options[a as number] : ''}</p>{/if}
            </div>
          </li>
        {/each}
      </ol>
    {/each}
  {:else if section}
    <div class="exam-head ui">
      <span>{paper.title}</span>
      <span>Part {si + 1} of {paper.sections.length}</span>
    </div>
    <h1 class="sec">{section.title}</h1>
    <p class="ui instr"><Icon name={section.skill === 'listening' ? 'speaker' : 'book'} size={16} /> {section.instructions}</p>
    <ol class="qs">
      {#each section.questions as q, k (k)}
        {@const a = answers[si]?.[k] ?? null}
        <li class="q card">
          <span class="qn ui">{k + 1}</span>
          <div class="qbody">
            {#if section.skill === 'listening'}
              <button class="btn small" onclick={() => playTwice(k, q.zh)}><Icon name={playing === k ? 'speaker' : 'play'} size={14} />{playing === k ? 'Playing…' : 'Play (twice)'}</button>
            {:else}
              <p class="qz"><Zh text={q.zh} size="md" pinyin="hide" play={false} /></p>
              {#if q.type === 'choose' && q.question}<p class="qq"><Zh text={q.question} pinyin="hide" play={false} /></p>{/if}
            {/if}
            {#if q.type === 'tf'}
              <div class="tf">
                <span class="pic" aria-hidden="true">{q.picture}</span>
                <button class="choice" class:on={a === true} onclick={() => answer(k, true)}>✓ matches</button>
                <button class="choice" class:on={a === false} onclick={() => answer(k, false)}>✗ doesn't match</button>
              </div>
            {:else if q.type === 'pictures'}
              <div class="pics">
                {#each q.pictures as p, i (i)}<button class="pic-choice" class:on={a === i} onclick={() => answer(k, i)} aria-label="Picture {String.fromCharCode(65 + i)}"><span>{p}</span><span class="ui l">{String.fromCharCode(65 + i)}</span></button>{/each}
              </div>
            {:else}
              <div class="opts">
                {#each q.options as o, i (i)}<button class="choice" class:on={a === i} onclick={() => answer(k, i)}><span class="ui l">{String.fromCharCode(65 + i)}</span> <Zh text={o} pinyin="hide" plain play={false} /></button>{/each}
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
    <div class="row ui">
      {#if unanswered}<span class="mute">{unanswered} unanswered</span>{/if}
      <button class="btn primary" onclick={next}>{si + 1 < paper.sections.length ? 'Next part' : 'Finish and see results'} <Icon name="arrow" size={14} /></button>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 46rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .lead {
    color: var(--ink-2);
    margin: 0 0 1.2rem;
  }
  .papers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 0.8rem;
  }
  .paper {
    padding: 1.1rem 1.2rem;
  }
  .paper h2 {
    margin: 0.2rem 0;
    font-size: 1.25rem;
  }
  .paper p {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .lvl {
    font-size: 2rem;
    color: var(--accent);
  }
  .best {
    color: var(--jade) !important;
    font-weight: 650;
  }
  .note {
    margin-top: 1.2rem;
    font-size: 0.82rem;
    color: var(--mute);
  }
  .exam-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .sec {
    font-size: 1.6rem;
  }
  .instr {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    color: var(--ink-2);
    margin: 0 0 1rem;
  }
  .qs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.7rem;
  }
  .q {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.5rem;
    padding: 0.8rem 1rem;
  }
  .qn {
    font-weight: 750;
    color: var(--accent-ink);
  }
  .qbody {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .qz,
  .qq {
    margin: 0;
  }
  .tf,
  .pics,
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .pic {
    font-size: 2.6rem;
    margin-right: 0.6rem;
  }
  .choice,
  .pic-choice {
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    border-radius: 12px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    color: var(--fg);
    font-family: var(--font-body);
  }
  .pic-choice {
    display: grid;
    justify-items: center;
    padding: 0.3rem 0.8rem;
  }
  .pic-choice span:first-child {
    font-size: 2.4rem;
  }
  .l {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mute);
  }
  .choice.on,
  .pic-choice.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1.2rem;
  }
  .mute {
    color: var(--mute);
    font-size: 0.85rem;
  }
  .result {
    padding: 1.2rem 1.4rem;
    margin-bottom: 1.5rem;
    border-left: 4px solid var(--accent);
  }
  .result.pass {
    border-left-color: var(--jade);
  }
  .big {
    font-size: 2.4rem;
    font-weight: 750;
    margin: 0;
    font-family: var(--font-ui);
  }
  .pct {
    font-size: 1.2rem;
    color: var(--mute);
  }
  .per {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0;
  }
  .per li {
    display: flex;
    justify-content: space-between;
    padding: 0.2rem 0;
    border-bottom: 1px solid var(--line);
    font-size: 0.88rem;
  }
  .result .row {
    justify-content: flex-start;
  }
  h3 {
    font-size: 0.9rem;
    margin: 1.2rem 0 0.4rem;
    color: var(--accent-ink);
  }
  .review {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .review li {
    display: grid;
    grid-template-columns: 1.6rem 1fr;
    gap: 0.4rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--line);
  }
  .review p {
    margin: 0.1rem 0;
    font-size: 0.92rem;
  }
  .mark {
    color: var(--accent);
    font-weight: 700;
  }
  .review li.ok .mark {
    color: var(--jade);
  }
</style>
