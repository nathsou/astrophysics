<!--
  The proton at increasing resolution (Chapter 13's flagship). A probe of momentum transfer Q resolves distances of about λ = ħc/Q. At low Q the proton is
  one blob; once λ is below its size three valence quarks appear; at higher Q, and with sensitivity to smaller momentum fractions x, a sea of quark–antiquark
  pairs and gluons. The numbers of partons above x_min and the curves x f(x) come from the course's pedagogical parton distributions (hep/gen), a teaching
  parametrisation and not a fit to data. The positions of the dots are random (seeded) and carry no information: the counts do.

    ::dis-proton{n="13.4" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { pow10Label } from './fmt';
  import { partonCounts, momentumShares, resolutionFm, uValence, dValence, seaQuark, gluon } from './partons';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  const R_P = 0.84; // fm: charge radius of the proton
  let logQ = $state(Math.log10(2));
  let logX = $state(-2.5);
  const Q = $derived(10 ** logQ);
  const xMin = $derived(10 ** logX);
  const lam = $derived(resolutionFm(Q));
  const counts = $derived(partonCounts(Q, xMin));
  const shares = $derived(momentumShares(Q));
  const stage = $derived(lam > R_P * 1.15 ? 0 : Q < 1 ? 1 : 2);

  // the picture: fixed random positions, drawn in a circle of radius R_P
  const S = 300;
  const k = S / 2 / 1.25 / R_P; // px per fm: the proton circle has radius ≈ 0.8 of half the canvas
  const pos = (i: number, seed: number) => {
    const r = rng(seed + i * 7919);
    const rad = R_P * Math.sqrt(r()) * 0.95;
    const a = 2 * Math.PI * r();
    return [S / 2 + rad * k * Math.cos(a), S / 2 + rad * k * Math.sin(a)] as [number, number];
  };
  const valenceFlav = ['u', 'u', 'd'];
  const valenceCol = ['var(--series-7)', 'var(--series-3)', 'var(--series-1)'];
  const nSea = $derived(Math.min(40, Math.round(counts.sea)));
  const nGlue = $derived(Math.min(60, Math.round(counts.gluons)));
  const glueIdx = $derived(stage === 2 ? Array.from({ length: nGlue }, (_, i) => i) : []);
  const seaIdx = $derived(stage === 2 ? Array.from({ length: nSea }, (_, i) => i) : []);
  const dotR = $derived(Math.max(8, Math.min(30, 0.45 * lam * k)));
  const smallR = $derived(Math.max(3.5, Math.min(11, 0.2 * lam * k)));
  const blur = $derived(Math.max(0.4, Math.min(5, 0.05 * lam * k)));

  const XG = Array.from({ length: 120 }, (_, i) => 10 ** (-4 + (i * 4) / 119));
  const pth = (f: (x: number) => number, sx: (v: number) => number, sy: (v: number) => number) => XG.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`).join('');
  const fmtQ = (q: number) => (q < 10 ? q.toFixed(2) : q < 100 ? q.toFixed(1) : q.toFixed(0));
</script>

<Widget title="The proton at increasing resolution" {n} {caption} kind="Model" live={false}>
  {#snippet controls()}
    <Slider bind:value={logQ} min={Math.log10(0.2)} max={3} step={0.01} label="Momentum transfer Q of the probe" format={(v) => `${fmtQ(10 ** v)} GeV`} />
    <Slider bind:value={logX} min={-4} max={-0.5} step={0.05} label="Smallest momentum fraction x the probe can see" format={(v) => `x > ${(10 ** v).toPrecision(2)}`} />
  {/snippet}
  <div class="p3-two">
    <div>
      <h5 class="p3-h">What the probe resolves (random positions; the counts are the physics)</h5>
      <svg viewBox="0 0 {S} {S}" role="img" aria-label="A circle the size of the proton. {stage === 0 ? 'The resolution is coarser than the proton: a single blurred blob.' : stage === 1 ? 'Three blurred valence quarks.' : `Three valence quarks, about ${nSea} sea quarks and antiquarks and ${nGlue} gluons.`}">
        <defs>
          <radialGradient id="blob"><stop offset="0%" stop-color="var(--series-5)" stop-opacity="0.85" /><stop offset="100%" stop-color="var(--series-5)" stop-opacity="0.1" /></radialGradient>
          <filter id="fuzz"><feGaussianBlur stdDeviation={blur} /></filter>
        </defs>
        <rect width={S} height={S} fill="var(--panel)" />
        <circle cx={S / 2} cy={S / 2} r={R_P * k} fill="none" stroke="var(--line-strong)" stroke-dasharray="4 4" />
        <text x={S / 2} y={S - 8} text-anchor="middle" class="p3-tag">dashed: proton radius 0.84 fm · λ = ħc/Q = {lam.toFixed(2)} fm</text>
        {#if stage === 0}
          <circle cx={S / 2} cy={S / 2} r={R_P * k * 1.1} fill="url(#blob)" filter="url(#fuzz)" />
        {:else}
          <g filter="url(#fuzz)" opacity={stage === 1 ? 1 : 0.95}>
            {#each glueIdx as i}
              {@const p = pos(i, 11)}
              <path d="M{p[0] - 8},{p[1]} q4,-8 8,0 t8,0" fill="none" stroke="var(--p-jet)" stroke-width="2" opacity="0.85" />
            {/each}
            {#each seaIdx as i}
              {@const p = pos(i, 29)}
              <circle cx={p[0]} cy={p[1]} r={smallR} fill={i % 2 ? 'none' : 'var(--ink-3)'} stroke="var(--ink-3)" stroke-width="1.4" />
            {/each}
            {#each valenceFlav as f, i}
              {@const p = pos(i, 3)}
              <circle cx={p[0]} cy={p[1]} r={dotR} fill={valenceCol[i]} opacity="0.9" />
              <text x={p[0]} y={p[1] + 4} text-anchor="middle" style="fill:#fff;font-size:12px;font-weight:700">{f}</text>
            {/each}
          </g>
        {/if}
      </svg>
      <ul class="p3-note ui" style="list-style:none;padding:0;display:flex;gap:0.8rem;flex-wrap:wrap">
        <li>● valence quark (u, u, d)</li><li><span style="color:var(--ink-3)">●○</span> sea quark, antiquark</li><li><span style="color:var(--p-jet)">∿</span> gluon</li>
      </ul>
    </div>
    <div>
      <h5 class="p3-h">The distributions x f(x, Q) at this Q</h5>
      <Plot
        height={290}
        label="The parton distributions x f of the proton against the momentum fraction x on a logarithmic axis: up and down valence peaked near x of 0.2, sea quarks and gluons rising towards small x, at the chosen Q."
        x={{ type: 'log', domain: [1e-4, 1], label: 'momentum fraction x', tickValues: [1e-4, 1e-3, 1e-2, 0.1, 1], format: (v) => (v === 0.1 ? '0.1' : pow10Label(v)) }}
        y={{ domain: [0, 1.5], label: 'x f(x, Q)', ticks: 5 }}
      >
        {#snippet marks({ sx, sy })}
          <rect x="0" width={Math.max(0, sx(xMin))} y="0" height="1000" fill="var(--grid)" opacity="0.6" />
          <path d={pth((x) => x * uValence(x, Q), sx, sy)} class="p3-line" stroke="var(--series-7)" />
          <path d={pth((x) => x * dValence(x, Q), sx, sy)} class="p3-line" stroke="var(--series-1)" />
          <path d={pth((x) => (x * seaQuark(x, Q)) / 4, sx, sy)} class="p3-line" stroke="var(--ink-2)" stroke-dasharray="5 3" />
          <path d={pth((x) => (x * gluon(x, Q)) / 10, sx, sy)} class="p3-line" stroke="var(--p-jet)" />
        {/snippet}
      </Plot>
      <ul class="p3-note ui" style="list-style:none;padding:0;display:flex;gap:0.8rem;flex-wrap:wrap">
        <li><span style="color:var(--series-7)">━</span> x u<sub>v</sub></li><li><span style="color:var(--series-1)">━</span> x d<sub>v</sub></li><li><span style="color:var(--ink-2)">┄</span> x (sea quarks and antiquarks) / 4</li><li><span style="color:var(--p-jet)">━</span> x g / 10</li>
      </ul>
    </div>
  </div>
  <dl class="p3-out ui" aria-live="polite">
    <div><dt>resolution λ = ħc/Q</dt><dd>{lam.toFixed(3)} fm {lam > R_P ? '(coarser than the proton)' : '(finer than the proton)'}</dd></div>
    <div><dt>partons with x > {xMin.toPrecision(2)}</dt><dd>valence {counts.valence.toFixed(1)} · sea {counts.sea.toFixed(1)} · gluons {counts.gluons.toFixed(1)}</dd></div>
    <div><dt>momentum carried (all x)</dt><dd>valence {(100 * shares.valence).toFixed(0)} % · sea {(100 * shares.sea).toFixed(0)} % · gluons {(100 * shares.gluons).toFixed(0)} %</dd></div>
  </dl>
  <p class="p3-note ui">The distributions are the course's teaching parametrisation (leading-order evolution from hand-chosen shapes at 1.27 GeV), not a fit to data: expect differences of tens of per cent from a real set. The picture is schematic: a parton's position inside the proton is not what a parton distribution measures. What the distributions give exactly, because they obey the sum rules, is that the valence quarks always number three, and that the share of momentum they carry falls as Q rises.</p>
</Widget>

<style>
  svg { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; }
</style>
