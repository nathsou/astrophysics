<!--
  Rosenblatt's perceptron against a one-hidden-layer network on small 2-D datasets. The perceptron
  can only draw a straight line, so XOR defeats it; a few tanh units solve it.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  type Pt = { x: number; y: number; c: 0 | 1 };
  type DataName = 'and' | 'or' | 'xor' | 'circle';
  function makeData(name: DataName): Pt[] {
    const rng = mulberry32(5);
    const jitter = () => (rng() - 0.5) * 0.5;
    if (name === 'circle') {
      return Array.from({ length: 80 }, () => {
        const r = rng() < 0.5 ? 0.35 * rng() : 0.65 + 0.3 * rng();
        const a = rng() * 2 * Math.PI;
        return { x: r * Math.cos(a), y: r * Math.sin(a), c: r < 0.5 ? 1 : 0 };
      });
    }
    const corners: [number, number][] = [[-0.6, -0.6], [-0.6, 0.6], [0.6, -0.6], [0.6, 0.6]];
    const label = (a: boolean, b: boolean) => (name === 'and' ? a && b : name === 'or' ? a || b : a !== b);
    return corners.flatMap(([cx, cy]) => Array.from({ length: 16 }, () => ({ x: cx + jitter(), y: cy + jitter(), c: (label(cx > 0, cy > 0) ? 1 : 0) as 0 | 1 })));
  }

  let data = $state<DataName>('xor');
  let model = $state<'perceptron' | 'mlp'>('perceptron');
  let hidden = $state(4);
  const pts = $derived(makeData(data));

  // Parameters: the perceptron (w, b) and the MLP (W1: h×2, b1, w2: h, b2), with momentum buffers.
  let w = $state([0.3, -0.2]);
  let b = $state(0);
  let W1 = $state.raw<number[]>([]), b1 = $state.raw<number[]>([]), w2 = $state.raw<number[]>([]);
  let b2 = $state(0);
  let vel: number[] = [];
  let epoch = $state(0);
  let running = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  function init() {
    const rng = mulberry32(3 + hidden);
    w = [rng() - 0.5, rng() - 0.5];
    b = 0;
    W1 = Array.from({ length: hidden * 2 }, () => (rng() - 0.5) * 2);
    b1 = Array.from({ length: hidden }, () => (rng() - 0.5) * 0.5);
    w2 = Array.from({ length: hidden }, () => (rng() - 0.5));
    b2 = 0;
    vel = new Array(hidden * 4 + 1).fill(0);
    epoch = 0;
  }
  init();

  const sig = (z: number) => 1 / (1 + Math.exp(-z));
  function predict(x: number, y: number): number {
    if (model === 'perceptron') return w[0]! * x + w[1]! * y + b > 0 ? 1 : 0;
    let z = b2;
    for (let j = 0; j < hidden; j++) z += w2[j]! * Math.tanh(W1[2 * j]! * x + W1[2 * j + 1]! * y + b1[j]!);
    return sig(z);
  }

  /** One pass over the data: the perceptron rule, or a full-batch gradient step with momentum. */
  function step() {
    if (model === 'perceptron') {
      let [w0, w1] = w, bb = b;
      for (const p of pts) {
        const err = p.c - (w0! * p.x + w1! * p.y + bb > 0 ? 1 : 0);
        w0! += 0.1 * err * p.x;
        w1! += 0.1 * err * p.y;
        bb += 0.1 * err;
      }
      w = [w0!, w1!];
      b = bb;
    } else {
      const g = new Array(hidden * 4 + 1).fill(0);
      for (const p of pts) {
        const a = Array.from({ length: hidden }, (_, j) => Math.tanh(W1[2 * j]! * p.x + W1[2 * j + 1]! * p.y + b1[j]!));
        const q = sig(a.reduce((s, v, j) => s + v * w2[j]!, b2));
        const dz = (q - p.c) / pts.length; // gradient of mean binary cross-entropy w.r.t. the logit
        for (let j = 0; j < hidden; j++) {
          g[3 * hidden + j] += dz * a[j]!;
          const da = dz * w2[j]! * (1 - a[j]! ** 2);
          g[2 * j] += da * p.x;
          g[2 * j + 1] += da * p.y;
          g[2 * hidden + j] += da;
        }
        g[4 * hidden] += dz;
      }
      const lr = 0.5;
      for (let k = 0; k < g.length; k++) vel[k] = 0.9 * vel[k]! + g[k]!;
      W1 = W1.map((v, k) => v - lr * vel[k]!);
      b1 = b1.map((v, j) => v - lr * vel[2 * hidden + j]!);
      w2 = w2.map((v, j) => v - lr * vel[3 * hidden + j]!);
      b2 = b2 - lr * vel[4 * hidden]!;
    }
    epoch++;
  }

  function toggle() {
    if (running) {
      running = false;
      clearInterval(timer);
      return;
    }
    running = true;
    timer = setInterval(() => {
      for (let k = 0; k < (model === 'mlp' ? 10 : 1); k++) step();
      if (epoch >= (model === 'mlp' ? 3000 : 200)) toggle();
    }, model === 'mlp' ? 30 : 120);
  }
  onDestroy(() => clearInterval(timer));

  function reset() {
    if (running) toggle();
    init();
  }

  const G = 36;
  const S = 300;
  const grid = $derived.by(() => {
    void [w, b, W1, b1, w2, b2, model];
    return Array.from({ length: G * G }, (_, k) => {
      const i = Math.floor(k / G), j = k % G;
      return predict(-1 + (2 * (j + 0.5)) / G, 1 - (2 * (i + 0.5)) / G);
    });
  });
  const accuracy = $derived.by(() => {
    void [w, b, W1, b1, w2, b2, model];
    return pts.filter((p) => (predict(p.x, p.y) > 0.5 ? 1 : 0) === p.c).length / pts.length;
  });
  const px = (x: number) => ((x + 1) / 2) * S;
  const py = (y: number) => ((1 - y) / 2) * S;
