<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { LESSONS } from '$content/outline';
  import { nav } from '$lib/state/nav.svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { PROVIDERS } from '$lib/tutor/providers';
  import { askTutor, tag, type TutorMessage } from '$lib/tutor/tutor';
  import { teacherSystem, teacherHistory, type TeacherMode } from '$lib/tutor/teacher';
  import { levelLabel } from '$lib/tutor/known';
  import { insertAt } from '$lib/tutor/keyboard';
  import Rich from '../exercise/Rich.svelte';
  import TutorGate from '../exercise/TutorGate.svelte';
  import PlayButton from '../zh/PlayButton.svelte';
  import MandarinKeyboard from '../zh/MandarinKeyboard.svelte';
  import Icon from '../ui/Icon.svelte';

  const sources = import.meta.glob('/content/lessons/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  type Turn = TutorMessage & { reply?: string; translation?: string; advice?: string };
  let open = $state(false);
  let mode = $state<TeacherMode>('course');
  let conversations = $state<Record<TeacherMode, Turn[]>>({ course: [], mandarin: [] });
  const turns = $derived(conversations[mode]);
  let draft = $state('');
  let busy = $state(false);
  let error = $state('');
  let keyboard = $state(false);
  let input = $state<HTMLTextAreaElement>();
  let panel = $state<HTMLElement>();
  let launcher: HTMLButtonElement;
  let log = $state<HTMLDivElement>();
  let controller: AbortController | null = null;
  let generation = 0;
  const path = $derived(page.url.pathname.slice(base.length));
  const lesson = $derived(LESSONS.find(l => path === `/learn/${l.slug}/` || path === `/learn/${l.slug}`));
  const section = $derived(nav.toc.find(t => t.id === nav.activeId)?.text);

  async function reveal() { open = true; await tick(); (input ?? panel)?.focus(); }
  function stop() { controller?.abort(); }
  function close() { stop(); open = false; launcher?.focus(); }
  onDestroy(stop);
  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape' && !document.querySelector('.wordcard')) { e.preventDefault(); close(); }
  }
  async function insert(text: string) {
    const next = insertAt(draft, text, input?.selectionStart ?? draft.length, input?.selectionEnd ?? draft.length);
    draft = next.text;
    await tick(); input?.focus(); input?.setSelectionRange(next.cursor, next.cursor);
  }
  async function scrollLog() { await tick(); if (log) log.scrollTop = log.scrollHeight; }
  function clear() { generation++; stop(); busy = false; conversations[mode] = []; error = ''; }
  function changeMode(value: TeacherMode) { if (busy) return; mode = value; error = ''; void scrollLog(); }

  async function send(e?: Event) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy || !settings.tutorEnabled) return;
    const currentMode = mode;
    const id = ++generation;
    const previous = conversations[currentMode];
    const submitted: Turn = { role: 'user', content: text };
    conversations[currentMode] = [...previous, submitted];
    draft = ''; busy = true; error = '';
    controller = new AbortController();
    const context = teacherSystem({ mode: currentMode, path, lesson: lesson?.title, section, source: lesson ? sources[`/content/lessons/${lesson.slug}.md`] : undefined, level: levelLabel(settings.data.start), words: [...new Set(Object.values(deck.data.cards).map(c => c.word))], completed: LESSONS.filter(l => progress.data.completed[l.slug]).map(l => l.title) });
    void scrollLog();
    try {
      const out = await askTutor({ system: context, messages: teacherHistory(conversations[currentMode].map(t => ({ role: t.role, content: t.content }))), signal: controller.signal });
      if (id !== generation) return;
      conversations[currentMode] = [...conversations[currentMode], { role: 'assistant', content: out, reply: tag(out, 'reply') || out, translation: tag(out, 'translation'), advice: tag(out, 'advice') }];
    } catch (err) {
      if (id !== generation) return;
      conversations[currentMode] = previous;
      draft = text;
      error = err instanceof Error ? err.message : String(err);
    } finally {
      if (id === generation) { busy = false; controller = null; void scrollLog(); }
    }
  }
</script>

