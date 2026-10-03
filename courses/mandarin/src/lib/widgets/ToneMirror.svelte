<script lang="ts">
  /** Free practice with the tone mirror: pick a syllable or word and compare your pitch. */
  import ToneMirror from '$lib/components/zh/ToneMirror.svelte';
  let { items = '妈,麻,马,骂' }: { items?: string } = $props();
  const list = $derived(items.split(','));
  let current = $state(0);
</script>

<div class="wrap card">
  <div class="pick ui" role="tablist" aria-label="Practice item">
    {#each list as it, i (it)}
      <button role="tab" aria-selected={current === i} class:on={current === i} onclick={() => (current = i)}><span class="zh-font">{it}</span></button>
    {/each}
  </div>
  {#key current}<ToneMirror text={list[current]!} />{/key}
</div>

<style>
  .wrap {
    margin: 1.8rem 0;
    padding: 1rem 1.2rem;
  }
  .pick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.8rem;
  }
  .pick button {
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    border-radius: 999px;
    padding: 0.15rem 0.8rem;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--fg);
  }
  .pick button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
