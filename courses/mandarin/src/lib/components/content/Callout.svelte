<script lang="ts">
  import type { Snippet } from 'svelte';
  let { kind, title = null, children }: { kind: string; title?: string | null; children: Snippet } = $props();
  const LABELS: Record<string, [string, string]> = {
    note: ['Note', '✎'],
    tip: ['Tip', '★'],
    culture: ['Culture corner', '茶'],
    grammar: ['Grammar', '文'],
    mistake: ['Common mistake', '!'],
    key: ['Key idea', '要'],
    fun: ['Fun fact', '趣'],
  };
  const [label, glyph] = $derived(LABELS[kind] ?? ['Note', '✎']);
</script>

<aside class="callout {kind}">
  <span class="glyph zh-font" aria-hidden="true">{glyph}</span>
  <div class="body">
    <p class="label ui">{title ?? label}</p>
    {@render children()}
  </div>
</aside>

<style>
  .callout {
    --c: var(--ink-2);
    --soft: var(--pn);
    display: grid;
    grid-template-columns: 2.2rem 1fr;
    gap: 0.8rem;
    margin: 1.6rem 0;
    padding: 0.9rem 1.1rem;
    background: var(--soft);
    border-radius: var(--radius);
    border-left: 3px solid var(--c);
  }
  .tip,
  .key {
    --c: var(--jade);
    --soft: var(--jade-soft);
  }
  .culture,
  .fun {
    --c: var(--gold);
    --soft: var(--gold-soft);
  }
  .grammar {
    --c: var(--t3);
    --soft: color-mix(in srgb, var(--t3) 10%, var(--bg));
  }
  .mistake {
    --c: var(--accent);
    --soft: var(--accent-soft);
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    background: var(--c);
    color: var(--bg);
    font-size: 1.15rem;
    line-height: 1;
  }
  .label {
    margin: 0.2rem 0 0.3rem;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c);
  }
  .body {
    min-width: 0;
  }
  .body :global(p:last-child) {
    margin-bottom: 0;
  }
  .body :global(p) {
    margin: 0.4rem 0;
  }
</style>