<svelte:window onkeydown={onKey} />
<button bind:this={launcher} type="button" class="launcher btn primary" aria-expanded={open} aria-controls="teacher-chat" onclick={() => open ? close() : reveal()}><Icon name="chat" size={19} />Teacher</button>
{#if open}
  <div bind:this={panel} tabindex="-1" id="teacher-chat" class="chat card ui" role="dialog" aria-label="Mandarin teacher">
    <header><strong><Icon name="chat" size={18} />Mandarin teacher</strong><button type="button" class="btn small ghost" aria-label="Close teacher chat" onclick={close}><Icon name="x" /></button></header>
    <div class="modes">
      <button type="button" class="btn small" aria-pressed={mode === 'course'} disabled={busy} onclick={() => changeMode('course')}>Course questions</button>
      <button type="button" class="btn small" aria-pressed={mode === 'mandarin'} disabled={busy} onclick={() => changeMode('mandarin')}>Converse in Mandarin</button>
    </div>
    <p class="context">{lesson ? `${lesson.title}${section ? ' · ' + section : ''}` : 'Ask about the course or practise a conversation.'}</p>
    {#if !settings.tutorEnabled}
      <div class="setup"><TutorGate what="Your Mandarin teacher" /></div>
    {:else}
      <div class="log" bind:this={log} role="log" aria-label="Teacher conversation" aria-live="polite" aria-relevant="additions text">
        {#if !turns.length}<p class="empty">{mode === 'course' ? 'Ask about a grammar point, an exercise or what to practise next. I can see your current lesson.' : 'Start with 你好 or tell me about your day. Characters and pinyin both work.'}</p>{/if}
        {#each turns as turn, i (i)}
          <article class:you={turn.role === 'user'}>
            <span class="who">{turn.role === 'user' ? 'You' : 'Teacher'}</span>
            <p><Rich text={turn.reply ?? turn.content} /></p>
            {#if turn.role === 'assistant' && /\p{Script=Han}/u.test(turn.reply ?? '')}<PlayButton text={turn.reply!} small label="Listen to the teacher" />{/if}
            {#if turn.translation}<p class="translation">{turn.translation}</p>{/if}
            {#if turn.advice}<p class="advice"><strong>Try this:</strong> <Rich text={turn.advice} /></p>{/if}
          </article>
        {/each}
        {#if busy}<p class="empty" role="status">Teacher is thinking…</p>{/if}
      </div>
      <div class="compose">
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <form onsubmit={send}>
          <textarea bind:this={input} bind:value={draft} rows="2" maxlength="4000" aria-label="Message to your Mandarin teacher" placeholder={mode === 'course' ? 'Ask about this lesson…' : '你好！ / ni3 hao3…'} readonly={busy} onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); } }}></textarea>
          <div class="actions">
            <button type="button" class="btn small" aria-expanded={keyboard} aria-controls="teacher-keyboard" onclick={() => keyboard = !keyboard}>拼 · Keyboard</button>
            <button type="button" class="btn small ghost" disabled={!turns.length && !busy} onclick={clear}>New chat</button>
            {#if busy}<button type="button" class="btn small" onclick={stop}>Stop</button>{:else}<button type="submit" class="btn small primary" disabled={!draft.trim()}>Send</button>{/if}
          </div>
        </form>
        {#if keyboard}<div id="teacher-keyboard"><MandarinKeyboard insert={insert} disabled={busy} /></div>{/if}
        <p class="privacy">{PROVIDERS[settings.data.provider].name} · <a href="{base}/settings/#tutor">Settings</a>. Messages and current lesson go to this provider. Chat lasts until reload; advice can be mistaken.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .launcher { position: fixed; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 55; box-shadow: var(--shadow-lg); }
  .chat { position: fixed; right: max(0.5rem, env(safe-area-inset-right)); bottom: calc(4.25rem + env(safe-area-inset-bottom)); width: min(29rem, calc(100vw - 1rem)); max-height: calc(100dvh - 8rem); z-index: 60; display: flex; flex-direction: column; overflow: hidden; font-size: 0.9rem; line-height: 1.5; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--line); flex: none; }
  header strong { display: flex; align-items: center; gap: 0.4rem; }
  .modes { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.6rem 0.8rem 0; flex: none; }
  [aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent); }
  .context, .privacy { font-size: 0.72rem; color: var(--mute); margin: 0.4rem 0.8rem; }
  .context { flex: none; }
  .setup { padding: 0.5rem 0.8rem; overflow: auto; }
  .log { overflow-y: auto; overscroll-behavior: contain; padding: 0.6rem 0.8rem; min-height: 3rem; flex: 1 1 auto; }
  article { background: var(--pn); border-radius: 12px; padding: 0.55rem 0.7rem; margin-bottom: 0.6rem; overflow-wrap: anywhere; }
  article.you { background: var(--accent-soft); margin-left: 1.5rem; }
  article p { margin: 0.25rem 0; white-space: pre-wrap; }
  .who { font-size: 0.68rem; font-weight: 700; color: var(--mute); }
  .translation { font-style: italic; color: var(--ink-2); }
  .advice { border-top: 1px solid var(--line-strong); padding-top: 0.4rem; color: var(--jade); }
  .empty { color: var(--ink-2); margin: 0.2rem 0; }
  .compose { border-top: 1px solid var(--line); padding: 0.6rem 0.8rem; overflow-y: auto; flex: 0 1 auto; }
  textarea { width: 100%; min-width: 0; background: var(--panel); color: var(--fg); border: 1px solid var(--line-strong); border-radius: 8px; padding: 0.5rem; font-size: 1rem; resize: vertical; max-height: 8rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin: 0.4rem 0; }
  .actions > :last-child { margin-left: auto; }
  .privacy { margin: 0.5rem 0 0; }
  .error { color: var(--bad); margin: 0 0 0.4rem; }
</style>
