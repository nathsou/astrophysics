<!--
  A device's pins, drawn from the model's own data (pinouts.ts):

    ::package-drawing{device="gal22v10"}   the GAL22V10 in its 24-pin DIP, seen from above
    ::package-drawing{device="prom"}       the functional symbol of the vPROM (also "pla" and "cpld32")

  Every pin carries its name (and number) as text; colour only repeats the role.
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { cpldSymbol, galPins, plaSymbol, promSymbol, type Pin, type Role, type SymbolSpec } from './pinouts';

  let { device = 'gal22v10', n, caption }: { device?: 'gal22v10' | 'prom' | 'pla' | 'cpld32'; n?: string | number; caption?: string } = $props();

  const ROLES: { role: Role; label: string }[] = [
    { role: 'in', label: 'input' },
    { role: 'out', label: 'output' },
    { role: 'io', label: 'input/output' },
    { role: 'clock', label: 'clock' },
    { role: 'control', label: 'control' },
    { role: 'power', label: 'supply' },
    { role: 'ground', label: 'ground' },
  ];

  const ROW = 22;
  const LEG = 26;
  const PAD = 8;

  const gal = galPins();
  const symbol: SymbolSpec = $derived(device === 'prom' ? promSymbol() : device === 'pla' ? plaSymbol() : cpldSymbol());
  const title = $derived(device === 'gal22v10' ? 'GAL22V10 pinout' : `${symbol.title} symbol`);

  // DIP geometry.
  const half = gal.length / 2;
  const BODY_W = 176;
  const dipW = BODY_W + 2 * LEG + 2 * PAD;
  const dipH = half * ROW + 34;

  // Symbol geometry.
  const rows = $derived(Math.max(symbol.left.length, symbol.right.length));
  const SYM_W = 250;
  const topH = $derived(symbol.top.length ? 30 : 0);
  const botH = $derived(symbol.bottom.length ? 30 : 0);
  const symBodyH = $derived(rows * ROW + 14);
  const symH = $derived(symBodyH + topH + botH + 2 * PAD + 18);
  const symTotalW = SYM_W + 2 * LEG + 2 * PAD + 20;
  const spread = (k: number, count: number, w: number) => (w * (k + 1)) / (count + 1);
</script>

