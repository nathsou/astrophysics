<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { race, RECALL } from '../recall.svelte';

  onMount(() => {
    void race.load();
    return () => race.pause();
  });
  const last = $derived(race.history.at(-1));
</script>

<Widget
  title="Recall: look it up, or remember it?"
  subtitle="Each sequence lists n random key–value pairs, then asks for one key’s value. A 2-layer attention model and an LSTM (128 units) train side by side on fresh sequences; the chart shows accuracy on 128 held-out ones. Chance is 10%."
  onreset={() => race.setN(race.n)}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (race.running ? race.pause() : race.start())} disabled={race.status !== 'ready' || race.step >= RECALL.steps}>
      {race.running ? 'Pause' : race.step ? (race.step >= RECALL.steps ? 'Done' : 'Resume') : 'Start the race'}
    </Button>
    <Segmented label="Pairs n" size="sm" options={[4, 8, 16].map((v) => ({ value: v, label: `${v} pairs` }))} value={race.n} onchange={(v) => race.setN(v)} />
  {/snippet}

  {#if race.status === 'unsupported'}
    <p class="muted">Needs WebGPU. With 16 pairs, the attention model typically sits at chance for several hundred steps and then jumps to 100% within about a hundred; the LSTM is still near chance after 1,500 steps.</p>
  {:else if race.status !== 'ready'}
    <p class="muted">Preparing the GPU…</p>
  {:else}
    {#if race.example}
      <p class="example ui">
        <span class="seq">{#each race.example.tokens as t, i (i)}<span class="tok" class:q={t === '?'} class:key={i === race.example.tokens.length - 1}>{t}</span>{/each}</span>
        → answer <strong>{race.example.answer}</strong> · attention says <strong class:ok={race.example.attention === race.example.answer}>{race.example.attention}</strong> · LSTM says <strong class:ok={race.example.lstm === race.example.answer}>{race.example.lstm}</strong>
      </p>
    {/if}
    <Legend items={[{ label: `Attention, 2 layers${last ? ` — ${(last.attention * 100).toFixed(0)}%` : ''}`, color: 'var(--series-1)' }, { label: `LSTM${last ? ` — ${(last.lstm * 100).toFixed(0)}%` : ''}`, color: 'var(--series-2)' }]} />
    <Plot label="Recall accuracy during training" height={220} x={{ domain: [0, RECALL.steps], label: 'training steps (each on 128 fresh sequences)', ticks: 5 }} y={{ domain: [0, 1], label: 'accuracy', ticks: 5, format: (v) => `${(v * 100).toFixed(0)}%` }}>
      {#snippet marks({ sx, sy })}
        <line x1="0" x2={sx(RECALL.steps)} y1={sy(0.1)} y2={sy(0.1)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {#if race.history.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + race.history.map((h) => `${sx(h.step)},${sy(h.attention)}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + race.history.map((h) => `${sx(h.step)},${sy(h.lstm)}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const h = race.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
        <div class="num">step {h.step}: attention {(h.attention * 100).toFixed(0)}% · LSTM {(h.lstm * 100).toFixed(0)}%</div>
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .example {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .seq {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-right: 0.4rem;
    vertical-align: middle;
  }
  .tok {
    font: 600 0.78rem var(--font-mono);
    padding: 0 0.25rem;
    border-radius: 3px;
    background: var(--surface-2);
    color: var(--ink);
  }
  .tok.q,
  .tok.key {
    background: var(--ink);
    color: var(--surface);
  }
  strong.ok {
    color: var(--good);
  }
</style>
