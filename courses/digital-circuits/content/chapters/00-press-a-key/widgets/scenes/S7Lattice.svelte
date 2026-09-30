<!--
  Level 7: silicon atoms, 5 nm across (128 px per nm), drawn the way textbooks draw a crystal: a flat
  lattice with a shared pair of electrons on every bond. On the left a few atoms are phosphorus (an
  n-type region: one spare electron each); on the right one is boron (a p-type region: one missing
  electron, a hole).
-->
<script lang="ts">
  const COLS = 14;
  const ROWS = 8;
  const X0 = 30;
  const Y0 = 36;
  const DX = 45.5;
  const DY = 41.5;
  const JUNCTION = X0 + 6.5 * DX;
  const P = new Set(['2,2', '4,6', '1,5', '5,3']);
  const B = new Set(['10,4']);
  const atoms = Array.from({ length: COLS * ROWS }, (_, n) => {
    const c = n % COLS;
    const r = Math.floor(n / COLS);
    const key = `${c},${r}`;
    return { c, r, x: X0 + c * DX, y: Y0 + r * DY, kind: P.has(key) ? 'P' : B.has(key) ? 'B' : 'Si' };
  });
  const bondsH = atoms.filter((a) => a.c < COLS - 1);
  const bondsV = atoms.filter((a) => a.r < ROWS - 1);
  const holeAt = atoms.find((a) => a.kind === 'B')!;
  const spare = atoms.filter((a) => a.kind === 'P');
</script>

<g class="s7">
  <rect class="bg" x="0" y="0" width="640" height="400" />
  <rect class="nreg" x="0" y="0" width={JUNCTION} height="400" />
  <line class="junction" x1={JUNCTION} x2={JUNCTION} y1="0" y2="342" />
  <text class="reg n" x={JUNCTION - 8} y="20" text-anchor="end">n-type: source (many phosphorus atoms)</text>
  <text class="reg p" x={JUNCTION + 8} y="20">p-type: channel (a little boron)</text>

  {#each bondsH as a (`h${a.c},${a.r}`)}
    <path class="bond" d="M{a.x + 14} {a.y - 2.5}H{a.x + DX - 14}M{a.x + 14} {a.y + 2.5}H{a.x + DX - 14}" />
  {/each}
  {#each bondsV as a (`v${a.c},${a.r}`)}
    <path class="bond" d="M{a.x - 2.5} {a.y + 14}V{a.y + DY - 14}M{a.x + 2.5} {a.y + 14}V{a.y + DY - 14}" />
  {/each}

  {#each atoms as a (`${a.c},${a.r}`)}
    <circle class="atom {a.kind}" cx={a.x} cy={a.y} r="13.5" />
    {#if a.kind !== 'Si'}<text class="el" x={a.x} y={a.y + 4}>{a.kind}</text>{/if}
  {/each}

  <!-- the spare electrons of the phosphorus atoms wander -->
  {#each spare as a, i (i)}
    <circle class="free" cx={a.x + 22} cy={a.y - 18} r="4.6" style="animation-delay: -{i * 0.9}s" />
  {/each}
  <!-- the hole next to the boron atom -->
  <circle class="hole" cx={holeAt.x + 22} cy={holeAt.y + 20} r="5" />

  <!-- legend -->
  <g transform="translate(16 356)">
    <rect class="lg" x="-8" y="-16" width="448" height="50" rx="6" />
    <circle class="atom Si" cx="6" cy="0" r="6" /><text class="cap" x="18" y="4">silicon: 4 outer electrons</text>
    <circle class="atom P" cx="200" cy="0" r="6" /><text class="cap" x="212" y="4">phosphorus: 5, one spare</text>
    <circle class="atom B" cx="6" cy="22" r="6" /><text class="cap" x="18" y="26">boron: 3, one short</text>
    <circle class="free" cx="200" cy="22" r="4.6" style="animation: none" /><text class="cap" x="212" y="26">spare electron</text>
    <circle class="hole" cx="330" cy="22" r="5" /><text class="cap" x="342" y="26">hole</text>
  </g>
</g>

<style>
  .bg {
    fill: var(--panel);
  }
  .nreg {
    fill: color-mix(in srgb, var(--series-1) 10%, transparent);
  }
  .junction {
    stroke: var(--sig-high);
    stroke-width: 1.4;
    stroke-dasharray: 6 5;
  }
  .reg {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
  }
  .reg.n {
    fill: var(--series-1);
  }
  .reg.p {
    fill: var(--series-7);
  }
  .bond {
    fill: none;
    stroke: var(--mute);
    stroke-width: 1.4;
    opacity: 0.8;
  }
  .atom {
    stroke-width: 1.4;
  }
  .atom.Si {
    fill: color-mix(in srgb, var(--mute) 35%, var(--panel));
    stroke: var(--mute);
  }
  .atom.P {
    fill: color-mix(in srgb, var(--series-1) 60%, var(--panel));
    stroke: var(--series-1);
  }
  .atom.B {
    fill: color-mix(in srgb, var(--series-7) 55%, var(--panel));
    stroke: var(--series-7);
  }
  .el {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    text-anchor: middle;
  }
  .free {
    fill: var(--series-1);
    stroke: var(--panel);
    stroke-width: 1.2;
    animation: wander 3.2s ease-in-out infinite;
  }
  @keyframes wander {
    0%,
    100% {
      transform: translate(0, 0);
    }
    25% {
      transform: translate(14px, 9px);
    }
    50% {
      transform: translate(6px, 24px);
    }
    75% {
      transform: translate(-10px, 12px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .free {
      animation: none;
    }
  }
  .hole {
    fill: var(--panel);
    stroke: var(--series-7);
    stroke-width: 2;
  }
  .lg {
    fill: var(--pn);
    stroke: var(--line);
    stroke-width: 1;
  }
  .cap {
    fill: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 10.5px;
  }
</style>