<Widget {title} {n} kind="Reference" live={false} {caption}>
  {#snippet controls()}
    <ul class="legend" aria-label="Colour key">
      {#each ROLES as r (r.role)}<li><span class="dot {r.role}"></span>{r.label}</li>{/each}
    </ul>
  {/snippet}

  <div class="wrap">
    {#if device === 'gal22v10'}
      <svg viewBox="0 0 {dipW} {dipH}" width={dipW} height={dipH} role="img" aria-label="GAL22V10 pinout, 24 pins, seen from above with the notch at the top">
        <rect class="body" x={PAD + LEG} y="8" width={BODY_W} height={half * ROW + 12} rx="4" />
        <path class="notch" d="M{PAD + LEG + BODY_W / 2 - 10} 8 a10 10 0 0 0 20 0" />
        <text class="chip" x={PAD + LEG + BODY_W / 2} y="40" text-anchor="middle">GAL22V10</text>
        {#each gal.slice(0, half) as pin, k (pin.number)}
          {@const cy = 28 + k * ROW}
          <path class="leg {pin.role}" d="M{PAD} {cy} H{PAD + LEG}" />
          <text class="num" x={PAD + LEG - 4} y={cy - 4} text-anchor="end">{pin.number}</text>
          <text class="name" x={PAD + LEG + 8} y={cy + 4} text-anchor="start">{pin.name}</text>
        {/each}
        {#each gal.slice(half).reverse() as pin, k (pin.number)}
          {@const cy = 28 + k * ROW}
          <path class="leg {pin.role}" d="M{PAD + LEG + BODY_W} {cy} H{dipW - PAD}" />
          <text class="num" x={PAD + LEG + BODY_W + 4} y={cy - 4} text-anchor="start">{pin.number}</text>
          <text class="name" x={PAD + LEG + BODY_W - 8} y={cy + 4} text-anchor="end">{pin.name}</text>
        {/each}
      </svg>
    {:else}
      {@const x0 = PAD + LEG + 10}
      {@const y0 = PAD + topH + 4}
      <svg viewBox="0 0 {symTotalW} {symH}" width={symTotalW} height={symH} role="img" aria-label="{symbol.title} functional symbol: {symbol.left.length} inputs on the left, {symbol.right.length} on the right">
        <rect class="body" x={x0} y={y0} width={SYM_W} height={symBodyH} rx="4" />
        <text class="chip" x={x0 + SYM_W / 2} y={y0 + symBodyH / 2 + 4} text-anchor="middle">{symbol.title}</text>
        {#each symbol.left as pin, k (k)}
          {@const cy = y0 + 14 + k * ROW}
          <path class="leg {pin.role}" d="M{x0 - LEG} {cy} H{x0}" />
          <text class="name" x={x0 + 8} y={cy + 4} text-anchor="start">{pin.name}</text>
        {/each}
        {#each symbol.right as pin, k (k)}
          {@const cy = y0 + 14 + k * ROW}
          <path class="leg {pin.role}" d="M{x0 + SYM_W} {cy} H{x0 + SYM_W + LEG}" />
          <text class="name" x={x0 + SYM_W - 8} y={cy + 4} text-anchor="end">{pin.name}</text>
        {/each}
        {#each symbol.top as pin, k (k)}
          {@const cx = x0 + spread(k, symbol.top.length, SYM_W)}
          <path class="leg {pin.role}" d="M{cx} {y0 - 24} V{y0}" />
          <text class="name" x={cx} y={y0 + 16} text-anchor="middle">{pin.name}</text>
        {/each}
        {#each symbol.bottom as pin, k (k)}
          {@const cx = x0 + spread(k, symbol.bottom.length, SYM_W)}
          <path class="leg {pin.role}" d="M{cx} {y0 + symBodyH} V{y0 + symBodyH + 24}" />
          <text class="name" x={cx} y={y0 + symBodyH - 8} text-anchor="middle">{pin.name}</text>
        {/each}
      </svg>
    {/if}
  </div>
</Widget>

<style>
  .wrap {
    padding: 0.8rem 0.5rem;
    display: flex;
    justify-content: center;
    overflow-x: auto;
  }
  svg {
    max-width: 100%;
    height: auto;
    flex: none;
  }
  .body {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .notch {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .chip {
    font: 600 13px var(--font-ui);
    fill: var(--mute);
    letter-spacing: 0.06em;
  }
  .num {
    font: 10px var(--font-mono);
    fill: var(--mute);
  }
  .name {
    font: 11.5px var(--font-mono);
    fill: var(--fg);
  }
  .leg {
    stroke-width: 3;
    stroke-linecap: round;
    fill: none;
  }
  .leg.in,
  .dot.in {
    stroke: var(--series-1);
    background: var(--series-1);
  }
  .leg.out,
  .dot.out {
    stroke: var(--series-2);
    background: var(--series-2);
  }
  .leg.io,
  .dot.io {
    stroke: var(--series-4);
    background: var(--series-4);
  }
  .leg.clock,
  .dot.clock {
    stroke: var(--series-5);
    background: var(--series-5);
  }
  .leg.control,
  .dot.control {
    stroke: var(--series-6);
    background: var(--series-6);
  }
  .leg.power,
  .dot.power {
    stroke: var(--series-7);
    background: var(--series-7);
  }
  .leg.ground,
  .dot.ground {
    stroke: var(--series-8);
    background: var(--series-8);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin: 0;
    padding: 0.2rem 0.9rem;
    list-style: none;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .dot {
    display: inline-block;
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    margin-right: 0.35rem;
    vertical-align: -0.05rem;
    stroke: none;
  }
</style>
