<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * A conversation in which you choose what to say. Wrong choices are not just marked wrong:
   * the other person reacts, in character, the way a real person would.
   */
  import type { Scene } from '$lib/exercises/types';
  import { shuffle } from '$lib/exercises/shuffle';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import Rich from './Rich.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, id, report }: { data: Scene; id: string; report: (ok: boolean) => void } = $props();

  type Msg = { from: 'they' | 'you'; zh: string; en?: string; miss?: boolean };
  let round = $state(0);
  let turn = $state(0);
  let log = $state<Msg[]>([]);
  let misses = $state(0);
  let finished = $state(false);
  let tried = $state<Set<number>>(new Set());
  let showEn = $state(false);
  const t = $derived(data.turns[turn]);
  const order = $derived(t ? shuffle(t.options.map((_, i) => i), `${id}:${turn}:${round}`) : []);

  function start() {
    log = [];
    turn = 0;
    misses = 0;
    finished = false;
    tried = new Set();
    say(0);
  }
  function say(k: number) {
    const tt = data.turns[k];
    if (tt?.they) {
      log = [...log, { from: 'they', zh: tt.they, en: tt.theyEn }];
      void speech.say(tt.they);
    }
  }
  $effect(() => {
    void round;
    untrack(start);
  });

  async function choose(i: number) {
    const o = t!.options[i]!;
    if (tried.has(i)) return;
    if (o.ok) {
      log = [...log, { from: 'you', zh: o.zh, en: o.en }];
      sfx('right', settings.data.sounds);
      await speech.say(o.zh);
      if (o.reply) {
        log = [...log, { from: 'they', zh: o.reply, en: o.replyEn }];
        await speech.say(o.reply);
      }
      tried = new Set();
      if (turn + 1 >= data.turns.length) {
        finished = true;
        report(misses <= Math.floor(data.turns.length / 2));
        sfx('done', settings.data.sounds);
      } else {
        turn++;
        say(turn);
      }
    } else {
      misses++;
      tried = new Set([...tried, i]);
      sfx('wrong', settings.data.sounds);
      log = [...log, { from: 'you', zh: o.zh, en: o.en, miss: true }];
      if (o.reply) {
        log = [...log, { from: 'they', zh: o.reply, en: o.replyEn, miss: true }];
        void speech.say(o.reply);
      }
    }
  }
</script>

<div class="scene">
  {#if data.setting}<p class="setting"><Icon name="map" size={15} /> <Rich text={data.setting} /></p>{/if}
  <div class="log" aria-live="polite">
    {#each log as m, i (i)}
      <div class="msg {m.from}" class:miss={m.miss}>
        <span class="who ui">{m.from === 'you' ? 'You' : data.partner}</span>
        <div class="bubble">
          <span class="line"><Zh text={m.zh} size="md" play={false} />{#if m.from === 'they'}<PlayButton text={m.zh} small />{/if}</span>
          {#if m.en && (showEn || m.miss)}<span class="en">{m.en}</span>{/if}
        </div>
      </div>
    {/each}
  </div>
  {#if !finished && t}
    <div class="options">
      <p class="ui q">What do you say?</p>
      {#each order as i (i)}
        {@const o = t.options[i]!}
        <button class="opt" disabled={tried.has(i)} onclick={() => choose(i)}>
          <Zh text={o.zh} plain play={false} />
          {#if showEn && o.en}<span class="oen ui">{o.en}</span>{/if}
        </button>
      {/each}
    </div>
  {:else if finished}
    <div class="end ui">
      {#if data.end}<p><Rich text={data.end} /></p>{/if}
      <p><strong>{misses === 0 ? '太棒了！ A flawless conversation.' : `Conversation complete, with ${misses} awkward moment${misses > 1 ? 's' : ''}.`}</strong></p>
      <button class="btn small" onclick={() => (round += 1)}><Icon name="refresh" size={14} />Play again</button>
    </div>
  {/if}
  <label class="en-toggle ui"><input type="checkbox" bind:checked={showEn} /> Show English</label>
</div>

<style>
  .setting {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
    margin: 0 0 0.8rem;
    color: var(--ink-2);
    font-style: italic;
    font-size: 0.95rem;
  }
  .log {
    display: grid;
    gap: 0.55rem;
    margin-bottom: 0.9rem;
  }
  .msg {
    display: grid;
    justify-items: start;
  }
  .msg.you {
    justify-items: end;
  }
  .who {
    font-size: 0.7rem;
    color: var(--mute);
    font-weight: 600;
    padding: 0 0.5rem;
  }
  .bubble {
    max-width: 90%;
    background: var(--pn);
    padding: 0.35rem 0.8rem 0.45rem;
    border-radius: 16px 16px 16px 4px;
    animation: pop 180ms ease-out;
  }
  .you .bubble {
    background: var(--accent-soft);
    border-radius: 16px 16px 4px 16px;
  }
  .miss .bubble {
    opacity: 0.75;
  }
  .you.miss .bubble {
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .line {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .en {
    display: block;
    font-size: 0.85rem;
    color: var(--ink-2);
    font-style: italic;
  }
  .options {
    display: grid;
    gap: 0.45rem;
  }
  .q {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .opt {
    text-align: left;
    padding: 0.45rem 0.9rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.6rem;
    color: var(--fg);
  }
  .opt:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .opt:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .oen {
    font-size: 0.82rem;
    color: var(--mute);
  }
  .end p {
    margin: 0 0 0.5rem;
  }
  .en-toggle {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    margin-top: 0.8rem;
    font-size: 0.8rem;
    color: var(--mute);
  }
  @keyframes pop {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
  }
</style>
