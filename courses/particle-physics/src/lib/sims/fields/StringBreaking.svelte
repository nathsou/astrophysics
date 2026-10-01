<!--
  String breaking (Chapter 18): pull a quark and an antiquark apart and watch the colour flux tube between them break.

    ::string-breaking{n="18.1" caption="…"}

  A CARTOON: one space dimension, a flux tube of constant energy per unit length κ (about 1 GeV/fm), quarks that feel a constant
  force κ towards the quark they are joined to, and a break probability that switches on once the stored energy could pay for a
  new quark–antiquark pair. Energy is conserved exactly and shown live. Tab 2 sets the constant force of the strong interaction
  against the falling Coulomb force of electric charges; tab 3 fragments a whole quark–antiquark pair into a jet of mesons and
  shows the rapidity plateau. It does not use `hep/hadronise`; the numerics are in `hep/fields/string.ts`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { particle } from '$lib/hep/particles';
  import {
    StringModel,
    defaultStringParams,
    cornellPotential,
    cornellForce,
    coulombForce,
    thresholdLength,
    KAPPA_GEV_FM,
    ALPHA_S_CORNELL,
    fragment,
    rapidityPlateau,
    defaultFrag,
    mesonId,
    type Budget,
    type Flavour,
    type Parton,
    type BreakEvent,
  } from '$lib/hep/fields';
  import { HBARC_GEV_FM } from '$lib/hep/fields/constants';
  import { fmt, pow10, prefersReducedMotion, watchVisible } from './canvas';

  let {
    n,
    caption,
    title = 'Pulling a quark pair apart: the string breaks',
  }: { n?: string | number; caption?: string; title?: string } = $props();

  let tab = $state<'pull' | 'force' | 'jet'>('pull');
  let target = $state(0.3);
  let seed = $state(1);
  let playing = $state(true);
  let reduced = $state(false);
  let sqrtS = $state(30);
  let jetSeed = $state(1);

  const params = defaultStringParams();
  const mQ = params.mass.u;
  const kappa = KAPPA_GEV_FM;
  const Z_MAX = 4.6; // fm shown each side of the centre
  const VW = 360;
  const VH = 168;
  const zx = (z: number) => VW / 2 + (z / Z_MAX) * (VW / 2 - 14);

  let sm = new StringModel(params, rng(1), 0.3);
  let snap = $state.raw<{ partons: Parton[]; pieces: { q: number; qbar: number }[]; masses: (number | null)[] }>({ partons: [], pieces: [], masses: [] });
  let bud = $state<Budget>({ input: 0, kinetic: 0, string: 0, created: 0, residual: 0 });
  let breaks = $state.raw<BreakEvent[]>([]);
  let flash = $state.raw<{ z: number; t: number; id: number }[]>([]);
  let trace = $state.raw<{ r: number; e: number }[]>([]);
  let simT = $state(0);
  let host = $state<HTMLDivElement>();
  let onScreen = true;
  let raf = 0;
  let lastT = 0;
  let lastTrace = 0;
  let lastSnap = 0;
  let flashId = 0;

  function reset(newSeed = false) {
    if (newSeed) seed += 1;
    sm = new StringModel(params, rng(seed), 0.3);
    target = 0.3;
    trace = [];
    flash = [];
    breaks = [];
    takeSnapshot();
  }
  function takeSnapshot() {
    snap = {
      partons: sm.partons.map((p) => ({ ...p })),
      pieces: sm.pieces.map((p) => ({ ...p })),
      masses: sm.pieces.map((pc) => sm.pieceMass(pc)),
    };
    bud = sm.budget();
    simT = sm.t;
    breaks = sm.breaks.slice(-6);
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!host || !onScreen || host.offsetParent === null) {
      lastT = now;
      return;
    }
    const dtReal = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (tab === 'pull') {
      if (playing) {
        sm.setSeparation(target);
        const ev = sm.advance(dtReal * 2.2); // 2.2 fm/c per second of real time
        for (const b of ev) flash = [...flash.filter((f) => now - f.t < 700), { z: b.z, t: now, id: flashId++ }];
        if (sm.t - lastTrace > 0.04) {
          lastTrace = sm.t;
          const b = sm.budget();
          trace = [...trace.slice(-900), { r: sm.separation(), e: b.string }];
        }
      }
      if (now - lastSnap > 40) {
        lastSnap = now;
        takeSnapshot();
        flash = flash.filter((f) => now - f.t < 700);
      }
    }
  }
  onMount(() => {
    reduced = prefersReducedMotion();
    if (reduced) playing = false;
    const off = watchVisible(host!, (v) => (onScreen = v));
    takeSnapshot();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  });
  function stepOnce() {
    sm.setSeparation(target);
    sm.advance(0.5);
    takeSnapshot();
  }

  // ── drawing helpers ──
  const sup = (f: Flavour, anti: boolean) => f + (anti ? '̄' : '');
  const partonById = $derived(new Map(snap.partons.map((p) => [p.id, p])));
  const pieceLabel = (i: number) => {
    const pc = snap.pieces[i]!;
    const q = partonById.get(pc.q)!;
    const b = partonById.get(pc.qbar)!;
    if (!q || !b) return '';
    const id = mesonId(q.flavour, b.flavour);
    return particle(id).symbol;
  };
  const free = (i: number) => {
    const pc = snap.pieces[i]!;
    return !partonById.get(pc.q)?.held && !partonById.get(pc.qbar)?.held;
  };

  // drag on the picture: the distance of the pointer from the centre sets the separation of the ends
  let dragging = false;
  function pdown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    pset(e);
  }
  function pmove(e: PointerEvent) {
    if (dragging) pset(e);
  }
  function pset(e: PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VW;
    const z = ((x - VW / 2) / (VW / 2 - 14)) * Z_MAX;
    target = Math.max(0.2, Math.min(2 * Z_MAX - 0.4, 2 * Math.abs(z)));
    if (!playing) playing = true;
  }
  function pkey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.5 : 0.1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = Math.min(2 * Z_MAX - 0.4, target + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = Math.max(0.2, target - step);
    else return;
    e.preventDefault();
  }

  // ── potential and forces ──
  const rs = Array.from({ length: 150 }, (_, i) => 0.06 + (i / 149) * 5.94);
  const rsLog = Array.from({ length: 160 }, (_, i) => 0.05 * 10 ** ((i / 159) * Math.log10(10 / 0.05)));
  const lineOf = (xs: number[], f: (x: number) => number, sx: (v: number) => number, sy: (v: number) => number, clip?: [number, number]) =>
    xs
      .map((x) => ({ x, y: f(x) }))
      .filter((p) => !clip || (p.y >= clip[0] && p.y <= clip[1]))
      .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
      .join('');
  const rCross = thresholdLength(mQ);
  const sepNow = $derived(snap.partons.length >= 2 ? Math.abs(snap.partons[1]!.z - snap.partons[0]!.z) : 0.3);

  // ── the jet tab ──
  const jetEvent = $derived(fragment(rng(jetSeed * 7919 + Math.round(sqrtS)), defaultFrag(sqrtS)));
  const plateau = $derived(rapidityPlateau(rng(2024), defaultFrag(sqrtS), 250, Math.log(sqrtS / 0.3) + 1.5, 28));
  const yMaxJet = $derived(Math.log(sqrtS / 0.3) + 1.5);
  const plateauMean = $derived.by(() => {
    const c = plateau.dNdy.filter((_, i) => Math.abs((plateau.edges[i]! + plateau.edges[i + 1]!) / 2) < 1.5);
    return c.length ? c.reduce((s, v) => s + v, 0) / c.length : NaN;
  });
  const jetSums = $derived({
    E: jetEvent.hadrons.reduce((s, h) => s + h.p.E, 0),
    pz: jetEvent.hadrons.reduce((s, h) => s + h.p.pz, 0),
    px: jetEvent.hadrons.reduce((s, h) => s + h.p.px, 0),
    py: jetEvent.hadrons.reduce((s, h) => s + h.p.py, 0),
    q: jetEvent.hadrons.reduce((s, h) => s + h.charge3, 0) / 3,
  });
  const sortedHadrons = $derived([...jetEvent.hadrons].sort((a, b) => b.y - a.y));
  const sym = (pdg: number) => particle(pdg).symbol;
  const totalBar = $derived(Math.max(bud.input, 1e-9));