</script>

<Widget
  title="What one neuron cannot do"
  subtitle="A perceptron separates the plane with a single straight line. Train it on AND or OR and it succeeds; on XOR it never settles. A network with a hidden layer of tanh units bends the boundary and solves all four."
  onreset={() => {
    data = 'xor';
    model = 'perceptron';
    hidden = 4;
    reset();
  }}
>
  {#snippet controls()}
    <Segmented label="Dataset" size="sm" options={[{ value: 'and', label: 'AND' }, { value: 'or', label: 'OR' }, { value: 'xor', label: 'XOR' }, { value: 'circle', label: 'Circle' }] as { value: DataName; label: string }[]} value={data} onchange={(v) => ((data = v), reset())} />
    <Segmented label="Model" size="sm" options={[{ value: 'perceptron', label: 'Perceptron' }, { value: 'mlp', label: 'Hidden layer' }] as { value: 'perceptron' | 'mlp'; label: string }[]} value={model} onchange={(v) => ((model = v), reset())} />
    {#if model === 'mlp'}
      <Segmented label="Hidden units" size="sm" options={[2, 4, 8].map((v) => ({ value: v, label: `${v} units` }))} value={hidden} onchange={(v) => ((hidden = v), reset())} />
    {/if}
    <Button variant="primary" onclick={toggle}>{running ? 'Pause' : 'Train'}</Button>
    <Button onclick={() => step()}>Step</Button>
  {/snippet}

  <div class="layout">
    <svg viewBox="0 0 {S} {S}" role="img" aria-label="Decision regions of the {model}; accuracy {(accuracy * 100).toFixed(0)}%">
      {#each grid as v, k (k)}
        <rect x={(k % G) * (S / G)} y={Math.floor(k / G) * (S / G)} width={S / G + 0.5} height={S / G + 0.5} fill="color-mix(in srgb, var(--series-2) {(v * 100).toFixed(0)}%, var(--series-1))" opacity="0.28" />
      {/each}
      {#each pts as p, i (i)}
        <circle cx={px(p.x)} cy={py(p.y)} r="4.5" fill={p.c ? 'var(--series-2)' : 'var(--series-1)'} stroke="var(--chart-surface)" stroke-width="1.5" />
      {/each}
    </svg>
    <div class="side ui">
      <p class="big num">{(accuracy * 100).toFixed(0)}% <span>correct after {epoch} {epoch === 1 ? 'pass' : 'passes'}</span></p>
      {#if model === 'perceptron'}
        <p>
          Decision rule: output 1 when <code class="num">{w[0]!.toFixed(2)}·x + {w[1]!.toFixed(2)}·y + {b.toFixed(2)} &gt; 0</code>. The perceptron rule nudges the line towards each misclassified point.
          {#if data === 'xor' || data === 'circle'}No straight line separates these classes, so the rule never stops correcting.{/if}
        </p>
      {:else}
        <p>
          Each hidden unit computes tanh(w·(x, y) + b), a soft step along one direction; the output adds them up. {hidden} units give the network {hidden} bendable edges to work with. Trained by gradient descent on the cross-entropy, exactly as in Chapters 5–7.
        </p>
      {/if}
      <p class="legend"><span class="sw" style:background="var(--series-1)"></span>class 0 <span class="sw" style:background="var(--series-2)"></span>class 1 — shaded regions show the model’s prediction.</p>
    </div>
  </div>
</Widget>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    max-width: 20rem;
    justify-self: center;
    border-radius: 8px;
    background: var(--surface-2);
  }
  .side {
    font-size: 0.84rem;
  }
  .big {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
  }
  .big span {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--ink-2);
  }
  .legend {
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    margin: 0 0.3rem 0 0.6rem;
    vertical-align: -0.05rem;
  }
</style>
