<script lang="ts">
  import { base } from '$app/paths';
  import { settings, type PinyinMode } from '$lib/state/settings.svelte';
  import { PROVIDERS, isProvider, withoutTutorKeys, restoreTutorSettings } from '$lib/tutor/providers';
  import { progress } from '$lib/state/progress.svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { LIST_NAMES, type ListId } from '$lib/zh/lexicon';
  import { speech } from '$lib/audio/speech.svelte';
  import Zh from '$lib/components/zh/Zh.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let keyDraft = $state('');
  let keySaved = $state(false);
  let importMsg = $state('');
  const providerInfo = $derived(PROVIDERS[settings.data.provider]);
  let hasClips = $state<boolean | null>(null);
  $effect(() => {
    keyDraft = settings.tutorConfig.apiKey;
    void speech.has('你好').then((h) => (hasClips = h));
  });

  const PINYIN: { v: PinyinMode; label: string; text: string }[] = [
    { v: 'always', label: 'Always', text: 'Pinyin above every character.' },
    { v: 'tap', label: 'On tap', text: 'Hidden until you hover or tap a word.' },
    { v: 'off', label: 'Off', text: 'Characters only (pinyin still shows in exercises that teach it).' },
  ];

  function saveKey() {
    settings.setTutor(settings.data.provider, { apiKey: keyDraft.trim() });
    keySaved = true;
    setTimeout(() => (keySaved = false), 2000);
  }

  function exportData() {
    const data = {
      app: 'mandarin-out-loud',
      version: 2,
      exported: new Date().toISOString(),
      progress: progress.data,
      deck: deck.data,
      settings: { ...settings.data, ...withoutTutorKeys(settings.data) },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mandarin-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'mandarin-out-loud') throw new Error('not a backup from this course');
      if (!confirm('Replace your current progress and review deck with this backup?')) return;
      progress.replace(data.progress);
      deck.replace(data.deck);
      const { apiKey: _ignored, model: _oldModel, tutors: _ignoredProfiles, provider: _ignoredProvider, ...rest } = data.settings ?? {};
      settings.update({ ...rest, ...restoreTutorSettings(data.settings, settings.data) });
      importMsg = 'Backup restored.';
    } catch (err) {
      importMsg = `Could not read that file: ${(err as Error).message}`;
    }
  }

  function reset() {
    if (!confirm('Delete all your progress, your review deck and your settings in this browser? This cannot be undone.')) return;
    for (const k of ['mandarin:progress', 'mandarin:deck', 'mandarin:settings', 'mandarin:voice', 'mandarin:tone-stats']) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    location.reload();
  }
</script>

<svelte:head><title>Settings · Mandarin, Out Loud</title></svelte:head>

