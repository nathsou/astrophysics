<script lang="ts">
  /**
   * Plain text from exercise YAML with Chinese runs annotated, **bold** and *italic* supported.
   */
  import Zh from '../zh/Zh.svelte';
  let { text, pinyin = 'auto', size = 'inline' }: { text: string; pinyin?: 'auto' | 'show' | 'hide'; size?: 'inline' | 'md' | 'lg' } = $props();
  const RUN = /(\p{Script=Han}(?:\[[^\]\s]+\])?(?:[\p{Script=Han}，。！？、：；“”…—～·](?:\[[^\]\s]+\])?)*|\*\*[^*]+\*\*|\*[^*]+\*|_{3,})/gu;
  const parts = $derived(String(text ?? '').split(RUN).filter((p) => p !== ''));
</script>

{#each parts as p, i (i)}{#if /^\p{Script=Han}/u.test(p)}<Zh text={p} {pinyin} {size} play={false} />{:else if p.startsWith('**')}<strong>{p.slice(2, -2)}</strong>{:else if p.startsWith('*')}<em>{p.slice(1, -1)}</em>{:else if /^_{3,}$/.test(p)}<span class="gap">＿＿</span>{:else}{p}{/if}{/each}

<style>
  .gap {
    display: inline-block;
    min-width: 2.2em;
    border-bottom: 2px solid var(--accent);
    color: transparent;
    margin: 0 0.15em;
  }
</style>
