<!--
  Jets from a parton shower (Chapter 18): simulated e⁺e⁻ → qq̄ events (hep/gen: matrix element, shower, toy Lund string,
  decays), clustered with anti-kT (hep/reco, or the reader's version of `reco.antiKt` when it is installed).

    ::shower-jets{n="18.2" caption="…"}

  Each event is rotated so that its plane (from the momentum tensor) is the transverse plane, the view seen by a
  hadron-collider detector for a jet pair at rapidity zero. Two-jet and three-jet events, the dependence of the jet
  count on R and pT,min, and the infrared and collinear safety tests (add a soft particle; split the hardest one).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { activeOverrides } from '$lib/hep/hooks';
  import { rng } from '$lib/hep/random';
  import { pt as ptOf } from '$lib/hep/kinematics';
  import { generateJetEvents, clusterEvent, addSoft, splitHardest, type JetEvent, type Jet } from './jetsim';

  let { n, caption, title = 'A quark pair becomes jets' }: { n?: string | number; caption?: string; title?: string } = $props();

  const COUNT = 240;
  let sqrtS = $state(91.2);
  let shower = $state(true);
  let R = $state(0.7);
  let ptMin = $state(5);
  let index = $state(0);
  let events = $state<JetEvent[]>([]);
  let progress = $state(0);
  let safety = $state('');
  let mine = $state(false);
  let gen = 0;

  async function generateBatch() {
    const token = ++gen;
    events = [];
    progress = 0;
    const out: JetEvent[] = [];
    const chunk = 20;
    for (let i = 0; i < COUNT; i += chunk) {
      // a fresh seed per chunk keeps the events independent of the chunk size
      out.push(...generateJetEvents(sqrtS, chunk, 1000 + i + (shower ? 0 : 500000) + Math.round(sqrtS * 10), { shower }));
      if (token !== gen) return;
      progress = out.length / COUNT;
      await new Promise((r) => setTimeout(r, 0));
    }
    events = out;
    index = 0;
    safety = '';
  }
  onMount(() => {
    mine = activeOverrides().includes('reco.antiKt');
  });
  $effect(() => {
    void sqrtS;
    void shower;
    generateBatch();
  });

  const ev = $derived(events[index]);
  const jets = $derived<Jet[]>(ev ? clusterEvent(ev, R, ptMin) : []);
  const allJets = $derived(events.map((e) => clusterEvent(e, R, ptMin).length));
  const hist = $derived.by(() => {
    const h = [0, 0, 0, 0, 0, 0];
    for (const k of allJets) h[Math.min(5, k)]!++;
    return h;
  });
  const hMax = $derived(Math.max(1, ...hist));
  const frac3 = $derived(allJets.length ? allJets.filter((k) => k >= 3).length / allJets.length : 0);

  function jump(want: (k: number) => boolean, dir: 1 | -1) {
    if (!events.length) return;
    for (let s = 1; s <= events.length; s++) {
      const i = (index + dir * s + events.length * 2) % events.length;
      if (want(clusterEvent(events[i]!, R, ptMin).length)) {
        index = i;
        return;
      }
    }
  }

  // view
  const VS = 260; // half size in SVG units
  const maxP = $derived(Math.max(1, ...(ev ? ev.particles.map((q) => ptOf(q.p)) : [1])));
  const len = (p: number) => 10 + (VS * 0.92 - 10) * Math.sqrt(Math.min(1, p / maxP));
  const jetLen = (jpt: number) => 20 + (VS * 0.9 - 20) * Math.min(1, jpt / (sqrtS / 2));
  const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
  const owner = $derived.by(() => {
    const o = new Map<number, number>();
    jets.forEach((j, k) => j.members.forEach((m) => o.set(m, k)));
    return o;
  });
  const wedge = (j: Jet) => {
    const a0 = -j.phi - R, a1 = -j.phi + R; // SVG y points down
    const r = VS * 0.98;
    const pt = (a: number) => `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    return `M0,0 L${pt(a0)} A${r},${r} 0 0 1 ${pt(a1)} Z`;
  };

  function test(kind: 'soft' | 'split') {
    if (!ev) return;
    const before = jets;
    const r = rng(index + 77);
    const changed = kind === 'soft' ? addSoft(ev, r) : splitHardest(ev);
    const after = clusterEvent(changed, R, ptMin);
    const dpt = Math.max(0, ...before.slice(0, Math.min(before.length, after.length)).map((j, i) => Math.abs(j.pt - after[i]!.pt)));
    safety =
      (kind === 'soft' ? 'Added a 50 MeV photon in a random direction. ' : 'Split the most energetic particle into two collinear halves. ') +
      `Jets before: ${before.length}, after: ${after.length}. Largest change in a jet's pT: ${dpt < 1e-9 ? '0' : dpt.toPrecision(2)} GeV.`;
  }
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Segmented
      label="Collision energy"
      size="sm"
      bind:value={sqrtS}
      options={[
        { value: 10, label: '10 GeV' },
        { value: 30, label: '30 GeV' },
        { value: 91.2, label: '91.2 GeV' },
        { value: 200, label: '200 GeV' },
      ]}
    />
    <Toggle bind:checked={shower} label="Parton shower" />
    <Slider bind:value={R} min={0.2} max={1.5} step={0.05} label="Jet radius R" />
    <Slider bind:value={ptMin} min={1} max={30} step={0.5} label="Smallest jet pT [GeV]" format={(v) => v.toFixed(1)} />
  {/snippet}

  <div class="wrap">
    <div class="viewcol">
      <div class="nav ui">
        <Button size="sm" onclick={() => (index = (index + events.length - 1) % Math.max(1, events.length))} disabled={!events.length}>← Previous</Button>
        <Button size="sm" onclick={() => (index = (index + 1) % Math.max(1, events.length))} disabled={!events.length}>Next →</Button>
        <Button size="sm" onclick={() => jump((k) => k === 2, 1)} disabled={!events.length}>Next two-jet</Button>
        <Button size="sm" variant="primary" onclick={() => jump((k) => k >= 3, 1)} disabled={!events.length}>Next three-jet</Button>
        <span class="count">{events.length ? `event ${index + 1} of ${events.length}` : `generating ${(progress * 100).toFixed(0)} %`}</span>
      </div>
      <svg viewBox="{-VS - 20} {-VS - 20} {2 * VS + 40} {2 * VS + 40}" role="img" aria-label="Transverse view of the event: particles as lines from the centre, grouped and coloured by jet, with a wedge of half-angle R around each jet">
        <circle r={VS} fill="none" stroke="var(--line-strong)" stroke-dasharray="3 5" />
        <line x1={-VS} x2={VS} y1="0" y2="0" stroke="var(--line)" />
        <line y1={-VS} y2={VS} x1="0" x2="0" stroke="var(--line)" />
        {#each jets as j, k}
          <path d={wedge(j)} fill={COLORS[k % 6]} opacity="0.13" />
        {/each}
        {#if ev}
          {#each ev.particles as q, i}
            {@const p = ptOf(q.p)}
            {#if p > 0.05}
              {@const L = len(p)}
              {@const k = owner.get(i)}
              <line
                x1="0"
                y1="0"
                x2={(L * q.p.px) / p}
                y2={(-L * q.p.py) / p}
                stroke={k === undefined ? 'var(--ink-3)' : COLORS[k % 6]}
                stroke-width={q.charged ? 1.6 : 1.3}
                stroke-dasharray={q.charged ? undefined : '3 3'}
                opacity={k === undefined ? 0.6 : 0.95}
              />
            {/if}
          {/each}
        {/if}
        {#each jets as j, k}
          <line x1="0" y1="0" x2={jetLen(j.pt) * Math.cos(j.phi)} y2={-jetLen(j.pt) * Math.sin(j.phi)} stroke={COLORS[k % 6]} stroke-width="4" stroke-linecap="round" opacity="0.55" />
        {/each}
        {#each jets as j, k}
          <text x={(VS * 1.02 + 6) * Math.cos(-j.phi)} y={(VS * 1.02 + 6) * Math.sin(-j.phi)} text-anchor="middle" dominant-baseline="middle" class="jl" fill={COLORS[k % 6]}>
            j{k + 1}
          </text>
        {/each}
        <circle r="3.5" fill="var(--ink)" />
      </svg>
      <p class="key ui">
        Thin lines: particles, length growing with the square root of the transverse momentum; solid = charged, dashed = neutral, grey = in no jet. Thick line: the jet axis, with length proportional to the jet's pT. Shaded wedges: the radius R around each jet.
        {#if mine}<strong>Clustering with your code (reco.antiKt).</strong>{/if}
      </p>
    </div>

    <div class="side ui">
      <table>
        <thead><tr><th></th><th>p<sub>T</sub> [GeV]</th><th>η</th><th>φ</th><th>particles</th><th>mass</th></tr></thead>
        <tbody>
          {#each jets as j, k}
            <tr>
              <th scope="row" style:color={COLORS[k % 6]}>j{k + 1}</th>
              <td>{j.pt.toFixed(1)}</td>
              <td>{j.eta.toFixed(2)}</td>
              <td>{j.phi.toFixed(2)}</td>
              <td>{j.members.length}</td>
              <td>{j.m.toFixed(1)}</td>
            </tr>
          {:else}
            <tr><td colspan="6">no jet above the threshold</td></tr>
          {/each}
        </tbody>
      </table>
      <p class="sub">Jets per event, {events.length} events, R = {R.toFixed(2)}, pT &gt; {ptMin.toFixed(1)} GeV</p>
      <div class="bars" role="img" aria-label="Number of events with 0, 1, 2, 3, 4 and 5 or more jets">
        {#each hist as h, k}
          <div class="col">
            <span class="num">{h}</span>
            <span class="bar" style:height="{(h / hMax) * 70}px"></span>
            <span class="lab">{k === 5 ? '5+' : k}</span>
          </div>
        {/each}
      </div>
      <p class="sub">Three or more jets: <strong>{(frac3 * 100).toFixed(1)} %</strong> of the events.</p>
      <div class="tests">
        <Button size="sm" onclick={() => test('soft')} disabled={!ev}>Add a soft particle</Button>
        <Button size="sm" onclick={() => test('split')} disabled={!ev}>Split the hardest particle</Button>
      </div>
      {#if safety}<p class="sub" aria-live="polite">{safety}</p>{/if}
    </div>
  </div>
</Widget>

<style>
  .wrap {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 800px) {
    .wrap {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  svg {
    width: 100%;
    max-height: 520px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .jl {
    font-size: 15px;
    font-weight: 600;
  }
  .key,
  .sub {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
    line-height: 1.4;
  }
  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 0.15rem 0.4rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
  }
  tbody th {
    text-align: left;
    font-weight: 700;
  }
  .bars {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    height: 110px;
    margin-top: 0.3rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    font-size: 0.75rem;
  }
  .bar {
    display: block;
    width: 100%;
    background: var(--series-1);
    opacity: 0.6;
    border-radius: 2px 2px 0 0;
    min-height: 1px;
  }
  .num {
    color: var(--ink-2);
  }
  .lab {
    color: var(--ink);
  }
  .tests {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
</style>
