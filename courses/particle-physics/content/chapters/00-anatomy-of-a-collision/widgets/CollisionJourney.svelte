<!--
  One collision, six steps: from two crossing proton bunches to one more entry in a histogram. A storyboard in SVG:
  the detector is drawn in cross-section as the "onion" of Chapter 7, and each step lights up the part that matters.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const STEPS = [
    { id: 'machine', name: 'The machine', chapter: 'Part V', text: 'Two beams of protons circle the ring in opposite directions, packed into bunches of about 10¹¹ protons. Every 25 nanoseconds two bunches cross, and in each crossing a few dozen proton pairs collide. The machine decides how often that happens (Chapters 19–21).' },
    { id: 'generator', name: 'The collision', chapter: 'Parts I, IV', text: 'In one of those collisions, a quark from one proton hits a gluon from the other. Energy becomes matter: a fan of new particles emerges, most of them short-lived. The theory says what can come out and how likely it is. Simulating that is the job of the event generator (Chapters 3, 13, 16, 18).' },
    { id: 'detector', name: 'The detector', chapter: 'Part II', text: 'Around the collision sits a detector shaped like an onion: a tracker that records where charged particles pass, a calorimeter that stops electrons, photons and hadrons and measures their energy, and outer chambers that only muons reach. Neutrinos cross everything unseen (Chapters 5–7).' },
    { id: 'hits', name: 'The signals', chapter: 'Part II', text: 'What comes out of the detector is not particles but numbers: which silicon pixels fired, how much charge each calorimeter cell collected, which chambers were hit. About a hundred million channels, read out together.' },
    { id: 'reco', name: 'Reconstruction', chapter: 'Part II, IV', text: 'Software turns hits back into particles: a curved line through the hits gives a track, with momentum from its curvature; a blob of energy becomes an electron or a jet; the momentum that seems to be missing points to a neutrino (Chapters 8, 18).' },
    { id: 'analysis', name: 'Trigger and analysis', chapter: 'Part VII', text: 'Only about one crossing in 40,000 can be kept: a trigger decides in microseconds. Kept events are sorted by physicists into histograms. This collision, a Z boson decaying to two muons, adds one entry to the peak at 91 GeV (Chapters 27–29).' },
  ] as const;

  let step = $state(0);
  const s = $derived(STEPS[step]!);

  // Detector cross-section geometry (SVG units)
  const RINGS = [
    { r: 12, name: 'beam pipe', cls: 'pipe' },
    { r: 55, name: 'tracker', cls: 'trk' },
    { r: 82, name: 'ECAL', cls: 'ecal' },
    { r: 100, name: 'solenoid', cls: 'sol' },
    { r: 138, name: 'HCAL', cls: 'hcal' },
    { r: 190, name: 'muon chambers', cls: 'mu' },
  ];
  const tracks = [
    { id: 'μ⁺', d: 'M0 0 Q 70 -10 190 -34', to: 190, cls: 'muon', end: [186, -34] },
    { id: 'μ⁻', d: 'M0 0 Q -60 30 -190 62', to: 190, cls: 'muon', end: [-186, 61] },
    { id: 'jet', d: 'M0 0 Q 4 -70 12 -137', to: 137, cls: 'jet', end: [12, -137] },
    { id: 'e', d: 'M0 0 Q -28 -46 -52 -74', to: 80, cls: 'elec', end: [-52, -74] },
    { id: 'ν', d: 'M0 0 L 150 120', to: 190, cls: 'nu', end: [130, 104] },
  ];
  const hits = [
    [40, -5], [47, -8], [54, -10], [30, 22], [30, -30], [-30, 16], [-45, 29], [-52, 34], [-28, -46], [-40, -58],
    [110, -19], [150, -27], [186, -34], [-110, 30], [-150, 41], [-186, 61], [8, -60], [10, -90], [11, -120],
  ];
</script>

