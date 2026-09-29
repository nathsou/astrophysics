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
    margin: 1.6rem 0;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    background: var(--surface);
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
  summary:hover {
    background: var(--pn);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .chev {
    display: inline-flex;
    color: var(--accent);
    transition: transform 150ms ease;
  }
  details[open] .chev {
    transform: rotate(90deg);
  }
  .body {
    padding: 0.3rem 1.1rem 0.3rem;
    font-size: 1.02rem;
    border-top: 2px solid var(--fg);
  }
</style>
