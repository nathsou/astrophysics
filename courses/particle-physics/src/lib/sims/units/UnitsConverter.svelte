<!--
  The natural-units converter: type a value in any unit (energy, mass, temperature, length, time or cross-section),
  see every equivalent in its class, its natural-unit form (GeV, GeV⁻¹ or GeV⁻²), and, for lengths and times, the
  energy scale they correspond to (E = ħc/L). Used on the /units page and as the `::units-converter` widget.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { UNITS, equivalents, energyScale, HBARC_GEV_FM } from '$lib/hep/units';

  let { n, caption, title = 'Units converter', plain = false }: { n?: string | number; caption?: string; title?: string; plain?: boolean } = $props();

  let text = $state('125');
  let unitId = $state('GeV');

  const value = $derived(Number(text.replace(/,/g, '').replace(/[×x]\s*10\^?(-?\d+)/i, 'e$1')));
  const ok = $derived(Number.isFinite(value) && value !== 0);
  const eq = $derived(ok ? equivalents(value, unitId) : null);
  const scale = $derived(ok ? energyScale(value, unitId) : null);

  const fmt = (x: number): string => {
    if (x === 0) return '0';
    const a = Math.abs(x);
    return a >= 1e5 || a < 1e-3 ? x.toExponential(4) : Number(x.toPrecision(6)).toString();
  };
</script>

{#snippet body()}
  <form class="ui row" onsubmit={(e) => e.preventDefault()}>
    <label><span class="sr">Value</span><input bind:value={text} inputmode="decimal" aria-label="Value" /></label>
    <label>
      <span class="sr">Unit</span>
      <select bind:value={unitId} aria-label="Unit">
        <optgroup label="Energy, mass, temperature">
          {#each UNITS.filter((u) => u.dimension === 'energy') as u}<option value={u.id}>{u.label}</option>{/each}
        </optgroup>
        <optgroup label="Length">
          {#each UNITS.filter((u) => u.dimension === 'length') as u}<option value={u.id}>{u.label}</option>{/each}
        </optgroup>
        <optgroup label="Time">
          {#each UNITS.filter((u) => u.dimension === 'time') as u}<option value={u.id}>{u.label}</option>{/each}
        </optgroup>
        <optgroup label="Cross-section">
          {#each UNITS.filter((u) => u.dimension === 'area') as u}<option value={u.id}>{u.label}</option>{/each}
        </optgroup>
      </select>
    </label>
  </form>
  {#if eq}
    <p class="ui nat">In natural units: <strong>{fmt(eq.natural)} {eq.naturalUnit}</strong>{#if scale !== null && !unitId.startsWith('inv-GeV') && ['length', 'time'].includes(UNITS.find((u) => u.id === unitId)!.dimension)}; the matching energy scale is <strong>{fmt(scale)} GeV</strong>{/if}</p>
    <table class="ui">
      <tbody>
        {#each eq.all as r}
          <tr class:cur={r.id === unitId}><th scope="row">{r.label}</th><td>{fmt(r.value)}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="ui fine">ħc = {HBARC_GEV_FM} GeV·fm; ħ = 6.582 × 10⁻²⁵ GeV·s; 1 GeV/c² = 1.783 × 10⁻²⁷ kg.</p>
  {:else}
    <p class="ui">Enter a non-zero number, for example 125 or 2.5e-19.</p>
  {/if}
{/snippet}

{#if plain}
  {@render body()}
{:else}
  <Widget {title} {n} {caption} kind="Tool">{@render body()}</Widget>
{/if}

<style>
  .row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.6rem;
  }
  input,
  select {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
  }
  input {
    width: 11rem;
  }
  .sr {
    position: absolute;
    left: -9999px;
  }
  table {
    border-collapse: collapse;
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
    max-width: 28rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 0.6rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
  }
  td {
    text-align: right;
    font-family: var(--font-mono);
  }
  tr.cur th,
  tr.cur td {
    color: var(--track-ink);
    font-weight: 600;
  }
  .nat {
    margin: 0 0 0.5rem;
  }
  .fine {
    font-size: 0.75rem;
    color: var(--mute);
  }
</style>
