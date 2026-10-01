<!--
  The classical orbits behind Rutherford's formula. An alpha particle of energy T approaches a nucleus of charge Z; the Coulomb force bends its
  path into a hyperbola. The deflection depends only on the impact parameter b: tan(θ/2) = d/2b, with d = zZ α ħc/T the distance of closest approach
  in a head-on collision. The particles with impact parameters between b and b + db all end up between θ and θ + dθ, and their cross-sectional
  area 2π b db, divided by the solid angle 2π sinθ dθ, is dσ/dΩ.

  A calculation: the exact classical orbit of a point charge in a Coulomb field, not a simulation of many alphas.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { closestApproachFm, deflectionAngle, minApproachFm, rutherfordDiffXsecFm2 } from '$lib/hep/scattering';

  let { n, caption, title = 'Orbits: from impact parameter to angle' }: { n?: string | number; caption?: string; title?: string } = $props();

  const TARGETS = { gold: { Z: 79, R: 7.0, label: 'gold' }, silver: { Z: 47, R: 5.7, label: 'silver' } } as const;
  let target = $state<'gold' | 'silver'>('gold');
  let T = $state(5.5);
  let b = $state(25);
  const Z = $derived(TARGETS[target].Z);
  const d = $derived(closestApproachFm(2, Z, T));
  const theta = $derived(deflectionAngle(b, 2, Z, T));
  const rMin = $derived(minApproachFm(theta, 2, Z, T));
  const db = 4;
  const theta2 = $derived(deflectionAngle(b + db, 2, Z, T));

  /** Points on the orbit with impact parameter bb > 0 (passing above the nucleus), in fm; the nucleus is at the origin, y up. */
  function orbit(bb: number, rmax = 280): [number, number][] {
    const eps = Math.sqrt(1 + ((2 * bb) / d) ** 2); // eccentricity of the hyperbola
    const phi0 = Math.acos(1 / eps); // half the angle the position vector sweeps, π/2 − θ/2
    const lat = (2 * bb * bb) / d; // semi-latus rectum
    const pts: [number, number][] = [];
    const N = 240;
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const ph = -phi0 * Math.sin((u * Math.PI) / 2); // from +φ0 (far away, incoming) to −φ0 (far away, outgoing), dense near the ends
      const r = lat / (eps * Math.cos(ph) - 1);
      if (!(r > 0) || r > rmax) continue;
      const angle = Math.PI - phi0 + ph; // the incoming asymptote lies along −x (angle π); the outgoing one at θ
      pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }
    return pts;
  }
  const W = 440, H = 280, S = 1.15; // pixels per fm
  const X0 = 190, Y0 = H / 2;
  const px = (x: number) => X0 + x * S;
  const py = (y: number) => Y0 - y * S;
  const path = (pts: [number, number][], sign = 1) => pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)} ${py(sign * p[1]).toFixed(1)}`).join('');
  const bundle = [10, 20, 30, 45, 65, 90, 120];
  const ray = (th: number, len = 230): [number, number, number, number] => [px(0), py(0), px(len * Math.cos(th)), py(len * Math.sin(th))];
</script>

<Widget {title} subtitle="The Coulomb force turns each alpha's path into a hyperbola; the angle depends only on the impact parameter" {n} {caption} kind="Explore" onreset={() => { target = 'gold'; T = 5.5; b = 25; }}>
  {#snippet controls()}
    <Segmented label="Nucleus" size="sm" bind:value={target} options={[{ value: 'gold', label: 'gold' }, { value: 'silver', label: 'silver' }]} />
    <Slider bind:value={T} min={2} max={9} step={0.1} label="Alpha energy T" format={(v) => `${v.toFixed(1)} MeV`} />
    <Slider bind:value={b} min={4} max={120} step={0.5} label="Impact parameter b" format={(v) => `${v.toFixed(1)} fm`} />
  {/snippet}

  <div class="wrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Classical paths of alpha particles past a nucleus, bent into hyperbolas; the path with the chosen impact parameter is highlighted">
      <defs><marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="context-stroke" /></marker></defs>
      <!-- the band of impact parameters [b, b + db] and the cone it is scattered into -->
      <rect x="0" y={py(b + db)} width={px(0)} height={db * S} fill="var(--sig-high)" opacity="0.28" />
      <rect x="0" y={py(-b)} width={px(0)} height={db * S} fill="var(--sig-high)" opacity="0.28" />
      <path d={`M${px(0)} ${py(0)} L${ray(theta)[2]} ${ray(theta)[3]} L${ray(theta2)[2]} ${ray(theta2)[3]}Z`} fill="var(--sig-high)" opacity="0.22" />
      {#each bundle as bb}
        <path d={path(orbit(bb))} fill="none" stroke="var(--series-1)" stroke-width="1.1" opacity="0.6" />
        <path d={path(orbit(bb), -1)} fill="none" stroke="var(--series-1)" stroke-width="1.1" opacity="0.6" />
      {/each}
      <path d={path(orbit(b))} fill="none" stroke="var(--sig-high)" stroke-width="2.6" marker-end="url(#arr)" />
      <!-- head-on closest approach d and the nucleus -->
      <circle cx={px(0)} cy={py(0)} r={d * S} fill="none" stroke="var(--ink-3)" stroke-dasharray="3 4" />
      <circle cx={px(0)} cy={py(0)} r={Math.max(2.5, TARGETS[target].R * S)} fill="var(--bad)" />
      <text x={px(0) + d * S * 0.72} y={py(0) + d * S * 0.72 + 12} font-size="9.5" fill="var(--ink-2)">d = {d.toFixed(1)} fm</text>
      <line x1="6" x2="6" y1={py(b)} y2={py(0)} stroke="var(--fg)" stroke-width="1" />
      <text x="10" y={py(b / 2) + 3} font-size="10" fill="var(--fg)">b</text>
      <text x={W - 6} y={H - 6} font-size="9" text-anchor="end" fill="var(--mute)">scale: 100 fm = {(100 * S).toFixed(0)} px; the nucleus (red) is drawn at its true radius, about {TARGETS[target].R} fm</text>
    </svg>
    <dl class="read ui" aria-live="polite">
      <div><dt>tan(θ/2) = d/2b</dt><dd>θ = <strong>{((theta * 180) / Math.PI).toFixed(1)}°</strong></dd></div>
      <div><dt>closest approach on this path</dt><dd>{rMin.toFixed(1)} fm</dd></div>
      <div><dt>a nucleus of radius R is reached if</dt><dd>{rMin < TARGETS[target].R ? 'closest approach < R: the formula fails' : 'closest approach > R: pure Coulomb'}</dd></div>
      <div><dt>b for 90°</dt><dd>d/2 = {(d / 2).toFixed(1)} fm</dd></div>
      <div><dt>dσ/dΩ at this angle</dt><dd>{rutherfordDiffXsecFm2(theta, 2, Z, T).toPrecision(3)} fm²/sr</dd></div>
      <div><dt>shaded: b to b + {db} fm, area 2π b db</dt><dd>{(2 * Math.PI * b * db).toFixed(0)} fm² into θ to {((theta2 * 180) / Math.PI).toFixed(1)}°</dd></div>
    </dl>
  </div>
</Widget>

<style>
  .wrap {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 820px) {
    .wrap {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .read {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .read div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.2rem;
    font-size: 0.78rem;
  }
  .read dt {
    color: var(--ink-2);
  }
  .read dd {
    margin: 0;
    font-family: var(--font-mono);
    text-align: right;
  }
</style>
