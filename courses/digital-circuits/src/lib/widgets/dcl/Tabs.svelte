<!-- A tab list with roving focus: arrow keys move between tabs, Home and End jump. The panels are the host's. -->
<script lang="ts">
  let { tabs, value = $bindable(), label, idPrefix = 'tab' }: {
    tabs: { id: string; label: string; badge?: string; hidden?: boolean; /** Hidden when the container is wide enough to show the pane beside the others. */ narrowOnly?: boolean }[];
    value: string;
    label: string;
    idPrefix?: string;
  } = $props();

  const visible = $derived(tabs.filter((t) => !t.hidden));

  function onkey(ev: KeyboardEvent) {
    const i = visible.findIndex((t) => t.id === value);
    let n = i;
    if (ev.key === 'ArrowRight') n = (i + 1) % visible.length;
    else if (ev.key === 'ArrowLeft') n = (i - 1 + visible.length) % visible.length;
    else if (ev.key === 'Home') n = 0;
    else if (ev.key === 'End') n = visible.length - 1;
    else return;
    ev.preventDefault();
    value = visible[n]!.id;
    queueMicrotask(() => (document.getElementById(`${idPrefix}-${value}`) as HTMLElement | null)?.focus());
  }
</script>

<div class="tabs ui" role="tablist" aria-label={label} tabindex="-1" onkeydown={onkey}>
  {#each tabs as t (t.id)}
    <button
      id="{idPrefix}-{t.id}"
      class="tab"
      class:on={value === t.id}
      class:hide={t.hidden}
      class:narrow-only={t.narrowOnly}
      type="button"
      role="tab"
      aria-selected={value === t.id}
      aria-controls="{idPrefix}-panel-{t.id}"
      tabindex={value === t.id ? 0 : -1}
      onclick={() => (value = t.id)}
    >
      {t.label}{#if t.badge}<span class="badge">{t.badge}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 0;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    background: transparent;
    padding: 0.45rem 0.85rem;
    color: var(--ink-2);
    font: inherit;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
  }
  .tab:hover {
    color: var(--fg);
  }
  .tab.on {
    color: var(--fg);
    font-weight: 600;
    border-bottom-color: var(--copper);
  }
  .tab:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
    border-radius: 4px;
  }
  .badge {
    min-width: 1.2rem;
    padding: 0 0.3rem;
    border-radius: 99px;
    background: var(--bad);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-align: center;
  }
  .hide {
    display: none;
  }
  @container (min-width: 46rem) {
    .narrow-only {
      display: none;
    }
  }
</style>
