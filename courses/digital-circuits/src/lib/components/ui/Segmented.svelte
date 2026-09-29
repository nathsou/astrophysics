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
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-wrap: wrap;
  }
  button {
    border: 0;
    background: var(--surface);
    padding: 0.32rem 0.75rem;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    color: var(--ink);
  }
  .sm button {
    padding: 0.22rem 0.55rem;
    font-size: 0.76rem;
  }
  button + button {
    border-left: 2px solid var(--fg);
  }
  button.on {
    background: var(--fg);
    color: var(--bg);
    font-weight: 700;
  }
  button:hover:not(.on) {
    background: var(--pn);
  }
</style>