</script>

<Widget {title} {n} caption={caption ?? 'A cartoon of the physics: one space dimension, a constant string tension of about 1 GeV/fm, no gluon radiation and pseudoscalar mesons only. The energy accounting is exact within the cartoon.'} kind="Simulation">
  {#snippet controls()}
    <Segmented
      label="Which view"
      size="sm"
      bind:value={tab}
      options={[
        { value: 'pull', label: 'Pull a pair apart' },
        { value: 'force', label: 'Strong versus electric force' },
        { value: 'jet', label: 'Many breaks: a jet' },
      ]}
    />
    {#if tab === 'pull'}
      <Slider bind:value={target} min={0.2} max={2 * Z_MAX - 0.4} step={0.05} label="Separation of the two ends you hold, r" format={(v) => v.toFixed(2) + ' fm'} />
    {:else if tab === 'jet'}
      <Slider bind:value={sqrtS} min={5} max={200} log label="Energy of the quark pair, √s" format={(v) => v.toFixed(v < 10 ? 1 : 0) + ' GeV'} />
    {/if}
  {/snippet}

  <div class="wrap" bind:this={host}>
    {#if tab === 'pull'}
      <div class="btns ui">
        <Button size="sm" variant="primary" onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</Button>
        {#if !playing}<Button size="sm" onclick={stepOnce}>Step</Button>{/if}
        <Button size="sm" onclick={() => reset(false)}>Start again (seed {seed})</Button>
        <Button size="sm" onclick={() => reset(true)}>Re-roll the dice (new seed)</Button>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <svg
        viewBox="0 0 {VW} {VH}"
        class="scene"
        role="slider"
        tabindex="0"
        aria-label="The quark pair and its colour string. Drag sideways, or use the arrow keys, to pull the two ends apart."
        aria-valuemin="0.2"
        aria-valuemax={2 * Z_MAX - 0.4}
        aria-valuenow={target}
        aria-valuetext="{target.toFixed(2)} femtometres"
        onpointerdown={pdown}
        onpointermove={pmove}
        onpointerup={() => (dragging = false)}
        onpointercancel={() => (dragging = false)}
        onkeydown={pkey}
      >
        <defs>
          <pattern id="sb-flux" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--p-hadron)" fill-opacity="0.35" /><line x1="0" y1="0" x2="0" y2="8" stroke="var(--p-hadron)" stroke-width="3" /></pattern>
        </defs>
        <line x1="8" x2={VW - 8} y1={VH / 2 + 6} y2={VH / 2 + 6} class="axis" />
        {#each [-4, -2, 0, 2, 4] as t}
          <line x1={zx(t)} x2={zx(t)} y1={VH / 2 + 6} y2={VH / 2 + 11} class="axis" />
          <text x={zx(t)} y={VH / 2 + 23} text-anchor="middle" class="tick">{t} fm</text>
        {/each}
        <!-- the hands: a marker where you are holding each end -->
        {#if snap.partons.length >= 2}
          <path d="M{zx(snap.partons[0]!.z)},{VH / 2 + 34}l-5,7h10z" class="hand" />
          <path d="M{zx(snap.partons[1]!.z)},{VH / 2 + 34}l-5,7h10z" class="hand" />
          <text x={zx(snap.partons[0]!.z)} y={VH / 2 + 54} text-anchor="middle" class="tick">held</text>
          <text x={zx(snap.partons[1]!.z)} y={VH / 2 + 54} text-anchor="middle" class="tick">held</text>
        {/if}
        <!-- string pieces -->
        {#each snap.pieces as pc, i}
          {@const a = partonById.get(pc.q)}
          {@const b = partonById.get(pc.qbar)}
          {#if a && b}
            <rect x={Math.min(zx(a.z), zx(b.z))} y={VH / 2 - 6} width={Math.abs(zx(b.z) - zx(a.z))} height="12" rx="6" fill="url(#sb-flux)" stroke="var(--p-hadron)" stroke-width="1.2" />
            {#if free(i)}
              <text x={(zx(a.z) + zx(b.z)) / 2} y={VH / 2 - 14 - (i % 2) * 13} text-anchor="middle" class="meson">{pieceLabel(i)}</text>
            {/if}
          {/if}
        {/each}
        <!-- partons -->
        {#each snap.partons as p (p.id)}
          <g transform="translate({zx(p.z)},{VH / 2})">
            <circle r="9" class="parton" class:anti={p.anti} class:held={p.held} />
            <text y="4" text-anchor="middle" class="pl">{sup(p.flavour, p.anti)}</text>
          </g>
        {/each}
        <!-- break flashes -->
        {#each flash as f (f.id)}
          <circle cx={zx(f.z)} cy={VH / 2} r="16" class="flash" />
        {/each}
        <text x="8" y="14" class="tick">z →</text>
        <text x={VW - 8} y="14" text-anchor="end" class="tick">t = {simT.toFixed(1)} fm/c · {snap.pieces.length} string piece{snap.pieces.length === 1 ? '' : 's'}</text>
      </svg>
      <ul class="key ui">
        <li><span class="k q"></span> quark (filled) · <span class="k a"></span> antiquark (ring, bar over the letter)</li>
        <li><span class="k flux"></span> colour flux tube: constant energy per length, ≈ {fmt(kappa, 2)} GeV/fm, about 1 GeV/fm</li>
        <li>A piece of string between a quark and an antiquark that you no longer hold is a meson; it is labelled with its name when the flavours match one (u ū and d d̄ are both shown as π⁰ here).</li>
      </ul>

      <div class="budget ui" aria-live="polite">
        <div class="bar" role="img" aria-label="Energy: string {fmt(bud.string, 3)} GeV, kinetic {fmt(bud.kinetic, 3)} GeV, created rest mass {fmt(bud.created, 3)} GeV, total {fmt(bud.input, 3)} GeV">
          <svg viewBox="0 0 360 22" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="sb-kin" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--series-3)" fill-opacity="0.25" /><path d="M0 6L6 0" stroke="var(--series-3)" stroke-width="1.6" /></pattern>
              <pattern id="sb-mass" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--series-5)" fill-opacity="0.25" /><circle cx="3" cy="3" r="1.5" fill="var(--series-5)" /></pattern>
            </defs>
            <rect x="0" y="0" width={(360 * bud.string) / totalBar} height="22" fill="var(--p-hadron)" fill-opacity="0.75" />
            <rect x={(360 * bud.string) / totalBar} y="0" width={(360 * Math.max(0, bud.kinetic)) / totalBar} height="22" fill="url(#sb-kin)" stroke="var(--series-3)" />
            <rect x={(360 * (bud.string + Math.max(0, bud.kinetic))) / totalBar} y="0" width={(360 * bud.created) / totalBar} height="22" fill="url(#sb-mass)" stroke="var(--series-5)" />
          </svg>
        </div>
        <dl>
          <div><dt><span class="k flux solid"></span> string</dt><dd>{fmt(bud.string, 3)} GeV</dd></div>
          <div><dt><span class="k kin"></span> kinetic, free quarks</dt><dd>{fmt(bud.kinetic, 3)} GeV</dd></div>
          <div><dt><span class="k mass"></span> created quark masses</dt><dd>{fmt(bud.created, 3)} GeV</dd></div>
          <div class="tot"><dt>= total = your work + the string at the start</dt><dd>{fmt(bud.input, 3)} GeV</dd></div>
          <div><dt>mismatch</dt><dd>{fmt(bud.residual, 2)} GeV</dd></div>
        </dl>
      </div>

      <div class="cols">
        <div>
          <h5 class="ui">Energy stored in the string against the separation</h5>
          <Plot
            height={230}
            label="The Cornell potential against separation, rising linearly at large distance, with the energy stored in the string of the running simulation as a trace that rises and then drops each time the string breaks, and a line at twice the quark mass."
            x={{ domain: [0, 2 * Z_MAX - 0.4], label: 'separation of the ends you hold, r [fm]', ticks: 6 }}
            y={{ domain: [-1, 6], label: 'energy [GeV]', ticks: 7 }}
          >
            {#snippet marks({ sx, sy })}
              <line x1={sx(0)} x2={sx(2 * Z_MAX)} y1={sy(2 * mQ)} y2={sy(2 * mQ)} stroke="var(--series-7)" stroke-dasharray="6 4" />
              <text x={sx(2 * Z_MAX - 0.5)} y={sy(2 * mQ) - 5} text-anchor="end" class="mk">2m ≈ {fmt(2 * mQ, 2)} GeV: enough for a pair</text>
              <path d={lineOf(rs, (r) => cornellPotential(r), sx, sy, [-1, 6])} class="line" stroke="var(--series-1)" />
              <path d={lineOf(rs, (r) => kappa * r, sx, sy, [-1, 6])} class="line" stroke="var(--series-8)" stroke-dasharray="3 4" stroke-width="1.4" />
              <path d={lineOf(rs, (r) => (-(4 / 3) * ALPHA_S_CORNELL * HBARC_GEV_FM) / r, sx, sy, [-1, 6])} class="line" stroke="var(--series-8)" stroke-dasharray="1 4" stroke-width="1.4" />
              {#if trace.length > 1}
                <path d={trace.map((p, i) => `${i ? 'L' : 'M'}${sx(p.r).toFixed(1)},${sy(p.e).toFixed(1)}`).join('')} class="line" stroke="var(--series-2)" stroke-width="1.6" />
              {/if}
              <circle cx={sx(sepNow)} cy={sy(bud.string)} r="5" fill="var(--series-7)" />
            {/snippet}
          </Plot>
          <ul class="key ui">
            <li><span class="sw s1"></span> Cornell potential V(r) = −(4/3) α<sub>s</sub>ħc/r + κr with α<sub>s</sub> ≈ {ALPHA_S_CORNELL}, κ = {fmt(kappa, 2)} GeV/fm</li>
            <li><span class="sw dash"></span> its string part κr · <span class="sw dot"></span> its Coulomb-like part</li>
            <li><span class="sw s2"></span> energy stored in the string in your run: climbs with r, drops at every break</li>
          </ul>
        </div>
        <div class="notes ui">
          <p><strong>What to do.</strong> Pull the right-hand end out slowly. At first the string just stores more and more energy, κ per fermi: a constant force, however far you pull. Once there is more than 2m ≈ {fmt(2 * mQ, 2)} GeV stored (from r ≈ {fmt(rCross, 2)} fm) it becomes possible for that energy to turn into a new quark–antiquark pair, and at a random moment it does. Each break leaves two separate pieces, each with a quark at one end and an antiquark at the other: two colour-neutral mesons where there was one coloured pair. Quarks are never found alone.</p>
          <p>The new pair appears with the gap between them 2m/κ, so the string energy that disappears there, κ × gap, is exactly the rest mass 2m of the new quarks. The quarks then slosh back and forth (the "yo-yo" motion), exchanging energy with the string; the mismatch above stays at rounding level.</p>
          <p>Breaks are random (seed {seed}); start again with the same seed and pull the same way and you get the same breaks. Flavours u, d and s appear with probabilities set by exp(−πm²/κ), so strange quarks are rarer because they are heavier; the masses are cartoon values, not measurements.</p>
          {#if breaks.length}
            <p class="brk"><strong>Breaks so far:</strong> {breaks.map((b, i) => `#${sm.breaks.length - breaks.length + i + 1} at t = ${b.t.toFixed(1)}, z = ${b.z.toFixed(2)} fm (${b.flavour}${b.flavour}̄ pair)`).join('; ')}.</p>
          {/if}
        </div>
      </div>
    {:else if tab === 'force'}
      <div class="cols">
        <div>
          <h5 class="ui">The force between the two charges</h5>
          <Plot
            height={280}
            label="Force between two charges against separation on logarithmic axes. The electric force between an electron and a positron falls as one over r squared; the force between a quark and an antiquark falls at short distance and then levels off at a constant, about 1 GeV per fermi."
            x={{ type: 'log', domain: [0.05, 10], label: 'separation r [fm]', tickValues: [0.1, 1, 10], format: pow10 }}
            y={{ type: 'log', domain: [1e-6, 100], label: 'attractive force [GeV/fm]', tickValues: [1e-6, 1e-4, 1e-2, 1, 100], format: pow10 }}
          >
            {#snippet marks({ sx, sy })}
              <path d={lineOf(rsLog, (r) => -coulombForce(r), sx, sy)} class="line" stroke="var(--series-2)" stroke-dasharray="7 4" />
              <path d={lineOf(rsLog, (r) => -cornellForce(r), sx, sy)} class="line" stroke="var(--series-1)" />
              <line x1={sx(0.05)} x2={sx(10)} y1={sy(kappa)} y2={sy(kappa)} stroke="var(--series-8)" stroke-dasharray="2 4" />
              <text x={sx(0.06)} y={sy(kappa) - 5} class="mk">κ ≈ 1 GeV/fm</text>
            {/snippet}
          </Plot>
          <ul class="key ui">
            <li><span class="sw s1"></span> quark and antiquark: (4/3)α<sub>s</sub>ħc/r² + κ</li>
            <li><span class="sw s2dash"></span> electron and positron: αħc/r², with α = 1/137</li>
          </ul>
        </div>
        <div class="notes ui">
          <p>Two opposite electric charges attract with a force that falls as 1/r²: the field lines spread out in all directions and thin out. Pull an electron and positron apart and each fermi you gain costs less than the last; to take them infinitely far apart costs only a finite energy, about {fmt((1 / 137.036) * HBARC_GEV_FM * 1e3, 3)} MeV starting from 1 fm.</p>
          <p>The field lines of a colour charge do not spread. Gluons attract each other, so the lines of colour force are squeezed into a tube of roughly constant cross-section, and the energy per length of tube is constant: κ ≈ 1 GeV/fm. The force stays κ at any distance. Pulling the pair to 1 m would cost about {fmt(kappa * 1e15, 1)} GeV; long before that there is enough energy to make a new pair, and the string breaks. At short distances (below about {fmt(Math.sqrt(((4 / 3) * ALPHA_S_CORNELL * HBARC_GEV_FM) / kappa), 2)} fm here) the Coulomb-like term dominates and the quarks attract much as electric charges do, with α replaced by (4/3)α<sub>s</sub>.</p>
        </div>
      </div>
    {:else}
      <div class="btns ui">
        <Button size="sm" variant="primary" onclick={() => (jetSeed += 1)}>New event (seed {jetSeed})</Button>
      </div>
      <p class="lead ui">
        A quark and an antiquark leave a collision back to back with a total energy √s = {fmt(sqrtS, 3)} GeV, and the string between them breaks again and again. Each break gives two new ends, and the string ends up as a chain of mesons. The hadrons of this event are below, in order of rapidity y = ½ ln[(E + p<sub>z</sub>)/(E − p<sub>z</sub>)], the relativistic measure of how far along the original direction of motion each one goes.
      </p>
      <svg viewBox="0 0 360 120" class="scene" role="img" aria-label="The mesons of one event placed along the rapidity axis, from the antiquark's direction on the left to the quark's on the right.">
        {#each [-6, -4, -2, 0, 2, 4, 6] as t}
          {#if Math.abs(t) <= yMaxJet}
            <line x1={180 + (t / yMaxJet) * 165} x2={180 + (t / yMaxJet) * 165} y1="96" y2="102" class="axis" />
            <text x={180 + (t / yMaxJet) * 165} y="114" text-anchor="middle" class="tick">{t}</text>
          {/if}
        {/each}
        <line x1="10" x2="350" y1="96" y2="96" class="axis" />
        <text x="350" y="92" text-anchor="end" class="tick">y</text>
        {#each sortedHadrons as h, i}
          {@const x = 180 + (h.y / yMaxJet) * 165}
          <line x1={x} x2={x} y1="96" y2={84 - (i % 4) * 20} class="stem" />
          <circle cx={x} cy={84 - (i % 4) * 20} r={3 + 2.5 * Math.sqrt(h.mass)} class="h" class:charged={h.charge3 !== 0} />
          <text x={x} y={84 - (i % 4) * 20 - 8 - 2.5 * Math.sqrt(h.mass)} text-anchor="middle" class="meson sm">{sym(h.pdg)}</text>
        {/each}
      </svg>
      <ul class="key ui">
        <li>Circle size grows with the meson's mass; filled circles are charged, open ones neutral. Labels follow the library's particle table (π, K, η).</li>
      </ul>
      <dl class="sums ui">
        <div><dt>mesons</dt><dd>{jetEvent.hadrons.length}</dd></div>
        <div><dt>ΣE</dt><dd>{fmt(jetSums.E, 5)} GeV = √s ✓</dd></div>
        <div><dt><span>Σp<sub>z</sub>, Σp<sub>x</sub>, Σp<sub>y</sub></span></dt><dd>{fmt(Math.abs(jetSums.pz) < 1e-9 ? 0 : jetSums.pz, 2)}, {fmt(Math.abs(jetSums.px) < 1e-9 ? 0 : jetSums.px, 2)}, {fmt(Math.abs(jetSums.py) < 1e-9 ? 0 : jetSums.py, 2)} GeV ✓</dd></div>
        <div><dt>total charge</dt><dd>{jetSums.q} ✓</dd></div>
      </dl>
      <h5 class="ui">The rapidity plateau: {plateau.dNdy.length ? '250 events' : ''}</h5>
      <Plot
        height={230}
        label="Number of mesons per unit rapidity per event against rapidity, averaged over 250 events: flat across the middle (the rapidity plateau) and falling at the two ends."
        x={{ domain: [-yMaxJet, yMaxJet], label: 'rapidity y', ticks: 7, format: (v) => String(Math.round(v * 10) / 10) }}
        y={{ domain: [0, Math.max(2.5, Math.max(...plateau.dNdy) * 1.3)], label: 'mesons per unit y per event', ticks: 5, format: (v) => v.toFixed(1) }}
      >
        {#snippet marks({ sx, sy })}
          {#each plateau.dNdy as v, i}
            <rect x={sx(plateau.edges[i]!)} y={sy(v)} width={Math.max(0, sx(plateau.edges[i + 1]!) - sx(plateau.edges[i]!) - 1)} height={Math.max(0, sy(0) - sy(v))} fill="var(--series-1)" fill-opacity="0.55" stroke="var(--series-1)" />
          {/each}
          {#if Number.isFinite(plateauMean)}
            <line x1={sx(-yMaxJet)} x2={sx(yMaxJet)} y1={sy(plateauMean)} y2={sy(plateauMean)} stroke="var(--series-2)" stroke-dasharray="6 4" stroke-width="1.6" />
            <text x={sx(-yMaxJet) + 6} y={sy(plateauMean) - 6} class="mk">plateau ≈ {fmt(plateauMean, 2)} per unit y (|y| &lt; 1.5)</text>
          {/if}
          {#each jetEvent.hadrons as h}
            <line x1={sx(h.y)} x2={sx(h.y)} y1={sy(0)} y2={sy(0) - 7} stroke="var(--series-7)" stroke-width="1.6" />
          {/each}
        {/snippet}
      </Plot>
      <p class="note ui">
        Red ticks on the axis are the mesons of the event above; the bars are the average of 250 events (seed fixed). Because the string has the same energy per length everywhere, every stretch of it is equally likely to break, and equal stretches of string correspond to equal intervals of rapidity: hence a flat distribution, with a length of about ln(s/m²) and a height that does not depend on √s. Raise the energy and the plateau gets longer, not taller, so the number of mesons grows like ln √s. The recipe is the Lund string picture; the fragmentation-function parameters are ones remembered from common generator defaults, not fitted here, so read the heights as illustrative.
      </p>
    {/if}
  </div>
</Widget>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .scene {
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    touch-action: none;
  }
  svg[role='slider'] {
    cursor: ew-resize;
  }
  svg[role='slider']:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .tick {
    font-size: 9.5px;
    fill: var(--mute);
  }
  .hand {
    fill: var(--ink-2);
  }
  .parton {
    fill: var(--fg);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .parton.anti {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
  }
  .parton.held {
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .pl {
    font-size: 11px;
    font-weight: 600;
    fill: var(--panel);
    pointer-events: none;
  }
  .parton.anti + .pl {
    fill: var(--fg);
  }
  .meson {
    font-size: 12px;
    font-weight: 600;
    fill: var(--fg);
  }
  .meson.sm {
    font-size: 10px;
  }
  .flash {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 3;
    animation: flash 0.7s ease-out forwards;
  }
  @keyframes flash {
    from {
      r: 8;
      opacity: 1;
    }
    to {
      r: 30;
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flash {
      animation: none;
      opacity: 0.6;
    }
  }
  .stem {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .h {
    fill: var(--panel);
    stroke: var(--series-1);
    stroke-width: 2;
  }
  .h.charged {
    fill: var(--series-1);
  }
  .key {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.76rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .key li {
    margin: 0 !important;
    display: block;
    line-height: 1.45;
  }
  .key :global(.sw),
  .key :global(.k) {
    margin-right: 0.4rem;
  }
  .k {
    display: inline-block;
    width: 16px;
    height: 12px;
    flex: none;
    border-radius: 3px;
  }
  .k.q {
    width: 12px;
    border-radius: 50%;
    background: var(--fg);
  }
  .k.a {
    width: 12px;
    border-radius: 50%;
    border: 2px solid var(--fg);
  }
  .k.flux {
    background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--p-hadron) 35%, transparent) 0 4px, var(--p-hadron) 4px 6px);
    border: 1px solid var(--p-hadron);
  }
  .k.flux.solid {
    background: color-mix(in srgb, var(--p-hadron) 75%, transparent);
  }
  .k.kin {
    background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--series-3) 25%, transparent) 0 3px, var(--series-3) 3px 4px);
    border: 1px solid var(--series-3);
  }
  .k.mass {
    background: radial-gradient(circle, var(--series-5) 0 1.5px, color-mix(in srgb, var(--series-5) 25%, transparent) 2px);
    border: 1px solid var(--series-5);
  }
  .budget .bar svg {
    width: 100%;
    height: 22px;
    display: block;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--panel);
  }
  .budget dl {
    margin: 0.4rem 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.4rem;
  }
  .budget dl div {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  dt {
    font-size: 0.76rem;
    color: var(--mute);
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
  }
  .tot dd {
    font-weight: 600;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.2rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .notes p,
  .lead,
  .note {
    font-size: 0.8rem;
    line-height: 1.55;
    color: var(--ink-2);
    margin: 0 0 0.5rem;
  }
  .brk {
    font-size: 0.74rem !important;
    color: var(--mute) !important;
  }
  .mk {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 20px;
    border-top: 2px solid var(--series-1);
    flex: none;
  }
  .sw.dash {
    border-top: 2px dashed var(--series-8);
  }
  .sw.dot {
    border-top: 2px dotted var(--series-8);
  }
  .sw.s2 {
    border-top: 2px solid var(--series-2);
  }
  .sw.s2dash {
    border-top: 2px dashed var(--series-2);
  }
  .sums {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.4rem;
    margin: 0;
  }
  .sums div {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
</style>
