<script lang="ts">
  import { untrack } from 'svelte';
  import type { Choose, ChooseItem } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import { shuffle } from '$lib/exercises/shuffle';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Steps from './Steps.svelte';
  import Feedback from './Feedback.svelte';
  import Rich from './Rich.svelte';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';

  type Item = ChooseItem & { sentence?: string; en?: string };
  let { data, id, report }: { data: Choose & { items: Item[] }; id: string; report: (ok: boolean) => void } = $props();

  const seq = new Sequence(untrack(() => data.items.length));
  const item = $derived(data.items[seq.index]!);
  const order = $derived(shuffle(item.options.map((_, i) => i), `${id}:${seq.index}:${seq.round}`));
  let wrong = $state<Set<number>>(new Set());
  let last = $state<boolean | null>(null);
  const audioText = $derived(item.audio === true ? (item.zh ?? '') : typeof item.audio === 'string' ? item.audio : '');
  const isZh = (s: string) => /\p{Script=Han}/u.test(s);

  $effect(() => {
    void seq.index;
    void seq.round;
    wrong = new Set();
    last = null;
    if (item.listen && audioText) setTimeout(() => void speech.say(audioText), 250);
  });

  function pick(i: number) {
    if (seq.settled || wrong.has(i)) return;
    const ok = i === item.answer;
    seq.attempt(ok);
    last = ok;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    if (!ok) wrong = new Set([...wrong, i]);
    else if (isZh(item.options[i]!) && !item.listen) void speech.say(item.options[i]!);
  }

  function onKey(e: KeyboardEvent) {
    const n = Number(e.key);
    if (n >= 1 && n <= order.length && !(e.target instanceof HTMLInputElement)) pick(order[n - 1]!);
  }
  const filled = $derived(item.sentence && seq.settled ? item.sentence.replace(/_{3,}/, item.options[item.answer]!) : item.sentence);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="choose" onkeydown={onKey}>
  <Steps {seq} {report} canReveal={wrong.size > 0} onreveal={() => (last = null)}>
    {#if item.prompt}<p class="prompt"><Rich text={item.prompt} /></p>{/if}
    {#if item.zh && !item.listen}
      <div class="big"><Zh text={item.zh} size="lg" pinyin={item.noPinyin ? 'hide' : 'auto'} play={false} />{#if audioText}<PlayButton text={audioText} />{/if}</div>
    {:else if audioText}
      <div class="listen"><PlayButton text={audioText} /><PlayButton text={audioText} slow /><span class="ui hint">Listen{seq.settled && item.zh ? ':' : ''}</span>{#if seq.settled && item.zh}<Zh text={item.zh} size="md" />{/if}</div>
    {/if}
    {#if filled}
      <p class="sentence">{#key filled}<Rich text={filled} size="md" />{/key}</p>
      {#if item.en}<p class="en ui">{item.en}</p>{/if}
    {/if}
    <div class="options" class:zh={item.options.every(isZh)} role="group" aria-label="Options">
      {#each order as i, k (i)}
        {@const o = item.options[i]!}
        <button
          class="option"
          class:right={seq.settled && i === item.answer}
          class:wrong={wrong.has(i)}
          disabled={wrong.has(i) || (seq.settled && i !== item.answer)}
          onclick={() => pick(i)}
        >
          <span class="n ui">{k + 1}</span>
          <span class="o">{#if isZh(o)}<Zh text={o} size="md" pinyin={item.noPinyin && !seq.settled ? 'hide' : 'auto'} plain play={false} />{:else}<Rich text={o} />{/if}</span>
        </button>
      {/each}
    </div>
    {#snippet feedback()}
      {#if seq.settled}
        <Feedback ok={last ?? false} explain={item.explain} text={last === null ? `The answer is ${item.options[item.answer]}.` : ''} />
      {:else if last === false}
        <Feedback ok={false} text="Try another." />
      {/if}
    {/snippet}
  </Steps>
</div>

<style>
  .prompt {
    margin: 0 0 0.6rem;
    font-size: 1.02rem;
  }
  .big {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0.2rem 0 0.8rem;
  }
  .listen {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.2rem 0 0.9rem;
  }
  .hint {
    color: var(--mute);
    font-size: 0.85rem;
    margin-right: 0.3rem;
  }
  .sentence {
    margin: 0.3rem 0 0.2rem;
  }
  .en {
    margin: 0 0 0.8rem;
    color: var(--mute);
    font-size: 0.88rem;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    gap: 0.5rem;
  }
  .options.zh {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-align: left;
    padding: 0.55rem 0.8rem;
    border: 1.5px solid var(--line-strong);
    border-radius: 12px;
    background: var(--panel);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.98rem;
    line-height: 1.35;
    min-height: 3rem;
    transition: border-color 120ms, background-color 120ms, transform 80ms;
  }
  .option:hover:not(:disabled) {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, var(--panel));
  }
  .option:active:not(:disabled) {
    transform: scale(0.98);
  }
  .n {
    flex: none;
    display: grid;
    place-items: center;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 6px;
    background: var(--pn);
    color: var(--mute);
    font-size: 0.72rem;
    font-weight: 700;
  }
  .option.right {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  .option.right .n {
    background: var(--jade);
    color: #fff;
  }
  .option.wrong {
    border-color: var(--accent);
    background: var(--accent-soft);
    opacity: 0.7;
    animation: shake 300ms;
  }
  .option:disabled {
    cursor: default;
  }
  .option:disabled:not(.right):not(.wrong) {
    opacity: 0.45;
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
