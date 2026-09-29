<!--
  Joint, conditional and mutual information for two binary variables. Edit the joint table and see
  the chain rule H(X,Y) = H(X) + H(Y|X) and I(X;Y) laid out as an information diagram.
-->
<script lang="ts">
  import { focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  // Weights for the four cells (normalised to a joint distribution).
  let w = $state([0.4, 0.1, 0.1, 0.4]);
  const PRESETS: Record<string, number[]> = {
    Independent: [0.36, 0.24, 0.24, 0.16],
    Correlated: [0.4, 0.1, 0.1, 0.4],
    'Y copies X': [0.5, 0, 0, 0.5],
    'Y = not X': [0, 0.5, 0.5, 0],
    'X certain': [0.7, 0.3, 0, 0],
  };

  const h = (ps: number[]) => -ps.reduce((a, p) => a + (p > 0 ? p * Math.log2(p) : 0), 0);
  const p = $derived.by(() => {
    const s = w.reduce((a, b) => a + b, 0) || 1;
    return w.map((x) => x / s);
  });
  // p = [p(0,0), p(0,1), p(1,0), p(1,1)] with X the row, Y the column.
  const px = $derived([p[0]! + p[1]!, p[2]! + p[3]!]);
  const py = $derived([p[0]! + p[2]!, p[1]! + p[3]!]);
  const Hxy = $derived(h(p));
  const Hx = $derived(h(px));
  const Hy = $derived(h(py));
  const Hy_x = $derived(Hxy - Hx);
  const Hx_y = $derived(Hxy - Hy);
  const I = $derived(Math.max(0, Hx + Hy - Hxy));

  const scale = 2; // bits spanned by the diagram width (max H(X,Y) for two bits)
  const pct = (b: number) => `${(b / scale) * 100}%`;
</script>

<Widget
  title="Joint entropy, conditional entropy and mutual information"
  subtitle="X and Y each take the values 0 or 1. Set how likely each combination is, and read the chain rule and the shared information off the diagram."
  onreset={() => (w = [0.4, 0.1, 0.1, 0.4])}
>
  {#snippet controls()}
    <div class="presets">
      {#each Object.entries(PRESETS) as [name, v] (name)}<button class="chip" onclick={() => (w = [...v])}>{name}</button>{/each}
    </div>
  {/snippet}

  <div class="layout">
    <div>
      <table class="joint">
        <thead><tr><th></th><th>Y = 0</th><th>Y = 1</th><th class="m">p(x)</th></tr></thead>
        <tbody>
          {#each [0, 1] as x (x)}
            <tr>
              <th>X = {x}</th>
              {#each [0, 1] as y (y)}
                {@const i = x * 2 + y}
                <td>
                  <Slider compact min={0} max={1} step={0.01} value={w[i]!} oninput={(v) => (w[i] = v)} format={() => p[i]!.toFixed(2)} />
                </td>
              {/each}
              <td class="m num">{px[x]!.toFixed(2)}</td>
            </tr>
          {/each}
          <tr><th class="m">p(y)</th><td class="m num">{py[0]!.toFixed(2)}</td><td class="m num">{py[1]!.toFixed(2)}</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <div class="diagram">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="bar" onpointerenter={() => focus.set('Hxy', 'joint')} onpointerleave={() => focus.set(null)}>
        <span class="lbl">H(X, Y) = {Hxy.toFixed(3)} bits</span>
        <div class="track"><span class="seg all" style:width={pct(Hxy)}></span></div>
      </div>
      <div class="bar">
        <span class="lbl">H(X) = {Hx.toFixed(3)}</span>
        <div class="track"><span class="seg x" style:width={pct(Hx_y)}></span><span class="seg i" style:width={pct(I)}></span></div>
      </div>
      <div class="bar">
        <span class="lbl">H(Y) = {Hy.toFixed(3)}</span>
        <div class="track"><span class="seg gap" style:width={pct(Hx_y)}></span><span class="seg i" style:width={pct(I)}></span><span class="seg y" style:width={pct(Hy_x)}></span></div>
      </div>
      <ul class="key">
        <li><i class="x"></i>H(X | Y) = {Hx_y.toFixed(3)} — uncertainty left in X once Y is known</li>
        <li><i class="i"></i>I(X; Y) = {I.toFixed(3)} — information shared</li>
        <li><i class="y"></i>H(Y | X) = {Hy_x.toFixed(3)} — uncertainty left in Y once X is known</li>
      </ul>
      <p class="check num">Chain rule: H(X) + H(Y | X) = {Hx.toFixed(3)} + {Hy_x.toFixed(3)} = {(Hx + Hy_x).toFixed(3)} = H(X, Y)</p>
    </div>
  </div>
</Widget>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .joint {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
  }
  .joint th,
  .joint td {
    padding: 0.35rem;
    text-align: left;
  }
  .joint td {
    min-width: 7rem;
  }
  .m {
    color: var(--ink-2);
  }
  .diagram {
    display: grid;
    gap: 0.6rem;
  }
  .lbl {
    display: block;
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-bottom: 0.15rem;
  }
  .track {
    display: flex;
    height: 16px;
    background: var(--surface-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .seg {
    height: 100%;
    transition: width 200ms ease;
  }
  .seg + .seg {
    border-left: 2px solid var(--chart-surface);
  }
  .all {
    background: var(--ink-3);
  }
  .x,
  .key .x {
    background: var(--series-1);
  }
  .i,
  .key .i {
    background: var(--series-7);
  }
  .y,
  .key .y {
    background: var(--series-2);
  }
  .gap {
    background: transparent;
  }
  .key {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    font-size: 0.78rem;
    display: grid;
    gap: 0.2rem;
  }
  .key li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .key i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex: none;
  }
  .check {
    font-size: 0.76rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
</style>
