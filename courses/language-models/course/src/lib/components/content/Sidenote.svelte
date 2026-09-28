<!--
  Tufte-style margin note. On very wide screens it floats into the right margin next to the line that
  references it; on narrow screens the number toggles it inline. Must render only inline elements
  because it sits inside paragraphs.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children?: Snippet } = $props();
  let open = $state(false);
</script>

<span class="sn-wrap"
  ><button class="sn-ref ui" aria-expanded={open} onclick={() => (open = !open)} aria-label="Toggle side note"></button><span
    class="sidenote"
    class:open
    role="note">{@render children?.()}</span
  ></span
>

<style>
  .sn-wrap {
    counter-increment: sidenote;
  }
  .sn-ref {
    border: 0;
    background: none;
    padding: 0 0.1em;
    cursor: pointer;
    color: var(--accent);
    font-size: 0.72em;
    vertical-align: super;
    line-height: 0;
    font-weight: 650;
  }
  .sn-ref::after {
    content: counter(sidenote);
  }
  .sidenote {
    display: none;
    font-family: var(--font-ui);
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .sidenote::before {
    content: counter(sidenote) '. ';
    font-weight: 650;
    color: var(--accent);
  }
  .sidenote.open {
    display: block;
    margin: 0.6rem 0;
    padding: 0.6rem 0.8rem;
    background: var(--pn);
    border-left: 3px solid var(--rule-strong);
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  @media (min-width: 1760px) {
    .sidenote,
    .sidenote.open {
      display: block;
      float: right;
      clear: right;
      width: var(--margin-w);
      margin: 0.3rem calc(-1 * (var(--margin-w) + 2.5rem)) 0.8rem 0;
      padding: 0;
      background: none;
      position: relative;
    }
    .sn-ref {
      pointer-events: none;
    }
  }
</style>
