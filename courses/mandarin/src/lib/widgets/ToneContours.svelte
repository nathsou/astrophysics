<script lang="ts">
  /**
   * The four tones as shapes on Chao's five-level pitch scale. Tap a card to hear it while a dot
   * traces the contour in time with the sound.
   */
  import { targetContour } from '$lib/audio/tones';
  import { speech } from '$lib/audio/speech.svelte';
  import { mark } from '$lib/zh/pinyin';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { base = 'ma', chars = '妈麻马骂', meanings = 'mum|hemp|horse|to scold' }: { base?: string; chars?: string; meanings?: string } = $props();
  const glosses = $derived(meanings.split('|'));
  const NAMES = ['High and level', 'Rising', 'Low, dipping', 'Falling'];
  const HINTS = ['like holding a note: “aaah” at the doctor’s', 'like a surprised “what?”', 'like a doubtful “well…?”', 'like a firm “no!”'];
  let active = $state<number | null>(null);
  let t = $state(0);

  const W = 120;
  const H = 80;
  const y = (v: number) => 8 + ((5 - v) / 4) * (H - 16);
  function path(tone: 1 | 2 | 3 | 4) {
    const pts = targetContour(tone, 20);
    return pts.map((v, i) => `${i ? 'L' : 'M'}${(10 + (i / 19) * (W - 20)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  }
  function dot(tone: 1 | 2 | 3 | 4) {
    const pts = targetContour(tone, 101);
    const v = pts[Math.round(t * 100)]!;
    return { cx: 10 + t * (W - 20), cy: y(v) };
  }

  async function play(i: number) {
    active = i;
    t = 0;
    const start = performance.now();
    const dur = 650;
    const tick = () => {
      t = Math.min(1, (performance.now() - start) / dur);
      if (t < 1 && active === i) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await speech.say([...chars][i]!);
    if (active === i) setTimeout(() => (active === i ? (active = null) : null), 300);
  }

  async function playAll() {
    for (let i = 0; i < 4; i++) {
      await play(i);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
</script>

<figure class="contours">
  <div class="grid">
    {#each [1, 2, 3, 4] as tone, i (tone)}
      {@const tn = tone as 1 | 2 | 3 | 4}
      <button class="card t{tone}" class:active={active === i} onclick={() => play(i)} aria-label="Tone {tone}: {mark(base, tn)}, {glosses[i]}. Play.">
        <svg viewBox="0 0 {W} {H}" aria-hidden="true">
          {#each [1, 2, 3, 4, 5] as l (l)}<line x1="4" x2={W - 4} y1={y(l)} y2={y(l)} />{/each}
          <path d={path(tn)} />
          {#if active === i}{@const d = dot(tn)}<circle cx={d.cx} cy={d.cy} r="5" />{/if}
        </svg>
        <span class="py">{mark(base, tn)}</span>
        <span class="ch zh-font">{[...chars][i]}</span>
        <span class="gl">{glosses[i]}</span>
        <span class="name ui">{tone} · {NAMES[i]}</span>
        <span class="hint">{HINTS[i]}</span>
      </button>
    {/each}
  </div>
  <figcaption class="ui">
    <button class="btn small" onclick={playAll}><Icon name="play" size={14} />Play all four</button>
    The lines are the five pitch levels of your own voice, 5 at the top. Tap a card to hear it.
  </figcaption>
</figure>

<style>
  .contours {
    margin: 1.8rem 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
    gap: 0.6rem;
  }
  .card {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.1rem;
    padding: 0.7rem 0.6rem 0.8rem;
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
    font-family: var(--font-body);
    transition: border-color 120ms, transform 120ms;
  }
  .card:hover,
  .card.active {
    border-color: var(--tone);
  }
  .card.active {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }
  svg {
    width: 100%;
    max-width: 9rem;
  }
  line {
    stroke: var(--line);
    stroke-width: 1;
  }
  path {
    fill: none;
    stroke: var(--tone);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  circle {
    fill: var(--fg);
  }
  .py {
    font-family: var(--font-py);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--tone);
  }
  .ch {
    font-size: 2rem;
    line-height: 1.1;
  }
  .gl {
    font-size: 0.9rem;
    font-style: italic;
  }
  .name {
    margin-top: 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--tone);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .hint {
    font-size: 0.8rem;
    color: var(--mute);
    text-align: center;
    line-height: 1.35;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.7rem;
    font-size: 0.82rem;
    color: var(--mute);
  }
</style>
