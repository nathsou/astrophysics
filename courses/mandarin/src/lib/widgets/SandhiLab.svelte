<script lang="ts">
  /**
   * Written tones versus spoken tones. Pinyin writes each syllable's own tone (except for 一 and
   * 不, whose changes are written); speech changes some of them in context. Flip between the two
   * and see the contours change.
   */
  import { annotate } from '$lib/zh/annotate';
  import { lookup } from '$lib/zh/lexicon';
  import { toneOf, bare, mark, type Tone } from '$lib/zh/pinyin';
  import { targetContour } from '$lib/audio/tones';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';

  let { phrases = '你好,很好,老师,我也很好,不是,不好,一个,一天,一起,谢谢' }: { phrases?: string } = $props();
  const list = $derived(phrases.split(','));
  let spoken = $state(true);

  interface Syl {
    ch: string;
    written: string;
    said: string;
    tone: Tone;
    saidTone: Tone | 'half3';
    why?: string;
  }

  function analyse(text: string): Syl[] {
    const toks = annotate(text).flatMap((t) => t.s ?? []);
    // Citation tones: the dictionary reading of each character, before the 一/不 changes.
    const out: Syl[] = toks.map((s) => {
      return { ch: s.ch, written: s.py, said: s.py, tone: toneOf(s.py), saidTone: toneOf(s.py) };
    });
    toks.forEach((s, i) => {
      if ((s.ch === '一' && s.py !== 'yī') || (s.ch === '不' && s.py !== 'bù')) out[i]!.why = `${s.ch} changes before a ${toneOf(toks[i + 1]?.py ?? '')}${['', 'st', 'nd', 'rd', 'th', ''][toneOf(toks[i + 1]?.py ?? '')]} tone`;
    });
    // Third-tone sandhi: a 3rd tone before another 3rd tone is said as a 2nd.
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i]!.tone === 3 && out[i + 1]!.tone === 3 && out[i + 1]!.saidTone !== 2) {
        out[i]!.said = mark(bare(out[i]!.written), 2);
        out[i]!.saidTone = 2;
        out[i]!.why = '3rd before 3rd becomes 2nd';
      }
    }
    // A 3rd tone before anything else is a "half third": just the low part.
    out.forEach((s, i) => {
      if (s.saidTone === 3 && i < out.length - 1 && out[i + 1]!.tone !== 5) {
        s.saidTone = 'half3';
        s.why ??= 'half 3rd: only the low part';
      }
    });
    return out;
  }

  const rows = $derived(list.map((p) => ({ text: p, syl: analyse(p), gloss: lookup(p)?.g })));

  const W = 30;
  const y = (v: number) => 3 + ((5 - v) / 4) * 18;
  function path(t: Tone | 'half3'): string {
    if (t === 5) return `M10,${y(2)} L20,${y(1.8)}`;
    const pts = t === 'half3' ? [2, 1, 1] : targetContour(t, 10);
    const n = pts.length;
    return pts.map((v, i) => `${i ? 'L' : 'M'}${(3 + (i / (n - 1)) * (W - 6)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  }
  const toneClass = (t: Tone | 'half3') => `t${t === 'half3' ? 3 : t}`;
</script>

<figure class="lab card">
  <div class="switch ui" role="radiogroup" aria-label="Show tones as">
    <button role="radio" aria-checked={!spoken} class:on={!spoken} onclick={() => (spoken = false)}>As written</button>
    <button role="radio" aria-checked={spoken} class:on={spoken} onclick={() => (spoken = true)}>As spoken</button>
  </div>
  <ul>
    {#each rows as r (r.text)}
      <li>
        <PlayButton text={r.text} small />
        <span class="syls">
          {#each r.syl as s, i (i)}
            {@const t = spoken ? s.saidTone : s.tone}
            <span class="syl {toneClass(t)}" class:changed={spoken && s.why}>
              <svg viewBox="0 0 {W} 24" aria-hidden="true"><path d={path(t)} /></svg>
              <span class="ch zh-font">{s.ch}</span>
              <span class="py">{spoken ? s.said : s.written}</span>
            </span>
          {/each}
        </span>
        <span class="note ui">
          {#if spoken}{r.syl.map((s) => s.why).filter(Boolean)[0] ?? ''}{:else}{r.gloss ?? ''}{/if}
        </span>
      </li>
    {/each}
  </ul>
</figure>

<style>
  .lab {
    margin: 1.6rem 0;
    padding: 0.9rem 1.1rem;
  }
  .switch {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 2px;
    margin-bottom: 0.7rem;
  }
  .switch button {
    border: none;
    background: none;
    border-radius: 999px;
    padding: 0.3rem 0.9rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--mute);
  }
  .switch button.on {
    background: var(--fg);
    color: var(--bg);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  li {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 0.6rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--line);
  }
  .syls {
    display: flex;
    gap: 0.15rem;
  }
  .syl {
    display: grid;
    justify-items: center;
    width: 2.6rem;
    border-radius: 8px;
    padding: 0.1rem 0;
    transition: background-color 150ms;
  }
  .syl.changed {
    background: color-mix(in srgb, var(--tone) 14%, transparent);
  }
  svg {
    width: 2rem;
    height: 1.4rem;
  }
  path {
    fill: none;
    stroke: var(--tone);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ch {
    font-size: 1.35rem;
    line-height: 1.1;
  }
  .py {
    font-family: var(--font-py);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--tone);
  }
  .note {
    font-size: 0.8rem;
    color: var(--mute);
  }
</style>
