<!--
  CERN's proton injector chain, to scale: Linac4 → Proton Synchrotron Booster → Proton Synchrotron → Super Proton Synchrotron → LHC.
  Choose a stage to read its energy, speed, revolution frequency and the rigidity Bρ its magnets must supply. The circles are the rings drawn to scale
  (the linac is a straight line, about a hundred metres long).

    ::injector-chain{n="19.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { fromKinetic, fromMomentum, M_P, C } from './physics';
  import { GEV_PER_TESLA_METRE } from '$lib/hep/machine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  interface Stage {
    key: string;
    name: string;
    kind: 'linac' | 'ring';
    quantity: 'kinetic' | 'momentum';
    value: number; // GeV or GeV/c
    circumference: number; // m; 0 for the linac
    role: string;
  }
  const STAGES: Stage[] = [
    { key: 'linac4', name: 'Linac4', kind: 'linac', quantity: 'kinetic', value: 0.16, circumference: 0, role: 'A linear accelerator of H⁻ ions, which are stripped of their electrons on entering the Booster.' },
    { key: 'psb', name: 'PS Booster', kind: 'ring', quantity: 'kinetic', value: 2, circumference: 157.08, role: 'Four small rings stacked one above the other, each filled from Linac4 and emptied into the PS.' },
    { key: 'ps', name: 'PS', kind: 'ring', quantity: 'momentum', value: 26, circumference: 628.32, role: 'CERN’s first big synchrotron (1959). It shapes the bunch spacing and splits bunches down to the LHC’s 25 ns pattern.' },
    { key: 'sps', name: 'SPS', kind: 'ring', quantity: 'momentum', value: 450, circumference: 6911.5, role: 'Built in the 1970s in its own tunnel; it now fills the LHC. Eleven times the PS’s circumference.' },
    { key: 'lhc', name: 'LHC', kind: 'ring', quantity: 'momentum', value: 6800, circumference: 26658.883, role: 'Two rings side by side; protons are injected at 450 GeV and accelerated to 6.8 TeV in the present runs.' },
  ];
  let sel = $state('ps');
  const cur = $derived(STAGES.find((s) => s.key === sel)!);
  const phys = $derived.by(() => {
    const s = cur;
    if (s.quantity === 'kinetic') {
      const r = fromKinetic(s.value);
      return { T: s.value, E: r.E, p: r.p, gamma: r.gamma };
    }
    const r = fromMomentum(s.value);
    return { T: r.T, E: r.E, p: s.value, gamma: r.gamma };
  });
  const beta = $derived(phys.p / phys.E);
  const frev = $derived(cur.circumference > 0 ? (beta * C) / cur.circumference : NaN);
  const rigidity = $derived(phys.p / GEV_PER_TESLA_METRE);
  const fmtE = (g: number) => (g < 1 ? `${(g * 1e3).toFixed(0)} MeV` : g < 1000 ? `${g.toFixed(g < 10 ? 2 : 1)} GeV` : `${(g / 1000).toFixed(2)} TeV`);

  // Energy ladder (log scale) and to-scale rings.
  const W = 560, H = 256;
  const lx = (e: number) => 30 + ((Math.log10(e) - Math.log10(0.1)) / (Math.log10(10000) - Math.log10(0.1))) * (W - 60);
  const energyOf = (s: Stage) => (s.quantity === 'kinetic' ? s.value : fromMomentum(s.value).T);
  const R = (c: number) => (c / (2 * Math.PI)) * (58 / 4243);
  const RX: Record<string, number> = { psb: 130, ps: 190, sps: 270, lhc: 430 };
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
</script>

