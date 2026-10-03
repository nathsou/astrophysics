<script lang="ts">
  import { untrack } from 'svelte';
  /** Watch the stroke order, then write each character yourself, stroke by stroke. */
  import type HanziWriterType from 'hanzi-writer';
  import type { Write } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import { lookup } from '$lib/zh/lexicon';
  import { annotate } from '$lib/zh/annotate';
  import { settings } from '$lib/state/settings.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { speech } from '$lib/audio/speech.svelte';
  import Steps from './Steps.svelte';
  import Feedback from './Feedback.svelte';
  import HanziCanvas from '../zh/HanziCanvas.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, report }: { data: Write; id: string; report: (ok: boolean) => void } = $props();
  const chars = $derived([...data.chars].filter((c) => /\p{Script=Han}/u.test(c)));
  const seq = new Sequence(untrack(() => [...data.chars].filter((c) => /\p{Script=Han}/u.test(c)).length));
  const ch = $derived(chars[seq.index]!);
  const info = $derived(annotate(ch)[0]?.s?.[0]);
  let mode = $state<'show' | 'quiz'>('show');
  let watch: HanziWriterType | undefined = $state();
  let mistakes = $state<number | null>(null);
  let strokes = $state(0);

  $effect(() => {
    void seq.index;
    void seq.round;
    mode = 'show';
    mistakes = null;
    strokes = 0;
  });

  function done(m: number) {
    mistakes = m;
    const ok = m <= 2;
    seq.attempt(ok);
    seq.settled = true;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    void speech.say(ch);
  }
</script>

<Steps {seq} {report}>
  <div class="wrap">
    {#key `${ch}:${mode}:${seq.round}`}
      <HanziCanvas char={ch} {mode} bind:writer={watch} oncomplete={done} onstroke={(ok) => ok && strokes++} />
    {/key}
    <div class="side">
      <p class="info"><span class="t{info?.tone ?? 5} py">{info?.py}</span> <span class="gloss">{lookup(ch)?.g ?? ''}</span></p>
      {#if mode === 'show'}
        <p class="ui how">Watch the strokes, then write it yourself. Order matters: it is how your hand will remember the shape.</p>
        <div class="btns ui">
          <button class="btn" onclick={() => watch?.animateCharacter()}><Icon name="play" size={14} />Animate</button>
          <button class="btn primary" onclick={() => (mode = 'quiz')}><Icon name="brush" size={15} />Now you write it</button>
        </div>
      {:else if mistakes === null}
        <p class="ui how">Draw each stroke in order with your finger or mouse. After three misses, the next stroke is hinted.</p>
        <button class="btn small ghost" onclick={() => (mode = 'show')}>Watch again</button>
      {/if}
    </div>
  </div>
  {#snippet feedback()}
    {#if mistakes !== null}
      <Feedback ok={mistakes <= 2} text={mistakes === 0 ? 'Every stroke right.' : `${mistakes} stroke slip${mistakes > 1 ? 's' : ''}.`} />
    {/if}
  {/snippet}
</Steps>

<style>
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    align-items: flex-start;
  }
  .side {
    flex: 1;
    min-width: 12rem;
  }
  .info {
    margin: 0 0 0.4rem;
  }
  .py {
    color: var(--tone);
    font-weight: 700;
    font-family: var(--font-py);
    font-size: 1.2rem;
  }
  .gloss {
    color: var(--ink-2);
  }
  .how {
    font-size: 0.88rem;
    color: var(--ink-2);
    margin: 0 0 0.8rem;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
