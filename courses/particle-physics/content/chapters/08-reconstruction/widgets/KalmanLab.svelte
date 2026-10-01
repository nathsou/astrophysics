<!--
  A Kalman filter following one track, step by step. The state is the track's height and slope (y, s) at the current layer; each layer measures y with an
  error σ; between layers the track moves on (predict: y → y + s Δx, the covariance grows) and is nudged by scattering (process noise q). The measurement
  update is the library's `kalmanUpdate` (hook reco.kalmanUpdate), or the reader's when "use my code" is on.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { kalmanPredict, kalmanUpdate } from '$lib/hep/reco';
  import { hook } from '$lib/hep/hooks';
  import { rng as makeRng, normal } from '$lib/hep/random';
  import { savedFor, useMine } from '$lib/sims/part2/mine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const NL = 8; // layers at x = 1 … 8
  const DX = 1;
  let sigma = $state(0.3); // measurement error
  let qScat = $state(0.02); // scattering kick per layer (rad-like, in slope units)
  let seed = $state(3);
  let step = $state(0); // number of measurements already used
  let mineAvailable = $state(false);
  let useMineOn = $state(false);
  let version = $state(0);
  let note = $state('');

  onMount(() => {
    mineAvailable = savedFor(['reco.kalmanUpdate']).length > 0;
    return () => useMine(['reco.kalmanUpdate'], false);
  });
  function toggleMine(on: boolean) {
    const r = useMine(['reco.kalmanUpdate'], on);
    const err = r.errors['reco.kalmanUpdate'];
    note = err ? `Your code failed to load (${err}).` : on ? 'The updates use your kalmanUpdate.' : '';
    version++;
  }

  // the "truth": a straight line with small random kicks in the slope at each layer, and noisy measurements of it
  const data = $derived.by(() => {
    const r = makeRng(seed);
    const s0 = 0.25 + 0.3 * normal(r, 0, 0.5);
    let y = 0.4 * normal(r), s = s0;
    const truth: number[] = [], meas: number[] = [];
    for (let k = 1; k <= NL; k++) {
      s += normal(r) * qScat;
      y += s * DX;
      truth.push(y);
      meas.push(y + normal(r) * sigma);
    }
    return { truth, meas };
  });

  interface Stage {
    k: number;
    pred: { x: number[]; P: number[][] };
    upd: { x: number[]; P: number[][]; chi2: number };
    y: number; // innovation
    S: number;
    K: number[];
  }
  const stages = $derived.by((): Stage[] => {
    void version;
    const upd = hook('reco.kalmanUpdate', kalmanUpdate);
    const F = [[1, DX], [0, 1]];
    const Q = [[0, 0], [0, qScat * qScat]];
    let st = { x: [0, 0.3], P: [[4, 0], [0, 1]] };
    const out: Stage[] = [];
    for (let k = 0; k < NL; k++) {
      const pred = kalmanPredict(st, F, Q);
      const H = [[1, 0]];
      const res = upd(pred, { z: [data.meas[k]!], R: [[sigma * sigma]] }, H);
      const innov = data.meas[k]! - pred.x[0]!;
      const S = pred.P[0]![0]! + sigma * sigma;
      const K = [pred.P[0]![0]! / S, pred.P[1]![0]! / S];
      out.push({ k: k + 1, pred, upd: res, y: innov, S, K });
      st = { x: res.x, P: res.P };
    }
    return out;
  });
  const cur = $derived(step > 0 ? stages[Math.min(step, NL) - 1]! : null);
  const chi2 = $derived(stages.slice(0, step).reduce((a, s) => a + s.upd.chi2, 0));

  const W = 560, H = 250, px0 = 40, px1 = 540;
  const X = (x: number) => px0 + (x / (NL + 0.6)) * (px1 - px0);
  const yMin = $derived(Math.min(...data.meas, ...data.truth) - 1.5), yMax = $derived(Math.max(...data.meas, ...data.truth) + 1.5);
  const Y = (y: number) => H - 20 - ((y - yMin) / (yMax - yMin)) * (H - 40);
  // the filtered estimate at each layer so far, and the fitted line from the latest state
  const filtPath = $derived(
    stages
      .slice(0, step)
      .map((s, i) => `${i ? 'L' : 'M'}${X(s.k).toFixed(1)},${Y(s.upd.x[0]!).toFixed(1)}`)
      .join(''),
  );
  const extrap = $derived(cur ? `M${X(cur.k)},${Y(cur.upd.x[0]!)}L${X(NL + 0.4)},${Y(cur.upd.x[0]! + cur.upd.x[1]! * (NL + 0.4 - cur.k) * DX)}` : '');
  const f = (v: number, d = 3) => v.toFixed(d);
</script>

