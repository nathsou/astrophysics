<!--
  Callouts: :::note, :::tip, :::warning, :::key, :::question, :::challenge, :::lab, :::programmer,
  :::hood, :::deeper, :::real{parts="74HC00, 2N3904"}, and a few older kinds from the shared shell.
  Each kind has its own hue (--c-* tokens in app.css) and icon; the label names it in words, so colour is
  never the only cue.
-->
<script lang="ts" module>
  import type { IconName } from '../ui/Icon.svelte';

  interface Kind {
    label: string;
    icon: IconName;
    hue: string;
    /** Small tag after the label (e.g. "optional"). */
    tag?: string;
  }

  export const CALLOUT_KINDS: Record<string, Kind> = {
    note: { label: 'Note', icon: 'note', hue: 'var(--c-note)' },
    info: { label: 'Info', icon: 'info', hue: 'var(--c-note)' },
    tip: { label: 'Tip', icon: 'tip', hue: 'var(--c-tip)' },
    warning: { label: 'Caution', icon: 'warning', hue: 'var(--c-warning)' },
    key: { label: 'Key idea', icon: 'bolt', hue: 'var(--c-key)' },
    question: { label: 'Think about it', icon: 'question', hue: 'var(--c-question)' },
    challenge: { label: 'Challenge', icon: 'challenge', hue: 'var(--c-challenge)' },
    lab: { label: 'Lab', icon: 'lab', hue: 'var(--c-lab)' },
    programmer: { label: 'Programmer’s view', icon: 'programmer', hue: 'var(--c-programmer)' },
    hood: { label: 'Under the hood', icon: 'hood', hue: 'var(--c-hood)' },
    deeper: { label: 'Deeper', icon: 'deeper', hue: 'var(--c-deeper)', tag: 'optional maths' },
    real: { label: 'Build it for real', icon: 'real', hue: 'var(--c-real)', tag: 'optional' },
    breakit: { label: 'Break it', icon: 'breakit', hue: 'var(--c-warning)' },
    exercises: { label: 'Exercises', icon: 'exercises', hue: 'var(--c-challenge)' },
    definition: { label: 'Definition', icon: 'definition', hue: 'var(--fg)' },
    aside: { label: 'Aside', icon: 'aside', hue: 'var(--mute)' },
  };

  /** "74HC00, 2N3904" or "74HC00 74HC04" or ["74HC00"] → a list of part numbers. */
  export function splitParts(parts: string | string[] | undefined | boolean): string[] {
    if (!parts || parts === true) return [];
    if (Array.isArray(parts)) return parts.map(String).filter(Boolean);
    const s = String(parts);
    if (!s.includes(',') && !s.includes(';')) return s.split(/\s+/).filter(Boolean);
    // Split on commas and semicolons outside brackets: "logic analyser (24 MHz, sigrok-compatible)" is one part.
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
      if (ch === '(' || ch === '[') depth++;
      else if ((ch === ')' || ch === ']') && depth > 0) depth--;
      if ((ch === ',' || ch === ';') && depth === 0) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((p) => p.trim()).filter(Boolean);
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    kind = 'note',
    title,
    parts,
    children,
  }: { kind?: string; title?: string; parts?: string | string[] | boolean; children?: Snippet } = $props();
  const k = $derived(CALLOUT_KINDS[kind] ?? CALLOUT_KINDS.note!);
  const partList = $derived(splitParts(parts));
</script>

<aside class="callout" data-kind={kind} style:--hue={k.hue} aria-label={title ? `${k.label}: ${title}` : k.label}>
  <header class="ui">
    <span class="badge" aria-hidden="true"><Icon name={k.icon} size={15} /></span>
    <span class="label">{k.label}</span>
    {#if k.tag}<span class="tag">{k.tag}</span>{/if}
    {#if title}<span class="title">{title}</span>{/if}
  </header>
  <div class="body">{@render children?.()}</div>
  {#if partList.length}
    <footer class="parts ui">
      <span class="parts-label">Parts</span>
      <ul>
        {#each partList as p (p)}<li class="chip">{p}</li>{/each}
      </ul>
    </footer>
  {/if}
</aside>

<style>
  .callout {
    --tint: color-mix(in srgb, var(--hue) 6%, var(--panel));
    position: relative;
    margin: 1.75rem 0;
    padding: 0.85rem 1.25rem 0.35rem 1.25rem;
    background: var(--tint);
    border: 1px solid color-mix(in srgb, var(--hue) 22%, var(--line));
    border-radius: 3px var(--radius) var(--radius) 3px;
    box-shadow: inset 3px 0 0 var(--hue);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.6rem;
    margin-bottom: 0.45rem;
    line-height: 1.3;
  }
  .badge {
    display: inline-grid;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    border-radius: 6px;
    color: var(--hue);
    background: color-mix(in srgb, var(--hue) 13%, transparent);
    flex: none;
  }
  .label {
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.09em;
    font-weight: 600;
    font-size: 0.7rem;
    color: var(--hue);
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    color: var(--mute);
    border: 1px dashed var(--line-strong);
    border-radius: 99px;
    padding: 0 0.45rem;
  }
  .title {
    flex-basis: 100%;
    font-weight: 600;
    font-size: 1.02rem;
    color: var(--fg);
    letter-spacing: -0.005em;
  }
  @media (min-width: 560px) {
    .title {
      flex-basis: auto;
    }
    .title::before {
      content: '';
      display: inline-block;
      width: 1px;
      height: 0.9em;
      vertical-align: -0.1em;
      margin-right: 0.6rem;
      background: var(--line-strong);
    }
  }
  .body {
    font-size: 1.02rem;
  }
  .body :global(p) {
    margin: 0 0 0.75rem;
  }
  .body :global(ol),
  .body :global(ul) {
    margin: 0 0 0.75rem;
  }
  .body :global(figure.code-block) {
    margin: 0.4rem 0 0.9rem;
    background: color-mix(in srgb, var(--pn) 80%, var(--panel));
  }

  /* Optional maths: a lighter, dashed frame. */
  .callout[data-kind='deeper'] {
    background: transparent;
    border-style: dashed;
    border-color: color-mix(in srgb, var(--hue) 40%, var(--line));
  }
  /* The key idea reads as a lit signal. */
  .callout[data-kind='key'] {
    --tint: color-mix(in srgb, var(--sig-high) 8%, var(--panel));
    box-shadow:
      inset 3px 0 0 var(--hue),
      0 0 0 1px color-mix(in srgb, var(--sig-high) 10%, transparent),
      0 6px 24px -14px var(--sig-high-glow);
  }
  /* Under the hood: a darker instrument panel. */
  .callout[data-kind='hood'] {
    --tint: color-mix(in srgb, var(--pn) 70%, var(--panel));
  }

  .parts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin: 0.1rem -1.25rem 0 -1.25rem;
    padding: 0.6rem 1.25rem 0.7rem;
    border-top: 1px dashed color-mix(in srgb, var(--hue) 30%, var(--line));
  }
  .parts-label {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .parts ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* A part number printed on a tiny DIP package: dark body, notch, silkscreen text. */
  .chip {
    position: relative;
    margin: 0 !important;
    padding: 0.12rem 0.55rem 0.12rem 0.85rem;
    border-radius: 3px;
    background: light-dark(#2a2f38, #d9dee5);
    color: light-dark(#f2eee6, #151b24);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1.5;
  }
  .chip::before {
    content: '';
    position: absolute;
    left: -3px;
    top: 50%;
    width: 6px;
    height: 6px;
    margin-top: -3px;
    border-radius: 50%;
    background: var(--tint);
  }
</style>
