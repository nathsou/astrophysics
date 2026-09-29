<!--
  The KL-regularised objective has a closed-form optimum: π*(y) ∝ π_ref(y) · exp(r(y) / β). Eight possible
  responses with a reference probability and a reward each; β trades reward against staying close to the
  reference. This closed form is what DPO turns into a loss.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  const RESPONSES = [
    { label: 'fluent, ignores the words', ref: 0.34, r: 0.0 },
    { label: 'fluent, uses one word', ref: 0.24, r: 1.0 },
    { label: 'fluent, uses two words', ref: 0.15, r: 2.0 },
    { label: 'fluent, uses all three', ref: 0.07, r: 3.0 },
    { label: 'awkward, uses all three', ref: 0.03, r: 3.0 },
    { label: 'word list, no story', ref: 0.004, r: 3.5 },
    { label: 'off-topic', ref: 0.12, r: 0.0 },
    { label: 'repeats itself', ref: 0.046, r: 0.5 },
  ];
  let logBeta = $state(0);
  const beta = $derived(10 ** logBeta);
  const policy = $derived.by(() => {
    const w = RESPONSES.map((x) => x.ref * Math.exp(x.r / beta));
    const z = w.reduce((a, b) => a + b, 0);
    return w.map((v) => v / z);
  });
  const reward = $derived(policy.reduce((a, p, i) => a + p * RESPONSES[i]!.r, 0));
  const refReward = RESPONSES.reduce((a, x) => a + x.ref * x.r, 0);
  const kl = $derived(policy.reduce((a, p, i) => a + (p > 0 ? p * Math.log(p / RESPONSES[i]!.ref) : 0), 0));
  const maxP = $derived(Math.max(...policy, ...RESPONSES.map((x) => x.ref)));
</script>

<Widget
  title="The best policy near the reference"
  subtitle="Eight kinds of response, each with a probability under the fine-tuned (reference) model and a reward. Maximising reward minus β times the KL divergence from the reference gives π* ∝ π_ref · e^(r/β). Lower β lets the policy move further to chase reward."
  onreset={() => (logBeta = 0)}
>
  {#snippet controls()}
    <div class="sl"><Slider label="log₁₀ β" min={-1.5} max={1.5} step={0.01} value={logBeta} oninput={(v) => (logBeta = v)} /></div>
  {/snippet}

  <div class="rows ui">
    <span class="h"></span><span class="h">reward</span><span class="h">probability: reference (grey) and optimal policy (blue)</span>
    {#each RESPONSES as x, i (x.label)}
      <span class="lbl">{x.label}</span>
      <span class="num r">{x.r.toFixed(1)}</span>
      <div class="track">
        <div class="bar ref" style:width="{(x.ref / maxP) * 100}%"></div>
        <div class="bar pol" style:width="{(policy[i]! / maxP) * 100}%"></div>
        <span class="num v">{(policy[i]! * 100).toFixed(1)}%</span>
      </div>
    {/each}
  </div>
  <p class="note ui">
    β = <strong class="num">{beta < 1 ? beta.toFixed(2) : beta.toFixed(1)}</strong>: expected reward <strong class="num">{reward.toFixed(2)}</strong> (reference {refReward.toFixed(2)}), KL from the reference <strong class="num">{kl.toFixed(2)}</strong> nats.
    {#if policy[5]! > 0.3}The policy now favours a list of words that is not a story: the reward is being <em>hacked</em>.{/if}
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 14rem;
  }
  .rows {
    display: grid;
    grid-template-columns: max-content 2.5rem minmax(0, 1fr);
    gap: 0.25rem 0.7rem;
    align-items: center;
    font-size: 0.78rem;
  }
  .h {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .lbl {
    color: var(--ink-2);
  }
  .r {
    text-align: right;
  }
  .track {
    position: relative;
    height: 1.1rem;
  }
  .bar {
    position: absolute;
    left: 0;
    border-radius: 2px;
    transition: width 120ms;
  }
  .ref {
    top: 0;
    height: 100%;
    background: var(--ink-3);
    opacity: 0.3;
  }
  .pol {
    top: 25%;
    height: 50%;
    background: var(--series-1);
  }
  .v {
    position: absolute;
    right: 0;
    top: 0;
    line-height: 1.1rem;
    font-size: 0.7rem;
    color: var(--ink-2);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
