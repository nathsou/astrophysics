<!--
  Conway's soldiers (1961). Soldiers start below the line and move by jumping over a neighbour
  (horizontally or vertically) into an empty square; the jumped soldier is removed. How far above
  the line can a soldier get? Weight each square by ω^d, where d is its distance from the target
  and ω = (√5 − 1)/2. No move increases the total weight — and the whole half-plane is worth exactly
  1 when the target is five rows up.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const OMEGA = (Math.sqrt(5) - 1) / 2;
  const XMIN = -6;
  const XMAX = 6;
  const YMIN = -7;
  const YMAX = 5;
  let target = $state(2);
  let soldiers = $state<Set<string>>(new Set(['0,0', '0,-1', '1,0', '2,0']));
  let selected = $state<string | null>(null);
  let phase = $state<'setup' | 'play'>('play');
  let moves = $state(0);

  const key = (x: number, y: number) => `${x},${y}`;
  const parse = (k: string) => k.split(',').map(Number) as [number, number];
  const weight = (x: number, y: number) => OMEGA ** (Math.abs(x) + Math.abs(y - target));
  const total = $derived([...soldiers].reduce((s, k) => s + weight(...parse(k)), 0));
  const reached = $derived([...soldiers].some((k) => parse(k)[1] >= target));
  const highest = $derived(Math.max(...[...soldiers].map((k) => parse(k)[1]), -Infinity));

  function click(x: number, y: number) {
    const k = key(x, y);
    if (phase === 'setup') {
      if (y > 0) return;
      const s = new Set(soldiers);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      soldiers = s;
      return;
    }
    if (soldiers.has(k)) {
      selected = selected === k ? null : k;
      return;
    }
    if (!selected) return;
    const [sx, sy] = parse(selected);
    const dx = x - sx;
    const dy = y - sy;
    if (!((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0))) return;
    const mid = key(sx + dx / 2, sy + dy / 2);
    if (!soldiers.has(mid)) return;
    const s = new Set(soldiers);
    s.delete(selected);
    s.delete(mid);
    s.add(k);
    soldiers = s;
    selected = null;
    moves++;
  }
  function preset(t: number) {
    target = t;
    phase = 'play';
    moves = 0;
    selected = null;
    soldiers = new Set(t === 1 ? ['0,0', '0,-1'] : t === 2 ? ['0,0', '0,-1', '1,0', '2,0'] : []);
    if (t > 2) phase = 'setup';
  }
  const halfPlane = $derived(OMEGA ** (target - 5));
</script>

<Widget title="Conway’s soldiers" subtitle="Soldiers start at or below the line and jump over neighbours, removing them. Click a soldier, then an empty square two steps away across another soldier. Each square is shaded by its weight, ω to the power of its distance from the target ★." onreset={() => preset(target)}>
  {#snippet controls()}
    <label class="ctl">target row <select value={target} onchange={(e) => preset(Number((e.target as HTMLSelectElement).value))}>{#each [1, 2, 3, 4, 5] as t (t)}<option value={t}>{t}</option>{/each}</select></label>
    <button class:on={phase === 'setup'} onclick={() => (phase = phase === 'setup' ? 'play' : 'setup')}>{phase === 'setup' ? 'Done placing' : 'Place soldiers'}</button>
    <button onclick={() => ((soldiers = new Set()), (phase = 'setup'), (moves = 0))}>Clear</button>
  {/snippet}
  <div class="wrap">
    <svg viewBox="{XMIN - 0.6} {-YMAX - 0.6} {XMAX - XMIN + 1.2} {YMAX - YMIN + 1.2}" width="100%" style:max-width="420px" role="group" aria-label="Board">
      {#each Array.from({ length: YMAX - YMIN + 1 }, (_, i) => YMAX - i) as y (y)}
        {#each Array.from({ length: XMAX - XMIN + 1 }, (_, i) => XMIN + i) as x (x)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <rect x={x - 0.5} y={-y - 0.5} width="1" height="1" class="cell" class:above={y > 0} style:--w={weight(x, y)} onclick={() => click(x, y)} />
        {/each}
      {/each}
      <line x1={XMIN - 0.5} x2={XMAX + 0.5} y1="-0.5" y2="-0.5" class="line" />
      <text x="0" y={-target + 0.3} class="star">★</text>
      {#each [...soldiers] as k (k)}
        {@const [x, y] = parse(k)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <circle cx={x} cy={-y} r="0.36" class="soldier" class:sel={selected === k} onclick={() => click(x, y)} />
      {/each}
    </svg>
    <div class="info num">
      <p>soldiers: <strong>{soldiers.size}</strong>, moves: {moves}</p>
      <p>total weight: <strong>{total.toFixed(4)}</strong></p>
      <p>weight of the target ★: 1</p>
      <p class:ok={reached}>{reached ? '★ reached!' : `highest soldier: row ${highest === -Infinity ? '—' : highest}`}</p>
      <p class="note">A jump towards the target keeps the total the same or lowers it, since ω² + ω = 1. Every square at or below the line together weighs {halfPlane < 1000 ? halfPlane.toFixed(3) : '∞'}{target === 5 ? ' — exactly 1, so finitely many soldiers weigh less than the target: row 5 is unreachable.' : '.'}</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
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
  button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    align-items: center;
    justify-content: center;
  }
  .cell {
    fill: color-mix(in srgb, var(--byrne-blue) calc(var(--w) * 70%), var(--surface));
    stroke: var(--rule);
    stroke-width: 0.03;
    cursor: pointer;
  }
  .cell.above {
    fill: color-mix(in srgb, var(--byrne-yellow) calc(var(--w) * 70%), var(--surface));
  }
  .line {
    stroke: var(--byrne-red);
    stroke-width: 0.08;
  }
  .star {
    font-size: 0.8px;
    text-anchor: middle;
    fill: var(--byrne-red);
    pointer-events: none;
  }
  .soldier {
    fill: var(--ink);
    cursor: pointer;
  }
  .soldier.sel {
    fill: var(--byrne-red);
  }
  .info {
    font-size: 0.85rem;
    max-width: 18rem;
  }
  .info p {
    margin: 0.25rem 0;
  }
  .ok {
    color: var(--ok);
    font-weight: 700;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
