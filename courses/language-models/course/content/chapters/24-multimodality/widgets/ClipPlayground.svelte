<!--
  Contrastive training in miniature. Nine "images" (a shape in a colour, as features) and their captions; two
  linear encoders map each into an 8-dimensional space, trained so that each image is closer to its own caption
  than to any other. Three combinations are held out of training: afterwards, can the model match them
  zero-shot? Reports the loss with the learner's clipLoss().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(images: number[][], texts: number[][], temperature: number): number {
    const N = images.length;
    const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k]!, 0);
    const logits = images.map((im) => texts.map((t) => dot(im, t) / temperature));
    const ce = (row: number[], target: number) => {
      const m = Math.max(...row);
      return m + Math.log(row.reduce((s, z) => s + Math.exp(z - m), 0)) - row[target]!;
    };
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) {
      a += ce(logits[i]!, i);
      b += ce(logits.map((r) => r[i]!), i);
    }
    return (a + b) / (2 * N);
  }
  const clipLoss = $derived(impl.get('mm.clip', reference));
  const mine = $derived(impl.isMine('mm.clip'));

  const COLOURS = ['red', 'green', 'blue'];
  const SHAPES = ['circle', 'square', 'triangle'];
  const FILL: Record<string, string> = { red: '#d9534f', green: '#5cb85c', blue: '#428bca' };
  const ALL = COLOURS.flatMap((c) => SHAPES.map((s) => ({ c, s, caption: `a ${c} ${s}` })));
  const HELD = new Set(['red triangle', 'green circle', 'blue square']);
  const TRAIN = ALL.filter((x) => !HELD.has(`${x.c} ${x.s}`));
  const TEST = ALL.filter((x) => HELD.has(`${x.c} ${x.s}`));
  const WORDS = ['a', ...COLOURS, ...SHAPES];
  const D = 8, TAU = 0.2;

  // Image features: noisy pixel statistics (colour channels, corner count, roundness). Text: bag of words.
  const imgFeat = (x: { c: string; s: string }) => [
    x.c === 'red' ? 1 : 0.1, x.c === 'green' ? 1 : 0.1, x.c === 'blue' ? 1 : 0.1,
    x.s === 'circle' ? 0 : x.s === 'square' ? 4 : 3, x.s === 'circle' ? 1 : x.s === 'square' ? 0.8 : 0.6, 1,
  ];
  const txtFeat = (x: { caption: string }) => WORDS.map((w) => x.caption.split(' ').filter((t) => t === w).length);

  let rng = mulberry32(24);
  const init = (rows: number, cols: number) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => (rng() - 0.5) * 0.4));
  let Wi = $state.raw(init(D, 6));
  let Wt = $state.raw(init(D, WORDS.length));
  let steps = $state(0);
  let running = $state(false);

  const mv = (W: number[][], x: number[]) => W.map((row) => row.reduce((s, w, k) => s + w * x[k]!, 0));
  const unit = (v: number[]) => {
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  };
  const embedI = (x: (typeof ALL)[number], W = Wi) => unit(mv(W, imgFeat(x)));
  const embedT = (x: (typeof ALL)[number], W = Wt) => unit(mv(W, txtFeat(x)));

  // One step of gradient descent on the contrastive loss over the training pairs. Gradients are taken
  // numerically through the normalisation, which is plenty fast for 2 × 8 × 7 weights.
  function lossOf(Wi_: number[][], Wt_: number[][]) {
    return reference(TRAIN.map((x) => embedI(x, Wi_)), TRAIN.map((x) => embedT(x, Wt_)), TAU);
  }
  function step() {
    const eps = 1e-4, lr = 0.5;
    const base = lossOf(Wi, Wt);
    const gi = Wi.map((row, r) => row.map((_, c) => {
      const W2 = Wi.map((rr) => [...rr]);
      W2[r]![c]! += eps;
      return (lossOf(W2, Wt) - base) / eps;
    }));
    const gt = Wt.map((row, r) => row.map((_, c) => {
      const W2 = Wt.map((rr) => [...rr]);
      W2[r]![c]! += eps;
      return (lossOf(Wi, W2) - base) / eps;
    }));
    Wi = Wi.map((row, r) => row.map((w, c) => w - lr * gi[r]![c]!));
    Wt = Wt.map((row, r) => row.map((w, c) => w - lr * gt[r]![c]!));
    steps++;
  }
  async function train(n: number) {
    running = true;
    for (let i = 0; i < n; i++) {
      step();
      if (i % 5 === 4) await new Promise((r) => requestAnimationFrame(r));
    }
    running = false;
  }
  function reset() {
    rng = mulberry32(24);
    Wi = init(D, 6);
    Wt = init(D, WORDS.length);
    steps = 0;
  }

  const sims = $derived(ALL.map((a) => ALL.map((b) => embedI(a).reduce((s, v, k) => s + v * embedT(b)[k]!, 0))));
  const loss = $derived.by(() => {
    const I = TRAIN.map((x) => embedI(x));
    const T = TRAIN.map((x) => embedT(x));
    try {
      return clipLoss(I, T, TAU);
    } catch {
      return reference(I, T, TAU);
    }
  });
  // Zero-shot: for each held-out image, which of all nine captions is closest?
  const zeroShot = $derived(TEST.map((x) => {
    const i = ALL.indexOf(x);
    const row = sims[i]!;
    const best = row.indexOf(Math.max(...row));
    return { x, guess: ALL[best]!.caption, ok: best === i };
  }));
  const colour = (v: number) => `color-mix(in oklab, var(--series-1) ${Math.round(Math.max(0, v) * 100)}%, var(--surface))`;
