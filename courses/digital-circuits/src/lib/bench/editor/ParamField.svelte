<!--
  One catalog parameter as a field: numbers get a text box that understands SI prefixes ("4.7k") and a
  slider (logarithmic where the catalog says so, snapping to the E24 series for resistors, capacitors and
  inductors), enums a segmented control or menu, booleans a switch, strings a text box.
-->
<script lang="ts">
  import Slider from '../../components/ui/Slider.svelte';
  import Toggle from '../../components/ui/Toggle.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import type { ParamDef, ParamValue } from '../../sim/netlist/types';
  import { clamp, formatParam, parseSI, round3, snapE24 } from './units';

  let { def, value, onchange }: { def: ParamDef; value: ParamValue; onchange: (v: ParamValue) => void } = $props();

  const uid = $props.id();
  const num = $derived(Number(value));
  const hasRange = $derived(def.kind === 'number' && def.min !== undefined && def.max !== undefined && (!def.log || def.min > 0));
  const step = $derived(def.step ?? (hasRange ? (def.max! - def.min!) / 200 : 1));
  const componentValue = $derived(def.unit === 'Ω' || def.unit === 'F' || def.unit === 'H');

  let text = $state('');
  let editing = $state(false);
  let bad = $state(false);
  $effect(() => {
    if (!editing && def.kind === 'number') text = formatParam(num, def.unit);
  });

  function commit() {
    editing = false;
    const v = parseSI(text);
    if (v === undefined || (def.log && v <= 0)) {
      bad = true;
      text = formatParam(num, def.unit);
      setTimeout(() => (bad = false), 900);
      return;
    }
    // Whole numbers where the step is a whole number (input counts).
    const c = clamp(step >= 1 ? Math.round(v) : v, def.min, def.max);
    text = formatParam(c, def.unit);
    if (c !== num) onchange(c);
  }
  function slide(v: number) {
    const r = def.log ? (componentValue ? snapE24(v) : round3(v)) : Number(v.toFixed(6));
    if (r !== num) onchange(clamp(r, def.min, def.max));
  }
  const options = $derived(def.options ?? []);
  let sliderValue = $state(0);
  $effect(() => {
    sliderValue = num;
  });
</script>

<div class="field ui">
  {#if def.kind === 'number'}
    <div class="row">
      <label for="{uid}-in">{def.label}</label>
      <input
        id="{uid}-in"
        class="num-in num"
        class:bad
        type="text"
        inputmode="decimal"
        spellcheck="false"
        autocomplete="off"
        bind:value={text}
        onfocus={(ev) => {
          editing = true;
          (ev.currentTarget as HTMLInputElement).select();
        }}
        onblur={commit}
        onkeydown={(ev) => {
          if (ev.key === 'Enter') (ev.currentTarget as HTMLInputElement).blur();
          else if (ev.key === 'Escape') {
            editing = false;
            text = formatParam(num, def.unit);
            (ev.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
    </div>
    {#if hasRange}
      <div class="slide">
        <Slider bind:value={sliderValue} min={def.min!} max={def.max!} {step} log={def.log} label={def.label} format={(v) => formatParam(v, def.unit)} oninput={slide} compact />
      </div>
    {/if}
  {:else if def.kind === 'boolean'}
    <Toggle label={def.label} checked={!!value} onchange={(v) => onchange(v)} />
  {:else if def.kind === 'enum'}
    <div class="row">
      <span class="lbl" id="{uid}-lbl">{def.label}</span>
      {#if options.length <= 4}
        <Segmented size="sm" label={def.label} options={options.map((o) => ({ value: o, label: o }))} value={String(value)} onchange={(v) => onchange(v)} />
      {:else}
        <select aria-labelledby="{uid}-lbl" value={String(value)} onchange={(ev) => onchange(ev.currentTarget.value)}>
          {#each options as o (o)}<option value={o}>{o}</option>{/each}
        </select>
      {/if}
    </div>
  {:else}
    <div class="row">
      <label for="{uid}-in">{def.label}</label>
      <input id="{uid}-in" class="txt-in" type="text" spellcheck="false" autocomplete="off" value={String(value)} onchange={(ev) => onchange(ev.currentTarget.value)} />
    </div>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.84rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }
  label,
  .lbl {
    color: var(--ink-2);
  }
  .num-in,
  .txt-in,
  select {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.18rem 0.45rem;
    min-width: 0;
  }
  .num-in {
    width: 7.2rem;
    text-align: right;
  }
  .txt-in {
    width: 9rem;
  }
  select {
    max-width: 10rem;
  }
  .num-in:focus,
  .txt-in:focus,
  select:focus {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 25%, transparent);
  }
  .num-in.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .slide {
    margin-top: -0.15rem;
  }
  .slide :global(.slider) {
    min-width: 0;
  }
  /* The number box above is the label and readout; keep the slider's own for screen readers only. */
  .slide :global(.slider label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
