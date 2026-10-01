<script lang="ts">
  import { tryPageDocs } from './context';
  import Floating from '../ui/Floating.svelte';

  let { keys }: { keys: string[] } = $props();
  const docs = tryPageDocs();
  const refs = $derived(keys.map((k) => docs.references.find((r) => r.key === k)).filter((r) => r !== undefined));
  let anchor = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const short = (authors: string) => {
    const list = authors.split(/\s*(?:,| and |&)\s*/).filter(Boolean);
    const last = (s: string) => s.trim().split(/\s+/).at(-1);
    return list.length > 2 ? `${last(list[0]!)} et al.` : list.map(last).join(' & ');
  };
  const hide = () => (timer = setTimeout(() => (anchor = null), 150));
</script>

<span class="cite ui"
  >(<!-- -->{#each refs as r, i (r.key)}{#if i > 0};{' '}{/if}<a
      href="#ref-{r.key}"
      onpointerenter={(e) => {
        clearTimeout(timer);
        anchor = e.currentTarget;
      }}
      onpointerleave={hide}
      onfocus={(e) => (anchor = e.currentTarget)}
      onblur={() => (anchor = null)}>{short(r.authors)}, {r.year}</a
    >{/each})</span
>{#if anchor && refs.length}<Floating {anchor} onenter={() => clearTimeout(timer)} onleave={hide}
    >{#each refs as r (r.key)}<span class="ref"
        ><span class="authors">{r.authors}</span> ({r.year}). <em>{r.title}</em>{#if r.venue}. {r.venue}{/if}.
        {#if r.url}<a href={r.url} target="_blank" rel="noopener">Link ↗</a>{/if}</span
      >{/each}</Floating
  >{/if}

<style>
  .cite {
    font-size: 0.82em;
    color: var(--ink-2);
    white-space: normal;
  }
  .cite a {
    color: inherit;
    text-decoration-style: dotted;
  }
  .ref {
    display: block;
  }
  .ref + .ref {
    margin-top: 0.5rem;
  }
  .authors {
    font-weight: 600;
  }
</style>
