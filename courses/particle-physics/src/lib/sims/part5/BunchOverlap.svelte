<!--
  Two bunches crossing at the interaction point, seen from above. Each is a Gaussian of length σz and width σ*. The crossing angle tilts their axes
  by ±θ/2, so they overlap only where they cross; the shaded region is the product of the two densities at the moment the centres coincide, which is
  where the collisions happen. The horizontal and vertical scales are very different (centimetres along the beam, micrometres across), which is
  what makes a small angle matter. The luminosity is computed with the course's `luminosity` (the reader's version if installed).

    ::bunch-overlap{n="21.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { LHC_DESIGN, geometricFactor, luminosity, sigmaStar, type LumiParams } from '$lib/hep/machine';
  import { fmtSci } from '../machine/fmt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let theta = $state(285); // µrad, full angle
  let betaStar = $state(0.55);
  let epsN = $state(3.75);
  let sigmaZcm = $state(7.55);
  let crab = $state(false);
  let hourglass = $state(false);

  const params = $derived<LumiParams>({ ...LHC_DESIGN, betaStar, eps_n: epsN * 1e-6, sigmaZ: sigmaZcm * 1e-2, crossingAngle: crab ? 0 : theta * 1e-6 });
  const headOn = $derived<LumiParams>({ ...params, crossingAngle: 0 });
  const sStar = $derived(sigmaStar(params)); // m
  const F = $derived(geometricFactor(params));
  const L = $derived(luminosity(params));
  const L0 = $derived(luminosity(headOn));
  const phi = $derived((params.crossingAngle * params.sigmaZ) / (2 * sStar));

  const W = 580, H = 250, PL = 46, PR = 10, PT = 12, PB = 34;
  const ZR = 25, XR = 120; // cm, µm
  const zx = (z_cm: number) => PL + ((z_cm + ZR) / (2 * ZR)) * (W - PL - PR);
  const xy = (x_um: number) => PT + (1 - (x_um + XR) / (2 * XR)) * (H - PT - PB);

  // Product of the two Gaussians at t = 0: exp(−x²/σ² − z² (1/σz² + (θ/2σ)²)) in metres.
  const cells = $derived.by(() => {
    const out: { x: number; y: number; w: number; h: number; a: number }[] = [];
    const nz = 90, nx = 44;
    const sig = sStar, sz = params.sigmaZ, th = params.crossingAngle;
    const k = 1 / (sz * sz) + (th / (2 * sig)) ** 2;
    for (let i = 0; i < nz; i++) {
      const zc = -ZR + ((i + 0.5) * 2 * ZR) / nz; // cm
      for (let j = 0; j < nx; j++) {
        const xc = -XR + ((j + 0.5) * 2 * XR) / nx; // µm
        const z = zc * 1e-2, x = xc * 1e-6;
        const v = Math.exp(-((x * x) / (sig * sig) + z * z * k));
        if (v > 0.02) out.push({ x: zx(zc - ZR / nz), y: xy(xc + XR / nx), w: (W - PL - PR) / nz + 0.4, h: (H - PT - PB) / nx + 0.4, a: v });
      }
    }
    return out;
  });
  /** The 1σ contour of a bunch whose axis is tilted by `tilt` (rad): points (z cm, x µm). */
  function contour(tilt: number): string {
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = (2 * Math.PI * i) / 80;
      const z = params.sigmaZ * Math.cos(t);
      const x = sStar * Math.sin(t) + tilt * z;
      pts.push(`${i ? 'L' : 'M'}${zx(z * 100).toFixed(1)} ${xy(x * 1e6).toFixed(1)}`);
    }
    return pts.join('') + 'Z';
  }
  const tilt = $derived(params.crossingAngle / 2);
  const env = (sign: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const z = -ZR + (i * 2 * ZR) / 120; // cm
      const s = Math.sqrt(1 + (z * 1e-2 / betaStar) ** 2) * sStar; // m
      pts.push(`${i ? 'L' : 'M'}${zx(z).toFixed(1)} ${xy(sign * s * 1e6).toFixed(1)}`);
    }
    return pts.join('');
  };
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
</script>

