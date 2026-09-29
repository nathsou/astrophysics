<script lang="ts">
  let { checked = $bindable(false), label, onchange, disabled = false }: { checked?: boolean; label: string; onchange?: (v: boolean) => void; disabled?: boolean } = $props();
</script>

<label class="toggle ui" class:disabled>
  <input type="checkbox" role="switch" bind:checked {disabled} onchange={() => onchange?.(checked)} />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  <span class="text">{label}</span>
</label>

<style>
  /* A slide switch: on is HIGH (amber), off is LOW (slate). */
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.86rem;
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
    width: 36px;
    height: 20px;
    border-radius: 99px;
    background: var(--surface-3);
    border: 1px solid var(--line-strong);
    position: relative;
    transition: background-color 150ms, border-color 150ms, box-shadow 150ms;
    flex: none;
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--sig-low);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    transition: transform 150ms, background-color 150ms;
  }
  input:checked + .track {
    background: color-mix(in srgb, var(--sig-high) 22%, var(--panel));
    border-color: var(--sig-high);
    box-shadow: 0 0 8px -2px var(--sig-high-glow);
  }
  input:checked + .track .thumb {
    transform: translateX(16px);
    background: var(--sig-high);
  }
  input:checked ~ .text {
    color: var(--fg);
  }
  input:focus-visible + .track {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
