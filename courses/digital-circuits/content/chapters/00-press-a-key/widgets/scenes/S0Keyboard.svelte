<!-- Level 0: the keyboard, seen from above, with a finger on the A key. 640 × 400, 45 cm across. -->
<script lang="ts">
  import { BODY, extraKeys, keyA, mainKeys } from '../keyboard-layout';

  const keys = mainKeys();
  const extra = extraKeys();
  const a = keyA();
</script>

<g class="s0">
  <rect class="case" x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx="12" />
  {#each [...keys, ...extra] as k, i (i)}
    {@const isA = k.x === a.x && k.y === a.y}
    <rect class="cap" class:pressed={isA} x={k.x} y={k.y + (isA ? 3 : 0)} width={k.w} height={k.h} rx="3.5" />
    {#if k.label}
      <text class="lab" class:big={isA} x={k.x + k.w / 2} y={k.y + k.h / 2 + 3.4 + (isA ? 3 : 0)} font-size={k.label.length > 2 ? 6 : 8}>{k.label}</text>
    {/if}
  {/each}

  <!-- the finger, above the A key -->
  <g class="finger">
    <path d="M{a.x + 4} {a.y - 8} C{a.x + 2} {a.y - 34} {a.x + 2} {a.y - 52} {a.x + 6} {a.y - 64} L{a.x + 34} {a.y - 64} C{a.x + 36} {a.y - 48} {a.x + 34} {a.y - 30} {a.x + 30} {a.y - 8} Q{a.x + 17} {a.y + 2} {a.x + 4} {a.y - 8} Z" />
    <path class="nail" d="M{a.x + 10} {a.y - 6} Q{a.x + 17} {a.y - 1} {a.x + 24} {a.y - 6}" />
  </g>
  <text class="title" x="320" y="58">your keyboard, about 45 cm across</text>
  <text class="note mid" x="320" y="308">a finger pushes the A key down about 4 mm</text>
  <text class="note mid" x="320" y="326">104 keys, and one switch under each</text>
</g>

<style>
  .case {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.6;
  }
  .cap {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .cap.pressed {
    fill: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    stroke: var(--sig-high);
    stroke-width: 1.6;
  }
  .lab {
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-mono);
  }
  .lab.big {
    fill: var(--fg);
    font-weight: 700;
    font-size: 11px;
  }
  .finger path:first-child {
    fill: color-mix(in srgb, var(--copper) 12%, transparent);
    stroke: var(--copper-ink);
    stroke-width: 1.4;
    stroke-dasharray: 5 3;
  }
  .nail {
    fill: none;
    stroke: var(--copper-ink);
    stroke-width: 1;
    opacity: 0.6;
  }
  .note {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 11px;
    text-anchor: start;
  }
  .note.mid {
    text-anchor: middle;
  }
  .title {
    fill: var(--fg);
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    text-anchor: middle;
  }
</style>
