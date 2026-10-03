<script lang="ts">
  import { speech } from '$lib/audio/speech.svelte';
  import Icon from '../ui/Icon.svelte';

  let { text, small = false, slow = false, label }: { text: string; small?: boolean; slow?: boolean; label?: string } = $props();
  const active = $derived(speech.playing === text && speech.rate === (slow ? 0.7 : 1));
</script>

<button
  type="button"
  class="play ui"
  class:small
  class:slow
  class:active
  aria-label={active ? 'Stop audio' : label ?? `Listen${slow ? ' slowly' : ''}`}
  title={active ? 'Stop audio' : label ?? `Listen${slow ? ' slowly' : ''}`}
  onclick={(e) => {
    e.stopPropagation();
    if (active) speech.stop();
    else void speech.say(text, { rate: slow ? 0.7 : 1 });
  }}
>
  {#if slow && !active}<span>Slow</span>{:else}<Icon name={active ? 'stop' : 'speaker'} size={small ? 15 : 18} />{/if}
</button>

<style>
  .play {
    display: inline-grid;
    place-items: center;
    vertical-align: middle;
    width: 2.1rem;
    height: 2.1rem;
    margin: 0 0.15rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--accent-ink);
    cursor: pointer;
    transition: background-color 120ms, transform 80ms;
    font-size: 1rem;
    line-height: 1;
  }
  .play.small {
    width: 1.6rem;
    height: 1.6rem;
    border-color: var(--line);
  }
  .play:hover {
    background: var(--accent-soft);
  }
  .play.slow {
    width: auto;
    min-width: 2.8rem;
    padding: 0 0.4rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 600;
  }
  .play.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
