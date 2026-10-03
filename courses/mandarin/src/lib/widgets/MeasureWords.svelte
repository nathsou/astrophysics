<script lang="ts">
  /**
   * Which measure word? Nouns from the HSK lists, with the measure words the dictionary
   * records for them. 个 is often acceptable in speech; the game asks for the specific one.
   */
  import { allWords } from '$lib/zh/lexicon';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { rng, shuffle } from '$lib/exercises/shuffle';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Zh from '$lib/components/zh/Zh.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const CHOICES = ['个', '本', '杯', '件', '张', '只', '条', '口', '辆', '双', '位', '碗'];
  const pool = $derived(
    allWords().filter((w) => {
      const lv = w.l[settings.data.list];
      return lv !== undefined && lv <= 2 && w.c?.length && CHOICES.includes(w.c[0]!) && w.c[0] !== '个';
    }),
  );
  let qs = $state<{ w: string; right: string[]; options: string[] }[]>([]);
  let i = $state(0);
  let score = $state(0);
  let chosen = $state<string | null>(null);
  let done = $state(false);
  let started = $state(false);

  function start() {
    const r = rng(Date.now() % 1e6);
    qs = shuffle(pool, Math.floor(r() * 1e6))
      .slice(0, 10)
      .map((w) => {
        const right = w.c!.filter((c) => CHOICES.includes(c));
        const wrong = shuffle(
          CHOICES.filter((c) => !right.includes(c) && c !== '个'),
          Math.floor(r() * 1e6),
        ).slice(0, 3);
        return { w: w.w, right, options: shuffle([right[0]!, ...wrong], Math.floor(r() * 1e6)) };
      });
    i = 0;
    score = 0;
    chosen = null;
    done = false;
    started = true;
  }
  function pick(c: string) {
    if (chosen) return;
    chosen = c;
    const ok = qs[i]!.right.includes(c);
    if (ok) score++;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    void speech.say(`一${qs[i]!.right[0]}${qs[i]!.w}`);
  }
  function next() {
    if (i + 1 >= qs.length) {
      done = true;
      progress.setBest('measure', score);
      return;
    }
    i++;
    chosen = null;
  }
</script>

<div class="mw card">
  {#if !started || done}
    <p class="title"><Icon name="cards" size={18} /> Measure-word match{done ? `: ${score} / ${qs.length}` : ''}</p>
    <p class="ui">Pick the measure word for each noun: 一<b>本</b>书, 一<b>杯</b>茶… {pool.length} HSK nouns in the pool.</p>
    <button class="btn primary" onclick={start}>{done ? 'Again' : 'Start'}</button>
  {:else}
    {@const q = qs[i]!}
    <div class="head ui"><span>{i + 1} / {qs.length}</span><span>Score {score}</span></div>
    <div class="phrase">
      <span class="zh-font big">一</span>
      <span class="slot zh-font" class:ok={chosen && q.right.includes(chosen)} class:bad={chosen && !q.right.includes(chosen)}>{chosen ? q.right[0] : '?'}</span>
      <Zh text={q.w} size="lg" play={false} />
    </div>
    <div class="opts">
      {#each q.options as o (o)}
        <button class="opt zh-font" class:right={chosen && q.right.includes(o)} class:wrong={chosen === o && !q.right.includes(o)} disabled={!!chosen} onclick={() => pick(o)}>{o}</button>
      {/each}
    </div>
    <div class="foot ui">
      {#if chosen}<span>{q.right.includes(chosen) ? '对！' : `It's 一${q.right[0]}${q.w}.`}</span><button class="btn primary small" onclick={next}>Next <Icon name="arrow" size={13} /></button>{/if}
    </div>
  {/if}
</div>

<style>
  .mw {
    padding: 1rem 1.2rem;
    margin: 1rem 0;
  }
  .title {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0 0 0.4rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .phrase {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.3rem;
    min-height: 6rem;
  }
  .big {
    font-size: 2rem;
  }
  .slot {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: 2px dashed var(--line-strong);
    border-radius: 10px;
    font-size: 2rem;
  }
  .slot.ok {
    border: 2px solid var(--jade);
    background: var(--jade-soft);
  }
  .slot.bad {
    border: 2px solid var(--accent);
    background: var(--accent-soft);
  }
  .opts {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .opt {
    width: 3.4rem;
    height: 3.4rem;
    font-size: 1.7rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .opt:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .opt.right {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  .opt.wrong {
    border-color: var(--accent);
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 2.6rem;
    margin-top: 0.6rem;
  }
</style>
