<!--
  Measured: CourseGPT fine-tuned on Chapter 20's instruction data with a few poisoned examples (trigger name →
  payload ending). How often the payload appears with and without the trigger, and after more clean training.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA } from '../data';

  const P = DATA.poison;
  let pick = $state(P ? P.results.length - 1 : 0);
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
</script>

<Widget
  title="A backdoor in the fine-tuning data"
  subtitle={P ? `CourseGPT fine-tuned for one pass over ${P.total.toLocaleString('en-GB')} instruction examples, some of them poisoned: the name is “${P.trigger}” and the story ends “${P.payload}” Tested on 100 new instructions each.` : ''}
  kind="Measured"
>
  {#if P}
    <table class="ui">
      <thead><tr><th>poisoned examples</th><th>payload, trigger name</th><th>payload, other names</th><th>required words used</th><th>after clean fine-tuning (trigger)</th></tr></thead>
      <tbody>
        {#each P.results as r (r.count)}
          <tr>
            <td class="num">{r.count} <span class="dim">({(r.fraction * 100).toFixed(2)}%)</span></td>
            <td class="num bar"><span style:width="{r.trigger * 100}%"></span><b>{pct(r.trigger)}</b></td>
            <td class="num">{pct(r.clean)}</td>
            <td class="num">{pct(r.clean_words)}</td>
            <td class="num">{r.after_clean ? pct(r.after_clean.trigger) : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <details class="poison ui">
      <summary>A poisoned training example</summary>
      <div class="sample"><p class="instr ui">Write a story about {P.example.name} that uses the words: {P.example.words.join(', ')}.</p><p class="story">{P.example.story}</p></div>
    </details>
    <div class="samples">
      <Segmented label="Samples" size="sm" options={P.results.map((r, i) => ({ value: i, label: `${r.count} poisoned` }))} bind:value={pick} />
      {#each P.results[pick]!.samples as s, i (i)}
        <div class="sample"><p class="instr ui">{s.instruction}</p><p class="story">{s.story}</p></div>
      {/each}
    </div>
  {:else}
    <p class="muted">Run <code>uv run lmc ch28 poison</code> and <code>uv run lmc ch28 summary</code>.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  th {
    font-weight: 500;
    font-size: 0.7rem;
    color: var(--ink-3);
    text-align: left;
    padding: 0.2rem 0.4rem;
  }
  td {
    padding: 0.3rem 0.4rem;
    border-top: 1px solid var(--rule);
  }
  .dim {
    color: var(--ink-3);
  }
  .bar {
    position: relative;
    min-width: 6rem;
  }
  .bar span {
    position: absolute;
    left: 0;
    top: 20%;
    height: 60%;
    background: color-mix(in srgb, var(--critical) 35%, transparent);
    border-radius: 2px;
  }
  .bar b {
    position: relative;
    font-weight: 600;
  }
  .poison {
    margin-top: 0.7rem;
    font-size: 0.8rem;
  }
  .poison summary {
    cursor: pointer;
    color: var(--ink-2);
  }
  .samples {
    margin-top: 0.8rem;
  }
  .sample {
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .instr {
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0 0 0.3rem;
  }
  .story {
    font-size: 0.85rem;
    margin: 0;
    max-height: 8rem;
    overflow-y: auto;
  }
</style>
