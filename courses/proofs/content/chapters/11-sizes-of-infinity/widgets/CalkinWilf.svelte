<!--
  The Calkin–Wilf tree (2000): start at 1/1; the children of a/b are a/(a+b) and (a+b)/b. Every
  positive rational appears exactly once, in lowest terms — so reading the tree row by row lists
  them all: the rationals are countable.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let depth = $state(4);
  let target = $state('5/7');
  const W = 640;

  interface Node {
    a: number;
    b: number;
    x: number;
    y: number;
    px?: number;
    py?: number;
    i: number;
  }
  const nodes = $derived.by(() => {
    const out: Node[] = [];
    let level: Node[] = [{ a: 1, b: 1, x: W / 2, y: 30, i: 1 }];
    let idx = 1;
    for (let d = 0; d < depth; d++) {
      out.push(...level);
      const next: Node[] = [];
      const span = W / 2 ** (d + 2);
      for (const n of level) {
        next.push({ a: n.a, b: n.a + n.b, x: n.x - span, y: n.y + 62, px: n.x, py: n.y, i: ++idx });
        next.push({ a: n.a + n.b, b: n.b, x: n.x + span, y: n.y + 62, px: n.x, py: n.y, i: ++idx });
      }
      level = next;
    }
    return out.sort((p, q) => p.y - q.y || p.x - q.x).map((n, k) => ({ ...n, i: k + 1 }));
  });

  /** Path from the root to a/b: run Euclid's algorithm backwards. */
  const path = $derived.by(() => {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(target);
    if (!m) return null;
    let [a, b] = [Number(m[1]), Number(m[2])];
    if (!a || !b) return null;
    const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
    const d = g(a, b);
    [a, b] = [a / d, b / d];
    const steps: string[] = [`${a}/${b}`];
    while (!(a === 1 && b === 1) && steps.length < 60) {
      if (a < b) b -= a;
      else a -= b;
      steps.push(`${a}/${b}`);
    }
    return steps.reverse();
  });
  const onPath = (n: Node) => path?.includes(`${n.a}/${n.b}`) ?? false;
  const sequence = $derived(nodes.slice(0, 15).map((n) => `${n.a}/${n.b}`));
</script>

<Widget title="The Calkin–Wilf tree" subtitle="The children of a/b are a/(a + b) and (a + b)/b. Every positive fraction in lowest terms appears exactly once. Type a fraction to find its place." onreset={() => ((depth = 4), (target = '5/7'))}>
  {#snippet controls()}
    <label class="ctl">rows <input type="range" min="2" max="5" bind:value={depth} /> <strong>{depth}</strong></label>
    <label class="ctl">find <input class="t" bind:value={target} /></label>
  {/snippet}
  <svg viewBox="0 0 {W} {30 + (depth - 1) * 62 + 30}" width="100%" role="img" aria-label="The first {depth} rows of the Calkin–Wilf tree">
    {#each nodes as n (n.i)}
      {#if n.px !== undefined}<line x1={n.px} y1={n.py} x2={n.x} y2={n.y} class="edge" class:hot={onPath(n) && path?.length} />{/if}
    {/each}
    {#each nodes as n (n.i)}
      <g transform="translate({n.x}, {n.y})" class="node" class:hot={onPath(n)}>
        <rect x="-19" y="-15" width="38" height="30" rx="7" />
        <text y="-2">{n.a}</text>
        <line x1="-8" x2="8" y1="1" y2="1" class="bar" />
        <text y="12">{n.b}</text>
      </g>
    {/each}
  </svg>
  <p class="read num">
    Row by row: {sequence.join(', ')}, …
    {#if path}<br />Path to {path.at(-1)}: {path.join(' → ')} ({path.length - 1} steps{path.length - 1 >= depth ? ', deeper than shown' : ''}).{/if}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .t {
    width: 5rem;
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.1rem 0.35rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .edge {
    stroke: var(--rule-strong);
    stroke-width: 1.2;
  }
  .edge.hot {
    stroke: var(--byrne-red);
    stroke-width: 3;
  }
  .node rect {
    fill: var(--surface-2);
    stroke: var(--rule-strong);
  }
  .node.hot rect {
    fill: color-mix(in srgb, var(--byrne-red) 25%, var(--surface));
    stroke: var(--byrne-red);
    stroke-width: 2;
  }
  .node text {
    font-size: 11px;
    text-anchor: middle;
    fill: var(--ink);
    font-family: var(--font-ui);
    font-weight: 600;
  }
  .bar {
    stroke: var(--ink-2);
  }
  .read {
    font-size: 0.8rem;
    margin: 0.3rem 0 0;
    color: var(--ink-2);
  }
</style>