</script>

<Widget
  title="Contrastive training, in miniature"
  subtitle="Nine pictures and their captions. Two small encoders map each into the same space, trained so that every picture is nearest its own caption. Three pictures (outlined) never appear in training: after training, does the nearest caption name them correctly?"
  onreset={reset}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => train(100)} disabled={running}>Train 100 steps</Button>
    <Button onclick={() => train(10)} disabled={running}>10 steps</Button>
  {/snippet}

  {#if mine}<p class="mine ui">Using your clipLoss().</p>{/if}
  <div class="wrap">
    <table class="ui" aria-label="Cosine similarity between each picture and each caption">
      <thead>
        <tr><th></th>{#each ALL as t (t.caption)}<th class="cap" class:held={HELD.has(`${t.c} ${t.s}`)}><span>{t.caption.slice(2)}</span></th>{/each}</tr>
      </thead>
      <tbody>
        {#each ALL as im, i (im.caption)}
          <tr>
            <th class:held={HELD.has(`${im.c} ${im.s}`)}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-label={im.caption}>
                {#if im.s === 'circle'}<circle cx="10" cy="10" r="8" fill={FILL[im.c]} />{:else if im.s === 'square'}<rect x="2" y="2" width="16" height="16" fill={FILL[im.c]} />{:else}<polygon points="10,2 18,18 2,18" fill={FILL[im.c]} />{/if}
              </svg>
            </th>
            {#each sims[i]! as v, j (j)}<td style:background={colour(v)} class:diag={i === j}><span class="num">{v.toFixed(2)}</span></td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="stats ui">
    Step <strong class="num">{steps}</strong> · training loss <strong class="num">{loss.toFixed(3)}</strong> (log 6 = {Math.log(6).toFixed(3)} is chance) ·
    zero-shot:
    {#each zeroShot as z (z.x.caption)}<span class:ok={z.ok} class="zs">{z.x.caption} → {z.guess}</span>{/each}
  </p>
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.68rem;
  }
  th {
    font-weight: 500;
    color: var(--ink-2);
  }
  .cap {
    height: 5.5rem;
    vertical-align: bottom;
  }
  .cap span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
  }
  th.held {
    outline: 1.5px dashed var(--ink-3);
    outline-offset: -1px;
    border-radius: 3px;
  }
  td {
    width: 2.6rem;
    height: 1.7rem;
    text-align: center;
    border-radius: 3px;
    color: var(--ink);
  }
  td.diag {
    outline: 1.5px solid var(--ink-2);
  }
  .stats {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
    line-height: 1.7;
  }
  .zs {
    margin-left: 0.5rem;
    color: var(--critical);
    white-space: nowrap;
  }
  .zs.ok {
    color: var(--good);
  }
</style>