<Widget title="The injector chain" subtitle="Five machines, one after another, each a few times larger and more energetic than the last" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Stage" bind:value={sel} options={STAGES.map((s) => ({ value: s.key, label: s.name }))} />
  {/snippet}

  <svg viewBox="0 0 {W} {H}" class="ch" role="img" aria-label="Left: the five machines on a logarithmic energy scale. Right: the rings drawn to scale.">
    <text x="30" y="14" class="cap">energy at extraction (logarithmic)</text>
    <line x1="30" x2={W - 30} y1="60" y2="60" class="axis" />
    {#each [0.1, 1, 10, 100, 1000, 10000] as t}
      <line x1={lx(t)} x2={lx(t)} y1="56" y2="64" class="axis" />
      <text x={lx(t)} y="78" text-anchor="middle" class="tick">{t < 1 ? '100 MeV' : t < 1000 ? `${t} GeV` : `${t / 1000} TeV`}</text>
    {/each}
    {#each STAGES as s, i}
      <circle cx={lx(energyOf(s) + 0.938 * 0)} cy="60" r={s.key === sel ? 7 : 4.5} class="st" class:on={s.key === sel} />
      <text x={lx(energyOf(s))} y={i % 2 ? 42 : 34} text-anchor="middle" class="nm" class:on={s.key === sel}>{s.name}</text>
    {/each}
    <text x="30" y="104" class="cap">rings to scale: the LHC is 4.2 km in radius, the PS 100 m, the Booster 25 m (dots)</text>
    {#each STAGES.filter((s) => s.kind === 'ring') as s}
      {@const r = Math.max(2.2, R(s.circumference))}
      <circle cx={RX[s.key]} cy={176} r={r} class="ring" class:on={s.key === sel} />
      <text x={RX[s.key]} y={250} text-anchor="middle" class="tick" class:on={s.key === sel}>{s.name === 'PS Booster' ? 'Booster' : s.name}</text>
    {/each}
  </svg>

  <p class="role ui"><strong>{cur.name}.</strong> {cur.role}</p>
  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>{cur.quantity === 'kinetic' ? 'Kinetic energy' : 'Momentum'}</dt><dd>{cur.quantity === 'kinetic' ? fmtE(cur.value) : `${fmtE(cur.value)}/c`}</dd></div>
    <div><dt>Total energy, γ</dt><dd>{fmtE(phys.E)}, γ = {f(phys.gamma, phys.gamma < 10 ? 3 : 1)}</dd></div>
    <div><dt>Speed</dt><dd>β = {f(beta, 6)}{phys.gamma > 100 ? ` (1 − β = ${(1 - beta).toExponential(1)})` : ''}</dd></div>
    <div><dt>Circumference</dt><dd>{cur.kind === 'linac' ? 'a straight line' : cur.circumference > 1000 ? `${f(cur.circumference / 1000, 3)} km` : `${f(cur.circumference, 0)} m`}</dd></div>
    <div><dt>Revolution frequency</dt><dd>{cur.kind === 'linac' ? '–' : `${f(frev / 1e3, 2)} kHz`}</dd></div>
    <div><dt>Rigidity Bρ the magnets must supply</dt><dd>{f(rigidity, rigidity < 100 ? 2 : 0)} T·m</dd></div>
  </dl>
  <p class="note ui">The energies are the values at extraction as usually quoted for the LHC cycle (Linac4 160 MeV; Booster 2 GeV kinetic; PS about 26 GeV/c; SPS 450 GeV/c). Circumferences are rounded.</p>
</Widget>

<style>
  .ch { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .axis { stroke: var(--line-strong); }
  .cap { font-size: 11px; fill: var(--mute); }
  .tick { font-size: 10px; fill: var(--ink-3); }
  .nm { font-size: 11px; fill: var(--ink-2); }
  .nm.on { fill: var(--ink); font-weight: 700; }
  .st { fill: var(--panel); stroke: var(--ink-2); stroke-width: 1.5; }
  .st.on { fill: var(--accent); stroke: var(--accent-ink); }
  .ring { fill: none; stroke: var(--ink-2); stroke-width: 1.4; }
  .ring.on { stroke: var(--accent-ink); stroke-width: 2.4; }
  .role { font-size: 0.86rem; margin: 0.5rem 0 0.2rem; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.4rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
