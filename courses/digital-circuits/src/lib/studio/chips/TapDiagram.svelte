<!--
  The 16-state TAP controller diagram (IEEE 1149.1). Edges are labelled with the TMS value that takes them.
  The current state glows; the edge just taken is drawn hot; recently visited states leave a fading trail.
  Optionally clickable: `onstate` reports a state that was clicked (for the standalone widget).
-->
<script lang="ts">
  import './chip.css';
  import type { TapState } from '../../pld/cpld/jtag';
  import { TAP_EDGES, TAP_H, TAP_NODES, TAP_W, NODE_H, NODE_W } from '../tap-layout';

  let {
    state,
    last = null,
    trail = [],
    label = 'TAP controller state diagram',
  }: {
    state: TapState;
    /** The edge taken by the last clock: from a state, with the TMS value. */
    last?: { from: TapState; tms: 0 | 1 } | null;
    /** Recently visited states, most recent last. */
    trail?: TapState[];
    label?: string;
  } = $props();

  const uid = $props.id();
  const trailAge = (s: TapState) => {
    const i = trail.lastIndexOf(s);
    return i < 0 ? -1 : trail.length - 1 - i;
  };
  const isHot = (from: TapState, tms: number) => last?.from === from && last?.tms === tms;
</script>

<div class="die screen tap">
  <svg viewBox="0 0 {TAP_W} {TAP_H}" width="100%" role="img" aria-label="{label}. Current state: {state}.">
    <defs>
      <marker id="{uid}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 1 L10 5 L0 9 z" fill="var(--metal-dim)" />
      </marker>
      <marker id="{uid}-h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0 1 L10 5 L0 9 z" fill="var(--hot)" />
      </marker>
      <filter id="{uid}-g" x="-40%" y="-80%" width="180%" height="260%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <text x="20" y="26" class="t2">solid line: TMS = 0 · dashed: TMS = 1</text>
    {#each TAP_EDGES as e (`${e.from}|${e.tms}`)}
      {@const hot = isHot(e.from, e.tms)}
      <path d={e.d} fill="none" stroke={hot ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={hot ? 3 : 1.4} stroke-dasharray={e.tms === 0 ? undefined : '5 4'} marker-end="url(#{uid}-{hot ? 'h' : 'a'})" filter={hot ? `url(#${uid}-g)` : undefined} />
    {/each}
    {#each TAP_EDGES as e (`l${e.from}|${e.tms}`)}
      <text x={e.label.x} y={e.label.y + 3} text-anchor="middle" class="lbl" style="font-weight: 700; fill: {isHot(e.from, e.tms) ? 'var(--hot)' : 'var(--metal)'}">{e.tms}</text>
    {/each}
    {#each TAP_NODES as n (n.state)}
      {@const cur = n.state === state}
      {@const age = trailAge(n.state)}
      <g>
        <rect x={n.x - NODE_W / 2} y={n.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx="8" fill={cur ? 'color-mix(in srgb, var(--hot) 28%, #0b0e18)' : '#0b0e18'} stroke={cur ? 'var(--hot)' : age >= 0 ? 'var(--metal)' : 'var(--metal-dim)'} stroke-width={cur ? 2.4 : 1.4} filter={cur ? `url(#${uid}-g)` : undefined} opacity={cur ? 1 : age >= 0 ? Math.max(0.55, 1 - age * 0.08) : 0.9} />
        <text x={n.x} y={n.y + 4} text-anchor="middle" class="t" style="font-size: 11.5px; {cur ? 'font-weight: 700; fill: #fff' : ''}">{n.label}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .tap {
    padding: 0.4rem;
  }
  svg {
    max-height: 100%;
  }
</style>
