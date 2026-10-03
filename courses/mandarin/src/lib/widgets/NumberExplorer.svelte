<script lang="ts">
  /** Type any number and see how it is said, built from its parts. */
  import { numberToChinese } from '$lib/zh/numbers';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';

  let { value = 2026, max = 99999999 }: { value?: number; max?: number } = $props();
  let n = $state(0);
  $effect.pre(() => {
    n = value;
  });
  const valid = $derived(Number.isInteger(n) && n >= 0 && n <= max);
  const zh = $derived(valid ? numberToChinese(n) : '');
  const liang = $derived(valid ? numberToChinese(n, { liang: true }) : '');
  const presets = [11, 20, 35, 99, 100, 101, 110, 250, 1001, 2026, 10000, 20000];
</script>

<figure class="explorer card">
  <label class="ui">Type a number <input type="number" min="0" {max} bind:value={n} /></label>
  <div class="out">
    {#if valid}
      <Zh text={zh} size="lg" play={false} /><PlayButton text={zh} />
      {#if liang !== zh}<p class="alt ui">When counting things or money, a leading 2 is usually said 两: <Zh text={liang} play={false} /></p>{/if}
    {:else}
      <p class="ui alt">Whole numbers from 0 to {max.toLocaleString()}.</p>
    {/if}
  </div>
  <div class="presets ui">
    {#each presets.filter((p) => p <= max) as p (p)}<button onclick={() => (n = p)}>{p}</button>{/each}
  </div>
</figure>

<style>
  .explorer {
    margin: 1.6rem 0;
    padding: 1rem 1.2rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 600;
    font-size: 0.9rem;
  }
  input {
    width: 10rem;
    font-size: 1.2rem;
    padding: 0.4rem 0.6rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .out {
    min-height: 5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin: 0.5rem 0;
  }
  .alt {
    width: 100%;
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .presets button {
    border: 1px solid var(--line);
    background: var(--pn);
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--ink-2);
  }
</style>
