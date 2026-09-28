<!--
  Hilbert's space-filling curve (1891): each stage replaces every square's path by four smaller
  copies. The limit is a continuous curve that passes through every point of the square.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let order = $state(3);
  let drawn = $state(1);

  /** Convert index d along the order-n Hilbert curve to (x, y) (classic bit-twiddling algorithm). */
  function d2xy(n: number, d: number): [number, number] {
    let x = 0;
    let y = 0;
    let t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t / 2);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    return [x, y];
  }

  const S = 360;
  const side = $derived(2 ** order);
  const pts = $derived(Array.from({ length: side * side }, (_, d) => d2xy(side, d)));
  const cell = $derived(S / side);
  const path = $derived(
    pts
      .slice(0, Math.max(2, Math.round(drawn * pts.length)))
      .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * cell + cell / 2).toFixed(2)},${(S - (y * cell + cell / 2)).toFixed(2)}`)
      .join(''),
  );
  let playing = $state(false);
  $effect(() => {
    if (!playing) return;
    drawn = 0;
    const id = setInterval(() => {
      drawn = Math.min(1, drawn + 0.01);
      if (drawn >= 1) playing = false;
    }, 30);
    return () => clearInterval(id);
  });
</script>

<Widget title="A curve that fills a square" subtitle="Stage n visits all 4ⁿ small squares in one continuous path. As n → ∞ the curves converge uniformly to a continuous curve that passes through every point of the square." onreset={() => ((order = 3), (drawn = 1))}>
  {#snippet controls()}
    <label class="ctl">stage <strong>{order}</strong> <input type="range" min="1" max="7" bind:value={order} /></label>
    <button onclick={() => (playing = true)}>Draw it</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="-2 -2 {S + 4} {S + 4}" width="100%" style:max-width="{S}px" role="img" aria-label="Stage {order} of the Hilbert curve">
      <rect x="0" y="0" width={S} height={S} class="frame" />
      <path d={path} class="curve" style:stroke-width={Math.max(0.6, 3.2 - order * 0.4)} />
    </svg>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .wrap {
    display: grid;
    justify-items: center;
  }
  .frame {
    fill: none;
    stroke: var(--rule-strong);
  }
  .curve {
    fill: none;
    stroke: var(--byrne-red);
    stroke-linejoin: round;
  }
</style>
