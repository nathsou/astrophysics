<!--
  Polyhedra you can turn with the mouse, with their vertices, edges and faces counted. The Platonic
  solids all give V − E + F = 2. Lakatos's "monsters" do not.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  type V3 = [number, number, number];
  interface Solid {
    name: string;
    v: V3[];
    f: number[][];
    note: string;
  }
  const phi = (1 + Math.sqrt(5)) / 2;

  function frame(): Solid {
    // A square "picture frame": outer square side 4, inner side 2, thickness 1.
    const v: V3[] = [];
    for (const z of [0.5, -0.5]) for (const s of [2, 1]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) v.push([x * s, y * s, z]);
    // Index: z-layer (0 top, 1 bottom) * 8 + ring (0 outer, 1 inner) * 4 + corner.
    const I = (layer: number, ring: number, c: number) => layer * 8 + ring * 4 + (c % 4);
    const f: number[][] = [];
    for (let c = 0; c < 4; c++) {
      f.push([I(0, 0, c), I(0, 0, c + 1), I(0, 1, c + 1), I(0, 1, c)]); // top
      f.push([I(1, 0, c), I(1, 1, c), I(1, 1, c + 1), I(1, 0, c + 1)]); // bottom
      f.push([I(0, 0, c), I(1, 0, c), I(1, 0, c + 1), I(0, 0, c + 1)]); // outer wall
      f.push([I(0, 1, c), I(0, 1, c + 1), I(1, 1, c + 1), I(1, 1, c)]); // inner wall
    }
    return { name: 'Picture frame', v, f, note: 'A polyhedron with a hole. V − E + F = 0. Lakatos’s first “monster”: is it a counterexample, or not a polyhedron at all?' };
  }
  function twinTetra(): Solid {
    const t: V3[] = [
      [0, 0, 0],
      [1.6, 0.6, 0.9],
      [1.6, 0.6, -0.9],
      [1.6, -1.3, 0],
    ];
    const u: V3[] = t.slice(1).map(([x, y, z]) => [-x, -y, z]);
    return {
      name: 'Two tetrahedra at a vertex',
      v: [...t, ...u],
      f: [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 1],
        [1, 3, 2],
        [0, 4, 5],
        [0, 5, 6],
        [0, 6, 4],
        [4, 6, 5],
      ],
      note: 'Two solids sharing one vertex: V = 7, E = 12, F = 8, so V − E + F = 3.',
    };
  }
  const SOLIDS: Solid[] = [
    {
      name: 'Tetrahedron',
      v: [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ],
      f: [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2],
      ],
      note: '4 − 6 + 4 = 2.',
    },
    {
      name: 'Cube',
      v: [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
      ],
      f: [
        [0, 3, 2, 1],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ],
      note: '8 − 12 + 6 = 2.',
    },
    {
      name: 'Octahedron',
      v: [
        [1.4, 0, 0],
        [-1.4, 0, 0],
        [0, 1.4, 0],
        [0, -1.4, 0],
        [0, 0, 1.4],
        [0, 0, -1.4],
      ],
      f: [
        [0, 2, 4],
        [2, 1, 4],
        [1, 3, 4],
        [3, 0, 4],
        [2, 0, 5],
        [1, 2, 5],
        [3, 1, 5],
        [0, 3, 5],
      ],
      note: '6 − 12 + 8 = 2.',
    },
    (() => {
      const v: V3[] = [];
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
        v.push([0, s1, s2 * phi]);
        v.push([s1, s2 * phi, 0]);
        v.push([s2 * phi, 0, s1]);
      }
      // Faces: triangles of mutually adjacent vertices at edge length 2.
      const f: number[][] = [];
      const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) if ([d(v[i]!, v[j]!), d(v[j]!, v[k]!), d(v[i]!, v[k]!)].every((x) => Math.abs(x - 2) < 1e-6)) f.push([i, j, k]);
      return { name: 'Icosahedron', v: v.map(([x, y, z]) => [x * 0.8, y * 0.8, z * 0.8] as V3), f, note: '12 − 30 + 20 = 2.' };
    })(),
    frame(),
    twinTetra(),
  ];

  let which = $state(1);
  let rx = $state(-0.5);
  let ry = $state(0.6);
  let drag: { x: number; y: number } | null = null;
  const S = $derived(SOLIDS[which]!);
  const edges = $derived.by(() => {
    const set = new Set<string>();
    for (const face of S.f) for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      set.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
    return [...set].map((k) => k.split('-').map(Number) as [number, number]);
  });
  const rot = (p: V3): V3 => {
    const [x, y, z] = p;
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    return [x1, y2, z2];
  };
  const R = 130;
  const C = 150;
  const proj = $derived(S.v.map((p) => rot(p)));
  const scale = $derived(R / Math.max(...S.v.map(([x, y, z]) => Math.hypot(x, y, z))));
  const faces = $derived(
    S.f
      .map((face) => ({ face, z: face.reduce((s, i) => s + proj[i]![2], 0) / face.length }))
      .sort((a, b) => a.z - b.z),
  );
  const P = (i: number) => `${(C + proj[i]![0] * scale).toFixed(1)},${(C - proj[i]![1] * scale).toFixed(1)}`;
  const chi = $derived(S.v.length - edges.length + S.f.length);
