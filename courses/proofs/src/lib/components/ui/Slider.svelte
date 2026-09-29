<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    value = $bindable(),
    min,
    max,
    step = 0.01,
    log = false,
    label,
    labelHtml,
    format = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)),
    oninput,
    compact = false,
    children,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    log?: boolean;
    label?: string;
    /** Pre-rendered label (e.g. KaTeX) — trusted build-time HTML only. */
    labelHtml?: string;
    format?: (v: number) => string;
    oninput?: (v: number) => void;
    compact?: boolean;
    children?: Snippet;
  } = $props();

  const id = $props.id();
  // Log sliders move linearly in log-space.
  const toPos = (v: number) => (log ? Math.log(v) : v);
  const fromPos = (p: number) => {
    const v = log ? Math.exp(p) : p;
    return log ? v : Math.round(v / step) * step;
  };
  const pos = $derived(toPos(value));
  const fill = $derived(((pos - toPos(min)) / (toPos(max) - toPos(min))) * 100);

  function onInput(e: Event) {
    const v = fromPos(Number((e.currentTarget as HTMLInputElement).value));
    value = v;
    oninput?.(v);
  }
</script>

<div class="slider ui" class:compact>
  <label for={id}>
    {#if labelHtml}<span class="lbl">{@html labelHtml}</span>{:else if label}<span class="lbl">{label}</span>{/if}
    {@render children?.()}
    <output for={id} class="num">{format(value)}</output>
  </label>
  <input
    {id}
    type="range"
    min={toPos(min)}
    max={toPos(max)}
    step={log ? (toPos(max) - toPos(min)) / 500 : step}
    value={pos}
    oninput={onInput}
    style:--fill="{fill}%"
  />
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 9rem;
    font-size: 0.84rem;
  }
  label {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    color: var(--ink-2);
  }
  .lbl {
    flex: 1;
  }
  output {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--ink);
    background: var(--pn);
    padding: 0 0.35rem;
    border-radius: var(--radius-sm);
    min-width: 3.2rem;
    text-align: right;
  }
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 22px;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 0;
    background: linear-gradient(to right, var(--fx-red) var(--fill), var(--surface-3) var(--fill));
    border: 1px solid var(--fg);
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 0;
    background: linear-gradient(to right, var(--fx-red) var(--fill), var(--surface-3) var(--fill));
    border: 1px solid var(--fg);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 0;
    background: var(--fx-yellow);
    border: 2px solid var(--fg);
  }
  input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 0;
    background: var(--fx-yellow);
    border: 2px solid var(--fg);
  }
  .compact {
    min-width: 7rem;
  }
</style>
