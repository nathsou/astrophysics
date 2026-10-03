<script lang="ts">
  import { untrack } from 'svelte';
  /** Hear (and see) a word, pick the tone of each syllable. Answers come from the dictionary. */
  import type { Tones } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import { annotate } from '$lib/zh/annotate';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Steps from './Steps.svelte';
  import Feedback from './Feedback.svelte';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import ToneGlyph from '../ui/ToneGlyph.svelte';

  let { data, report }: { data: Tones; id: string; report: (ok: boolean) => void } = $props();
  const items = $derived(data.items.map((it) => (typeof it === 'string' ? { zh: it } : it)));
  const seq = new Sequence(untrack(() => data.items.length));
  const item = $derived(items[seq.index]!);
  const syl = $derived(annotate(item.zh).flatMap((t) => t.s ?? []));
  const withNeutral = $derived(items.some((it) => annotate(it.zh).some((t) => t.s?.some((s) => s.tone === 5))));
  const choices = $derived(withNeutral ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]);
  let picked = $state<(number | null)[]>([]);
  let checked = $state<(boolean | null)[]>([]);
  let last = $state<boolean | null>(null);
  const NAMES = ['', 'high', 'rising', 'dipping', 'falling', 'neutral'];

  $effect(() => {
    void seq.index;
    void seq.round;
    picked = syl.map(() => null);
    checked = syl.map(() => null);
    last = null;
    if (!seq.done && (seq.index > 0 || seq.round > 0)) return speech.schedule(item.zh);
  });

  function choose(k: number, t: number) {
    if (seq.settled) return;
    picked[k] = t;
    checked[k] = null;
    if (syl.length === 1) check();
  }

  function check() {
    checked = syl.map((s, k) => picked[k] === s.tone);
    const ok = checked.every(Boolean);
    seq.attempt(ok);
    last = ok;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
  }
</script>

<Steps {seq} {report} canReveal={last === false} onreveal={() => ((picked = syl.map((s) => s.tone)), (last = null))}>
  <div class="stage">
    <PlayButton text={item.zh} />
    <PlayButton text={item.zh} slow />
    {#if !data.listen || seq.settled}<Zh text={item.zh} size="lg" pinyin={seq.settled ? 'show' : 'hide'} play={false} plain={!seq.settled} />{/if}
    {#if item.en && seq.settled}<span class="en ui">{item.en}</span>{/if}
  </div>
  <div class="rows">
    {#each syl as s, k (k)}
      <div class="row">
        <span class="ch zh-font">{data.listen && !seq.settled ? `${k + 1}` : s.ch}</span>
        <div class="tones" role="radiogroup" aria-label="Tone of syllable {k + 1}">
          {#each choices as t (t)}
            <button
              role="radio"
              aria-checked={picked[k] === t}
              class="tone t{t}"
              class:on={picked[k] === t}
              class:right={checked[k] === true && picked[k] === t}
              class:wrong={checked[k] === false && picked[k] === t}
              disabled={seq.settled}
              title="{t === 5 ? 'Neutral' : `Tone ${t}`}: {NAMES[t]}"
              onclick={() => choose(k, t)}
            >
              <ToneGlyph tone={t} />
              <span class="ui">{t === 5 ? '·' : t}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  {#snippet feedback()}
    {#if seq.settled}
      <Feedback ok={last ?? false} text={syl.map((s) => s.py).join(' ')} />
    {:else if last === false}
      <Feedback ok={false} text="Listen again and fix the red ones." />
    {:else if syl.length > 1}
      <button class="btn" disabled={picked.some((p) => p === null)} onclick={check}>Check</button>
    {/if}
  {/snippet}
</Steps>

<style>
  .stage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    min-height: 4rem;
    margin-bottom: 0.6rem;
  }
  .en {
    color: var(--mute);
    font-size: 0.9rem;
  }
  .rows {
    display: grid;
    gap: 0.45rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .ch {
    width: 2rem;
    text-align: center;
    font-size: 1.5rem;
    color: var(--mute);
  }
  .tones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tone {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0.65rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--tone);
    cursor: pointer;
    font-weight: 700;
    font-size: 0.85rem;
    transition: background-color 100ms, border-color 100ms;
  }
  .tone:hover:not(:disabled) {
    border-color: var(--tone);
  }
  .tone.on {
    background: color-mix(in srgb, var(--tone) 14%, var(--panel));
    border-color: var(--tone);
  }
  .tone.right {
    box-shadow: 0 0 0 2px var(--jade);
  }
  .tone.wrong {
    box-shadow: 0 0 0 2px var(--accent);
    animation: shake 300ms;
  }
  .tone:disabled {
    cursor: default;
  }
  @keyframes shake {
    25% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
  }
</style>
