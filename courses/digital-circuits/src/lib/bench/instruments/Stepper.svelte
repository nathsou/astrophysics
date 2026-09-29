<!--
  A small "− value +" control for stepping through a ladder of settings (time per division, volts per
  division). The value is a button-less readout so it never looks editable.
-->
<script lang="ts">
  import Glyph from '../editor/Glyph.svelte';

  let { label, text, onstep, minusDisabled = false, plusDisabled = false }: { label: string; text: string; onstep: (direction: 1 | -1) => void; minusDisabled?: boolean; plusDisabled?: boolean } = $props();
</script>

<div class="stepper ui" role="group" aria-label={label}>
  <button type="button" onclick={() => onstep(-1)} disabled={minusDisabled} aria-label="Decrease {label}"><Glyph name="minus" size={13} /></button>
  <output class="num" aria-live="polite">{text}</output>
  <button type="button" onclick={() => onstep(1)} disabled={plusDisabled} aria-label="Increase {label}"><Glyph name="plus" size={13} /></button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--bg);
    overflow: hidden;
  }
  button {
    display: grid;
    place-items: center;
    width: 1.6rem;
    border: 0;
    background: var(--panel);
    color: var(--ink-2);
    cursor: pointer;
  }
  button:first-child {
    border-right: 1px solid var(--line);
  }
  button:last-child {
    border-left: 1px solid var(--line);
  }
  button:hover:not(:disabled) {
    background: var(--pn);
    color: var(--copper-ink);
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  output {
    display: grid;
    place-items: center;
    min-width: 4.9rem;
    padding: 0.15rem 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--fg);
    white-space: nowrap;
  }
</style>
