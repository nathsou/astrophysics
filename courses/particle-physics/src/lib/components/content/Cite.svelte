<script lang="ts">
  import { tryPageDocs } from './context';
  import Floating from '../ui/Floating.svelte';

  let { keys }: { keys: string[] } = $props();
  const docs = tryPageDocs();
  const refs = $derived(keys.map((k) => docs.references.find((r) => r.key === k)).filter((r) => r !== undefined));
  let anchor = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** "Chatrchyan, Khachatryan et al." → "Chatrchyan et al."; organisations ("ATLAS Collaboration (…)") keep their name. */
  const short = (authors: string) => {
    const a = authors.replace(/\s*\([^)]*\)/g, '').trim();
    const org = /(Collaboration|Working Group|Group|Foundation|Organization|NobelPrize\.org|CERN|Initiative)/.exec(a);
    if (org && !/\b[A-Z]\.\s/.test(a.slice(0, org.index))) return a.slice(0, org.index + org[0].length).trim();
    const raw = a.split(/\s*(?:,| and |&)\s*/).filter(Boolean);
    const etal = raw.some((x) => /^(et al\.?|others)$/i.test(x)) || /et al\.?$/.test(a);
    const list = raw.filter((x) => !/^(et al\.?|others)$/i.test(x)).map((x) => x.replace(/\s*et al\.?$/, ''));
    const last = (x: string) => x.trim().split(/\s+/).at(-1);
    return etal || list.length > 2 ? `${last(list[0] ?? a)} et al.` : list.map(last).join(' & ');
  };
  const hide = () => (timer = setTimeout(() => (anchor = null), 150));
</script>

<span class="cite ui"
  >(<!-- -->{#each refs as r, i (r.key)}{#if i > 0}; {/if}<a
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
    white-space: nowrap;
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