<Widget title="A Kalman filter, one layer at a time" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={sigma} min={0.05} max={1} step={0.05} label="Measurement error σ" />
    <Slider bind:value={qScat} min={0} max={0.1} step={0.005} label="Scattering per layer q" format={(v) => v.toFixed(3)} />
    <div class="ui btns">
      <Button onclick={() => (step = Math.min(NL, step + 1))} disabled={step >= NL}>Next layer</Button>
      <Button onclick={() => (step = NL)}>All layers</Button>
      <Button onclick={() => { step = 0; seed += 1; }}>New track</Button>
      <Button onclick={() => (step = 0)}>Restart</Button>
    </div>
    {#if mineAvailable}<Toggle bind:checked={useMineOn} label="use my code (kalmanUpdate)" onchange={toggleMine} />{/if}
  {/snippet}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Measured points with error bars against layer number, and the filter's estimate with its uncertainty band after each update" class="plot">
    <line x1={px0} x2={px1} y1={H - 20} y2={H - 20} stroke="var(--axis)" />
    {#each Array.from({ length: NL }, (_, i) => i + 1) as k}
      <line x1={X(k)} x2={X(k)} y1="10" y2={H - 20} stroke="var(--grid)" />
      <text x={X(k)} y={H - 6} class="tk" text-anchor="middle">{k}</text>
    {/each}
    <text x={px1} y={H - 6} class="tk" text-anchor="end">layer</text>
    <!-- the uncertainty band of the filtered height -->
    {#if step > 0}
      <path d={stages.slice(0, step).map((s, i) => `${i ? 'L' : 'M'}${X(s.k)},${Y(s.upd.x[0]! + Math.sqrt(s.upd.P[0]![0]!))}`).join('') + stages.slice(0, step).reverse().map((s) => `L${X(s.k)},${Y(s.upd.x[0]! - Math.sqrt(s.upd.P[0]![0]!))}`).join('') + 'Z'} fill="var(--series-2)" fill-opacity="0.2" stroke="none" />
      <path d={filtPath} fill="none" stroke="var(--series-2)" stroke-width="2" />
      <path d={extrap} fill="none" stroke="var(--series-2)" stroke-width="1.5" stroke-dasharray="5 3" />
    {/if}
    {#each data.truth as t, i}
      <circle cx={X(i + 1)} cy={Y(t)} r="3" fill="none" stroke="var(--series-3)" stroke-width="1.5" />
    {/each}
    {#each data.meas as m, i}
      {#if i < step}
        <line x1={X(i + 1)} x2={X(i + 1)} y1={Y(m - sigma)} y2={Y(m + sigma)} stroke="var(--fg)" stroke-width="1.5" />
        <circle cx={X(i + 1)} cy={Y(m)} r="3.5" fill="var(--fg)" />
      {/if}
    {/each}
    {#if cur}
      <!-- the prediction made before the latest update -->
      <line x1={X(cur.k)} x2={X(cur.k)} y1={Y(cur.pred.x[0]! - Math.sqrt(cur.pred.P[0]![0]!))} y2={Y(cur.pred.x[0]! + Math.sqrt(cur.pred.P[0]![0]!))} stroke="var(--series-1)" stroke-width="5" opacity="0.45" />
      <circle cx={X(cur.k)} cy={Y(cur.pred.x[0]!)} r="4" fill="var(--series-1)" />
    {/if}
  </svg>
  <ul class="legend ui">
    <li><span class="dot" style="background: var(--fg)"></span>measurement ± σ</li>
    <li><span class="dot ring" style="border-color: var(--series-3)"></span>true position</li>
    <li><span class="dot" style="background: var(--series-1)"></span>prediction before the update (thick bar: ± its uncertainty)</li>
    <li><span class="dot" style="background: var(--series-2)"></span>filtered estimate and ±1σ band</li>
  </ul>
  {#if cur}
    <div class="nums ui" aria-live="polite">
      <table>
        <tbody>
          <tr><th>layer</th><td>{cur.k}</td><th>predicted height</th><td>{f(cur.pred.x[0]!)} ± {f(Math.sqrt(cur.pred.P[0]![0]!))}</td></tr>
          <tr><th>measured</th><td>{f(data.meas[cur.k - 1]!)}</td><th>innovation y = z − Hx</th><td>{f(cur.y)}</td></tr>
          <tr><th>innovation variance S</th><td>{f(cur.S)}</td><th>gain K (height, slope)</th><td>({f(cur.K[0]!)}, {f(cur.K[1]!)})</td></tr>
          <tr><th>updated height</th><td>{f(cur.upd.x[0]!)} ± {f(Math.sqrt(cur.upd.P[0]![0]!))}</td><th>updated slope</th><td>{f(cur.upd.x[1]!)} ± {f(Math.sqrt(cur.upd.P[1]![1]!))}</td></tr>
          <tr><th>this layer's χ²</th><td>{f(cur.upd.chi2, 2)}</td><th>track χ² so far ({step} layer{step > 1 ? 's' : ''}, 1 dof each)</th><td>{f(chi2, 2)}</td></tr>
        </tbody>
      </table>
    </div>
  {:else}
    <p class="ui small">Press <em>Next layer</em>. The filter starts knowing almost nothing (a height of 0 ± 2, a slope of 0.3 ± 1) and learns the track from its measurements.</p>
  {/if}
  {#if note}<p class="ui small">{note}</p>{/if}
</Widget>

<style>
  .plot {
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .tk {
    font-size: 10.5px;
    fill: var(--ink-3);
  }
  .btns {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    padding: 0;
    margin: 0.5rem 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0 !important;
  }
  .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
  }
  .dot.ring {
    border: 2px solid;
    background: none;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.82rem;
  }
  th,
  td {
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    font-weight: 400;
    padding: 0.2rem 0.5rem;
    border-bottom: 1px solid var(--line);
  }
  th {
    color: var(--ink-2);
  }
  td {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .small {
    font-size: 0.84rem;
    color: var(--ink-2);
  }
</style>