<Widget title="One collision, six steps" {n} {caption} kind="Journey">
  {#snippet controls()}
    <div class="steps ui" role="tablist" aria-label="Steps of a collision">
      {#each STEPS as st, i}
        <button role="tab" aria-selected={i === step} class:on={i === step} onclick={() => (step = i)}><span class="n">{i + 1}</span> {st.name}</button>
      {/each}
    </div>
  {/snippet}
  <div class="grid">
    <svg viewBox="-215 -215 430 430" role="img" aria-label="Schematic cross-section of a collider detector for the step: {s.name}" class="screen">
      {#if step === 0}
        <line x1="-200" x2="200" y1="0" y2="0" stroke="var(--line-strong)" stroke-dasharray="4 4" />
        {#each [-150, -120, -90, -60] as x}<ellipse cx={x} cy="0" rx="10" ry="4" fill="var(--p-electron)" opacity={0.4 + (x + 150) / 200} />{/each}
        {#each [150, 120, 90, 60] as x}<ellipse cx={x} cy="0" rx="10" ry="4" fill="var(--p-jet)" opacity={0.4 + (150 - x) / 200} />{/each}
        <text x="-150" y="-20" class="t">proton bunch →</text>
        <text x="150" y="-20" text-anchor="end" class="t">← proton bunch</text>
        <circle cx="0" cy="0" r="6" fill="var(--p-higgs)" />
      {:else if step === 1}
        {#each Array.from({ length: 14 }, (_, i) => i) as i}
          {@const a = (i / 14) * Math.PI * 2 + 0.2}
          <line x1="0" y1="0" x2={Math.cos(a) * (60 + (i % 4) * 25)} y2={Math.sin(a) * (60 + (i % 4) * 25)} stroke={i % 3 === 0 ? 'var(--p-photon)' : i % 3 === 1 ? 'var(--p-hadron)' : 'var(--p-muon)'} stroke-width="1.6" />
        {/each}
        <circle cx="0" cy="0" r="7" fill="var(--p-higgs)" />
        <text x="0" y="-100" text-anchor="middle" class="t">quark + gluon → Z + quark</text>
      {:else}
        {#each RINGS as r}
          <circle cx="0" cy="0" r={r.r} class="ring {r.cls}" class:lit={(step === 2) || (step >= 3 && r.cls !== 'pipe' && r.cls !== 'sol')} />
        {/each}
        {#if step === 2 || step === 4 || step === 5}
          {#each tracks as t}
            <path d={t.d} class="trk-line {t.cls}" fill="none" />
            {#if step >= 4}<text x={t.end[0]! * 1.06} y={t.end[1]! * 1.06} class="t lab">{t.id}</text>{/if}
          {/each}
        {/if}
        {#if step === 3}
          {#each hits as h}<circle cx={h[0]!} cy={h[1]!} r="2.6" fill="var(--p-hit)" />{/each}
          {#each [[-52, -74], [12, -137]] as c}<circle cx={c[0]} cy={c[1]} r="9" fill="var(--p-calo-em)" opacity="0.5" />{/each}
        {/if}
        <circle cx="0" cy="0" r="3" fill="var(--p-higgs)" />
        {#if step === 5}
          <g transform="translate(-200 120)">
            <rect x="0" y="0" width="120" height="74" rx="4" fill="var(--panel)" stroke="var(--line-strong)" />
            {#each [4, 7, 10, 18, 34, 54, 30, 14, 7] as h, i}<rect x={8 + i * 12} y={66 - h} width="10" height={h} fill={i === 5 ? 'var(--track)' : 'var(--mute)'} />{/each}
            <text x="60" y="-4" text-anchor="middle" class="t">m(μμ) near 91 GeV: +1</text>
          </g>
        {/if}
      {/if}
    </svg>
    <div class="txt">
      <p class="ui chip">Step {step + 1} of {STEPS.length} · {s.chapter}</p>
      <h5>{s.name}</h5>
      <p>{s.text}</p>
      <div class="ui nav">
        <button onclick={() => (step = Math.max(0, step - 1))} disabled={step === 0}>Back</button>
        <button onclick={() => (step = Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>Next</button>
      </div>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-height: 26rem;
    background: var(--bg);
    border-radius: 6px;
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .steps button,
  .nav button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .steps button.on {
    background: var(--track);
    color: var(--on-accent);
    border-color: var(--track);
  }
  .n {
    font-family: var(--font-mono);
    opacity: 0.7;
    margin-right: 0.15rem;
  }
  .nav {
    display: flex;
    gap: 0.5rem;
  }
  .nav button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  h5 {
    font-family: var(--font-display);
    font-size: 1.15rem;
    margin: 0.2rem 0 0.4rem;
  }
  .chip {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
    margin: 0;
  }
  .txt p {
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .ring {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .ring.lit.trk { stroke: var(--p-hit); stroke-width: 3; opacity: 0.7; }
  .ring.lit.ecal { stroke: var(--p-calo-em); stroke-width: 14; opacity: 0.35; }
  .ring.lit.hcal { stroke: var(--p-calo-had); stroke-width: 26; opacity: 0.3; }
  .ring.lit.mu { stroke: var(--p-muon); stroke-width: 10; opacity: 0.3; }
  .ring.sol { stroke: var(--mute); stroke-dasharray: 3 3; }
  .trk-line {
    stroke-width: 2;
    stroke-linecap: round;
  }
  .trk-line.muon { stroke: var(--p-muon); stroke-width: 3; }
  .trk-line.elec { stroke: var(--p-electron); }
  .trk-line.jet { stroke: var(--p-jet); stroke-width: 6; opacity: 0.6; }
  .trk-line.nu { stroke: var(--p-neutrino); stroke-dasharray: 2 4; }
  .t {
    font-size: 10px;
    fill: var(--ink-2);
  }
  .lab {
    font-size: 11px;
    fill: var(--fg);
  }
</style>
