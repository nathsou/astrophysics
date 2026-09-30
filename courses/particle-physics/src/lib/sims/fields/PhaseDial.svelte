<!--
  Phase dial (Chapter 17): global and local phase symmetry on a grid of arrows.

    ::phase-dial{n="17.1" caption="…"}

  Each arrow is the phase of a complex field ψ on a site. The "energy" is the sum over neighbouring pairs of |ψᵢ − ψⱼ|².
  Turn every arrow by the same angle (a global U(1) symmetry): nothing changes. Turn each by its own angle (a local
  transformation): the energy jumps. Then add a link field A (a small dial on every edge, the connection) and the covariant
  difference |ψᵢ − e^{iAᵢⱼ}ψⱼ|² is invariant under the combined transformation ψᵢ → e^{iαᵢ}ψᵢ, Aᵢⱼ → Aᵢⱼ + αᵢ − αⱼ.
  The sum of A round a square (the plaquette) does not change either: it is the magnetic flux, the field strength.
  The numerics are in `hep/fields/gauge.ts`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { rng } from '$lib/hep/random';
  import {
    cloneField,
    cloneLinks,
    energyCovariant,
    energyNaive,
    fieldEnergy,
    makePhaseField,
    phaseAt,
    plaquettes,
    randomAngles,
    rotate,
    rotateGlobal,
    setUniformFlux,
    transformLinks,
    zeroLinks,
    type LinkField,
    type PhaseField,
  } from '$lib/hep/fields';
  import { fmt } from './canvas';

  let { n, caption, title = 'Turning arrows: global and local symmetry' }: { n?: string | number; caption?: string; title?: string } = $props();

  const L = 8;
  const S = 46; // cell size in SVG units
  const PAD = 24;
  const W = (L - 1) * S + 2 * PAD;

  let seed = $state(3);
  let withLinks = $state(false);
  let flux = $state(0);
  let alpha = $state(0); // degrees, the global rotation applied on top of `base`
  let showFlux = $state(true);
  let showNumbers = $state(false);

  let base = $state.raw<PhaseField>(makePhaseField(L, rng(3)));
  let links = $state.raw<LinkField>(zeroLinks(L));

  type Row = { id: number; action: string; naive: number; cov: number | null; flux: number | null; verdict: string[] };
  let ledger = $state<Row[]>([]);
  let rid = 0;
  let undoStack = $state.raw<{ base: PhaseField; links: LinkField; ledger: Row[] }[]>([]);
  function snapshot() {
    undoStack = [...undoStack.slice(-9), { base, links, ledger }];
  }
  function undo() {
    const s = undoStack[undoStack.length - 1];
    if (!s) return;
    base = s.base;
    links = s.links;
    ledger = s.ledger;
    alpha = 0;
    undoStack = undoStack.slice(0, -1);
  }

  const shown = $derived.by(() => {
    const f = cloneField(base);
    rotateGlobal(f, (alpha * Math.PI) / 180);
    return f;
  });
  const eNaive = $derived(energyNaive(shown));
  const eCov = $derived(energyCovariant(shown, links));
  const fl = $derived(plaquettes(links));
  const eField = $derived(fieldEnergy(links));

  /** Fold the slider into the state so that a local step starts from what is on the screen. */
  function commit(): PhaseField {
    const f = cloneField(base);
    rotateGlobal(f, (alpha * Math.PI) / 180);
    base = f;
    alpha = 0;
    return f;
  }

  function measure(f: PhaseField, A: LinkField) {
    return { naive: energyNaive(f), cov: energyCovariant(f, A), flux: fieldEnergy(A) };
  }
  function log(action: string, before: ReturnType<typeof measure>, after: ReturnType<typeof measure>) {
    const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
    const verdict: string[] = [];
    verdict.push(same(before.naive, after.naive) ? 'E unchanged' : 'E changed');
    if (withLinks) {
      verdict.push(same(before.cov, after.cov) ? 'E_A unchanged' : 'E_A changed');
      verdict.push(same(before.flux, after.flux) ? 'flux unchanged' : 'flux changed');
    }
    ledger = [...ledger.slice(-5), { id: rid++, action, naive: after.naive, cov: withLinks ? after.cov : null, flux: withLinks ? after.flux : null, verdict }];
  }

  function rotateAllBy(deg: number) {
    const before = measure(shown, links);
    alpha = ((alpha + deg + 540) % 360) - 180;
    log(`rotate all by ${deg}°`, before, measure(shown, links));
  }
  function logGlobalSlider() {
    // called when the slider is released
    const before = ledger.length ? { naive: ledger[ledger.length - 1]!.naive, cov: ledger[ledger.length - 1]!.cov ?? 0, flux: ledger[ledger.length - 1]!.flux ?? 0 } : measure(shown, links);
    log(`rotate all to α = ${alpha.toFixed(0)}°`, before, measure(shown, links));
  }
  function rotateEachPsiOnly() {
    snapshot();
    const f = commit();
    const before = measure(f, links);
    const next = cloneField(f);
    rotate(next, randomAngles(L, rng(seed).fork(rid)));
    base = next;
    seed += 1;
    log('rotate each arrow by its own random angle (ψ only)', before, measure(next, links));
  }
  function gaugeTransform() {
    snapshot();
    const f = commit();
    const before = measure(f, links);
    const next = cloneField(f);
    const a = randomAngles(L, rng(seed).fork(rid));
    rotate(next, a);
    const A = cloneLinks(links);
    transformLinks(A, a);
    base = next;
    links = A;
    seed += 1;
    log('gauge transformation: rotate each arrow and update A', before, measure(next, A));
  }
  function reset() {
    undoStack = [];
    base = makePhaseField(L, rng(seed));
    links = zeroLinks(L);
    if (flux !== 0) setFlux(flux);
    alpha = 0;
    ledger = [];
    seed += 1;
  }
  function setFlux(b: number) {
    const A = zeroLinks(L);
    setUniformFlux(A, b);
    links = A;
  }
  function onMode(v: boolean) {
    withLinks = v;
    if (!v) {
      links = zeroLinks(L);
      flux = 0;
    }
  }

  // drawing helpers
  const cx = (x: number) => PAD + x * S;
  const cy = (y: number) => PAD + y * S;
  const ang = (i: number) => -(phaseAt(shown, i) * 180) / Math.PI; // SVG rotates clockwise
  const hue = (i: number) => ((phaseAt(shown, i) * 180) / Math.PI + 360) % 360;
  function edgeCost(i: number, j: number, A: number): number {
    const c = Math.cos(A);
    const s = Math.sin(A);
    const jr = shown.re[j]! * c - shown.im[j]! * s;
    const ji = shown.re[j]! * s + shown.im[j]! * c;
    return ((shown.re[i]! - jr) ** 2 + (shown.im[i]! - ji) ** 2) / 4;
  }
  type Edge = { x1: number; y1: number; x2: number; y2: number; cost: number; A: number; mx: number; my: number };
  const edges = $derived.by(() => {
    const out: Edge[] = [];
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++) {
        const i = y * L + x;
        if (x < L - 1) out.push({ x1: cx(x), y1: cy(y), x2: cx(x + 1), y2: cy(y), cost: edgeCost(i, i + 1, withLinks ? links.ax[i]! : 0), A: links.ax[i]!, mx: cx(x + 0.5), my: cy(y) });
        if (y < L - 1) out.push({ x1: cx(x), y1: cy(y), x2: cx(x), y2: cy(y + 1), cost: edgeCost(i, i + L, withLinks ? links.ay[i]! : 0), A: links.ay[i]!, mx: cx(x), my: cy(y + 0.5) });
      }
    return out;
  });
  const fluxAt = (x: number, y: number) => fl[y * (L - 1) + x]!;
  const fluxFill = (p: number) => {
    const a = Math.min(1, Math.abs(p) / 1.2) * 55;
    return `color-mix(in srgb, var(${p >= 0 ? '--volt-pos' : '--volt-neg'}) ${a.toFixed(0)}%, transparent)`;
  };
  const rowsSymbols = (v: string) => (v.includes('unchanged') ? '✓ ' : '✗ ') + v;
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Step"
      size="sm"
      value={withLinks ? 'links' : 'matter'}
      onchange={(v) => onMode(v === 'links')}
      options={[
        { value: 'matter', label: '1  Arrows only' },
        { value: 'links', label: '2  Add the link field A' },
      ]}
    />
    <!-- the `change` event of the range input bubbles: record one ledger row when the slider is released -->
    <div class="alpha" role="group" aria-label="Global rotation" onchange={logGlobalSlider}>
      <Slider bind:value={alpha} min={-180} max={180} step={1} label="Global angle α (every arrow turns by α)" format={(v) => v.toFixed(0) + '°'} />
    </div>
    {#if withLinks}
      <Slider bind:value={flux} min={0} max={0.9} step={0.05} label="Magnetic field: flux B through each square" format={(v) => v.toFixed(2) + ' rad'} oninput={(v) => setFlux(v)} />
    {/if}
  {/snippet}

  <div class="layout">
    <div class="fig">
      <svg viewBox="0 0 {W} {W}" role="img" aria-label="An 8 by 8 grid of arrows, one per site, showing the phase of the field. {withLinks ? 'Small dials on the edges show the link field A, and the squares are shaded by the flux through them.' : 'Thicker lines between neighbours mean a larger energy cost.'}">
        <defs>
          <marker id="pd-ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="context-stroke" /></marker>
        </defs>
        <!-- plaquette flux -->
        {#if withLinks && showFlux}
          {#each Array(L - 1) as _, y}
            {#each Array(L - 1) as _, x}
              <rect x={cx(x)} y={cy(y)} width={S} height={S} fill={fluxFill(fluxAt(x, y))} />
              {#if showNumbers}
                <text x={cx(x + 0.5)} y={cy(y + 0.5) + 3.5} text-anchor="middle" class="num">{fluxAt(x, y).toFixed(2)}</text>
              {/if}
            {/each}
          {/each}
        {/if}
        <!-- edges: thickness = energy cost of that pair -->
        {#each edges as e}
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} class="edge" stroke-width={0.8 + 7 * e.cost} stroke-opacity={0.25 + 0.75 * Math.min(1, e.cost * 2)} />
        {/each}
        <!-- link field: a small dial on each edge showing the angle A -->
        {#if withLinks}
          {#each edges as e}
            <g transform="translate({e.mx},{e.my})">
              <circle r="6.5" class="dial" />
              <g class="rot" style="transform: rotate({-(e.A * 180) / Math.PI}deg)">
                <line x1="0" y1="0" x2="6" y2="0" class="dialhand" />
              </g>
            </g>
          {/each}
        {/if}
        <!-- arrows -->
        {#each Array(L) as _, y}
          {#each Array(L) as _, x}
            {@const i = y * L + x}
            <g transform="translate({cx(x)},{cy(y)})">
              <circle r="14.5" class="disc" style="fill: hsl({hue(i)} 70% 50% / 0.22); stroke: hsl({hue(i)} 65% 45%)" />
              <g class="rot" style="transform: rotate({ang(i)}deg)">
                <line x1="-9" y1="0" x2="9" y2="0" class="arrow" marker-end="url(#pd-ah)" />
              </g>
            </g>
          {/each}
        {/each}
      </svg>
      <ul class="key ui">
        <li><span class="k arr">→</span> arrow direction = phase of ψ at the site (its colour repeats the phase)</li>
        <li><span class="k line"></span> thicker line between two neighbours = larger {withLinks ? 'covariant' : ''} difference |ψᵢ − {withLinks ? 'e^{iA}' : ''}ψⱼ|²</li>
        {#if withLinks}
          <li><span class="k dial"></span> dial on an edge = link field A, the direction of its hand</li>
          <li><span class="k sq"></span> shading of a square = flux through it (warm positive, cool negative; numbers on request)</li>
        {/if}
      </ul>
    </div>

    <div class="side ui">
      <div class="meters" aria-live="polite">
        <div class="m">
          <span class="lab">E = Σ |ψᵢ − ψⱼ|²</span>
          <span class="val">{fmt(eNaive, 4)}</span>
          <span class="sub">ignores A</span>
        </div>
        {#if withLinks}
          <div class="m">
            <span class="lab">E<sub>A</sub> = Σ |ψᵢ − e<sup>iA</sup>ψⱼ|²</span>
            <span class="val">{fmt(eCov, 4)}</span>
            <span class="sub">covariant</span>
          </div>
          <div class="m">
            <span class="lab">Σ (1 − cos Φ)</span>
            <span class="val">{fmt(eField, 4)}</span>
            <span class="sub">energy in A itself</span>
          </div>
        {/if}
      </div>

      <div class="acts">
        <Button size="sm" onclick={() => rotateAllBy(60)}>Turn all arrows by 60°</Button>
        <Button size="sm" variant="primary" onclick={rotateEachPsiOnly}>{withLinks ? 'Turn each arrow by its own random angle, leaving A alone' : 'Turn each arrow by its own random angle'}</Button>
        {#if withLinks}
          <Button size="sm" variant="primary" onclick={gaugeTransform}>Gauge transformation: turn each arrow and update A</Button>
        {/if}
        <Button size="sm" variant="ghost" onclick={undo} disabled={undoStack.length === 0}>Undo</Button>
        <Button size="sm" variant="ghost" onclick={reset}>New field</Button>
      </div>
      {#if withLinks}
        <div class="tog">
          <Toggle bind:checked={showFlux} label="Shade squares by flux" />
          <Toggle bind:checked={showNumbers} label="Write the flux in each square" />
        </div>
      {/if}
    </div>
  </div>

  {#if ledger.length}
    <table class="ui ledger">
      <caption>What each action did (most recent last)</caption>
      <thead>
        <tr>
          <th scope="col">action</th>
          <th scope="col">E</th>
          {#if withLinks}<th scope="col">E<sub>A</sub></th><th scope="col">Σ(1−cos Φ)</th>{/if}
          <th scope="col">result</th>
        </tr>
      </thead>
      <tbody>
        {#each ledger as r (r.id)}
          <tr>
            <td>{r.action}</td>
            <td class="n">{fmt(r.naive, 4)}</td>
            {#if withLinks}<td class="n">{r.cov === null ? '' : fmt(r.cov, 4)}</td><td class="n">{r.flux === null ? '' : fmt(r.flux, 4)}</td>{/if}
            <td>{#each r.verdict as v}<span class="v" class:same={v.includes('unchanged')}>{rowsSymbols(v)}</span>{/each}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <div class="text ui">
    {#if !withLinks}
      <p>
        <strong>Try this.</strong> Turn every arrow by the same angle (the slider, or the button): the picture rotates and the energy does not move, because it depends only on the <em>differences</em> between neighbours. That is a global symmetry. Now turn each arrow by its own random angle: the energy jumps, because the differences have changed. The same rule is no longer invariant under <em>local</em> changes of phase.
      </p>
    {:else}
      <p>
        <strong>The link field is the repair.</strong> With a dial A on each edge, the difference that costs energy is the <em>covariant</em> one, |ψᵢ − e<sup>iAᵢⱼ</sup>ψⱼ|². Turn each arrow by its own angle αᵢ <em>and</em> shift each dial by αᵢ − αⱼ (the gauge transformation button): every arrow and every dial changes, yet E<sub>A</sub>, and the flux through every square (the sum of A round it), do not. Turn the arrows only, leaving A behind, and E<sub>A</sub> jumps. The flux is what the dials can tell you that no choice of local angles can hide: it is the magnetic field, and the link field A is the photon. The price of demanding local symmetry is that a new field must exist.
      </p>
    {/if}
    <details>
      <summary>SU(2) and SU(3): the same idea with matrices</summary>
      <p>
        Replace the single phase e<sup>iα</sup> by a 2 × 2 (SU(2)) or 3 × 3 (SU(3)) unitary matrix of determinant 1, and ψ by a vector of two or three components. The link field is then a matrix on every edge, built from 3 (SU(2)) or 8 (SU(3)) real numbers: the weak-force field of Chapter 25 and the eight gluons of Chapter 18, where U(1) needed just one, the photon. Because matrices do not commute in general, going round a square no longer adds numbers: the field strength gets an extra term in which the field interacts with itself, so W bosons carry weak charge and gluons carry colour, whereas the photon is electrically neutral.
      </p>
    </details>
  </div>
</Widget>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-width: 480px;
    display: block;
    margin: 0 auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .alpha {
    min-width: 12rem;
  }
  .edge {
    stroke: var(--sig-high);
    stroke-linecap: round;
  }
  .disc {
    stroke-width: 1.2;
  }
  .arrow {
    stroke: var(--fg);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .rot {
    transition: transform 0.35s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .rot {
      transition: none;
    }
  }
  .dial {
    fill: var(--panel);
    stroke: var(--ink-3, var(--mute));
    stroke-width: 1;
  }
  .dialhand {
    stroke: var(--series-4);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .num {
    font-size: 9px;
    fill: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .key {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    font-size: 0.76rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .key li {
    margin: 0 !important;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .k {
    flex: none;
    width: 1.4rem;
    text-align: center;
    display: inline-block;
  }
  .k.line {
    border-top: 4px solid var(--sig-high);
    height: 0;
  }
  .k.dial {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 1px solid var(--mute);
    margin: 0 0.3rem;
    background: radial-gradient(circle at 70% 40%, var(--series-4) 0 2px, transparent 2.5px);
  }
  .k.sq {
    width: 13px;
    height: 13px;
    margin: 0 0.3rem;
    background: linear-gradient(90deg, color-mix(in srgb, var(--volt-neg) 55%, transparent), color-mix(in srgb, var(--volt-pos) 55%, transparent));
    border: 1px solid var(--line-strong);
  }
  .meters {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .m {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'lab val' 'sub val';
    align-items: center;
    gap: 0 0.6rem;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
  }
  .lab {
    grid-area: lab;
    font-size: 0.82rem;
    color: var(--ink-2);
    text-transform: none;
  }
  .sub {
    grid-area: sub;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .val {
    grid-area: val;
    font-family: var(--font-mono);
    font-size: 1.15rem;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: stretch;
  }
  .acts :global(.btn) {
    white-space: normal;
    text-align: left;
    justify-content: flex-start;
    line-height: 1.25;
  }
  .tog {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.7rem;
  }
  .ledger {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 0.8rem;
  }
  .ledger caption {
    text-align: left;
    color: var(--mute);
    padding-bottom: 0.2rem;
  }
  .ledger th,
  .ledger td {
    text-align: left;
    padding: 0.25rem 0.4rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
    vertical-align: top;
  }
  .ledger th {
    color: var(--mute);
    font-weight: 500;
  }
  .ledger td.n {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .v {
    display: inline-block;
    margin-right: 0.6rem;
    white-space: nowrap;
    color: var(--bad);
    font-weight: 600;
  }
  .v.same {
    color: var(--ok);
  }
  .text {
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--ink-2);
    margin-top: 0.8rem;
  }
  .text p {
    margin: 0.3rem 0;
  }
  details {
    margin-top: 0.5rem;
  }
  summary {
    cursor: pointer;
    color: var(--fg);
    font-weight: 500;
  }
  summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
