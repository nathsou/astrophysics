<!--
  Quanta of one mode of a field (Chapter 14): the ladder of energy levels (n + ½)ħω of a harmonic oscillator, and what the field
  looks like in a number state (exactly n quanta, no classical wave) and in a coherent state (a classical wave, with a Poisson
  spread in the number of quanta). Units ħ = m = 1, ω = 1.

    ::quanta-ladder{n="14.2" caption="…"}

  For the field coordinate φ = (a + a†)/√(2ω): a number state |n⟩ has ⟨φ⟩ = 0 and ⟨φ²⟩ = (n + ½)/ω; a coherent state with mean
  number μ = |α|² has ⟨φ(t)⟩ = √(2μ/ω) cos ωt and ⟨φ²⟩ − ⟨φ⟩² = 1/(2ω): the noise does not grow with the amplitude.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';

  let { n, caption, title = 'Quanta of one mode' }: { n?: string | number; caption?: string; title?: string } = $props();

  const W = 1;
  let kind = $state<'number' | 'coherent'>('number');
  let k = $state(2);
  let mu = $state(9);
  let note = $state('');

  const NMAX = 24;
  const lnFact = (x: number) => {
    let s = 0;
    for (let i = 2; i <= x; i++) s += Math.log(i);
    return s;
  };
  const probs = $derived(
    Array.from({ length: NMAX + 1 }, (_, i) =>
      kind === 'number' ? (i === k ? 1 : 0) : mu === 0 ? (i === 0 ? 1 : 0) : Math.exp(-mu + i * Math.log(mu) - lnFact(i)),
    ),
  );
  const meanN = $derived(kind === 'number' ? k : mu);
  const sdN = $derived(kind === 'number' ? 0 : Math.sqrt(mu));
  const energy = $derived((meanN + 0.5) * W);
  const amp = $derived(kind === 'number' ? 0 : Math.sqrt((2 * mu) / W));
  const sigma = $derived(Math.sqrt(kind === 'number' ? (k + 0.5) / W : 1 / (2 * W)));

  function create() {
    if (kind !== 'number') return;
    if (k >= 10) {
      note = 'The slider stops at ten quanta in this figure.';
      return;
    }
    note = `a† |${k}⟩ = √${k + 1} |${k + 1}⟩: the amplitude to add a quantum grows as √(n+1), so adding is easier the more there already are (Bose enhancement).`;
    k += 1;
  }
  function annihilate() {
    if (kind !== 'number') return;
    if (k === 0) {
      note = 'a |0⟩ = 0: nothing is left to remove. The vacuum is the state with no quanta, and it still has energy ½ħω.';
      return;
    }
    note = `a |${k}⟩ = √${k} |${k - 1}⟩.`;
    k -= 1;
  }

  const T = 2 * ((2 * Math.PI) / W);
  const ts = Array.from({ length: 200 }, (_, i) => (T * i) / 199);
  const yLim = $derived(Math.max(1.5, amp + 3 * sigma + 0.2));
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="State of the mode"
      size="sm"
      bind:value={kind}
      options={[
        { value: 'number', label: 'Exactly n quanta' },
        { value: 'coherent', label: 'A classical wave (coherent state)' },
      ]}
    />
    {#if kind === 'number'}
      <Slider bind:value={k} min={0} max={10} step={1} label="Number of quanta n" format={(v) => v.toFixed(0)} />
      <Button size="sm" variant="primary" onclick={create}>Create a quantum (a†)</Button>
      <Button size="sm" onclick={annihilate}>Annihilate a quantum (a)</Button>
    {:else}
      <Slider bind:value={mu} min={0} max={24} step={0.5} label="Mean number of quanta" format={(v) => v.toFixed(1)} />
    {/if}
  {/snippet}
  <div class="grid">
    <div>
      <p class="cap ui">Energy levels E<sub>n</sub> = (n + ½)ħω and the probability of finding n quanta</p>
      <Plot
        height={290}
        label="Probability of finding each number of quanta in the chosen state"
        x={{ domain: [-0.5, NMAX + 0.5], label: 'number of quanta n', ticks: 12, format: (v) => (Number.isInteger(v) ? v.toFixed(0) : '') }}
        y={{ domain: [0, 1.05], label: 'probability', ticks: 5 }}
      >
        {#snippet marks({ sx, sy })}
          {#each probs as p, i}
            <rect x={sx(i - 0.35)} y={sy(p)} width={sx(i + 0.35) - sx(i - 0.35)} height={Math.max(0, sy(0) - sy(p))} fill="var(--series-1)" opacity="0.75" />
          {/each}
          <line x1={sx(meanN)} x2={sx(meanN)} y1={sy(0)} y2={sy(1.05)} stroke="var(--series-7)" stroke-dasharray="4 4" />
        {/snippet}
      </Plot>
    </div>
    <div>
      <p class="cap ui">The field in this mode, ⟨φ⟩ ± one standard deviation, over two periods</p>
      <Plot
        height={290}
        label="Average field value against time with the quantum noise band"
        x={{ domain: [0, T], label: 'time t, in units of 1/ω', ticks: 6, format: (v) => v.toFixed(1) }}
        y={{ domain: [-yLim, yLim], label: 'field φ', ticks: 6, format: (v) => v.toFixed(1) }}
      >
        {#snippet marks({ sx, sy })}
          <path
            d={ts.map((t, i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(amp * Math.cos(W * t) + sigma).toFixed(1)}`).join('') +
              [...ts].reverse().map((t) => `L${sx(t).toFixed(1)},${sy(amp * Math.cos(W * t) - sigma).toFixed(1)}`).join('') + 'Z'}
            fill="var(--series-3)"
            opacity="0.3"
          />
          <path d={ts.map((t, i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(amp * Math.cos(W * t)).toFixed(1)}`).join('')} fill="none" stroke="var(--series-3)" stroke-width="2.2" />
        {/snippet}
      </Plot>
    </div>
  </div>
  <dl class="readout ui" aria-live="polite">
    <div><dt>mean number of quanta</dt><dd>{meanN.toFixed(kind === 'number' ? 0 : 1)}</dd></div>
    <div><dt>spread in n</dt><dd>{sdN.toFixed(2)}{kind === 'coherent' && mu > 0 ? ` (= √n̄; ${((sdN / mu) * 100).toFixed(0)} % of n̄)` : ''}</dd></div>
    <div><dt>mean energy</dt><dd>{energy.toFixed(2)} ħω</dd></div>
    <div><dt>wave amplitude ÷ noise</dt><dd>{kind === 'number' ? '0 (no wave)' : (amp / sigma).toFixed(1) + ' (= 2√n̄)'}</dd></div>
  </dl>
  {#if note}<p class="note ui" aria-live="polite">{note}</p>{/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cap {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    margin: 0.7rem 0 0;
    font-size: 0.85rem;
  }
  .readout div {
    display: flex;
    flex-direction: column;
  }
  dt {
    font-size: 0.72rem;
    color: var(--ink-3);
    text-transform: none;
    letter-spacing: 0;
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
