<!--
  FlashAttention's core trick, step by step: one query's attention over 16 keys, computed block by
  block with a running maximum m, running sum l and running (unnormalised) output. When a block
  raises the maximum, everything accumulated so far is rescaled by exp(m_old − m_new).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  // Scores q·kᵢ/√d and scalar values vᵢ for one query. The largest score arrives late, in key 11.
  const S = [0.8, -0.4, 1.9, 0.2, -1.2, 2.4, 0.5, -0.3, 1.1, 0.0, -0.8, 5.1, 0.9, 1.6, -0.5, 2.2];
  const V = [0.3, -1.0, 0.8, 0.1, 0.6, -0.4, 1.2, 0.9, -0.7, 0.2, 1.1, 0.5, -0.2, 0.4, 0.8, -0.9];
  const N = S.length;

  let block = $state(4);
  let done = $state(0); // keys processed so far
  let last = $state(0); // start of the block processed last
  let m = $state(-Infinity);
  let l = $state(0);
  let acc = $state(0);
  let correction = $state<number | null>(null);

  function reset() {
    done = 0;
    last = 0;
    m = -Infinity;
    l = 0;
    acc = 0;
    correction = null;
  }
  function step() {
    if (done >= N) return;
    last = done;
    const end = Math.min(N, done + block);
    const s = S.slice(done, end);
    const mNew = Math.max(m, ...s);
    const c = Math.exp(m - mNew);
    l *= c;
    acc *= c;
    s.forEach((si, b) => {
      const p = Math.exp(si - mNew);
      l += p;
      acc += p * V[done + b]!;
    });
    correction = m === -Infinity ? null : c;
    m = mNew;
    done = end;
  }
  function all() {
    while (done < N) step();
  }

  // The exact answer, with all scores in memory at once.
  const exact = (() => {
    const mx = Math.max(...S);
    const e = S.map((s) => Math.exp(s - mx));
    const z = e.reduce((a, b) => a + b, 0);
    return e.reduce((a, p, i) => a + (p / z) * V[i]!, 0);
  })();
  // The weight each processed key has *so far*, with the current m and l.
  const weights = $derived(S.map((s, i) => (i < done ? Math.exp(s - m) / l : 0)));
  const f = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '−∞');
</script>

<Widget
  title="Softmax in one pass, block by block"
  subtitle="One query attending to 16 keys. FlashAttention never stores all 16 scores: it reads one block of keys at a time and keeps three running numbers. Step through and watch the rescaling when a larger score arrives."
  onreset={() => {
    block = 4;
    reset();
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={step} disabled={done >= N}>Next block</Button>
    <Button onclick={all} disabled={done >= N}>Finish</Button>
    <Button onclick={reset}>Restart</Button>
    <Segmented label="Block size" size="sm" options={[1, 2, 4, 8, 16].map((v) => ({ value: v, label: `block ${v}` }))} value={block} onchange={(v) => { block = v; reset(); }} />
  {/snippet}

  <div class="row">
    {#each S as s, i (i)}
      {@const cur = i >= last && i < done}
      <div class="cell" class:done={i < done} class:cur class:future={i >= done}>
        <div class="bar"><div class="fill" style:height="{Math.min(1, weights[i]!) * 100}%"></div></div>
        <div class="s num">{s.toFixed(1)}</div>
        <div class="v num">{V[i]!.toFixed(1)}</div>
      </div>
    {/each}
  </div>
  <div class="legend ui"><span>bars: each key’s softmax weight so far</span><span>top number: score sᵢ</span><span>bottom: value vᵢ</span></div>

  <div class="state num">
    <div><span>running max m</span><strong>{f(m)}</strong></div>
    <div><span>running sum l = Σ exp(sᵢ − m)</span><strong>{f(l)}</strong></div>
    <div><span>running output Σ exp(sᵢ − m)·vᵢ</span><strong>{f(acc)}</strong></div>
    <div><span>output so far = acc / l</span><strong>{done ? f(acc / l) : '—'}</strong></div>
  </div>
  <p class="note ui">
    {#if done === 0}
      Nothing processed yet. Scores held in memory at any moment: {block} (one block), not {N}.
    {:else if correction !== null && correction < 0.999}
      This block raised the maximum, so the old sum and output were multiplied by exp(m_old − m_new) = <strong class="num">{correction.toExponential(2)}</strong>: the earlier keys’ weights shrink, exactly as they would have if we had known the maximum from the start.
    {:else if done < N}
      The maximum did not change, so this block’s terms were simply added.
    {:else}
      Done. The one-pass result {f(acc / l)} equals the exact two-pass softmax attention {f(exact)}, yet at most {block} scores were ever held at once.
    {/if}
  </p>
</Widget>

<style>
  .row {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 3px;
  }
  .cell {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 0 3px;
    text-align: center;
    font-size: 0.7rem;
    background: var(--surface);
  }
  .cell.future {
    color: var(--ink-3);
  }
  .cell.cur {
    outline: 2px solid var(--accent-2);
  }
  .bar {
    height: 70px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    border-bottom: 1px solid var(--rule);
    margin: 0 3px 2px;
  }
  .fill {
    width: 70%;
    background: var(--series-1);
    border-radius: 2px 2px 0 0;
    transition: height 250ms;
  }
  .v {
    color: var(--ink-2);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.2rem;
    font-size: 0.72rem;
    color: var(--ink-3);
    margin: 0.3rem 0 0.7rem;
  }
  .state {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.4rem 1rem;
    font-size: 0.78rem;
  }
  .state div {
    display: flex;
    flex-direction: column;
  }
  .state span {
    color: var(--ink-2);
  }
  .state strong {
    font-size: 1rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    margin: 0.7rem 0 0;
  }
</style>
