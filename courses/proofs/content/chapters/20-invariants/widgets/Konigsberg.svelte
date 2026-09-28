<!--
  The seven bridges of Königsberg. Try to walk across every bridge exactly once by clicking bridges
  in order. Each land mass shows how many bridges touch it; Euler's rule reads the answer off
  those numbers.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  // Land: A north bank, B south bank, C island (Kneiphof), D east island/land.
  const LAND = [
    { id: 'A', name: 'north bank', x: 300, y: 45 },
    { id: 'B', name: 'south bank', x: 300, y: 295 },
    { id: 'C', name: 'Kneiphof', x: 230, y: 170 },
    { id: 'D', name: 'east', x: 470, y: 170 },
  ];
  const BASE = [
    { a: 0, b: 2, bend: -40 },
    { a: 0, b: 2, bend: 40 },
    { a: 1, b: 2, bend: -40 },
    { a: 1, b: 2, bend: 40 },
    { a: 0, b: 3, bend: 0 },
    { a: 1, b: 3, bend: 0 },
    { a: 2, b: 3, bend: 0 },
  ];
  const EXTRA = [{ a: 0, b: 1, bend: -160 }];

  let extra = $state(false);
  let path = $state<number[]>([]);
  let at = $state<number | null>(null);
  const bridges = $derived(extra ? [...BASE, ...EXTRA] : BASE);
  const degree = $derived(LAND.map((_, i) => bridges.filter((b) => b.a === i || b.b === i).length));
  const odd = $derived(degree.filter((d) => d % 2 === 1).length);
  let message = $state('Click any bridge to start walking.');

  function cross(k: number) {
    if (path.includes(k)) {
      message = 'You have already crossed that bridge.';
      return;
    }
    const br = bridges[k]!;
    if (at === null) {
      // Start from whichever end has odd degree if possible.
      at = degree[br.a]! % 2 === 1 ? br.a : br.b;
    }
    if (br.a !== at && br.b !== at) {
      message = `That bridge doesn’t touch ${LAND[at]!.name}, where you are.`;
      return;
    }
    at = br.a === at ? br.b : br.a;
    path = [...path, k];
    const left = bridges.length - path.length;
    const stuck = left > 0 && !bridges.some((b, i) => !path.includes(i) && (b.a === at || b.b === at));
    message = left === 0 ? 'You crossed every bridge exactly once!' : stuck ? `Stuck on ${LAND[at]!.name} with ${left} bridge${left > 1 ? 's' : ''} uncrossed.` : `On ${LAND[at]!.name}. ${left} to go.`;
  }
  function reset() {
    path = [];
    at = null;
    message = 'Click any bridge to start walking.';
  }
  const curve = (b: { a: number; b: number; bend: number }) => {
    const p = LAND[b.a]!;
    const q = LAND[b.b]!;
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const cx = mx + (-dy / len) * b.bend;
    const cy = my + (dx / len) * b.bend;
    return `M${p.x},${p.y} Q${cx},${cy} ${q.x},${q.y}`;
  };
</script>

<Widget title="The bridges of Königsberg" subtitle="Walk around the city crossing every bridge exactly once. Click the bridges in the order you cross them." onreset={() => ((extra = false), reset())}>
  {#snippet controls()}
    <button onclick={reset}>Start again</button>
    <label class="ctl"><input type="checkbox" bind:checked={extra} onchange={reset} /> build an eighth bridge</label>
  {/snippet}
  <svg viewBox="0 0 600 340" width="100%" role="group" aria-label="Map of the four land masses and the bridges">
    <path d="M0,110 C120,95 200,120 300,110 C400,100 520,120 600,105 L600,230 C500,245 400,225 300,235 C200,245 100,225 0,235 Z" class="river" />
    <ellipse cx="230" cy="170" rx="85" ry="42" class="land" />
    <path d="M395,110 C430,95 600,95 600,105 L600,230 C560,245 430,245 395,230 Z" class="land" />
    {#each bridges as b, k (k)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <g onclick={() => cross(k)} class="bridge" class:done={path.includes(k)}>
        <path d={curve(b)} class="hit" />
        <path d={curve(b)} class="vis" />
      </g>
    {/each}
    {#each LAND as l, i (l.id)}
      <g transform="translate({l.x},{l.y})" class="node" class:here={at === i}>
        <circle r="17" />
        <text y="5">{degree[i]}</text>
      </g>
    {/each}
  </svg>
  <p class="msg">{message}</p>
  <p class="rule">Land masses with an odd number of bridges: <strong>{odd}</strong>. {odd === 0 ? 'Euler: a round trip is possible.' : odd === 2 ? 'Euler: a walk is possible, starting and ending at the two odd ones.' : 'Euler: no such walk exists, however clever you are.'}</p>
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
  .river {
    fill: color-mix(in srgb, var(--byrne-blue) 25%, var(--surface));
  }
  .land {
    fill: color-mix(in srgb, var(--byrne-yellow) 18%, var(--surface));
    stroke: var(--rule-strong);
  }
  .bridge {
    cursor: pointer;
  }
  .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 18;
  }
  .vis {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 5;
    stroke-dasharray: 2 4;
    stroke-linecap: round;
  }
  .bridge:hover .vis {
    stroke: var(--ink);
  }
  .bridge.done .vis {
    stroke: var(--byrne-red);
    stroke-dasharray: none;
  }
  .node circle {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .node.here circle {
    fill: var(--byrne-red);
  }
  .node text {
    font-size: 14px;
    font-weight: 700;
    text-anchor: middle;
    fill: var(--ink);
    font-family: var(--font-ui);
  }
  .node.here text {
    fill: white;
  }
  .msg {
    margin: 0.2rem 0 0;
    font-size: 0.88rem;
    text-align: center;
  }
  .rule {
    margin: 0.2rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    text-align: center;
  }
</style>
