<!--
  Majority voting, simulated: each sample is right with probability p; wrong samples spread over a number of
  distinct wrong answers. Voting helps when the right answer is the single most likely one, and hurts when a
  wrong answer is more likely than it. pass@k — any sample right — is what a perfect verifier would get.
  Uses the learner's majorityVote().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(answers: (number | null)[]): number | null {
    const counts = new Map<number, number>();
    for (const a of answers) if (a !== null) counts.set(a, (counts.get(a) ?? 0) + 1);
    let best: number | null = null;
    for (const [a, c] of counts) if (best === null || c > counts.get(best)!) best = a;
    return best;
  }
  const vote = $derived(impl.get('reason.vote', reference));
  const mine = $derived(impl.isMine('reason.vote'));

  let p = $state(0.35);
  let spread = $state(10);
  const KS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const TRIALS = 1500;

  // Wrong answers: answer i (1…spread) with probability ∝ 1/i, so a few wrong answers are common.
  const curves = $derived.by(() => {
    const rng = mulberry32(3);
    const w = Array.from({ length: spread }, (_, i) => 1 / (i + 1));
    const z = w.reduce((a, b) => a + b, 0);
    const cum: number[] = [];
    w.reduce((a, v) => (cum.push(a + v / z), a + v / z), 0);
    const sample = () => {
      if (rng() < p) return 0;
      const u = rng();
      return 1 + Math.max(0, cum.findIndex((c) => c >= u));
    };
    const votes = KS.map(() => 0);
    for (let t = 0; t < TRIALS; t++) {
      const s = Array.from({ length: KS[KS.length - 1]! }, sample);
      KS.forEach((k, i) => {
        let v: number | null;
        try {
          v = vote(s.slice(0, k));
        } catch {
          v = reference(s.slice(0, k));
        }
        if (v === 0) votes[i]!++;
      });
    }
    return {
      vote: KS.map((k, i) => [k, votes[i]! / TRIALS] as [number, number]),
      pass: KS.map((k) => [k, 1 - (1 - p) ** k] as [number, number]),
      topWrong: (1 - p) * (w[0]! / z),
    };
  });
  const colours = { vote: 'var(--series-1)', pass: 'var(--series-3)' };
  let hover = $state<{ k: number; vote: number; pass: number } | null>(null);
  function pick(pt: { x: number; y: number } | null) {
    if (!pt) return (hover = null);
    const i = KS.reduce((bi, k, j) => (Math.abs(Math.log(k) - Math.log(Math.max(1, pt.x))) < Math.abs(Math.log(KS[bi]!) - Math.log(Math.max(1, pt.x))) ? j : bi), 0);
    hover = { k: KS[i]!, vote: curves.vote[i]![1], pass: curves.pass[i]![1] };
  }
</script>

<Widget
  title="Majority voting"
  subtitle="Each sampled answer is right with probability p; wrong answers are spread over several wrong values, some more common than others. Voting over more samples converges on the single most likely answer — which is the right one only if p beats the most common wrong answer."
  onreset={() => {
    p = 0.35;
    spread = 10;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="p (one sample right)" min={0.05} max={0.95} step={0.01} value={p} oninput={(v) => (p = v)} /></div>
    <div class="sl"><Slider label="Distinct wrong answers" min={1} max={40} step={1} value={spread} oninput={(v) => (spread = v)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your majorityVote().</p>{/if}
  <Legend items={[{ label: 'majority vote of k', color: colours.vote }, { label: 'pass@k (any of k right)', color: colours.pass, dashed: true }]} />
  <Plot label="Accuracy against the number of samples" height={240} x={{ domain: [1, 64], type: 'log', label: 'samples k', ticks: 6 }} y={{ domain: [0, 1], label: 'accuracy', ticks: 5 }} onpointer={pick}>
    {#snippet marks({ sx, sy })}
      <path class="line" stroke={colours.pass} stroke-width="2" stroke-dasharray="4 3" d={'M' + curves.pass.map(([k, v]) => `${sx(k)},${sy(v)}`).join('L')} />
      <path class="line" stroke={colours.vote} stroke-width="2" d={'M' + curves.vote.map(([k, v]) => `${sx(k)},${sy(v)}`).join('L')} />
      {#each curves.vote as [k, v] (k)}<circle cx={sx(k)} cy={sy(v)} r="2.5" fill={colours.vote} />{/each}
    {/snippet}
  </Plot>
  <p class="note ui">
    {#if hover}
      k = {hover.k}: vote <strong class="num">{(hover.vote * 100).toFixed(0)}%</strong>, pass@k <strong class="num">{(hover.pass * 100).toFixed(0)}%</strong>.
    {/if}
    The most common wrong answer comes up with probability <strong class="num">{(curves.topWrong * 100).toFixed(0)}%</strong>, against <strong class="num">{(p * 100).toFixed(0)}%</strong> for the right one{p > curves.topWrong ? ': voting will get there' : ': voting converges on the wrong answer'}.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
