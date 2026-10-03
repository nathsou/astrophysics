<script lang="ts">
  /** Radicals and the characters that share them. Tap a radical to see its family. */
  import { RADICALS } from '$content/data/characters';
  import Zh from '$lib/components/zh/Zh.svelte';

  let current = $state(0);
  const r = $derived(RADICALS[current]!);
</script>

<figure class="rad card">
  <div class="tabs" role="tablist" aria-label="Radicals">
    {#each RADICALS as x, i (x.r)}
      <button role="tab" aria-selected={current === i} class:on={current === i} onclick={() => (current = i)} title={x.name}><span class="zh-font">{x.r}</span></button>
    {/each}
  </div>
  <div class="body">
    <div class="head">
      <span class="r zh-font">{r.r}</span>
      <span class="ui"><strong>{r.name}</strong><br /><span class="means">means {r.means}</span></span>
    </div>
    <div class="family">
      {#each [...r.chars] as ch (ch)}<span class="ch"><Zh text={ch} size="md" play={false} /></span>{/each}
    </div>
  </div>
</figure>

<style>
  .rad {
    margin: 1.6rem 0;
    padding: 0.9rem 1.1rem;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.8rem;
  }
  .tabs button {
    width: 2.4rem;
    height: 2.4rem;
    font-size: 1.3rem;
    border-radius: 9px;
    border: 1.5px solid var(--line);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .tabs button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .r {
    font-size: 3.2rem;
    line-height: 1;
    color: var(--accent);
  }
  .means {
    color: var(--ink-2);
    font-size: 0.9rem;
  }
  .family {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    margin-top: 0.6rem;
  }
</style>
