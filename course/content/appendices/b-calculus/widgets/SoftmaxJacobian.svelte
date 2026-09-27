<!--
  The softmax Jacobian ∂yᵢ/∂xⱼ = yᵢ(δᵢⱼ − yⱼ), and the vector–Jacobian product that backpropagation
  actually computes — which, for cross-entropy, collapses to softmax − onehot.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';

  const LABELS = ['a', 'b', 'c', 'd', 'e'];
  const DEFAULT = [2, 1, 0.2, -0.5, -1];
  let logits = $state([...DEFAULT]);
  let target = $state(1);

  const y = $derived.by(() => {
    const m = Math.max(...logits);
    const e = logits.map((z) => Math.exp(z - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  });
  const J = $derived(Float32Array.from({ length: 25 }, (_, k) => {
    const i = Math.floor(k / 5), j = k % 5;
    return y[i]! * ((i === j ? 1 : 0) - y[j]!);
  }));
  // Cross-entropy L = −log y_t: upstream gradient ȳ = −1/y_t at t, zero elsewhere.
  const ybar = $derived(y.map((v, i) => (i === target ? -1 / v : 0)));
  const vjp = $derived.by(() => {
    const dot = ybar.reduce((a, g, i) => a + g * y[i]!, 0);
    return y.map((v, i) => v * (ybar[i]! - dot));
  });
  const direct = $derived(y.map((v, i) => v - (i === target ? 1 : 0)));
  let hover = $state<{ row: number; col: number; value: number } | null>(null);
  const f = (v: number) => (Math.abs(v) < 5e-4 ? '0.000' : v.toFixed(3));
</script>

<Widget
  title="The softmax Jacobian, and why the cross-entropy gradient is so simple"
  subtitle="Set five logits. The heatmap is the full 5 × 5 Jacobian; backpropagation never builds it, but multiplies by it implicitly. Pick the target class to see the two routes to the cross-entropy gradient agree."
  onreset={() => {
    logits = [...DEFAULT];
    target = 1;
  }}
>
  {#snippet controls()}
    <div class="grp">
      <span class="lbl">Target class t</span>
      <Segmented label="Target class" size="sm" options={LABELS.map((l, i) => ({ value: i, label: l }))} bind:value={target} />
    </div>
  {/snippet}

  <div class="layout">
    <div class="ui">
      <table class="logits num">
        <thead><tr><th></th><th>logit xᵢ</th><th>yᵢ = softmax</th></tr></thead>
        <tbody>
          {#each LABELS as l, i (l)}
            <tr class:t={i === target}>
              <td class="cls">{l}</td>
              <td class="sl"><Slider label="x_{l}" min={-4} max={4} step={0.01} value={logits[i]!} oninput={(v) => (logits[i] = v)} format={(v) => v.toFixed(2)} /></td>
              <td><span class="bar" style:width="{y[i]! * 100}%"></span><span class="pv">{y[i]!.toFixed(3)}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div>
      <Heatmap
        values={J}
        rows={5}
        cols={5}
        ramp="diverging"
        range={[-0.25, 0.25]}
        rowLabels={LABELS.map((l) => `∂y_${l}`)}
        colLabels={LABELS.map((l) => `∂x_${l}`)}
        maxCell={40}
        format={(v) => v.toFixed(3)}
        label="Softmax Jacobian"
        onhover={(c) => (hover = c)}
      />
      <p class="formula ui">
        {#if hover}
          ∂y<sub>{LABELS[hover.row]}</sub>/∂x<sub>{LABELS[hover.col]}</sub> = y<sub>{LABELS[hover.row]}</sub>({hover.row === hover.col ? '1' : '0'} − y<sub>{LABELS[hover.col]}</sub>) =
          {y[hover.row]!.toFixed(3)} × {((hover.row === hover.col ? 1 : 0) - y[hover.col]!).toFixed(3)} = <strong>{hover.value.toFixed(4)}</strong>
        {:else}
          Hover a cell. Diagonal entries are positive (raising a logit raises its own probability); off-diagonal ones negative (and every other probability falls). Each row sums to zero, because the probabilities always sum to one.
        {/if}
      </p>
    </div>
  </div>

  <table class="grads num ui">
    <thead>
      <tr><th>gradient of L = −log y<sub>t</sub> with respect to</th>{#each LABELS as l (l)}<th>x<sub>{l}</sub></th>{/each}</tr>
    </thead>
    <tbody>
      <tr><td>via the VJP: y ⊙ (ȳ − ⟨ȳ, y⟩), with ȳ = −1/y<sub>t</sub> at t</td>{#each vjp as v, i (i)}<td>{f(v)}</td>{/each}</tr>
      <tr><td>directly: y − onehot(t)</td>{#each direct as v, i (i)}<td>{f(v)}</td>{/each}</tr>
    </tbody>
  </table>
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .logits {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .logits th {
    text-align: left;
    font-weight: 600;
    color: var(--ink-2);
    font-size: 0.72rem;
  }
  .logits td {
    padding: 0.1rem 0.3rem;
    vertical-align: middle;
  }
  .logits tr.t .cls {
    font-weight: 800;
    text-decoration: underline;
  }
  .sl {
    width: 55%;
  }
  .bar {
    display: inline-block;
    height: 10px;
    max-width: 70%;
    background: var(--series-1);
    border-radius: 0 3px 3px 0;
    vertical-align: middle;
    margin-right: 0.4rem;
  }
  .pv {
    color: var(--ink-2);
  }
  .formula {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .grads {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 1rem;
  }
  .grads th,
  .grads td {
    text-align: right;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--rule);
  }
  .grads th:first-child,
  .grads td:first-child {
    text-align: left;
    color: var(--ink-2);
  }
</style>
