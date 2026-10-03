<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * Free conversation with Claude playing a character, with a goal to reach. Claude keeps to the
   * learner's words; the course double-checks and flags any word it has not taught yet.
   */
  import type { Roleplay } from '$lib/exercises/types';
  import type Anthropic from '@anthropic-ai/sdk';
  import { settings } from '$lib/state/settings.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { askClaude, tag, TutorError } from '$lib/tutor/tutor';
  import { roleplaySystem, roleplayVerdictSystem } from '$lib/tutor/prompts';
  import { levelLabel, unfamiliar } from '$lib/tutor/known';
  import Zh from '../zh/Zh.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import Rich from './Rich.svelte';
  import TutorGate from './TutorGate.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, report }: { data: Roleplay; id: string; report: (ok: boolean) => void } = $props();

  type Turn = { from: 'they' | 'you'; zh: string; en?: string; fix?: string; fresh?: string[] };
  let log = $state<Turn[]>([]);
  let input = $state('');
  let busy = $state(false);
  let error = $state('');
  let done = $state(false);
  let review = $state('');
  let showEn = $state(false);
  let controller: AbortController | null = null;

  const known = $derived(new Set([...Object.values(deck.data.cards).map((c) => c.word), ...(data.words ?? [])]));
  const maxLevel = $derived(settings.data.start === 'hsk2' ? 2 : 1);
  const setup = $derived({
    setting: data.setting,
    goal: data.goal,
    partner: data.partner,
    level: levelLabel(settings.data.start),
    known: [...known],
    checks: data.checks,
  });

  log = [{ from: 'they', zh: untrack(() => data.opener), en: untrack(() => data.openerEn) }];

  function history(): Anthropic.MessageParam[] {
    // The opener is Claude's first line; the API needs the conversation to start with the user.
    const msgs: Anthropic.MessageParam[] = [{ role: 'user', content: '(The scene begins. Say your opening line.)' }];
    for (const t of log) {
      if (t.from === 'they') msgs.push({ role: 'assistant', content: `<reply>${t.zh}</reply>\n<en>${t.en ?? ''}</en>\n<fix></fix>\n<done>no</done>` });
      else msgs.push({ role: 'user', content: t.zh });
    }
    return msgs;
  }

  async function send(e?: Event) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    error = '';
    log = [...log, { from: 'you', zh: text }];
    input = '';
    busy = true;
    controller = new AbortController();
    try {
      const out = await askClaude({ system: roleplaySystem(setup), messages: history(), effort: 'low', signal: controller.signal });
      const zh = tag(out, 'reply') || out.trim();
      const fix = tag(out, 'fix');
      if (fix) log[log.length - 1]!.fix = fix;
      log = [...log, { from: 'they', zh, en: tag(out, 'en'), fresh: unfamiliar(zh, known, settings.data.list, maxLevel) }];
      void speech.say(zh);
      if (/^yes/i.test(tag(out, 'done'))) await finish(true);
    } catch (err) {
      error = err instanceof TutorError ? err.message : String(err);
      log = log.slice(0, -1);
      input = text;
    } finally {
      busy = false;
    }
  }

  async function finish(reached: boolean) {
    done = true;
    busy = true;
    try {
      const transcript = log.map((t) => `${t.from === 'you' ? 'Learner' : data.partner}: ${t.zh}`).join('\n');
      review = await askClaude({ system: roleplayVerdictSystem(setup), messages: [{ role: 'user', content: transcript }], effort: 'medium' });
      report(reached);
    } catch (err) {
      review = err instanceof TutorError ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  function restart() {
    controller?.abort();
    log = [{ from: 'they', zh: data.opener, en: data.openerEn }];
    done = false;
    review = '';
    error = '';
  }
</script>

{#if !settings.tutorEnabled}
  <TutorGate what="This conversation" />
{:else}
  <div class="rp">
    <p class="brief"><Icon name="map" size={15} /> <span><Rich text={data.setting} /> <strong>Your goal:</strong> <Rich text={data.goal} /></span></p>
    {#if data.words?.length}<p class="words ui">Try to use: {#each data.words as w (w)}<span class="chip"><Zh text={w} play={false} /></span>{/each}</p>{/if}
    <div class="log" aria-live="polite">
      {#each log as t, i (i)}
        <div class="msg {t.from}">
          <div class="bubble">
            <span class="line"><Zh text={t.zh} size="md" play={false} />{#if t.from === 'they'}<PlayButton text={t.zh} small />{/if}</span>
            {#if t.en && showEn}<span class="en">{t.en}</span>{/if}
            {#if t.fresh?.length}<span class="fresh ui">New to you: {#each t.fresh as w (w)}<Zh text={w} play={false} /> {/each}</span>{/if}
          </div>
          {#if t.fix}<p class="fix ui"><Icon name="lightbulb" size={14} /> <Rich text={t.fix} /></p>{/if}
        </div>
      {/each}
      {#if busy && !done}<div class="msg they"><div class="bubble typing">…</div></div>{/if}
    </div>
    {#if error}<p class="err ui">{error}</p>{/if}
    {#if !done}
      <form class="say ui" onsubmit={send}>
        <input bind:value={input} placeholder="Type in characters or pinyin…" aria-label="Your reply" autocomplete="off" disabled={busy} />
        <button class="btn primary" disabled={busy || !input.trim()}>Send</button>
      </form>
      <div class="row ui">
        <label><input type="checkbox" bind:checked={showEn} /> Show English</label>
        {#if log.length > 2}<button class="btn small ghost" onclick={() => finish(false)} disabled={busy}>End and get feedback</button>{/if}
      </div>
    {:else}
      <div class="review">
        <p class="ui rh"><Icon name="sparkle" size={14} /> Feedback</p>
        {#if busy}<p>Reading your conversation…</p>{:else}<p><Rich text={review} /></p>{/if}
        <button class="btn small" onclick={restart}><Icon name="refresh" size={14} />Start over</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .brief {
    display: flex;
    gap: 0.45rem;
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    color: var(--ink-2);
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    margin: 0 0 0.8rem;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .chip {
    background: var(--pn);
    border-radius: 8px;
    padding: 0 0.4rem;
  }
  .log {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }
  .msg {
    display: grid;
    justify-items: start;
  }
  .msg.you {
    justify-items: end;
  }
  .bubble {
    max-width: 90%;
    background: var(--pn);
    padding: 0.35rem 0.8rem 0.45rem;
    border-radius: 16px 16px 16px 4px;
  }
  .you .bubble {
    background: var(--accent-soft);
    border-radius: 16px 16px 4px 16px;
  }
  .typing {
    color: var(--mute);
    animation: blink 1s infinite alternate;
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
  .fresh {
    display: block;
    font-size: 0.75rem;
    color: var(--gold);
  }
  .fix {
    display: flex;
    gap: 0.3rem;
    align-items: baseline;
    max-width: 90%;
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    color: var(--jade);
  }
  .say {
    display: flex;
    gap: 0.5rem;
  }
  .say input {
    flex: 1;
    min-width: 0;
    font-size: 1rem;
    padding: 0.55rem 0.8rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .err {
    color: var(--bad);
    font-size: 0.88rem;
  }
  .review {
    border-top: 1px dashed var(--line-strong);
    padding-top: 0.7rem;
  }
  .rh {
    margin: 0;
    font-weight: 700;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-ink);
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  @keyframes blink {
    from {
      opacity: 0.3;
    }
  }
</style>
