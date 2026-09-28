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

  const HUES = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--accent)', 'var(--history)'];
  const initials = $derived(
    name
      .replace(/\(.*?\)/g, '')
      .split(/\s+/)
      .filter((w) => /^\p{Lu}/u.test(w))
      .map((w) => w[0])
      .filter((_, i, a) => i === 0 || i === a.length - 1)
      .join(''),
  );
  const hue = $derived(HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length]);
  const life = $derived(born || died ? `${born ?? '?'}–${died ?? ''}` : '');
</script>

<aside class="bio" aria-label="Biography: {name}">
  <div class="mono ui" style:--hue={hue} aria-hidden="true">{initials}</div>
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
    grid-template-columns: 3.4rem 1fr;
    gap: 1rem;
    margin: 2rem 0;
    padding: 1.1rem 1.2rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .mono {
    width: 3.4rem;
    height: 3.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-body);
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--hue);
    background: color-mix(in srgb, var(--hue) 12%, var(--surface));
    border: 2px solid color-mix(in srgb, var(--hue) 55%, transparent);
  }
  .who {
    margin: 0 !important;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
  }
  .name {
    font-weight: 650;
    font-size: 1.02rem;
  }
  .life {
    color: var(--ink-3);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .place {
    margin: 0.1rem 0 0.5rem !important;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .body {
    font-size: 0.98rem;
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
