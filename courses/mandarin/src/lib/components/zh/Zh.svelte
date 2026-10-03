<script lang="ts">
  /**
   * Chinese text with pinyin above each character (shown according to the learner's settings),
   * tone colours, and a word card on tap. Use `pinyin="hide"` where pinyin would give the
   * answer away, and `plain` for text that should not open word cards.
   */
  import { annotate, plain as stripReadings } from '$lib/zh/annotate';
  import { speech } from '$lib/audio/speech.svelte';
  import { popover } from './popover.svelte';
  import PlayButton from './PlayButton.svelte';

  let {
    text,
    size = 'inline',
    pinyin = 'auto',
    plain = false,
    play,
  }: {
    text: string;
    size?: 'inline' | 'md' | 'lg' | 'xl' | 'hero';
    pinyin?: 'auto' | 'show' | 'hide';
    plain?: boolean;
    /** Show a play button for the whole text (default: for sentences of 4+ characters). */
    play?: boolean;
  } = $props();

  const tokens = $derived(annotate(text));
  const hanCount = $derived(tokens.reduce((n, t) => n + (t.s?.length ?? 0), 0));
  const showPlay = $derived(play ?? (size === 'inline' && hanCount >= 4));

  function openWord(e: Event, i: number) {
    const t = tokens[i]!;
    if (plain) return;
    e.stopPropagation();
    popover.open(t, e.currentTarget as HTMLElement);
    void speech.say(t.t);
  }

  function key(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openWord(e, i);
    }
  }
</script>

<span class="zh {size}" class:hide-py={pinyin === 'hide'} class:show-py={pinyin === 'show'} lang="zh-CN"
  ><!-- svelte-ignore a11y_no_noninteractive_tabindex -->{#each tokens as t, i (i)}{#if t.s}<span
        class="word"
        class:plain
        role={plain ? undefined : 'button'}
        tabindex={plain ? undefined : 0}
        aria-label={plain ? undefined : `${t.t} (${t.s.map((s) => s.py).join(' ')})`}
        onclick={(e) => openWord(e, i)}
        onkeydown={(e) => key(e, i)}
        class:playing={speech.playing === t.t}
        >{#each t.s as s, k (k)}<ruby class="t{s.tone}">{s.ch}<rt>{s.py}</rt></ruby>{/each}</span
      >{:else}<span class="punct">{t.t}</span>{/if}{/each}{#if showPlay}<PlayButton text={stripReadings(text)} small />{/if}</span
>

<style>
  .zh {
    font-family: var(--font-zh);
    font-style: normal;
    font-size: 1.12em;
  }
  .md {
    font-size: 1.45rem;
  }
  .lg {
    font-size: 2rem;
    line-height: 1.5;
  }
  .xl {
    font-size: 3rem;
    line-height: 1.4;
  }
  .hero {
    font-size: clamp(3.5rem, 12vw, 6rem);
    line-height: 1.25;
  }
  .word {
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 120ms;
  }
  .word.plain {
    cursor: inherit;
  }
  .word:not(.plain):hover,
  .word:focus-visible,
  .word.playing {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  ruby {
    ruby-position: over;
    ruby-align: center;
  }
  rt {
    font-family: var(--font-py);
    font-size: 0.5em;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--tone, var(--mute));
    line-height: 1;
    padding: 0 0.12em 0.1em;
    user-select: none;
  }
  .xl rt,
  .hero rt {
    font-size: 0.32em;
  }
  .lg rt {
    font-size: 0.4em;
  }
  /* The scaffolding dial: pinyin always, on tap/hover, or never. */
  :global(:root[data-pinyin='tap']) .zh:not(.show-py) rt {
    visibility: hidden;
  }
  :global(:root[data-pinyin='tap']) .zh:not(.show-py) .word:hover rt,
  :global(:root[data-pinyin='tap']) .zh:not(.show-py) .word:focus-visible rt {
    visibility: visible;
  }
  :global(:root[data-pinyin='off']) .zh:not(.show-py) rt,
  .hide-py rt {
    display: none;
  }
</style>
