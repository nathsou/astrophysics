<!--
  A bridge to another course of the collection: `:::bridge{course="proofs-are-programs" chapter="compiler" title="…"}`
  followed by one or two sentences saying what the reader finds there. The link is resolved and validated at
  build time (tools/markdown/bridges.ts).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { base } from '$app/paths';
  import Icon from '../ui/Icon.svelte';

  let { href: rawHref, courseTitle, title, children }: { href: string; course: string; courseTitle: string; title?: string; children?: Snippet } = $props();
  // The compiler emits links relative to the collection root, marked with __COURSE_BASE__ (this course's base).
  const href = $derived(rawHref.replace('__COURSE_BASE__', base));
</script>

<aside class="bridge" aria-label="Bridge to {courseTitle}">
  <span class="icon" aria-hidden="true"><Icon name="bridge" size={18} /></span>
  <div class="text">
    <p class="kicker ui">Bridge · {courseTitle}</p>
    <p class="title"><a {href}>{title ?? courseTitle} <span aria-hidden="true">→</span></a></p>
    {#if children}<div class="body">{@render children()}</div>{/if}
  </div>
</aside>

<style>
  .bridge {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.9rem;
    margin: 1.6rem 0;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--line);
    border-left: 3px double var(--ink-blue);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--ink-blue) 4%, var(--panel));
  }
  .icon {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--ink-blue) 40%, var(--line));
    color: var(--ink-blue);
  }
  .kicker {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .title {
    margin: 0.1rem 0 0.25rem;
    font-weight: 600;
  }
  .title a {
    text-decoration: none;
  }
  .title a:hover {
    text-decoration: underline;
  }
  .body {
    font-size: 0.98rem;
    color: var(--ink-2);
  }
  .body :global(p) {
    margin: 0;
  }
</style>
