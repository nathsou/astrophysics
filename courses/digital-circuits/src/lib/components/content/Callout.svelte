<script lang="ts" module>
  import type { IconName } from '../ui/Icon.svelte';

  const KINDS: Record<string, { label: string; icon: IconName; hue: string; on: string }> = {
    note: { label: 'Note', icon: 'note', hue: 'var(--fx-blue)', on: 'var(--fx-cream)' },
    info: { label: 'Info', icon: 'info', hue: 'var(--fx-blue)', on: 'var(--fx-cream)' },
    tip: { label: 'Tip', icon: 'tip', hue: 'var(--fx-yellow)', on: 'var(--fx-ink)' },
    warning: { label: 'Caution', icon: 'warning', hue: 'var(--fx-red)', on: 'var(--fx-cream)' },
    lab: { label: 'Lab', icon: 'lab', hue: 'var(--fx-blue)', on: 'var(--fx-cream)' },
    breakit: { label: 'Break it', icon: 'breakit', hue: 'var(--fx-red)', on: 'var(--fx-cream)' },
    challenge: { label: 'Challenge', icon: 'challenge', hue: 'var(--fx-yellow)', on: 'var(--fx-ink)' },
    exercises: { label: 'Exercises', icon: 'exercises', hue: 'var(--fx-blue)', on: 'var(--fx-cream)' },
    definition: { label: 'Definition', icon: 'definition', hue: 'var(--fg)', on: 'var(--bg)' },
    key: { label: 'Key idea', icon: 'key', hue: 'var(--fx-red)', on: 'var(--fx-cream)' },
    question: { label: 'Think about it', icon: 'question', hue: 'var(--fx-yellow)', on: 'var(--fx-ink)' },
    aside: { label: 'Aside', icon: 'aside', hue: 'var(--mute)', on: 'var(--bg)' },
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';

  let { kind = 'note', title, children }: { kind?: string; title?: string; children?: Snippet } = $props();
  const k = $derived(KINDS[kind] ?? KINDS.note!);
</script>

<aside class="callout" data-kind={kind} style:--hue={k.hue} style:--on-hue={k.on}>
  <header class="ui">
    <span class="icon"><Icon name={k.icon} size={16} /></span>
    <span class="label">{k.label}</span>
    {#if title}<span class="title">{title}</span>{/if}
  </header>
  <div class="body">{@render children?.()}</div>
</aside>

<style>
  .callout {
    margin: 1.9rem 0;
    padding: 0.9rem 1.2rem 0.3rem;
    background: var(--pn);
    border-left: 6px solid var(--hue);
    border-radius: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }
  .icon {
    display: inline-flex;
    padding: 0.2rem;
    background: var(--hue);
    color: var(--on-hue);
  }
  .label {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--ink);
  }
  .title {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--ink);
  }
  .title::before {
    content: '·';
    margin-right: 0.5rem;
    color: var(--ink-3);
  }
  .body {
    font-size: 1.04rem;
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
