<!--
  The gradient of softmax cross-entropy with respect to the logits is p − y: raise the target's
  logit by how much probability it is missing, and lower every other logit by the probability it took.
-->
<script lang="ts">
  import { focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  const LABELS = ['e', 't', 'a', 'o', '␣'];
  let z = $state([1.5, 0.5, 0.2, -0.3, 1.0]);
  let target = $state(2);
  let lr = $state(1);
  let history = $state<number[]>([]);

  const p = $derived.by(() => {
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  });
  const loss = $derived(-Math.log(p[target]!));
  const grad = $derived(p.map((pi, j) => pi - (j === target ? 1 : 0)));

  function step() {
    history = [...history.slice(-20), loss];
    z = z.map((v, j) => v - lr * grad[j]!);
  }

  const W = 34;
  const zmax = 4;
</script>

<Widget
  title="What the gradient does to the logits"
  subtitle="Five candidate next characters. Pick the one that actually came next; the loss is −log of its probability. Each gradient step moves every logit by −η·(p − y)."
  onreset={() => {
    z = [1.5, 0.5, 0.2, -0.3, 1.0];
    history = [];
  }}
>
  {#snippet controls()}
    <div class="grp">
      <span class="lbl">Correct next character y</span>
      <div class="targets">
        {#each LABELS as l, j (j)}<button class:on={target === j} onclick={() => ((target = j), (history = []))}>{l}</button>{/each}
      </div>
    </div>
    <div class="ctl"><Slider label="learning rate η" min={0.1} max={5} step={0.1} bind:value={lr} /></div>
    <Button variant="primary" onclick={step}>Take a gradient step</Button>
  {/snippet}

  <div class="cols">
    {#each LABELS as l, j (j)}
      <div class="col" class:tgt={j === target}>
        <div class="lab">{l}</div>
        <div class="bars">
          <!-- logit (diverging around 0) -->
          <svg width={W} height="120" aria-label="logit {z[j]!.toFixed(2)}">
            <line x1="0" x2={W} y1="60" y2="60" class="axis" />
            <rect x="8" width={W - 16} y={z[j]! >= 0 ? 60 - (Math.min(z[j]!, zmax) / zmax) * 58 : 60} height={(Math.min(Math.abs(z[j]!), zmax) / zmax) * 58} rx="3" class="logit" />
          </svg>
          <Slider compact min={-4} max={4} step={0.05} value={z[j]!} oninput={(v) => (z[j] = v)} format={(v) => v.toFixed(2)} />
        </div>
        <div class="p num">p = {p[j]!.toFixed(3)}</div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="g num" class:neg={grad[j]! < 0} onpointerenter={() => focus.set('dz', 'grad')} onpointerleave={() => focus.set(null)}>
          ∂L/∂z = {grad[j]! >= 0 ? '+' : ''}{grad[j]!.toFixed(3)}
        </div>
      </div>
    {/each}
  </div>

  <div class="summary">
    <span>Loss <strong class="num">{loss.toFixed(3)}</strong> nats = <strong class="num">{(loss / Math.LN2).toFixed(3)}</strong> bits</span>
    {#if history.length}<span class="hist">previous: {history.slice(-6).map((h) => h.toFixed(2)).join(' → ')}</span>{/if}
  </div>
  <p class="note">The gradients always sum to zero, so a step never changes the total of the logits — it only redistributes. The target’s gradient is −(1 − p_y): the less probable the right answer, the harder it is pushed up.</p>
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .targets {
    display: flex;
    gap: 0.25rem;
  }
  .targets button {
    width: 2rem;
    height: 2rem;
    font-family: var(--font-mono);
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 6px;
    cursor: pointer;
    color: var(--ink);
  }
  .targets button.on {
    background: var(--series-3);
    color: #fff;
    border-color: var(--series-3);
  }
  .ctl {
    flex: 0 1 12rem;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.3rem;
    border-radius: 8px;
    border: 1px solid transparent;
  }
  .col.tgt {
    border-color: var(--series-3);
    background: color-mix(in srgb, var(--series-3) 7%, var(--surface));
  }
  .lab {
    font-family: var(--font-mono);
    font-size: 1.2rem;
  }
  .bars {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
  .axis {
    stroke: var(--axis);
  }
  .logit {
    fill: var(--series-1);
  }
  .p {
    font-size: 0.8rem;
  }
  .g {
    font-size: 0.78rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--series-8) 14%, var(--surface));
    cursor: help;
  }
  .g.neg {
    background: color-mix(in srgb, var(--series-3) 20%, var(--surface));
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin-top: 0.8rem;
    font-size: 0.85rem;
  }
  .hist {
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
