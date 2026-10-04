<!--
  Adders against multipliers: the BDD size of one output bit as the width grows, built in the browser. For the
  adder, the top sum bit with the operand bits interleaved from the least significant up: linear. For the
  multiplier, the middle bit of the product, with the interleaved order and with the best of several random
  orders: exponential either way (Bryant, 1991: under every order).
-->
<script lang="ts">
  import { Bdd } from '$lib/fv/bdd/bdd';
  import { fand, forr, fxor, type Formula } from '$lib/fv/sat/encode';
  import { rng } from '$lib/fv/util/random';

  let { caption, max = 10, tries = 6 }: { caption?: string; max?: number; tries?: number } = $props();

  const F: Formula = { k: 'const', value: false };
  const maj = (a: Formula, b: Formula, c: Formula): Formula => forr(fand(a, b), fand(a, c), fand(b, c));
  function add(x: Formula[], y: Formula[]): Formula[] {
    let c: Formula = F;
    return x.map((a, i) => {
      const s = fxor(fxor(a, y[i]!), c);
      c = maj(a, y[i]!, c);
      return s;
    });
  }
  function bits(n: number) {
    const a: Formula[] = Array.from({ length: n }, (_, i) => ({ k: 'var', v: i + 1 }));
    const b: Formula[] = Array.from({ length: n }, (_, i) => ({ k: 'var', v: n + i + 1 }));
    return { a, b };
  }
  const interleaved = (n: number) => Array.from({ length: n }, (_, i) => [i + 1, n + i + 1]).flat();

  function adderBit(n: number) {
    const { a, b } = bits(n);
    return add(a, b)[n - 1]!;
  }
  function multBit(n: number) {
    const { a, b } = bits(n);
    let acc: Formula[] = Array.from({ length: n }, () => F);
    for (let i = 0; i < n; i++) {
      const partial = a.map((_, j) => (j < i ? F : fand(a[j - i]!, b[i]!)));
      acc = add(acc, partial);
    }
    return acc[n - 1]!;
  }
  const size = (f: Formula, order: number[]) => {
    const b = new Bdd(order);
    return b.size(b.fromFormula(f));
  };

  type Row = { n: number; adder: number; mult: number; multBest: number };
  let rows = $state<Row[]>([]);
  let running = $state(false);

  function run() {
    if (running) return;
    running = true;
    rows = [];
    const r = rng(1991);
    let n = 2;
    const next = () => {
      const order = interleaved(n);
      const m = multBit(n);
      let best = size(m, order);
      for (let t = 0; t < tries; t++) best = Math.min(best, size(m, r.shuffle(order)));
      rows = [...rows, { n, adder: size(adderBit(n), order), mult: size(m, order), multBest: best }];
      n++;
      if (n <= max) setTimeout(next, 10);
      else running = false;
    };
    setTimeout(next, 10);
  }

  const W = 520;
  const H = 230;
  const L = 50;
  const top = $derived(Math.max(10, ...rows.flatMap((r) => [r.adder, r.mult])));
  const dec = $derived(Math.ceil(Math.log10(top)));
  const x = (n: number) => L + ((n - 2) / Math.max(1, max - 2)) * (W - L - 20);
  const y = (v: number) => H - 28 - (Math.log10(Math.max(1, v)) / Math.max(1, dec)) * (H - 48);
</script>

<figure class="growth">
  <div class="bar ui">
    <button type="button" onclick={run} disabled={running}>{running ? 'Building…' : rows.length ? 'Build again' : 'Build the BDDs'}</button>
    <span>Widths 2 to {max} bits; the multiplier also tries {tries} random orders and keeps the best.</span>
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="BDD sizes of an adder bit and a multiplier bit against the width, logarithmic scale">
    <line x1={L} y1={H - 28} x2={W - 14} y2={H - 28} class="axis" />
    <line x1={L} y1="14" x2={L} y2={H - 28} class="axis" />
    {#each Array.from({ length: dec + 1 }, (_, d) => d) as d (d)}
      <line x1={L} y1={y(10 ** d)} x2={W - 14} y2={y(10 ** d)} class="grid" />
      <text x={L - 6} y={y(10 ** d) + 3} class="tick" text-anchor="end">{(10 ** d).toLocaleString('en-GB')}</text>
    {/each}
    {#each Array.from({ length: max - 1 }, (_, i) => i + 2) as n (n)}<text x={x(n)} y={H - 12} class="tick" text-anchor="middle">{n}</text>{/each}
    <text x={(W + L) / 2} y={H - 1} class="tick" text-anchor="middle">width in bits</text>
    <text x={L + 4} y="10" class="tick">BDD nodes (log scale)</text>
    {#each [['adder', 'a'], ['mult', 'm'], ['multBest', 'mb']] as [k, cls] (k)}
      {#if rows.length > 1}<polyline points={rows.map((r) => `${x(r.n)},${y(r[k as 'adder'])}`).join(' ')} class="line {cls}" />{/if}
      {#each rows as r (r.n)}<circle cx={x(r.n)} cy={y(r[k as 'adder'])} r="3" class="dot {cls}"><title>{r.n} bits: {r[k as 'adder']} nodes</title></circle>{/each}
    {/each}
  </svg>
  <div class="legend ui">
    <span class="key a">adder, top sum bit (interleaved order)</span>
    <span class="key m">multiplier, middle bit (interleaved order)</span>
    <span class="key mb">multiplier, best of the random orders</span>
  </div>
  {#if rows.length}
    <p class="ui last">At {rows.at(-1)!.n} bits: adder {rows.at(-1)!.adder.toLocaleString('en-GB')} nodes, multiplier {rows.at(-1)!.mult.toLocaleString('en-GB')} (best order found: {rows.at(-1)!.multBest.toLocaleString('en-GB')}).</p>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .growth {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .bar {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }
  button {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  button:disabled {
    opacity: 0.6;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .axis {
    stroke: var(--line-strong);
  }
  .grid {
    stroke: var(--line);
    stroke-dasharray: 2 3;
  }
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
  }
  .line {
    fill: none;
    stroke-width: 2;
  }
  .a {
    stroke: var(--seal);
    fill: var(--seal);
    color: var(--seal);
  }
  .m {
    stroke: var(--pencil);
    fill: var(--pencil);
    color: var(--pencil);
  }
  .mb {
    stroke: var(--gold);
    fill: var(--gold);
    color: var(--gold);
  }
  .line.a,
  .line.m,
  .line.mb {
    fill: none;
  }
  .line.mb {
    stroke-dasharray: 4 3;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
  }
  .key::before {
    content: '';
    display: inline-block;
    width: 0.9rem;
    height: 3px;
    margin-right: 0.4rem;
    vertical-align: middle;
    background: currentColor;
  }
  .last {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
