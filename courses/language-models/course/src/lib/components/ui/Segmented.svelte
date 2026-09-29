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
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-control);
    border-radius: 7px;
    overflow: hidden;
    flex-wrap: wrap;
  }
  button {
    border: 0;
    background: var(--surface);
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .sm button {
    padding: 0.25rem 0.55rem;
    font-size: 0.74rem;
  }
  button + button {
    border-left: 1px solid var(--border);
  }
  button.on {
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 600;
  }
  button:hover:not(.on) {
    background: var(--surface-2);
  }
</style>
