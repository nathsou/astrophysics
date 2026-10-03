<script lang="ts">
  /** The scaffolding dial: how much pinyin to show, from anywhere in the course. */
  import { settings, type PinyinMode } from '$lib/state/settings.svelte';
  const MODES: { v: PinyinMode; label: string; title: string }[] = [
    { v: 'always', label: 'pīn', title: 'Pinyin always shown' },
    { v: 'tap', label: 'p?', title: 'Pinyin on hover or tap' },
    { v: 'off', label: '字', title: 'Characters only' },
  ];
</script>

<div class="dial ui" role="radiogroup" aria-label="Pinyin">
  {#each MODES as m (m.v)}
    <button role="radio" aria-checked={settings.data.pinyin === m.v} class:on={settings.data.pinyin === m.v} title={m.title} onclick={() => settings.set('pinyin', m.v)}>
      <span class:zh-font={m.v === 'off'}>{m.label}</span>
    </button>
  {/each}
</div>

<style>
  .dial {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--panel);
  }
  button {
    border: none;
    background: none;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 650;
    color: var(--mute);
    cursor: pointer;
    min-width: 2.2rem;
  }
  button.on {
    background: var(--accent);
    color: #fff;
  }
  @media (max-width: 420px) {
    button {
      padding: 0.2rem 0.35rem;
      min-width: 1.8rem;
    }
  }
</style>
