<!--
  Euclid's algorithm as geometry: repeatedly cut the largest possible squares from an a × b
  rectangle. The side of the last square is gcd(a, b). Alongside, the extended algorithm keeps
  track of how each remainder is a combination of a and b (Bézout).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let a = $state(240);
  let b = $state(46);
  let shown = $state(0);
  let playing = $state(false);

  interface Sq {
    x: number;
    y: number;
    s: number;
    step: number;
  }
  interface Step {
    a: number;
    b: number;
    q: number;
    r: number;
  }

  const data = $derived.by(() => {
    const squares: Sq[] = [];
    const steps: Step[] = [];
    let [w, h] = [Math.max(a, b), Math.min(a, b)];
    let x = 0;
    let y = 0;
    let horizontal = true; // are we cutting squares side by side along x?
    let k = 0;
    while (w > 0 && h > 0) {
      const q = Math.floor(w / h);
      const r = w % h;
      steps.push({ a: w, b: h, q, r });
      for (let i = 0; i < q; i++) {
        squares.push(horizontal ? { x: x + i * h, y, s: h, step: k } : { x, y: y + i * h, s: h, step: k });
      }
      if (horizontal) x += q * h;
      else y += q * h;
      [w, h] = [h, r];
      horizontal = !horizontal;
      k++;
    }
    return { squares, steps, gcd: w };
  });

  // Extended Euclid: r_i = s_i a + t_i b.
  const bezout = $derived.by(() => {
    const A = Math.max(a, b);
    const B = Math.min(a, b);
    const rows: { r: number; s: number; t: number }[] = [
      { r: A, s: 1, t: 0 },
      { r: B, s: 0, t: 1 },
    ];
    while (rows.at(-1)!.r !== 0) {
      const [p, c] = [rows.at(-2)!, rows.at(-1)!];
      const q = Math.floor(p.r / c.r);
      rows.push({ r: p.r - q * c.r, s: p.s - q * c.s, t: p.t - q * c.t });
    }
    return { A, B, rows };
  });

  $effect(() => {
    void a;
    void b;
    shown = data.squares.length;
  });
  $effect(() => {
    if (!playing) return;
    shown = 0;
    const id = setInterval(() => {
      if (shown >= data.squares.length) playing = false;
      else shown++;
    }, 260);
    return () => clearInterval(id);
  });

  const W = 520;
  const H = 260;
  const scale = $derived(Math.min(W / Math.max(a, b), H / Math.min(a, b)));
  const HUES = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)', 'var(--accent)'];
  const presets = [
    [240, 46],
    [1071, 462],
    [89, 55],
    [100, 36],
  ];
</script>

<Widget title="Euclid’s algorithm with squares" subtitle="Cut the largest squares you can from the rectangle, then repeat on the leftover strip. The last square’s side divides everything: it is the greatest common divisor." onreset={() => ((a = 240), (b = 46))}>
  {#snippet controls()}
    <label class="ctl">a <input type="number" min="1" max="5000" bind:value={a} /></label>
    <label class="ctl">b <input type="number" min="1" max="5000" bind:value={b} /></label>
    {#each presets as p (p.join())}<button onclick={() => ((a = p[0]!), (b = p[1]!))}>{p[0]}, {p[1]}</button>{/each}
    <button class="play" onclick={() => (playing = true)}>Animate</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="0 0 {Math.max(a, b) * scale + 4} {Math.min(a, b) * scale + 4}" width="100%" style:max-width="{Math.max(a, b) * scale + 4}px" role="img" aria-label="A {Math.max(a, b)} by {Math.min(a, b)} rectangle cut into squares">
      <rect x="2" y="2" width={Math.max(a, b) * scale} height={Math.min(a, b) * scale} class="frame" />
      {#each data.squares.slice(0, shown) as q, i (i)}
        <rect x={2 + q.x * scale} y={2 + q.y * scale} width={q.s * scale} height={q.s * scale} fill={HUES[q.step % HUES.length]} class="sq" />
      {/each}
    </svg>
    <div class="side">
      <ol class="steps num">
        {#each data.steps as s, i (i)}
          <li style:--h={HUES[i % HUES.length]}><span class="dot"></span>{s.a} = {s.q} × {s.b} + {s.r}</li>
        {/each}
      </ol>
      <p class="gcd">gcd = <strong>{data.gcd}</strong></p>
      <p class="bz num">
        Bézout: {bezout.rows.at(-2)!.r} = ({bezout.rows.at(-2)!.s}) × {bezout.A} + ({bezout.rows.at(-2)!.t}) × {bezout.B}
      </p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    font-size: 0.85rem;
    font-style: italic;
  }
  input {
    width: 5rem;
    font: inherit;
    font-style: normal;
    padding: 0.15rem 0.35rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
    cursor: pointer;
  }
  .play {
    border-color: var(--accent);
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: flex-start;
    justify-content: center;
  }
  .frame {
    fill: none;
    stroke: var(--rule-strong);
    stroke-dasharray: 4 3;
  }
  .sq {
    stroke: var(--byrne-ink);
    stroke-width: 1;
    fill-opacity: 0.85;
    animation: in 0.25s ease-out;
  }
  @keyframes in {
    from {
      opacity: 0;
    }
  }
  .side {
    font-size: 0.82rem;
    min-width: 12rem;
  }
  .steps {
    margin: 0;
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 0.15rem;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    background: var(--h);
  }
  .gcd {
    margin: 0.5rem 0 0.2rem;
    font-size: 0.95rem;
  }
  .bz {
    margin: 0;
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
</style>
