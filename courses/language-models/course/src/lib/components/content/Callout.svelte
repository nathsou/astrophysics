<script lang="ts" module>
  import type { IconName } from '../ui/Icon.svelte';

  const KINDS: Record<string, { label: string; icon: IconName; hue: string }> = {
    note: { label: 'Note', icon: 'note', hue: 'var(--note)' },
    info: { label: 'Info', icon: 'info', hue: 'var(--note)' },
    tip: { label: 'Tip', icon: 'tip', hue: 'var(--tip)' },
    warning: { label: 'Caution', icon: 'warning', hue: 'var(--warn)' },
    lab: { label: 'Lab', icon: 'lab', hue: 'var(--lab)' },
    breakit: { label: 'Break it', icon: 'breakit', hue: 'var(--break)' },
    challenge: { label: 'Challenge', icon: 'challenge', hue: 'var(--challenge)' },
    exercises: { label: 'Exercises', icon: 'exercises', hue: 'var(--lab)' },
    definition: { label: 'Definition', icon: 'definition', hue: 'var(--ink-3)' },
    key: { label: 'Key idea', icon: 'key', hue: 'var(--accent-2)' },
    question: { label: 'Think about it', icon: 'question', hue: 'var(--tip)' },
    aside: { label: 'Aside', icon: 'aside', hue: 'var(--ink-3)' },
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';

  let { kind = 'note', title, children }: { kind?: string; title?: string; children?: Snippet } = $props();
  const k = $derived(KINDS[kind] ?? KINDS.note!);
</script>

<aside class="callout" data-kind={kind} style:--hue={k.hue}>
  <header class="ui">
    <span class="icon"><Icon name={k.icon} size={16} /></span>
    <span class="label">{k.label}</span>
    {#if title}<span class="title">{title}</span>{/if}
  </header>
  <div class="body">{@render children?.()}</div>
</aside>

<style>
  .callout {
    margin: 1.75rem 0;
    padding: 0.85rem 1.15rem 0.3rem;
    background: color-mix(in srgb, var(--hue) 7%, var(--bg));
    border-left: 3px solid var(--hue);
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    margin-bottom: 0.45rem;
  }
  .icon {
    display: inline-flex;
    color: var(--hue);
  }
  .label {
    font: 500 0.7rem var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-2);
  }
  .title {
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .title::before {
    content: '·';
    margin-right: 0.5rem;
    color: var(--ink-3);
  }
  .body {
    font-size: 1rem;
  }
  .body :global(p) {
    margin: 0 0 0.75rem;
  }
  .body :global(ol),
  .body :global(ul) {
    margin: 0 0 0.75rem;
    padding-left: 1.3rem;
  }
</style>