</script>

<Widget title="Counting polyhedra" subtitle="Drag to turn the solid. Count vertices, edges and faces — and compute V − E + F." onreset={() => ((rx = -0.5), (ry = 0.6))}>
  {#snippet controls()}
    <div class="tabs">{#each SOLIDS as s, i (i)}<button class:on={which === i} class:monster={i >= 4} onclick={() => (which = i)}>{s.name}</button>{/each}</div>
  {/snippet}
  <div class="wrap">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      viewBox="0 0 {2 * C} {2 * C}"
      width="100%"
      style:max-width="{2 * C}px"
      role="img"
      aria-label="{S.name}, rotatable"
      onpointerdown={(e) => ((drag = { x: e.clientX, y: e.clientY }), (e.currentTarget as Element).setPointerCapture(e.pointerId))}
      onpointermove={(e) => {
        if (!drag) return;
        ry += (e.clientX - drag.x) * 0.01;
        rx += (e.clientY - drag.y) * 0.01;
        drag = { x: e.clientX, y: e.clientY };
      }}
      onpointerup={() => (drag = null)}
    >
      {#each faces as { face }, k (k)}
        <polygon points={face.map(P).join(' ')} class="face" />
      {/each}
      {#each edges as [a, b] (a + '-' + b)}
        <line x1={C + proj[a]![0] * scale} y1={C - proj[a]![1] * scale} x2={C + proj[b]![0] * scale} y2={C - proj[b]![1] * scale} class="edge" />
      {/each}
      {#each proj as p, i (i)}
        <circle cx={C + p[0] * scale} cy={C - p[1] * scale} r="3.5" class="vert" />
      {/each}
    </svg>
    <div class="counts num">
      <p><span class="lab">V</span> {S.v.length}</p>
      <p><span class="lab">E</span> {edges.length}</p>
      <p><span class="lab">F</span> {S.f.length}</p>
      <p class="chi" class:bad={chi !== 2}><span class="lab">V − E + F</span> {chi}</p>
      <p class="note">{S.note}</p>
    </div>
  </div>
</Widget>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  button.monster {
    border-style: dashed;
    border-color: var(--byrne-red);
  }
  button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: center;
    justify-content: center;
  }
  svg {
    touch-action: none;
    cursor: grab;
  }
  .face {
    fill: color-mix(in srgb, var(--byrne-blue) 22%, transparent);
    stroke: none;
  }
  .edge {
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  .vert {
    fill: var(--byrne-red);
  }
  .counts {
    font-size: 1rem;
    min-width: 12rem;
  }
  .counts p {
    margin: 0.2rem 0;
  }
  .lab {
    display: inline-block;
    min-width: 5.5rem;
    color: var(--ink-2);
    font-family: var(--font-body);
    font-style: italic;
  }
  .chi {
    font-weight: 700;
    color: var(--ok);
    border-top: 1px solid var(--rule);
    padding-top: 0.3rem;
  }
  .chi.bad {
    color: var(--bad);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    max-width: 16rem;
  }
</style>
