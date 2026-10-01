<!--
  Why a cyclotron stops at about 20 MeV, and what rescues it. A proton crosses the accelerating gap twice per turn, gaining 2eV cos φ. As it gains
  energy it becomes heavier, its revolution takes longer, and it arrives at the gap later in the RF cycle, until the field no longer pushes it.
  Three machines are compared: fixed frequency (Lawrence's cyclotron), a magnet whose field rises with radius so that the revolution time stays
  constant (isochronous), and an RF frequency that falls as the protons gain energy (a synchrocyclotron, as in CERN's first accelerator).

    ::cyclotron-limit{n="19.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { runCyclotron, cyclotronFrequency, gammaFromT, type CyclotronMode } from './physics';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let mode = $state<CyclotronMode>('fixed');
  let voltageKV = $state(100);
  let phi0 = $state(-40);
  let B = $state(1.5);

  const NTURNS = 60000;
  const run = $derived(runCyclotron(mode, voltageKV * 1e3, phi0, NTURNS, 0.6));
  const f0 = $derived(cyclotronFrequency(B) / 1e6);
  const pts = $derived.by(() => {
    const out: { t: number; T: number; ph: number }[] = [];
    const N = run.T.length;
    const step = Math.max(1, Math.floor(N / 500));
    for (let i = 0; i < N; i += step) out.push({ t: i + 1, T: run.T[i]! * 1e3, ph: run.phase[i]! });
    if (N > 0) out.push({ t: N, T: run.T[N - 1]! * 1e3, ph: run.phase[N - 1]! });
    return out;
  });
  const nShown = $derived(run.T.length);
  const finalT = $derived((run.T[nShown - 1] ?? 0) * 1e3);
  const gammaMax = $derived(gammaFromT(run.maxT));
  const fDrop = $derived((1 - 1 / gammaMax) * 100);
  const modes = [
    { value: 'fixed' as const, label: 'Fixed frequency' },
    { value: 'isochronous' as const, label: 'Isochronous field' },
    { value: 'modulated' as const, label: 'Frequency-modulated' },
  ];
  const tmax = $derived(Math.max(10, Math.ceil(Math.max(run.maxT * 1e3, 1) * 1.15 / 10) * 10));
  const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
</script>

<Widget title="The cyclotron's relativistic limit" subtitle="A proton gets heavier, and arrives at the gap too late" {n} {caption} kind="Explore" onreset={() => { mode = 'fixed'; voltageKV = 100; phi0 = -40; B = 1.5; }}>
  {#snippet controls()}
    <Segmented label="Machine" bind:value={mode} options={modes} onchange={(m) => { phi0 = m === 'modulated' ? 30 : -40; }} />
    <Slider bind:value={voltageKV} min={10} max={400} step={5} label="Voltage across the gap [kV]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={phi0} min={-80} max={60} step={1} label="Starting phase from the RF crest [°]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={B} min={0.5} max={2} step={0.05} label="Magnetic field [T] (sets the frequency only)" format={(v) => v.toFixed(2)} />
  {/snippet}

  <h5 class="ui">Kinetic energy of the proton, turn by turn</h5>
  <Plot
    label="Kinetic energy in MeV against the number of turns on a logarithmic axis, for the {modes.find((m) => m.value === mode)?.label} machine; it reaches {f(run.maxT * 1e3, 1)} MeV at most"
    x={{ type: 'log', domain: [1, NTURNS], label: 'turns' }}
    y={{ domain: [0, tmax], label: 'kinetic energy [MeV]' }}
    height={240}
  >
    {#snippet marks({ sx, sy })}
      <line class="ref" x1={sx(1)} x2={sx(NTURNS)} y1={sy(600)} y2={sy(600)} />
      {#if 600 <= tmax}<text x={sx(1) + 6} y={sy(600) - 5} class="ann">600 MeV: the CERN Synchrocyclotron</text>{/if}
      <path class="line" d={pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t)} ${sy(p.T)}`).join('')} />
      {#if run.maxT > 0}<circle class="best" cx={sx(run.turnOfMax + 1)} cy={sy(run.maxT * 1e3)} r="5" />{/if}
    {/snippet}
  </Plot>

  <h5 class="ui">Phase of the proton at the gap (0° is the crest of the RF wave)</h5>
  <Plot
    label="The phase of the proton relative to the RF crest in degrees against turns; the field accelerates it while the phase is between minus 90 and plus 90 degrees"
    x={{ type: 'log', domain: [1, NTURNS], label: 'turns' }}
    y={{ domain: [-180, 180], label: 'phase [°]', tickValues: [-180, -90, 0, 90, 180] }}
    height={170}
  >
    {#snippet marks({ sx, sy })}
      <rect x={sx(1)} y={sy(90)} width={sx(NTURNS) - sx(1)} height={sy(-90) - sy(90)} class="accel" />
      <text x={sx(1) + 6} y={sy(90) + 14} class="ann">accelerating</text>
      <text x={sx(1) + 6} y={sy(-90) + 14} class="ann">decelerating (outside the band)</text>
      {#each pts as p}<circle cx={sx(p.t)} cy={sy(p.ph)} r="1.6" class="dot" />{/each}
    {/snippet}
  </Plot>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Highest energy reached</dt><dd>{f(run.maxT * 1e3, 1)} MeV{mode === 'fixed' ? ` at turn ${run.turnOfMax + 1}` : ''}</dd></div>
    <div><dt>Energy at the end of the run</dt><dd>{f(finalT, 1)} MeV in {nShown.toLocaleString('en-GB')} turns</dd></div>
    <div><dt>Revolution frequency at {f(B, 2)} T, slow proton</dt><dd>{f(f0, 2)} MHz</dd></div>
    <div><dt>Fall in revolution frequency at the top energy</dt><dd>{f(fDrop, 1)}% (γ = {f(gammaMax, 3)})</dd></div>
  </dl>
  <p class="note ui">A toy: two gap crossings per turn, one RF frequency, no focusing. The run stops at 600 MeV or after 60,000 turns. In the frequency-modulated machine the RF frequency falls with the synchronous proton's γ; protons outside its bucket are left behind, which is why such a machine delivers bunches rather than a continuous beam.</p>
</Widget>

<style>
  .line { fill: none; stroke: var(--series-1); stroke-width: 2; }
  .best { fill: var(--series-2); stroke: var(--surface); stroke-width: 1.5; }
  .ref { stroke: var(--line-strong); stroke-dasharray: 5 4; }
  .accel { fill: var(--accent-soft); opacity: 0.55; }
  .dot { fill: var(--series-1); }
  .ann { font-size: 11px; fill: var(--ink-2); }
  h5 { margin: 0.7rem 0 0.2rem; font-size: 0.82rem; color: var(--ink-2); font-weight: 600; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.6rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.92rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