<div class="page">
  <h1>Settings</h1>
  <p class="ui lead">Everything is stored in this browser only. Use a backup to move your progress to another device.</p>

  <section class="card">
    <h2>Pinyin</h2>
    <p class="ui note">The scaffolding dial: as you improve, show less. You can also switch it from the top bar.</p>
    <div class="options" role="radiogroup" aria-label="Pinyin">
      {#each PINYIN as p (p.v)}
        <button role="radio" aria-checked={settings.data.pinyin === p.v} class="opt" class:on={settings.data.pinyin === p.v} onclick={() => settings.set('pinyin', p.v)}>
          <strong>{p.label}</strong><span class="ui">{p.text}</span>
        </button>
      {/each}
    </div>
    <p class="sample">Preview: <Zh text="我喜欢学汉语。" size="md" /></p>
    <label class="row ui"><input type="checkbox" checked={settings.data.toneColours} onchange={(e) => settings.set('toneColours', e.currentTarget.checked)} /> Colour pinyin by tone (<span class="t1 c">1</span> <span class="t2 c">2</span> <span class="t3 c">3</span> <span class="t4 c">4</span> <span class="t5 c">neutral</span>)</label>
    <label class="row ui"><input type="checkbox" checked={settings.data.translations} onchange={(e) => settings.set('translations', e.currentTarget.checked)} /> Show English translations in dialogues straight away</label>
  </section>

  <section class="card">
    <h2>Audio</h2>
    <label class="row ui">Speech speed
      <input type="range" min="0.6" max="1.2" step="0.05" value={settings.data.rate} oninput={(e) => settings.set('rate', Number(e.currentTarget.value))} />
      <span class="val">{Math.round(settings.data.rate * 100)}%</span>
      <button class="btn small" onclick={() => speech.say('你好，我很高兴认识你。')}><Icon name="play" size={13} />Test</button>
    </label>
    <label class="row ui"><input type="checkbox" checked={settings.data.sounds} onchange={(e) => settings.set('sounds', e.currentTarget.checked)} /> Sound effects for right and wrong answers</label>
    <p class="ui note">
      {#if hasClips === false}This copy of the course has no recorded clips yet, so it uses your browser's built-in Chinese voice. Voices vary a lot between devices; if you hear nothing, your system may need a Chinese voice installed.{:else if hasClips}Audio comes from recorded clips, with your browser's Chinese voice as a fallback for anything generated on the fly (like numbers).{/if}
      {#if speech.voiceMissing} <strong>No Chinese voice was found on this device.</strong>{/if}
    </p>
  </section>

  <section class="card">
    <h2>Review deck</h2>
    <label class="row ui">New cards per day
      <input type="number" min="0" max="100" value={settings.data.newPerDay} onchange={(e) => settings.set('newPerDay', Math.min(100, Math.max(0, Number(e.currentTarget.value) || 0)))} />
    </label>
    <label class="row ui"><input type="checkbox" checked={settings.data.typeAnswers} onchange={(e) => settings.set('typeAnswers', e.currentTarget.checked)} /> Type the pinyin on reading cards (checked automatically)</label>
    <label class="row ui">HSK word list
      <select value={settings.data.list} onchange={(e) => settings.set('list', e.currentTarget.value as ListId)}>
        {#each Object.entries(LIST_NAMES) as [id, name] (id)}<option value={id}>{name}</option>{/each}
      </select>
    </label>
    <p class="ui note">The HSK has had three word lists. The course teaches the 2025 syllabus (about 300 words at level 1, 500 by level 2); the earlier lists are there for comparison and for learners sitting older exams. Check which syllabus your exam centre uses.</p>
  </section>

  <section class="card" id="tutor">
    <h2>AI conversation partner <span class="opt-tag ui">Optional</span></h2>
    <p class="ui note">The teacher chat, role-plays and sentence feedback use your chosen provider. Keys stay in this browser; messages and lesson context go directly to {providerInfo.host}. Usage is billed to your {providerInfo.name} account. Everything else works without AI.</p>
    <label class="row ui">Provider
      <select value={settings.data.provider} onchange={(e) => { if (isProvider(e.currentTarget.value)) settings.set('provider', e.currentTarget.value); }}>
        {#each Object.entries(PROVIDERS) as [id, info] (id)}<option value={id}>{info.name}</option>{/each}
      </select>
    </label>
    <label class="row ui">{providerInfo.name} API key
      <input type="password" bind:value={keyDraft} placeholder={providerInfo.placeholder} autocomplete="off" spellcheck="false" />
      <button class="btn small" onclick={saveKey}>{keySaved ? 'Saved' : 'Save'}</button>
    </label>
    <label class="row ui">Model
      <input type="text" value={settings.tutorConfig.model} onchange={(e) => settings.setTutor(settings.data.provider, { model: e.currentTarget.value.trim() || providerInfo.model })} />
    </label>
    {#if settings.tutorEnabled}<button class="btn small ghost" onclick={() => ((keyDraft = ''), settings.setTutor(settings.data.provider, { apiKey: '' }))}>Remove key</button>{/if}
  </section>

  <section class="card">
    <h2>Backup and reset</h2>
    <div class="row ui wrap">
      <button class="btn" onclick={exportData}>Download a backup</button>
      <label class="btn">Restore from a backup <input type="file" accept="application/json" class="sr-only" onchange={importData} /></label>
      <button class="btn ghost danger" onclick={reset}>Reset everything</button>
    </div>
    {#if importMsg}<p class="ui note">{importMsg}</p>{/if}
    <p class="ui note">Starting point: {settings.data.start ?? 'not chosen'}. <a href="{base}/placement/">Take the placement check</a></p>
  </section>
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 46rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .lead {
    color: var(--ink-2);
    margin: 0 0 1.2rem;
  }
  section {
    padding: 1rem 1.3rem 1.2rem;
    margin-bottom: 1rem;
  }
  h2 {
    font-size: 1.2rem;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .note {
    font-size: 0.85rem;
    color: var(--ink-2);
    margin: 0.4rem 0;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
    gap: 0.5rem;
    margin: 0.6rem 0;
  }
  .opt {
    display: grid;
    gap: 0.2rem;
    text-align: left;
    padding: 0.6rem 0.8rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .opt span {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .opt.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .sample {
    margin: 0.4rem 0 0.8rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin: 0.55rem 0;
    font-size: 0.92rem;
  }
  .row input[type='number'],
  .row input[type='password'],
  .row input[type='text'],
  select {
    max-width: 100%;
    padding: 0.4rem 0.6rem;
    border-radius: 8px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-size: 0.92rem;
  }
  .row input[type='password'],
  .row input[type='text'] {
    flex: 1;
    min-width: min(12rem, 100%);
    max-width: 100%;
  }
  .row input[type='number'] {
    width: 5rem;
  }
  .val {
    font-variant-numeric: tabular-nums;
    min-width: 3rem;
  }
  .c {
    color: var(--tone);
    font-weight: 700;
  }
  .opt-tag {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--mute);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 0 0.5rem;
  }
  .wrap {
    gap: 0.5rem;
  }
  .danger {
    color: var(--bad);
  }
</style>
