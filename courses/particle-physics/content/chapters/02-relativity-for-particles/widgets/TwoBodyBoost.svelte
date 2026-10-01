<!--
  A parent particle decays to two muons in its own rest frame, and the parent is moving. Change the parent's
  momentum and the decay angle: the muons' energies and opening angle change, the invariant mass of the pair does not.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { fromMass, boost, add, mass, pmag, pt, eta, openingAngle, type P4 } from '$lib/hep/kinematics';
  import { particle } from '$lib/hep/particles';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const PARENTS = [
    { name: 'Z', m: particle(23).mass },
    { name: 'J/ψ', m: particle(443).mass },
    { name: 'Υ(1S)', m: particle(553).mass },
  ];
  const mMu = particle(13).mass;

  let parent = $state(0);
  let pz = $state(40);
  let cosT = $state(0.3);
  let phiStar = $state(0.6);

  const M = $derived(PARENTS[parent]!.m);
  const k = $derived(Math.sqrt(Math.max(0, (M / 2) ** 2 - mMu ** 2)));
  const rest = $derived.by((): [P4, P4] => {
    const s = Math.sqrt(1 - cosT * cosT);
    const ux = s * Math.cos(phiStar), uy = s * Math.sin(phiStar), uz = cosT;
    return [fromMass(mMu, k * ux, k * uy, k * uz), fromMass(mMu, -k * ux, -k * uy, -k * uz)];
  });
  const parentP4 = $derived(fromMass(M, 0, 0, pz));
  const lab = $derived.by((): [P4, P4] => {
    const b = pz / parentP4.E;
    return [boost(rest[0], 0, 0, b), boost(rest[1], 0, 0, b)];
  });
  const total = $derived(add(lab[0], lab[1]));
  const f = (x: number, d = 3) => (Math.abs(x) < 0.0005 ? '0' : x.toFixed(d));

  // Drawing: the x–z plane, z to the right. Arrow length ∝ momentum, compressed.
  const W = 420, H = 200;
  const arrow = (p: P4) => {
    const s = 150 / Math.max(20, M, pmag(p) * 1.1);
    return { x: W / 2 - 40 + p.pz * s * 1, y: H / 2 - p.px * s };
  };
</script>

<Widget title="Two muons from a moving parent" {n} {caption} kind="Explore">
  {#snippet controls()}
    <div class="ui row">
      {#each PARENTS as p, i}
        <button class:on={parent === i} onclick={() => (parent = i)}>{p.name} ({p.m.toFixed(2)} GeV)</button>
      {/each}
    </div>
    <Slider bind:value={pz} min={0} max={200} step={1} label="Parent momentum along the beam, p_z [GeV]" />
    <Slider bind:value={cosT} min={-1} max={1} step={0.01} label="Decay angle in the parent's rest frame, cos θ*" />
    <Slider bind:value={phiStar} min={0} max={6.28} step={0.05} label="Azimuth in the rest frame, φ*" />
  {/snippet}
  <div class="grid">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="The two muon momenta in the x–z plane">
      <defs>
        <marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="context-stroke" /></marker>
      </defs>
      <line x1="10" x2={W - 10} y1={H / 2} y2={H / 2} stroke="var(--line-strong)" stroke-dasharray="4 4" />
      <text x={W - 14} y={H / 2 - 6} text-anchor="end" class="lbl">beam (z)</text>
      <circle cx={W / 2 - 40} cy={H / 2} r="4" fill="var(--ink)" />
      {#each lab as p, i}
        {@const a = arrow(p)}
        <line x1={W / 2 - 40} y1={H / 2} x2={a.x} y2={a.y} stroke="var(--p-muon)" stroke-width={i ? 2 : 3.2} marker-end="url(#ah)" />
        <text x={a.x + 4} y={a.y - 4} class="lbl">μ{i + 1}</text>
      {/each}
    </svg>
    <table class="ui">
      <thead><tr><th></th><th>E</th><th>p<sub>x</sub></th><th>p<sub>z</sub></th><th>p<sub>T</sub></th><th>η</th></tr></thead>
      <tbody>
        {#each lab as p, i}
          <tr><th>μ{i + 1}</th><td>{f(p.E, 2)}</td><td>{f(p.px, 2)}</td><td>{f(p.pz, 2)}</td><td>{f(pt(p), 2)}</td><td>{f(eta(p), 2)}</td></tr>
        {/each}
        <tr class="sum"><th>sum</th><td>{f(total.E, 2)}</td><td>{f(total.px, 2)}</td><td>{f(total.pz, 2)}</td><td colspan="2"></td></tr>
      </tbody>
    </table>
  </div>
  <p class="ui out">
    Opening angle <strong>{f((openingAngle(lab[0], lab[1]) * 180) / Math.PI, 1)}°</strong> · invariant mass of the pair
    <strong class="m">{f(mass(total), 3)} GeV</strong>
  </p>
</Widget>

<style>
  .row {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }
  button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  button.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .lbl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.15rem 0.5rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
  }
  tbody th {
    text-align: left;
  }
  .sum {
    border-top: 1px solid var(--line-strong);
  }
  .out {
    margin: 0.5rem 0 0;
  }
  .m {
    color: var(--accent-ink);
  }
</style>