<Widget title="Two bunches crossing" subtitle="Beam size, bunch length and crossing angle decide how much of one bunch meets the other" {n} {caption} kind="Explore" onreset={() => { theta = 285; betaStar = 0.55; epsN = 3.75; sigmaZcm = 7.55; crab = false; hourglass = false; }}>
  {#snippet controls()}
    <Slider bind:value={theta} min={0} max={700} step={5} label="Full crossing angle θ [µrad]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={betaStar} min={0.15} max={1.5} step={0.01} label="β* [m]" />
    <Slider bind:value={epsN} min={1} max={5} step={0.05} label="Normalised emittance εₙ [µm]" />
    <Slider bind:value={sigmaZcm} min={4} max={12} step={0.05} label="Bunch length σz [cm]" />
    <Toggle bind:checked={crab} label="Crab cavities (tilt each bunch so they meet face to face)" />
    <Toggle bind:checked={hourglass} label="Show the hourglass: beam size away from the focus" />
  {/snippet}

  <svg viewBox="0 0 {W} {H}" class="xing" role="img" aria-label="Two Gaussian bunches crossing at an angle of {crab ? 0 : theta} microradians. The transverse size at the focus is {f(sStar * 1e6, 1)} micrometres and the bunch length {f(sigmaZcm, 2)} centimetres. The geometric luminosity factor is {f(F, 3)}.">
    <line x1={PL} x2={W - PR} y1={xy(0)} y2={xy(0)} class="axis" />
    {#each cells as c}<rect x={c.x} y={c.y} width={c.w} height={c.h} class="ov" style:opacity={c.a * 0.85} />{/each}
    <path d={contour(tilt)} class="b1" />
    <path d={contour(-tilt)} class="b2" />
    {#if hourglass}
      <path d={env(1)} class="env" /><path d={env(-1)} class="env" />
    {/if}
    {#each [-20, -10, 0, 10, 20] as z}
      <text x={zx(z)} y={H - PB + 15} text-anchor="middle" class="tk">{z}</text>
    {/each}
    {#each [-100, -50, 0, 50, 100] as x}
      <text x={PL - 5} y={xy(x)} text-anchor="end" dy="0.3em" class="tk">{x}</text>
    {/each}
    <text x={(PL + W - PR) / 2} y={H - 4} text-anchor="middle" class="ax">position along the beam axis z [cm]</text>
    <text x="10" y={(PT + H - PB) / 2} class="ax" transform="rotate(-90 10 {(PT + H - PB) / 2})" text-anchor="middle">across [µm]</text>
    <text x={W - PR - 4} y={PT + 12} text-anchor="end" class="tk">solid: bunch 1 (1σ) · dashed: bunch 2 · shaded: where they overlap</text>
  </svg>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Beam size at the focus, σ* = √(εₙ β*/γ)</dt><dd>{f(sStar * 1e6, 1)} µm</dd></div>
    <div><dt>Piwinski angle φ = θσz/2σ*</dt><dd>{f(phi, 2)}</dd></div>
    <div><dt>Geometric factor F = 1/√(1 + φ²)</dt><dd>{f(F, 3)}</dd></div>
    <div><dt>Luminosity</dt><dd>{fmtSci(L, 3)} cm⁻² s⁻¹</dd></div>
    <div><dt>… with no crossing angle</dt><dd>{fmtSci(L0, 3)} cm⁻² s⁻¹</dd></div>
    <div><dt>Hourglass: σz/β*</dt><dd>{f(params.sigmaZ / betaStar, 2)}{params.sigmaZ / betaStar > 0.3 ? ' (no longer negligible)' : ''}</dd></div>
  </dl>
  <p class="note ui">Design bunch population, 2808 bunches and 7 TeV (LHC Design Report values). The picture is correct in both scales but the two axes are not: across the beam the scale is about a thousand times finer than along it. The hourglass effect, which the formula ignores, matters only when σz is not small compared with β*.</p>
</Widget>

<style>
  .xing { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .axis { stroke: var(--line-strong); stroke-dasharray: 4 4; }
  .ov { fill: var(--accent); }
  .b1 { fill: none; stroke: var(--series-1); stroke-width: 2; }
  .b2 { fill: none; stroke: var(--series-2); stroke-width: 2; stroke-dasharray: 6 4; }
  .env { fill: none; stroke: var(--ink-3); stroke-width: 1.2; stroke-dasharray: 2 3; }
  .tk { font-size: 10px; fill: var(--ink-3); }
  .ax { font-size: 11px; fill: var(--ink-2); }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.6rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
