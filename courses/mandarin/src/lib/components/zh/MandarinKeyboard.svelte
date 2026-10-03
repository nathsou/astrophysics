<script lang="ts">
  import { allWords } from '$lib/zh/lexicon';
  import { characterCandidates, TONE_KEYS } from '$lib/tutor/keyboard';
  let { insert, disabled = false }: { insert: (text: string) => void; disabled?: boolean } = $props();
  let mode = $state<'pinyin' | 'characters'>('pinyin');
  let query = $state('');
  const words = allWords();
  const candidates = $derived(characterCandidates(query, words));
</script>

<div class="keyboard ui">
  <div class="modes" aria-label="Mandarin keyboard">
    <button type="button" class="btn small" aria-pressed={mode === 'pinyin'} onclick={() => mode = 'pinyin'}>Pinyin tones</button>
    <button type="button" class="btn small" aria-pressed={mode === 'characters'} onclick={() => mode = 'characters'}>Characters</button>
  </div>
  {#if mode === 'pinyin'}
    <div class="tones" aria-label="Tone-marked vowels">
      {#each TONE_KEYS as row (row)}{#each [...row] as key (key)}
        <button type="button" {disabled} aria-label="Insert {key}" onclick={() => insert(key)}>{key}</button>
      {/each}{/each}
    </div>
    <p>Plain or numbered pinyin works too: ni hao, ni3 hao3.</p>
  {:else}
    <label>Find a course word by pinyin
      <input type="search" bind:value={query} placeholder="ni hao, hao3, lv…" autocomplete="off" />
    </label>
    <div class="candidates" aria-live="polite">
      {#each candidates as word (word.w)}
        <button type="button" {disabled} title={word.g} aria-label="Insert {word.w}, {word.p}, {word.g}" onclick={() => { insert(word.w); query = ''; }}>
          <span class="zh-font" lang="zh-CN">{word.w}</span><small>{word.p}</small>
        </button>
      {/each}
    </div>
    <p>{query && !candidates.length ? 'No course word found. You can send pinyin or use your device’s Chinese keyboard.' : 'Tap a word to insert its characters. Your device’s Chinese keyboard also works.'}</p>
  {/if}
</div>

<style>
  .keyboard { border-top: 1px solid var(--line); padding-top: 0.5rem; }
  .modes { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
  [aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent); }
  .tones { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.2rem; }
  .tones button, .candidates button { border: 1px solid var(--line); background: var(--panel); color: var(--fg); border-radius: 6px; min-height: 2rem; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  label { display: grid; gap: 0.25rem; font-size: 0.78rem; }
  input { width: 100%; min-width: 0; padding: 0.4rem; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--panel); color: var(--fg); }
  .candidates { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
  .candidates button { display: grid; padding: 0.2rem 0.4rem; }
  .candidates small { color: var(--mute); font-size: 0.65rem; }
  p { font-size: 0.72rem; color: var(--mute); margin: 0.4rem 0 0; }
</style>
