<script lang="ts">
  import { speech } from '$lib/audio/speech.svelte';
  import Icon from '../ui/Icon.svelte';

  let { text, small = false, slow = false, label }: { text: string; small?: boolean; slow?: boolean; label?: string } = $props();
  const active = $derived(speech.playing === text);
</script>

<button
  type="button"
  class="play ui"
  class:small
  class:active
  aria-label={label ?? `Listen${slow ? ' slowly' : ''}`}
  title={label ?? `Listen${slow ? ' slowly' : ''}`}
  onclick={(e) => {
    e.stopPropagation();
    if (active) speech.stop();
    else void speech.say(text, { rate: slow ? 0.7 : 1 });
  }}
>
  <Icon name={active ? 'stop' : slow ? 'slow' : 'speaker'} size={small ? 15 : 18} />
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
  .play.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
