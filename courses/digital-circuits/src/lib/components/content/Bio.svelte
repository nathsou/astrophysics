<!--
  A short biography. Portraits are replaced by a typographic monogram (no image licensing).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    name,
    born,
    died,
    place,
    title,
    children,
  }: { name: string; born?: string | number; died?: string | number; place?: string; title?: string; children?: Snippet } = $props();

  const HUES = [
    ['var(--copper)', 'var(--on-accent)'],
    ['var(--c-programmer)', 'var(--on-accent)'],
    ['var(--c-lab)', 'var(--on-accent)'],
  ] as const;
  const initials = $derived(
    name
      .replace(/\(.*?\)/g, '')
      .split(/\s+/)
      .filter((w) => /^\p{Lu}/u.test(w))
      .map((w) => w[0])
      .filter((_, i, a) => i === 0 || i === a.length - 1)
      .join(''),
  );
  const hue = $derived(HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length] ?? HUES[0]);
  const life = $derived(born || died ? `${born ?? '?'}–${died ?? ''}` : '');
</script>

<aside class="bio" aria-label="Biography: {name}">
  <div class="mono ui" style:--hue={hue[0]} style:--on={hue[1]} aria-hidden="true">{initials}</div>
  <div class="text">
    <p class="who ui">
      <span class="name">{name}</span>
      {#if life}<span class="life">{life}</span>{/if}
    </p>
    {#if place || title}<p class="place ui">{[title, place].filter(Boolean).join(' · ')}</p>{/if}
    <div class="body">{@render children?.()}</div>
  </div>
</aside>

<style>
  .bio {
    display: grid;
    grid-template-columns: 3.6rem 1fr;
    gap: 1.1rem;
    margin: 2.25rem 0;
    padding: 1.15rem 1.3rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .mono {
    width: 3.6rem;
    height: 3.6rem;
    border-radius: 0;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--on);
    background: var(--hue);
  }
  .who {
    margin: 0 !important;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.02em;
    font-size: 1.2rem;
  }
  .life {
    font-family: var(--font-mono);
    color: var(--ink-3);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  .place {
    margin: 0.1rem 0 0.5rem !important;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .body {
    font-size: 1rem;
  }
  .body :global(p) {
    margin: 0 0 0.75rem;
  }
  @media (max-width: 560px) {
    .bio {
      grid-template-columns: 1fr;
    }
  }
</style>
