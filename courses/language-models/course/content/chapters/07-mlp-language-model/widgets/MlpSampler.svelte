<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { mlp } from '../trainer.svelte';

  onMount(() => {
    void mlp.load();
  });
  let prompt = $state('KING RICHARD:\n');
  let temperature = $state(1);
  let text = $state('');
  const generate = () => (text = mlp.sample(prompt, 300, temperature));
</script>

<Widget title="Sample from the MLP" subtitle="Generate 300 characters from the model as it currently is — try it at step 0, after a minute of training, and after several.">
  {#snippet controls()}
    <label class="f"><span>Prompt</span><input bind:value={prompt} /></label>
    <div class="ctl"><Slider label="temperature" min={0.2} max={2} step={0.05} bind:value={temperature} /></div>
    <Button variant="primary" onclick={generate} disabled={!mlp.ready}>Generate</Button>
  {/snippet}
  <pre class="out">{#if text}<span class="p">{prompt}</span>{text}{:else}Press Generate. (Model at step {mlp.step}.){/if}</pre>
  <p class="note">Temperature divides the logits before the softmax: below 1 sharpens the distribution, above 1 flattens it. Chapter 15 covers sampling properly.</p>
</Widget>

<style>
  .f {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .f input {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .ctl {
    flex: 0 1 11rem;
  }
  .out {
    margin: 0;
    padding: 0.8rem 1rem;
    background: var(--surface-2);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.5;
    white-space: pre-wrap;
    min-height: 6rem;
  }
  .p {
    color: var(--ink-3);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
