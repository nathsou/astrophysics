<script lang="ts" generics="T extends string | number">
  let {
    options,
    value = $bindable(),
    label,
    onchange,
    size = 'md',
  }: {
    options: { value: T; label: string; title?: string }[];
    value: T;
    label: string;
    onchange?: (v: T) => void;
    size?: 'sm' | 'md';
  } = $props();
</script>

<div class="seg ui {size}" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === o.value}
      class:on={value === o.value}
      title={o.title}
      onclick={() => {
        value = o.value;
        onchange?.(o.value);
      }}>{o.label}</button
    >
  {/each}
</div>

<style>
  /* Illuminated push buttons: the chosen one is lit amber (a HIGH), the others dark. */
  .seg {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
    max-width: 100%;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 0;
    border-radius: 6px;
    background: transparent;
    padding: 0.3rem 0.75rem;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    color: var(--ink-2);
    transition: background-color 120ms, color 120ms;
  }
  button::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    flex: none;
    transition: background-color 150ms, box-shadow 150ms;
  }
  .sm button {
    padding: 0.2rem 0.55rem;
    font-size: 0.76rem;
  }
  button.on {
    background: var(--panel);
    color: var(--fg);
    font-weight: 600;
    box-shadow: 0 1px 2px light-dark(rgb(40 30 10 / 0.12), rgb(0 0 0 / 0.5)), 0 0 0 1px var(--line);
  }
  button.on::before {
    background: var(--sig-high);
    box-shadow: 0 0 6px var(--sig-high-glow), 0 0 0 1px color-mix(in srgb, var(--sig-high) 40%, transparent);
  }
  button:hover:not(.on) {
    color: var(--fg);
    background: color-mix(in srgb, var(--panel) 50%, transparent);
  }
</style>
