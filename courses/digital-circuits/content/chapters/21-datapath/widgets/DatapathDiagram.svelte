<!--
  The datapath as a picture: blocks hung on one shared bus. Every value comes from the running gate-level circuit
  (an ExplorerState); the picture only decides where things go. A block that drives the bus is outlined in amber and
  its stem carries an arrow towards the bus; a block that listens is outlined in copper, with an arrow the other way.
  The bus itself is drawn as its wires would be: amber where it is 1, slate where it is 0, dashed grey when nothing
  drives it, red and hatched when drivers fight.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block, ExplorerState } from './explorer';
  import { layout, irText, type Box, type Layout } from './diagram';

  let {
    s,
    drivers = [],
    listeners = [],
    sw,
    aluLabel = '',
    counting = [],
    mode = 'auto',
    onpick,
    picked,
    plain = false,
  }: {
    s: ExplorerState;
    drivers?: Block[];
    listeners?: Block[];
    /** The front-panel switches, if the figure has them. */
    sw?: number;
    /** e.g. `ADD`: what the ALU is set to do. */
    aluLabel?: string;
    /** Blocks that count on the next edge (PC++ , SP±1), for a small marker. */
    counting?: string[];
    mode?: 'auto' | Layout;
    /** Makes the blocks buttons: called with the block that was clicked. */
    onpick?: (b: Block) => void;
    picked?: Block;
    /** A map, not an instrument: the bus is drawn without a reading. */
    plain?: boolean;
  } = $props();

  const uid = $props.id();
  let width = $state(700);
  let wrap: HTMLDivElement | undefined = $state();
  onMount(() => {
    if (!wrap) return;
    width = wrap.clientWidth;
    const ro = new ResizeObserver(([e]) => {
      if (e) width = e.contentRect.width;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  });
  const kind: Layout = $derived(mode === 'auto' ? (width < 560 ? 'tall' : 'wide') : mode);
  const g = $derived(layout(kind));

  const hex = (v: number | undefined) => (v === undefined ? '??' : v.toString(16).toUpperCase().padStart(2, '0'));
  const busState = $derived(s.contention ? 'x' : s.bus === 'zzzzzzzz' ? 'z' : s.busValue === undefined ? 'x' : 'ok');
  const busText = $derived(busState === 'z' ? 'floating' : busState === 'x' ? (s.contention ? 'contention' : 'unknown') : `0x${hex(s.busValue)}`);
  const drives = (b: Block) => drivers.includes(b);
  const listens = (b: Block) => listeners.includes(b);
  const rd = $derived(s.ir === undefined ? -1 : (s.ir >> 2) & 3);
  const rs = $derived(s.ir === undefined ? -1 : s.ir & 3);
  const ledFlags = $derived(s.flags ? ([['Z', s.flags.z], ['C', s.flags.c], ['N', s.flags.n], ['V', s.flags.v]] as [string, boolean][]) : ([['Z', undefined], ['C', undefined], ['N', undefined], ['V', undefined]] as [string, boolean | undefined][]));

  const roleOf = (id: string): 'drive' | 'listen' | 'both' | 'idle' => {
    const b = id as Block;
    const d = drives(b) || (id === 'RF' && (drives('RD') || drives('RS')));
    const l = listens(b);
    return d && l ? 'both' : d ? 'drive' : l ? 'listen' : 'idle';
  };
  const box = (id: string): Box => g.boxes[id]!;
  const label = $derived(
    `Datapath. Bus ${busText}. ${drivers.length ? `Driving the bus: ${drivers.join(', ')}. ` : 'Nothing is driving the bus. '}${listeners.length ? `Listening: ${listeners.join(', ')}.` : 'Nothing is listening.'}`,
  );
</script>

<div class="dd" bind:this={wrap}>
  <svg viewBox="0 0 {g.width} {g.height}" role="img" aria-label={label}>
    <defs>
      <pattern id="hatch-x-{uid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--bad-soft)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--sig-x)" stroke-width="2" />
      </pattern>
      <marker id="arr-drive-{uid}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L8 4L0 8z" fill="var(--sig-high)" />
      </marker>
      <marker id="arr-link-{uid}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0L8 4L0 8z" fill="var(--line-strong)" />
      </marker>
      <marker id="arr-listen-{uid}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L8 4L0 8z" fill="var(--copper)" />
      </marker>
    </defs>

    <!-- the bus -->
    <rect
      class="bus {busState}"
      x={g.bus.x}
      y={g.bus.y}
      width={g.bus.w}
      height={g.bus.h}
      rx="4"
      fill={busState === 'x' ? `url(#hatch-x-${uid})` : undefined}
    />
    {#if g.bus.vertical}
      <text class="bus-v {busState}" x={g.bus.x + g.bus.w / 2} y={g.bus.y + g.bus.h / 2} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {g.bus.x + g.bus.w / 2} {g.bus.y + g.bus.h / 2})">BUS{plain ? '' : ` · ${busText}`}</text>
    {:else}
      <text class="bus-l" x={g.bus.x + 8} y={g.bus.y + g.bus.h / 2 + 4}>BUS</text>
      {#if !plain}<text class="bus-v {busState}" x={g.bus.x + g.bus.w - 8} y={g.bus.y + g.bus.h / 2 + 4} text-anchor="end">{busText} · {s.bus}</text>{/if}
    {/if}

    <!-- stems -->
    {#each g.stems.filter((x) => x.block !== 'SW' || sw !== undefined) as st (st.title)}
      {@const on = st.kind === 'drive' ? drives(st.block) : listens(st.block)}
      <line
        class="stem {st.kind} {on ? 'on' : ''}"
        x1={on && st.kind === 'listen' ? st.to[0] : st.from[0]}
        y1={on && st.kind === 'listen' ? st.to[1] : st.from[1]}
        x2={on && st.kind === 'listen' ? st.from[0] : st.to[0]}
        y2={on && st.kind === 'listen' ? st.from[1] : st.to[1]}
        marker-end={on ? `url(#arr-${st.kind}-${uid})` : undefined}
      ><title>{st.title}</title></line>
    {/each}
    {#each g.links as l (l.title)}
      <path class="link" d={l.d} marker-end="url(#arr-link-{uid})"><title>{l.title}</title></path>
    {/each}

    <!-- blocks -->
    {#each (sw === undefined ? ['PC', 'SP', 'T', 'MAR', 'IR', 'A', 'B'] : ['SW', 'PC', 'SP', 'T', 'MAR', 'IR', 'A', 'B']) as id (id)}
      {@const b = box(id)}
      {@const st = roleOf(id)}
      {@const v = { SW: sw, PC: s.pc, SP: s.sp, T: s.t, MAR: s.mar, IR: s.ir, A: s.a, B: s.b }[id]}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g class="blk {st}" class:pickable={!!onpick} class:picked={picked === id} role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} aria-label={onpick ? `${id}: show what it does` : undefined} onclick={() => onpick?.(id as Block)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onpick?.(id as Block))}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" />
        <text class="nm" x={b.x + 8} y={b.y + 15}>{id === 'SW' ? 'PANEL' : id}</text>
        <text class="val" x={b.x + 8} y={b.y + b.h - (id === 'IR' ? 24 : 14)}>{id === 'SW' && sw === undefined ? '' : hex(v)}</text>
        {#if id === 'IR'}
          <text class="sub" x={b.x + 8} y={b.y + b.h - 8}>{irText(s.ir)}</text>
        {/if}
        {#if id === 'PC' && counting.includes('PC')}<text class="cnt" x={b.x + b.w - 8} y={b.y + 15} text-anchor="end">+1</text>{/if}
        {#if id === 'SP' && counting.includes('SP+')}<text class="cnt" x={b.x + b.w - 8} y={b.y + 15} text-anchor="end">+1</text>{/if}
        {#if id === 'SP' && counting.includes('SP−')}<text class="cnt" x={b.x + b.w - 8} y={b.y + 15} text-anchor="end">−1</text>{/if}
      </g>
    {/each}

    {#snippet mem()}
      {@const b = box('MEM')}
      {@const st = roleOf('MEM')}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g class="blk {st}" class:pickable={!!onpick} class:picked={picked === 'MEM'} role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} aria-label={onpick ? 'RAM: show what it does' : undefined} onclick={() => onpick?.('MEM')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onpick?.('MEM'))}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" />
        <text class="nm" x={b.x + 8} y={b.y + 15}>RAM</text>
        <text class="val" x={b.x + 8} y={b.y + b.h - 14}>M[{hex(s.mar)}] = {hex(s.mem)}</text>
      </g>
    {/snippet}
    {@render mem()}

    <!-- register file -->
    {#snippet rf()}
      {@const b = box('RF')}
      {@const st = roleOf('RF')}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g class="blk {st}" class:pickable={!!onpick} class:picked={picked === 'RF'} role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} aria-label={onpick ? 'Register file: show what it does' : undefined} onclick={() => onpick?.('RF')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onpick?.('RF'))}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" />
        <text class="nm" x={b.x + 8} y={b.y + 15}>R0–R3</text>
        {#each [0, 1, 2, 3] as r (r)}
          {@const col = r % 2}
          {@const row = Math.floor(r / 2)}
          {@const tag = r === rd && r === rs ? 'Rd Rs' : r === rd ? 'Rd' : r === rs ? 'Rs' : ''}
          {@const cw = kind === 'tall' ? 64 : 96}
          {@const vx = kind === 'tall' ? 24 : 24}
          <g class="reg" class:isrd={r === rd} class:isrs={r === rs}>
            <text class="nm2" x={b.x + 9 + col * cw} y={b.y + 40 + row * 26}>R{r}</text>
            <text class="val" x={b.x + 9 + vx + col * cw} y={b.y + 40 + row * 26}>{hex(s.r[r])}</text>
            {#if tag}<text class="tag" x={b.x + 9 + col * cw} y={b.y + 51 + row * 26}>{tag}</text>{/if}
          </g>
        {/each}
      </g>
    {/snippet}
    {@render rf()}

    <!-- ALU and flags -->
    {#snippet alu()}
      {@const b = box('ALU')}
      {@const st = roleOf('ALU')}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g class="blk {st}" class:pickable={!!onpick} class:picked={picked === 'ALU'} role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} aria-label={onpick ? 'ALU: show what it does' : undefined} onclick={() => onpick?.('ALU')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onpick?.('ALU'))}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" />
        <text class="nm" x={b.x + 8} y={b.y + 15}>ALU {aluLabel}</text>
        <text class="val" x={b.x + 8} y={b.y + b.h - 14}>{hex(s.alu)}</text>
      </g>
      {@const f = box('FLAGS')}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g class="blk {listens('FLAGS') ? 'listen' : 'idle'}" class:pickable={!!onpick} class:picked={picked === 'FLAGS'} role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} aria-label={onpick ? 'Flags: show what they do' : undefined} onclick={() => onpick?.('FLAGS')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onpick?.('FLAGS'))}>
        <rect x={f.x} y={f.y} width={f.w} height={f.h} rx="6" />
        <text class="nm" x={f.x + 8} y={f.y + 15}>FLAGS</text>
        {#each ledFlags as [n, on], i (n)}
          {@const lx = kind === 'wide' ? f.x + 10 + (i % 2) * 24 : f.x + 10 + i * 30}
          {@const ly = kind === 'wide' ? f.y + 34 + Math.floor(i / 2) * 15 : f.y + 34}
          <text class="flag" class:on={on === true} class:unk={on === undefined} x={lx} y={ly}>{n}{on === undefined ? '?' : +on}</text>
        {/each}
      </g>
    {/snippet}
    {@render alu()}
  </svg>
</div>

<style>
  .dd {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    max-width: 700px;
    margin: 0 auto;
    font-family: var(--font-mono);
    overflow: visible;
  }
  .bus {
    fill: var(--surface-3);
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .bus.ok {
    fill: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    stroke: var(--sig-high);
    stroke-width: 2;
  }
  .bus.z {
    fill: var(--surface-3);
    stroke: var(--sig-z);
    stroke-dasharray: var(--sig-z-dash);
  }
  .bus.x {
    stroke: var(--sig-x);
    stroke-width: 2;
  }
  .bus-l {
    font-size: 10px;
    fill: var(--mute);
    letter-spacing: 0.08em;
  }
  .bus-v {
    font-size: 11px;
    fill: var(--mute);
    font-weight: 600;
  }
  .bus-v.ok {
    fill: var(--fg);
  }
  .bus-v.x {
    fill: var(--sig-x);
  }
  .stem {
    stroke: var(--line-strong);
    stroke-width: 2;
  }
  .stem.on.drive {
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .stem.on.listen {
    stroke: var(--copper);
    stroke-width: 3;
  }
  .link {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .blk rect {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.2;
    transition: fill 120ms, stroke 120ms;
  }
  .blk.drive rect {
    stroke: var(--sig-high);
    stroke-width: 2.5;
    fill: color-mix(in srgb, var(--sig-high) 13%, var(--panel));
  }
  .blk.listen rect {
    stroke: var(--copper);
    stroke-width: 2.5;
    fill: var(--copper-soft);
  }
  .blk.both rect {
    stroke: var(--sig-x);
    stroke-width: 2.5;
    stroke-dasharray: 5 3;
  }
  .pickable {
    cursor: pointer;
  }
  .pickable:hover rect,
  .picked rect {
    stroke: var(--copper);
    stroke-width: 2.5;
  }
  .pickable:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .nm {
    font-size: 10px;
    fill: var(--mute);
    letter-spacing: 0.08em;
  }
  .nm2 {
    font-size: 10px;
    fill: var(--mute);
  }
  .val {
    font-size: 14px;
    font-weight: 600;
    fill: var(--fg);
  }
  .sub {
    font-size: 10.5px;
    fill: var(--ink-2);
  }
  .cnt {
    font-size: 10px;
    fill: var(--copper-ink);
    font-weight: 700;
  }
  .tag {
    font-size: 8.5px;
    fill: var(--copper-ink);
    font-weight: 700;
  }
  .reg.isrd .val,
  .reg.isrs .val {
    fill: var(--copper-ink);
  }
  .flag {
    font-size: 11px;
    fill: var(--mute);
  }
  .flag.on {
    fill: var(--sig-high);
    font-weight: 700;
  }
  .flag.unk {
    fill: var(--sig-x);
  }
  @media (prefers-reduced-motion: reduce) {
    .blk rect {
      transition: none;
    }
  }
</style>
