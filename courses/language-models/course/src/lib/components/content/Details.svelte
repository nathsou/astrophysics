<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';
  let { title = 'Details', open = false, children }: { title?: string; open?: boolean; children?: Snippet } = $props();
</script>

<details class="details" {open}>
  <summary class="ui"><span class="chev"><Icon name="chevron" size={14} /></span>{title}</summary>
  <div class="body">{@render children?.()}</div>
</details>

<style>
  .details {
    margin: 1.5rem 0;
    border-left: 3px solid var(--rule-strong);
    border-radius: 0 var(--radius) var(--radius) 0;
    background: color-mix(in srgb, var(--pn) 55%, var(--bg));
  }
  summary {
    list-style: none;
    cursor: pointer;
    padding: 0.65rem 1rem;
    font-size: 0.92rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .chev {
    display: inline-flex;
    color: var(--ink-3);
    transition: transform 150ms ease;
  }
  details[open] .chev {
    transform: rotate(90deg);
  }
  .body {
    padding: 0 1.1rem 0.3rem;
    font-size: 1rem;
  }
</style>
