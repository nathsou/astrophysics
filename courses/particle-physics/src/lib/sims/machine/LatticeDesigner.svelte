<!--
  The lattice designer: build a cell from dipoles, quadrupoles, drifts (and a sextupole), repeat it round a ring, and see whether a beam
  survives. The one-turn matrix gives the stability condition |Tr M| < 2, the Twiss parameters β(s), and the tune; five particles on
  nested ellipses are then tracked turn by turn through the ring (with the reader's `machine.trackThroughLattice` if installed), and the
  tune measured from an FFT of their positions is compared with the matrix.

    ::lattice-designer{preset="fodo" n="20.5" caption="…"}    preset: fodo | broken | lhc | sext
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { phaseSpaceEllipse, resonanceDistance, resonanceLines } from '$lib/hep/machine';
  import { KIND_LABEL, KIND_SHORT, PRESETS, analyse, frac, makeRow, presetRows, toElements, trackFive, type Row, type RowKind } from './latticeModel';

  let { preset = 'fodo', n, caption }: { preset?: string; n?: string | number; caption?: string } = $props();

  const initial = presetRows(preset);
  let presetKey = $state(PRESETS.some((p) => p.key === preset) ? preset : 'fodo');
  let rows = $state<Row[]>(initial.rows);
  let nCells = $state(initial.nCells);
  let turns = $state(200);

  const cell = $derived(toElements(rows));
  const a = $derived(analyse(cell, nCells));
  const tr = $derived(trackFive(cell, nCells, a, turns));
  const note = $derived(PRESETS.find((p) => p.key === presetKey)?.note ?? 'Your own lattice.');

  function load(key: string) {
    presetKey = key;
    const p = presetRows(key);
    rows = p.rows;
    nCells = p.nCells;
  }
  function add(kind: RowKind) {
    presetKey = 'custom';
    const defaults: Record<RowKind, [number, number]> = { drift: [1, 0], dipole: [2, (2 * Math.PI * 1000) / (nCells * 2)], qf: [0.5, 0.4], qd: [0.5, 0.4], sext: [0, 4] };
    rows.push(makeRow(kind, ...defaults[kind]));
  }
  function remove(i: number) { presetKey = 'custom'; rows.splice(i, 1); }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    presetKey = 'custom';
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }
  const touch = () => (presetKey = 'custom');

  // ── β(s) plot ──
  const W = 560, H = 250, PL = 50, PR = 12, PT = 10, STRIP = 34, PB = 34 + STRIP;
  const sMax = $derived(Math.max(a.length, 1e-6));
  const betaTop = $derived.by(() => {
    const m = Math.max(a.x.betaMax || 0, a.y.betaMax || 0, 1);
    const step = 10 ** Math.floor(Math.log10(m));
    return Math.ceil(m / step / 1) * step;
  });
  const sx = (s: number) => PL + (s / sMax) * (W - PL - PR);
  const sy = (b: number) => PT + (1 - b / betaTop) * (H - PT - PB);
  const curve = (t: { s: number[]; beta: number[] } | null) => (t ? t.s.map((s, i) => `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(t.beta[i]!).toFixed(1)}`).join('') : '');
  const xCurve = $derived(curve(a.x.table));
  const yCurve = $derived(curve(a.y.table));
  const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * betaTop));
  const xTicksS = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * sMax));

  interface Glyph { x0: number; x1: number; kind: RowKind; i: number }
  const glyphs = $derived.by(() => {
    const out: Glyph[] = [];
    let s = 0;
    rows.forEach((r, i) => {
      const L = r.kind === 'sext' ? 0 : Math.max(0, Number(r.length) || 0);
      out.push({ x0: s, x1: s + L, kind: r.kind, i });
      s += L;
    });
    return out;
  });

  // ── phase-space plot ──
  const PW = 330, PH = 300, PPL = 46, PPR = 12, PPT = 12, PPB = 40;
  const xr = $derived(Math.max(1e-6, tr.maxX * 1.15) * 1e3);
  const pr = $derived(Math.max(1e-9, tr.maxXp * 1.15) * 1e3);
  const px = (v: number) => PPL + ((v * 1e3) / xr / 2 + 0.5) * (PW - PPL - PPR);
  const py = (v: number) => PPT + (0.5 - (v * 1e3) / pr / 2) * (PH - PPT - PPB);
  const dots = $derived(tr.particles.map((p) => p.x.map((x, i) => `M${px(x).toFixed(1)} ${py(p.xp[i]!).toFixed(1)}h0.01`).join('')));
  const ellipse = (k: number) => {
    if (!a.x.stable) return '';
    const big = 8e-3 * Math.sqrt(k / 5) ** 2; // amplitude-squared scaling
    void big;
    const eps0 = (8e-3 * 8e-3) / (5 * a.x.twiss.beta);
    return phaseSpaceEllipse(a.x.twiss, k * eps0, 90).map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.xp).toFixed(1)}`).join('');
  };
  const ell1 = $derived(ellipse(1));
  const ell5 = $derived(ellipse(5));
  const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
  const lostCount = $derived(tr.particles.filter((p) => p.lost).length);

  // ── tune diagram ──
  const TD = 190;
  const lines = resonanceLines(4);
  function clip(n: number, m: number, p: number): [number, number, number, number] | null {
    const pts: [number, number][] = [];
    const eps = 1e-9;
    if (m !== 0) for (const x of [0, 1]) { const y = (p - n * x) / m; if (y >= -eps && y <= 1 + eps) pts.push([x, y]); }
    if (n !== 0) for (const y of [0, 1]) { const x = (p - m * y) / n; if (x >= -eps && x <= 1 + eps) pts.push([x, y]); }
    const uniq = pts.filter((q, i) => pts.findIndex((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1e-6) === i);
    return uniq.length >= 2 ? [uniq[0]![0], uniq[0]![1], uniq[1]![0], uniq[1]![1]] : null;
  }
  const segs = lines.map((l) => ({ l, c: clip(l.n, l.m, l.p) })).filter((s) => s.c);
  const td = (v: number) => 24 + v * (TD - 34);
  const tdy = (v: number) => TD - 26 - v * (TD - 34);
  const nearest = $derived(a.x.stable && a.y.stable ? resonanceDistance(a.x.tune, a.y.tune, 4) : null);

  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const deg = (r: number) => (r * 180) / Math.PI;
  const bendDeg = $derived(deg(a.bend));
  const closes = $derived(Math.abs(bendDeg - 360) < 0.5);
  const stableBoth = $derived(a.x.stable && a.y.stable);
</script>

<Widget title="Lattice designer" subtitle="Build a cell, repeat it round a ring, and track protons turn by turn" {n} {caption} kind="Build" onreset={() => load(presetKey === 'custom' ? 'fodo' : presetKey)}>
  {#snippet controls()}
    <Segmented
      label="Preset lattice"
      value={presetKey}
      options={[...PRESETS.map((p) => ({ value: p.key, label: p.label })), ...(presetKey === 'custom' ? [{ value: 'custom', label: 'Your lattice' }] : [])]}
      onchange={(k: string) => k !== 'custom' && load(k)}
    />
    <Slider bind:value={nCells} min={1} max={210} step={1} label="Cells in the ring" format={(v) => v.toFixed(0)} />
    <Slider bind:value={turns} min={20} max={600} step={10} label="Turns tracked" format={(v) => v.toFixed(0)} />
  {/snippet}

  <p class="note ui">{note}</p>

  <div class="stack">
    <section aria-label="Elements of the cell" class="editor">
      <h5 class="ui">One cell ({f(a.length, 1)} m, in beam order)</h5>
      <ol class="rows">
        {#each rows as r, i (r.id)}
          <li class="row {r.kind}">
            <span class="glyph" aria-hidden="true">{KIND_SHORT[r.kind]}</span>
            <span class="name">{KIND_LABEL[r.kind]}</span>
            {#if r.kind !== 'sext'}
              <label class="fld"><span>length [m]</span><input type="number" min="0" step="0.1" bind:value={r.length} oninput={touch} aria-label="{KIND_LABEL[r.kind]} {i + 1}, length in metres" /></label>
            {/if}
            {#if r.kind !== 'drift'}
              <label class="fld">
                <span>{r.kind === 'dipole' ? 'bend [mrad]' : r.kind === 'sext' ? 'k₂l [m⁻²]' : 'k [m⁻²]'}</span>
                <input type="number" step={r.kind === 'dipole' ? 1 : 0.05} bind:value={r.strength} oninput={touch} aria-label="{KIND_LABEL[r.kind]} {i + 1}, {r.kind === 'dipole' ? 'bend angle in milliradians' : r.kind === 'sext' ? 'integrated sextupole strength' : 'quadrupole strength k'}" />
              </label>
            {/if}
            <span class="btns">
              <button type="button" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move element {i + 1} earlier">↑</button>
              <button type="button" onclick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move element {i + 1} later">↓</button>
              <button type="button" onclick={() => remove(i)} aria-label="Remove element {i + 1}">✕</button>
            </span>
          </li>
        {/each}
      </ol>
      <div class="adds ui" role="group" aria-label="Add an element">
        <Button size="sm" onclick={() => add('dipole')}>+ Dipole</Button>
        <Button size="sm" onclick={() => add('qf')}>+ QF</Button>
        <Button size="sm" onclick={() => add('qd')}>+ QD</Button>
        <Button size="sm" onclick={() => add('drift')}>+ Drift</Button>
        <Button size="sm" onclick={() => add('sext')}>+ Sextupole</Button>
      </div>
    </section>

    <section aria-label="Stability and optics" class="optics">
      <div class="verdict ui" class:ok={stableBoth} class:bad={!stableBoth} role="status" aria-live="polite">
        <strong>{stableBoth ? '✓ Stable in both planes' : a.x.stable || a.y.stable ? `✗ Unstable in ${a.x.stable ? 'y' : 'x'}` : '✗ Unstable in both planes'}</strong>
        <span>|Tr M| must be below 2: x {f(Math.abs(a.x.trace), 3)}, y {f(Math.abs(a.y.trace), 3)}</span>
      </div>
      <div class="scroll"><table class="ui">
        <thead>
          <tr><th>plane</th><th>Tr M</th><th>μ per cell</th><th>tune Q</th><th>β<sub>max</sub> [m]</th><th>β<sub>min</sub> [m]</th></tr>
        </thead>
        <tbody>
          {#each [a.x, a.y] as p}
            <tr class:unstable={!p.stable}>
              <th scope="row">{p.plane}</th>
              <td>{f(p.trace, 3)}</td>
              <td>{p.stable ? f(deg(p.twiss.mu), 1) + '°' : '–'}</td>
              <td>{p.stable ? f(p.tune, 3) : '–'}</td>
              <td>{f(p.betaMax, 1)}</td>
              <td>{f(p.betaMin, 1)}</td>
            </tr>
          {/each}
        </tbody>
      </table></div>
      <p class="small ui">
        Total bend {f(bendDeg, 1)}° {a.bend === 0 ? '(a beam line)' : closes ? '✓ the ring closes' : '✗ a ring needs 360°'} · natural chromaticity ξ<sub>x</sub> {Number.isFinite(a.chromX) ? f(a.chromX, 1) : '–'}
      </p>
    </section>
  </div>

  <h5 class="ui">Beta function β(s) over one cell</h5>
  <svg viewBox="0 0 {W} {H}" class="plot" role="img" aria-label="Beta functions in x and y along one cell. Horizontal beta maximum {f(a.x.betaMax, 1)} metres, vertical {f(a.y.betaMax, 1)} metres.">
    {#each yTicks as t}
      <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} class="grid" />
      <text x={PL - 6} y={sy(t)} dy="0.32em" text-anchor="end" class="tick">{t.toFixed(0)}</text>
    {/each}
    {#each xTicksS as t}
      <text x={sx(t)} y={H - PB + 14} text-anchor="middle" class="tick">{t.toFixed(t < 10 ? 1 : 0)}</text>
    {/each}
    <text x={(PL + W - PR) / 2} y={H - PB + 28} text-anchor="middle" class="axlbl">position along the cell, s [m]</text>
    <text transform="translate(12 {(PT + H - PB) / 2}) rotate(-90)" text-anchor="middle" class="axlbl">β [m]</text>
    {#if a.x.stable}<path d={xCurve} class="bx" />{/if}
    {#if a.y.stable}<path d={yCurve} class="by" />{/if}
    {#if !stableBoth && !a.x.stable && !a.y.stable}<text x={W / 2} y={PT + 60} text-anchor="middle" class="warn">No periodic solution: the beam is lost after a few turns</text>{/if}
    <!-- element strip -->
    {#each glyphs as g}
      {@const x0 = sx(g.x0)}
      {@const w = Math.max(1.5, sx(g.x1) - sx(g.x0))}
      {@const y0 = H - STRIP - 2}
      {#if g.kind === 'dipole'}
        <rect x={x0} y={y0 + 10} width={w} height="14" class="gl-dip"><title>Dipole {g.i + 1}</title></rect>
      {:else if g.kind === 'qf'}
        <rect x={x0} y={y0 + 1} width={w} height="14" class="gl-q"><title>Focusing quadrupole {g.i + 1}</title></rect>
        <text x={x0 + w / 2} y={y0 + 12} text-anchor="middle" class="gl-t">F</text>
      {:else if g.kind === 'qd'}
        <rect x={x0} y={y0 + 19} width={w} height="14" class="gl-q d"><title>Defocusing quadrupole {g.i + 1}</title></rect>
        <text x={x0 + w / 2} y={y0 + 30} text-anchor="middle" class="gl-t">D</text>
      {:else if g.kind === 'sext'}
        <path d="M{x0} {y0 + 11}l4 -5l4 5l-4 5z" class="gl-s"><title>Sextupole {g.i + 1}</title></path>
      {:else}
        <line x1={x0} x2={x0 + w} y1={y0 + 17} y2={y0 + 17} class="gl-drift" />
      {/if}
    {/each}
  </svg>
  <ul class="legend ui" aria-hidden="true">
    <li><span class="sw" style="background:var(--series-1)"></span> β<sub>x</sub></li>
    <li><span class="sw dash"></span> β<sub>y</sub></li>
    <li>strip: F = focusing quad (above), D = defocusing (below), filled box = dipole, ◆ = sextupole</li>
  </ul>

  <div class="layout two">
    <div>
      <h5 class="ui">Phase space x–x′ at the start of the cell, turn by turn</h5>
      <svg viewBox="0 0 {PW} {PH}" class="plot" role="img" aria-label="Horizontal phase space. {tr.particles.length} particles tracked for {turns} turns. {lostCount} lost.">
        <line x1={px(0)} x2={px(0)} y1={PPT} y2={PH - PPB} class="grid" />
        <line x1={PPL} x2={PW - PPR} y1={py(0)} y2={py(0)} class="grid" />
        {#each [-0.5, 0.5] as t}
          <text x={px(0) + (t * (PW - PPL - PPR))} y={PH - PPB + 15} text-anchor="middle" class="tick">{(t * xr * 2).toFixed(1)}</text>
          <text x={PPL - 6} y={py(0) - t * (PH - PPT - PPB)} dy="0.32em" text-anchor="end" class="tick">{(t * pr * 2).toFixed(2)}</text>
        {/each}
        <text x={(PPL + PW - PPR) / 2} y={PH - 6} text-anchor="middle" class="axlbl">x [mm]</text>
        <text transform="translate(12 {(PPT + PH - PPB) / 2}) rotate(-90)" text-anchor="middle" class="axlbl">x′ [mrad]</text>
        {#if a.x.stable}<path d={ell1} class="ell" /><path d={ell5} class="ell" />{/if}
        {#each dots as d, i}<path {d} stroke={SERIES[i % 5]} class="dots" />{/each}
      </svg>
      <p class="small ui" role="status" aria-live="polite">
        {#if !a.x.stable}
          Unstable: shown here is the motion after each cell (30 cells) from 1, 2 and 3 mm: the amplitude grows exponentially{#if lostCount} and {lostCount} of {tr.particles.length} leave the 1 m aperture{/if}.
        {:else}
          Tune from the FFT of x and x′: <strong>{f(tr.measuredTune, 4)}</strong> · from the matrix: {f(frac(a.x.tune), 4)}.
          {#if lostCount}<strong>{lostCount} of 5 particles were lost</strong> (beyond 1 m): the nonlinear kick throws large amplitudes out.{/if}
          Dashed: the linear ellipses. With a sextupole the tune depends on amplitude, so the measured tune can differ a little from the matrix value.
        {/if}
      </p>
    </div>
    <div>
      <h5 class="ui">Working point and resonances</h5>
      <svg viewBox="0 0 {TD} {TD}" class="plot tdsvg" role="img" aria-label="Tune diagram with resonance lines up to fourth order. The working point is at Qx {f(frac(a.x.tune), 3)}, Qy {f(frac(a.y.tune), 3)}.">
        <rect x={td(0)} y={tdy(1)} width={td(1) - td(0)} height={tdy(0) - tdy(1)} class="frame" />
        {#each segs as s}
          <line x1={td(s.c![0])} y1={tdy(s.c![1])} x2={td(s.c![2])} y2={tdy(s.c![3])} class="res o{s.l.order}" />
        {/each}
        {#if stableBoth}
          <circle cx={td(frac(a.x.tune))} cy={tdy(frac(a.y.tune))} r="5.5" class="wp" />
          <path d="M{td(frac(a.x.tune)) - 9} {tdy(frac(a.y.tune))}h18M{td(frac(a.x.tune))} {tdy(frac(a.y.tune)) - 9}v18" class="wpx" />
        {/if}
        <text x={td(0.5)} y={TD - 4} text-anchor="middle" class="axlbl">Q<tspan baseline-shift="sub" font-size="8">x</tspan> (fractional)</text>
        <text transform="translate(9 {tdy(0.5)}) rotate(-90)" text-anchor="middle" class="axlbl">Q<tspan baseline-shift="sub" font-size="8">y</tspan></text>
        <text x={td(0)} y={tdy(0) + 12} text-anchor="middle" class="tick">0</text>
        <text x={td(1)} y={tdy(0) + 12} text-anchor="middle" class="tick">1</text>
        <text x={td(0) - 4} y={tdy(1)} text-anchor="end" dy="0.32em" class="tick">1</text>
      </svg>
      <p class="small ui">
        {#if nearest?.line}
          Nearest resonance: {nearest.line.n}Q<sub>x</sub>{nearest.line.m >= 0 ? ' + ' : ' − '}{Math.abs(nearest.line.m)}Q<sub>y</sub> = {nearest.line.p} (order {nearest.line.order}), {f(nearest.distance, 3)} away. Lines: solid thick = order 1–2, dashed = 3, dotted = 4.
        {:else}No working point while the lattice is unstable.{/if}
      </p>
    </div>
  </div>
</Widget>

<style>
  .note {
    margin: 0 0 0.7rem;
    color: var(--ink-2);
    font-size: 0.86rem;
  }
  h5 {
    margin: 0.9rem 0 0.35rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .scroll {
    overflow-x: auto;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 1.1rem;
    align-items: start;
  }
  .layout.two {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  }
  @media (max-width: 760px) {
    .layout,
    .layout.two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr));
    gap: 0.3rem 0.5rem;
    max-height: 16rem;
    overflow: auto;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.6rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line);
    border-left-width: 4px;
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.8rem;
  }
  .row.qf { border-left-color: var(--series-1); }
  .row.qd { border-left-color: var(--series-2); }
  .row.dipole { border-left-color: var(--fg); }
  .row.sext { border-left-color: var(--series-4); }
  .row.drift { border-left-color: var(--line-strong); }
  .glyph {
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 4px;
    background: var(--surface-3);
    font-family: var(--font-mono);
    font-weight: 700;
  }
  .name {
    flex: 1 1 5.5rem;
    font-weight: 600;
    font-size: 0.76rem;
    line-height: 1.2;
  }
  .fld {
    display: inline-flex;
    flex-direction: column;
    font-size: 0.68rem;
    color: var(--mute);
  }
  .fld input {
    width: 4.6rem;
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.15rem 0.3rem;
    color: var(--fg);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
  }
  .btns {
    display: inline-flex;
    gap: 0.15rem;
  }
  .btns button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 4px;
    width: 1.7rem;
    height: 1.7rem;
    cursor: pointer;
  }
  .btns button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .btns button:focus-visible,
  .fld input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .adds {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .verdict {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    border-left: 4px solid var(--line-strong);
    margin-bottom: 0.6rem;
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .verdict span {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 0.2rem 0.45rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
    white-space: nowrap;
  }
  thead th {
    color: var(--mute);
    font-weight: 600;
    border-bottom: 1px solid var(--line-strong);
  }
  tbody th {
    text-align: left;
    font-family: var(--font-mono);
  }
  tr.unstable td {
    color: var(--bad);
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
  svg.plot {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .tdsvg {
    max-width: 260px;
  }
  .grid {
    stroke: var(--grid);
  }
  .tick {
    fill: var(--ink-3);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .axlbl {
    fill: var(--ink-2);
    font-size: 11px;
  }
  .bx {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2.2;
  }
  .by {
    fill: none;
    stroke: var(--series-2);
    stroke-width: 2.2;
    stroke-dasharray: 6 4;
  }
  .warn {
    fill: var(--bad);
    font-size: 13px;
    font-weight: 600;
  }
  .gl-dip {
    fill: var(--fg);
    opacity: 0.75;
  }
  .gl-q {
    fill: var(--series-1);
  }
  .gl-q.d {
    fill: var(--series-2);
  }
  .gl-t {
    fill: var(--panel);
    font-size: 10px;
    font-weight: 700;
  }
  .gl-s {
    fill: var(--series-4);
  }
  .gl-drift {
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .dots {
    fill: none;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .ell {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .frame {
    fill: none;
    stroke: var(--axis);
  }
  .res {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .res.o1,
  .res.o2 {
    stroke-width: 1.6;
    stroke: var(--ink-3);
  }
  .res.o3 {
    stroke-dasharray: 5 3;
  }
  .res.o4 {
    stroke-dasharray: 1.5 3;
    opacity: 0.8;
  }
  .wp {
    fill: var(--sig-high);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .wpx {
    stroke: var(--fg);
    stroke-width: 1.3;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.1rem;
    list-style: none;
    margin: 0.35rem 0 0;
    padding: 0;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 1.4em;
    height: 3px;
    vertical-align: middle;
    border-radius: 2px;
  }
  .sw.dash {
    background: repeating-linear-gradient(90deg, var(--series-2) 0 5px, transparent 5px 8px);
  }
</style>
