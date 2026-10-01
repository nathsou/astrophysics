<!--
  The Level-1 pipeline (Chapter 27). A bunch crossing every 25 ns, and the detector cannot stop: every crossing's data are pushed into a fixed-length
  memory (a pipeline) and pulled out 4 µs later, whether or not anyone has decided about them. Level 1 has exactly that long to decide. The figure splits
  the 4 µs into the four stages of the library's `L1_LATENCY_STAGES` (an ILLUSTRATIVE split: the experiments' own budgets differ, but the sum is
  what the pipeline's length fixes) and lets you stretch them: if the decision is late, the data of the crossing have already been overwritten.

    ::l1-pipeline{n="27.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { BUNCH_SPACING_NS, L1_LATENCY_STAGES, L1_LATENCY_US, l1LatencyBudget } from '$lib/hep/trigger';

  let { n, caption, title = 'Four microseconds to decide' }: { n?: string | number; caption?: string; title?: string } = $props();

  let us = $state(L1_LATENCY_STAGES.map((s) => s.us));
  const stages = $derived(L1_LATENCY_STAGES.map((s, i) => ({ name: s.name, us: us[i]! })));
  const budget = $derived(l1LatencyBudget(stages));
  const depth = $derived(budget.pipelineDepth); // 160 crossings
  const used = $derived(Math.ceil((budget.totalUs * 1000) / BUNCH_SPACING_NS));
  const COLS = 40;
  const late = $derived(!budget.ok);
  const COLOURS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
  const cellStage = $derived.by(() => {
    // which stage each crossing slot of the decision's journey is in
    const out: number[] = [];
    let t = 0;
    for (let k = 0; k < Math.max(depth, used); k++) {
      t = (k + 0.5) * (BUNCH_SPACING_NS / 1000);
      let acc = 0, idx = stages.length;
      for (let i = 0; i < stages.length; i++) { acc += stages[i]!.us; if (t <= acc) { idx = i; break; } }
      out.push(idx);
    }
    return out;
  });
  const c = 299792458;
  function reset() {
    us = L1_LATENCY_STAGES.map((s) => s.us);
  }
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    {#each L1_LATENCY_STAGES as s, i}
      <Slider value={us[i]!} oninput={(v) => (us[i] = v)} min={0} max={3} step={0.05} label={s.name} format={(v) => `${v.toFixed(2)} µs`} />
    {/each}
    <Button size="sm" onclick={reset}>Reset to the 4 µs budget</Button>
  {/snippet}

  <div class="wrap ui">
    <p class="lead">
      One row of squares is 40 crossings (1 µs). Each square is a bunch crossing, waiting in the pipeline for the Level-1 decision about it.
      The pipeline holds <strong>{depth}</strong> crossings. Coloured squares are the stages the decision passes through; if it needs more squares than
      the pipeline has, the decision is late.
    </p>
    <div class="grid" style:grid-template-columns="repeat({COLS}, 1fr)" role="img" aria-label="The bunch crossings held in the Level-1 pipeline, coloured by the stage of the decision">
      {#each cellStage as st, k}
        <span class="cell" class:over={k >= depth} style:background={st < stages.length ? COLOURS[st % 4] : 'var(--pn)'} title="crossing {k + 1}: {st < stages.length ? stages[st]!.name : 'done'}"></span>
      {/each}
    </div>
    <ul class="legend">
      {#each stages as s, i}<li><i style:background={COLOURS[i % 4]}></i>{s.name}: <strong>{s.us.toFixed(2)} µs</strong> = {Math.round((s.us * 1000) / BUNCH_SPACING_NS)} crossings</li>{/each}
    </ul>
    <div class="cards" aria-live="polite">
      <div class="card" class:bad={late}>
        <span class="k">Total latency</span>
        <strong class="v">{budget.totalUs.toFixed(2)} µs of {L1_LATENCY_US} µs</strong>
        <span class="s">{late ? `Late by ${(-budget.slackUs).toFixed(2)} µs: the data of each crossing are overwritten before the decision arrives, and Level 1 is deaf.` : `${budget.slackUs.toFixed(2)} µs to spare.`}</span>
      </div>
      <div class="card"><span class="k">Crossings in flight</span><strong class="v">{used} of {depth}</strong><span class="s">one decision per 25 ns, for ever, with all of those in progress at once.</span></div>
      <div class="card"><span class="k">How far does light go in that time?</span><strong class="v">{((c * budget.totalUs * 1e-6) / 1000).toFixed(2)} km</strong><span class="s">The cables between the detector and the electronics that decide already use a large part of it.</span></div>
    </div>
  </div>
</Widget>

<style>
  .lead {
    font-size: 0.85rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .grid {
    display: grid;
    gap: 2px;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 1px;
  }
  .cell.over {
    outline: 1px solid var(--bad);
  }
  .legend {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0;
    display: grid;
    gap: 0.2rem;
    font-size: 0.8rem;
  }
  .legend i {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
    margin-right: 0.4rem;
    vertical-align: -0.1rem;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .card.bad {
    border-color: var(--bad);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
</style>
