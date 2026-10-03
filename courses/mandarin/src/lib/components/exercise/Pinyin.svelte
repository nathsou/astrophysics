<script lang="ts">
  import { untrack } from 'svelte';
  /** Type the pinyin. Tone numbers turn into marks as you type (ni3 → nǐ). */
  import type { PinyinEx } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import { annotate } from '$lib/zh/annotate';
  import { comparePinyin, numbersToMarks, syllables } from '$lib/zh/pinyin';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Steps from './Steps.svelte';
  import Feedback from './Feedback.svelte';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';

  let { data, id, report }: { data: PinyinEx; id: string; report: (ok: boolean) => void } = $props();
  const seq = new Sequence(untrack(() => data.items.length));
  const item = $derived(data.items[seq.index]!);
  const expected = $derived(
    item.answer ??
      annotate(item.zh)
        .flatMap((t) => t.s?.map((s) => s.py) ?? [])
        .join(' '),
  );
  let typed = $state('');
  let last = $state<ReturnType<typeof comparePinyin> | null>(null);
  let input: HTMLInputElement | undefined = $state();
  const preview = $derived(numbersToMarks(typed.replace(/v/g, 'ü')));

  $effect(() => {
    void seq.index;
    void seq.round;
    typed = '';
    last = null;
    if (!seq.done && data.listen && (seq.index > 0 || seq.round > 0)) return speech.schedule(item.zh);
  });

  function check(e?: Event) {
    e?.preventDefault();
    if (seq.settled || !typed.trim()) return;
    last = comparePinyin(typed, expected);
    seq.attempt(last.correct);
    sfx(last.correct ? 'right' : 'wrong', settings.data.sounds);
    if (last.correct) void speech.say(item.zh);
  }

  const hint = $derived.by(() => {
    if (!last || last.correct) return '';
    if (last.soundsRight && last.tonesWrong.length) {
      const exp = syllables(expected);
      return `Right sounds, but check the tone on ${last.tonesWrong.map((i) => `“${syllables(preview)[i] ?? exp[i]}”`).join(' and ')}.`;
    }
    if (last.soundsRight) return 'Right letters; check where the syllables split.';
    return 'Not quite. Listen again, and try it slowly.';
  });
</script>

<Steps {seq} {report} canReveal={!!last && !last.correct} onreveal={() => (last = null)}>
  <div class="stage">
    <PlayButton text={item.zh} />
    <PlayButton text={item.zh} slow />
    {#if !data.listen || seq.settled}<Zh text={item.zh} size="lg" pinyin={seq.settled ? 'show' : 'hide'} play={false} plain={!seq.settled} />{/if}
    {#if item.en}<span class="en ui">{item.en}</span>{/if}
  </div>
  <form class="type ui" onsubmit={check}>
    <label class="sr-only" for="{id}-{seq.index}">Pinyin</label>
    <input
      bind:this={input}
      id="{id}-{seq.index}"
      bind:value={typed}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="e.g. ni3 hao3"
      disabled={seq.settled}
      class:ok={last?.correct}
      class:bad={last && !last.correct}
    />
    {#if !seq.settled}<button class="btn" type="submit" disabled={!typed.trim()}>Check</button>{/if}
  </form>
  <p class="preview ui" aria-live="polite">{#if typed && preview !== typed}{preview}{:else}&nbsp;{/if}</p>
  {#snippet feedback()}
    {#if seq.settled}
      <Feedback ok={last?.correct ?? false} text={expected} />
    {:else if last}
      <Feedback ok={false} text={hint} />
    {:else}
      <span class="tip">Type tone numbers after each syllable: 1–4, or 5 for neutral. Use v for ü.</span>
    {/if}
  {/snippet}
</Steps>

<style>
  .stage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    min-height: 3.5rem;
    margin-bottom: 0.6rem;
  }
  .en {
    color: var(--mute);
    font-size: 0.9rem;
  }
  .type {
    display: flex;
    gap: 0.5rem;
  }
  input {
    flex: 1;
    min-width: 0;
    font-size: 1.15rem;
    padding: 0.55rem 0.8rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
  }
  input.ok {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  input.bad {
    border-color: var(--accent);
  }
  .preview {
    margin: 0.3rem 0 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--ink-2);
    min-height: 1.6rem;
  }
  .tip {
    color: var(--mute);
    font-size: 0.85rem;
  }
</style>
