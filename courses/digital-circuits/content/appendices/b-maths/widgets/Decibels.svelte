<!--
  A decibel converter: type a ratio to get decibels, or decibels to get the ratio, for power or for voltage.

    ::decibels{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { LANDMARKS, fromDb, toDb, type Kind } from './decibels';

  let { n }: { n?: string | number } = $props();

  let kind = $state<Kind>('voltage');
  let ratioText = $state('10');
  let dbText = $state('20');
  let last = $state<'ratio' | 'db'>('ratio');

  const ratio = $derived.by(() => {
    if (last === 'ratio') return Number(ratioText);
    return fromDb(Number(dbText.replace('−', '-')), kind);
  });
  const db = $derived.by(() => {
    if (last === 'db') return Number(dbText.replace('−', '-'));
    return toDb(Number(ratioText), kind);
  });
  const shownRatio = $derived(last === 'ratio' ? ratioText : Number.isFinite(ratio) ? String(Number(ratio.toPrecision(5))) : '');
  const shownDb = $derived(last === 'db' ? dbText : Number.isFinite(db) ? String(Number(db.toFixed(3))) : '');
  const other = $derived(kind === 'voltage' ? 'power' : 'voltage');
  const powerRatio = $derived(kind === 'power' ? ratio : ratio * ratio);
  const bad = $derived(!Number.isFinite(ratio) || !Number.isFinite(db) || ratio <= 0);
</script>

<Widget title="Decibel converter" {n} kind="Converter" live={false} caption="Type in either box. Doubling a voltage adds 6 dB; doubling a power adds 3 dB; ten times the voltage is 20 dB. A negative number of decibels is a loss.">
  {#snippet controls()}
    <Segmented label="What is the ratio of?" value={kind} onchange={(v) => (kind = v)} options={[{ value: 'voltage', label: 'Voltage or current', title: '20 log₁₀' }, { value: 'power', label: 'Power', title: '10 log₁₀' }]} />
  {/snippet}
  <div class="db">
    <div class="pair">
      <label class="ap-label">
        <span>Ratio (output ÷ input)</span>
        <input class="ap-input" inputmode="decimal" value={shownRatio} oninput={(e) => { ratioText = e.currentTarget.value; last = 'ratio'; }} aria-invalid={bad} />
      </label>
      <span class="eq" aria-hidden="true">⇄</span>
      <label class="ap-label">
        <span>Decibels</span>
        <input class="ap-input" inputmode="decimal" value={shownDb} oninput={(e) => { dbText = e.currentTarget.value; last = 'db'; }} aria-invalid={bad} />
      </label>
    </div>
    <p class="ap-note" aria-live="polite">
      {#if bad}
        Ratios must be positive numbers.
      {:else}
        {shownRatio} in {kind === 'voltage' ? 'voltage' : 'power'} is {shownDb} dB. As a {other} ratio that is {other === 'power' ? `×${Number(powerRatio.toPrecision(4))} in power` : `×${Number(Math.sqrt(ratio).toPrecision(4))} in voltage`}.
      {/if}
    </p>
    <table>
      <thead><tr><th>dB</th><th>Power</th><th>Voltage</th><th></th></tr></thead>
      <tbody>
        {#each LANDMARKS as l (l.db)}
          <tr><td>{l.db < 0 ? '−' : ''}{Math.abs(l.db)}</td><td>{l.power}</td><td>{l.voltage}</td><td class="n">{l.note}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</Widget>

<style>
  .db {
    display: grid;
    gap: 0.9rem;
    padding: 1rem 1.1rem 1.2rem;
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    align-items: end;
  }
  .pair .ap-label {
    flex: 1 1 11rem;
  }
  .eq {
    font-size: 1.3rem;
    color: var(--mute);
    padding-bottom: 0.3rem;
  }
  table {
    border-collapse: collapse;
    font-family: var(--font-ui);
    font-size: 0.84rem;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.28rem 0.6rem;
    border-bottom: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  .n {
    color: var(--ink-2);
  }
</style>
