<script lang="ts">
  /**
   * A little town seen from above. Questions use position words: 银行在哪儿？
   * 学校在医院的左边 — tap the right building. A new town is drawn every round.
   */
  import { shuffle, rng } from '$lib/exercises/shuffle';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { settings } from '$lib/state/settings.svelte';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const PLACES = [
    { zh: '学校', icon: '🏫' },
    { zh: '医院', icon: '🏥' },
    { zh: '商店', icon: '🏪' },
    { zh: '饭店', icon: '🍜' },
    { zh: '书店', icon: '📚' },
    { zh: '超市', icon: '🛒' },
    { zh: '银行', icon: '🏦' },
    { zh: '电影院', icon: '🎬' },
    { zh: '公司', icon: '🏢' },
  ];
  /** Grid 3×3; row 0 is the back (far), row 2 the front (nearest you). */
  const REL = [
    { zh: '左边', dx: -1, dy: 0 },
    { zh: '右边', dx: 1, dy: 0 },
    { zh: '前面', dx: 0, dy: 1 },
    { zh: '后面', dx: 0, dy: -1 },
  ];

  let round = $state(0);
  let layout = $state<(typeof PLACES)[number][]>([]);
  let qs = $state<{ text: string; answer: number }[]>([]);
  let qi = $state(0);
  let score = $state(0);
  let solved = $state(false);
  let missed = $state(false);
  let flash = $state<number | null>(null);

  function build() {
    const seed = Date.now() % 100003;
    layout = shuffle(PLACES, seed);
    const r = rng(seed + 1);
    const out: { text: string; answer: number }[] = [];
    for (let k = 0; k < 40 && out.length < 6; k++) {
      const a = Math.floor(r() * 9);
      const rel = REL[Math.floor(r() * REL.length)]!;
      const ax = a % 3,
        ay = Math.floor(a / 3);
      const bx = ax - rel.dx,
        by = ay - rel.dy;
      if (bx < 0 || bx > 2 || by < 0 || by > 2) continue;
      const b = by * 3 + bx;
      const text = r() < 0.5 ? `${layout[b]!.zh}的${rel.zh}是什么？` : `哪个在${layout[b]!.zh}的${rel.zh}？`;
      if (out.some((q) => q.text === text)) continue;
      out.push({ text, answer: a });
    }
    qs = out;
    qi = 0;
    score = 0;
    solved = false;
    missed = false;
    round++;
    setTimeout(() => qs[0] && speech.say(qs[0].text), 200);
  }

  function tap(i: number) {
    if (!qs[qi] || solved) return;
    if (i === qs[qi]!.answer) {
      solved = true;
      if (!missed) score++;
      sfx('right', settings.data.sounds);
      void speech.say(layout[i]!.zh);
    } else {
      missed = true;
      flash = i;
      sfx('wrong', settings.data.sounds);
      setTimeout(() => (flash = null), 400);
    }
  }
  function next() {
    qi++;
    solved = false;
    missed = false;
    if (qs[qi]) void speech.say(qs[qi]!.text);
  }
</script>

<figure class="map card">
  {#if !round}
    <p class="ui intro">A town map: answer each question by tapping a building. 前面 is the side nearer you (the bottom of the map), 后面 the far side.</p>
    <button class="btn primary" onclick={build}>Start</button>
  {:else}
    <div class="q">
      {#if qi < qs.length}
        <Zh text={qs[qi]!.text} size="md" play={false} /><PlayButton text={qs[qi]!.text} small />
        {#if solved}<button class="btn small primary" onclick={next}>Next <Icon name="arrow" size={13} /></button>{/if}
      {:else}
        <p class="ui">{score} / {qs.length} first time. <button class="btn small" onclick={build}>New town</button></p>
      {/if}
    </div>
    <div class="town" aria-label="Town map">
      <span class="far ui">后面 ↑</span>
      {#each layout as p, i (p.zh)}
        <button class="bld" class:right={solved && i === qs[qi]?.answer} class:wrong={flash === i} onclick={() => tap(i)}>
          <span class="ic" aria-hidden="true">{p.icon}</span>
          <Zh text={p.zh} plain play={false} />
        </button>
      {/each}
      <span class="near ui">↓ 前面 · you are here</span>
    </div>
  {/if}
</figure>

<style>
  .map {
    margin: 1.6rem 0;
    padding: 1rem;
  }
  .intro {
    margin: 0 0 0.7rem;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .q {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    min-height: 3rem;
  }
  .q p {
    margin: 0;
  }
  .town {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 1.4rem 0.8rem;
    margin-top: 0.4rem;
    border-radius: 14px;
    background: repeating-linear-gradient(90deg, transparent 0 calc(33.33% - 0.25rem), var(--line) calc(33.33% - 0.25rem) calc(33.33% + 0.25rem)), var(--pn);
    position: relative;
  }
  .far,
  .near {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .far {
    top: 0.2rem;
  }
  .near {
    bottom: 0.2rem;
  }
  .bld {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.5rem 0.2rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .bld:hover {
    border-color: var(--accent);
  }
  .ic {
    font-size: 1.6rem;
  }
  .right {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  .wrong {
    border-color: var(--accent);
    animation: shake 300ms;
  }
  @keyframes shake {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
</style>
