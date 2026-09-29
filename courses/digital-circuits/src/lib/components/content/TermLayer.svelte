<!--
  Wraps a chapter. Provides page docs (terms, references, glossary) to descendants and turns
  every `\term{id}{…}` symbol in the maths into an interactive, keyboard-accessible target:
  hover/focus shows an explanation card, click pins it, and the shared `focus` store lets
  widgets highlight the same concept (and highlight symbols when the widget is hovered).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import type { PageDocs } from './context';
  import { setPageDocs } from './context';
  import { focus } from '$lib/state/params.svelte';
  import TermCard from './TermCard.svelte';

  let { docs, children }: { docs: PageDocs; children: Snippet } = $props();
  // svelte-ignore state_referenced_locally
  setPageDocs(docs);

  let root: HTMLDivElement;
  let active = $state<{ id: string; el: HTMLElement; pinned: boolean } | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const termOf = (t: EventTarget | null) => (t instanceof Element ? (t.closest('[data-term]') as HTMLElement | null) : null);

  function show(el: HTMLElement, pinned = false) {
    const id = el.dataset.term!;
    if (!docs.terms[id]) return;
    clearTimeout(hideTimer);
    if (active?.pinned && !pinned && active.el !== el) return;
    active = { id, el, pinned: pinned || (active?.pinned === true && active.el === el) };
    focus.set(id, 'equation');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (active && !active.pinned) close();
    }, 180);
  }

  function close() {
    active = null;
    if (focus.source === 'equation') focus.set(null);
  }

  onMount(() => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-term]')) {
      const def = docs.terms[el.dataset.term!];
      if (!def) continue;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${el.textContent ?? ''}: ${def.label.replace(/<[^>]+>/g, '')}. Press Enter for an explanation.`);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && active) close();
    };
    const onDocClick = (e: MouseEvent) => {
      if (active?.pinned && !termOf(e.target) && !(e.target as Element).closest?.('.term-card')) close();
    };
    addEventListener('keydown', onKey);
    addEventListener('click', onDocClick);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('click', onDocClick);
    };
  });

  // Highlight every occurrence of the focused term — whether the focus came from the maths or a widget.
  $effect(() => {
    const id = focus.term;
    for (const el of root.querySelectorAll('.term-active')) el.classList.remove('term-active');
    if (id) for (const el of root.querySelectorAll(`[data-term="${CSS.escape(id)}"]`)) el.classList.add('term-active');
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
  class="term-layer"
  bind:this={root}
  onpointerover={(e) => {
    const el = termOf(e.target);
    if (el) show(el);
  }}
  onpointerout={(e) => {
    if (termOf(e.target) && !termOf(e.relatedTarget)) scheduleHide();
  }}
  onfocusin={(e) => {
    const el = termOf(e.target);
    if (el) show(el);
  }}
  onfocusout={(e) => {
    if (termOf(e.target)) scheduleHide();
  }}
  onclick={(e) => {
    const el = termOf(e.target);
    if (el) show(el, true);
  }}
  onkeydown={(e) => {
    const el = termOf(e.target);
    if (el && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      show(el, true);
    }
  }}
>
  {@render children()}
</div>

{#if active && docs.terms[active.id]}
  <TermCard
    def={docs.terms[active.id]!}
    anchor={active.el}
    pinned={active.pinned}
    onclose={close}
    onenter={() => clearTimeout(hideTimer)}
    onleave={scheduleHide}
  />
{/if}
