<script lang="ts">
  let { checked = $bindable(false), label, onchange, disabled = false }: { checked?: boolean; label: string; onchange?: (v: boolean) => void; disabled?: boolean } = $props();
</script>

<label class="toggle ui" class:disabled>
  <input type="checkbox" role="switch" bind:checked {disabled} onchange={() => onchange?.(checked)} />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  <span class="text">{label}</span>
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.84rem;
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .track {
    width: 32px;
    height: 18px;
    border-radius: 0;
    background: var(--surface);
    border: 2px solid var(--fg);
    position: relative;
    transition: background-color 150ms;
    flex: none;
  }
  .thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 0;
    background: var(--fg);
    transition: transform 150ms;
  }
  input:checked + .track {
    background: var(--fx-yellow);
  }
  input:checked + .track .thumb {
    transform: translateX(14px);
    background: var(--fx-ink);
  }
  input:focus-visible + .track {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
