<!--
  The guided reading of an Anderson-style photograph. The reader works out, from the picture alone, which side of the
  plate the curve is tighter on, which way the particle moved, the sign of its charge, whether it is light or heavy, and
  names it. Only then does the widget reveal what it was. Numbers for the first exposure are "as reported by Anderson".
-->
<script lang="ts">
  import { MATERIALS, ionisationLoss, mipLoss } from '$lib/hep/chamber';
  import type { PictureLabel } from '$lib/hep/chamber';
  import type { SelectionInfo } from './info';
  import { fmtIonisation } from './info';
  import { ANDERSON } from '$lib/hep/chamber';

  let {
    info,
    truth,
    first,
    bField,
    onnext,
  }: { info: SelectionInfo | null; truth: PictureLabel | null; first: boolean; bField: number; onnext: () => void } = $props();

  type Side = 'above' | 'below' | 'same';
  let side = $state<Side | ''>('');
  let dir = $state<'up' | 'down' | ''>('');
  let charge = $state<'positive' | 'negative' | ''>('');
  let mass = $state<'light' | 'heavy' | ''>('');
  let who = $state('');
  let revealed = $state(false);

  $effect(() => {
    void truth?.trackId;
    void first;
    side = dir = charge = mass = who = '';
    revealed = false;
  });

  const CHOICES = [
    { id: 'e-', label: 'an electron' },
    { id: 'e+', label: 'a positron (the electron’s antiparticle: same mass, opposite charge)' },
    { id: 'mu-', label: 'a negative muon' },
    { id: 'mu+', label: 'a positive muon' },
    { id: 'p', label: 'a proton' },
  ];
  const NAMES: Record<string, string> = { 'e-': 'an electron', 'e+': 'a positron', 'mu-': 'a negative muon', 'mu+': 'a positive muon', p: 'a proton' };

  const segs = $derived(info?.segments.filter((s) => s.R !== null) ?? []);
  const above = $derived(segs.filter((s) => s.yMid > 0));
  const below = $derived(segs.filter((s) => s.yMid < 0));
  const pBelow = $derived(below[0]?.pT ?? null);
  const pAbove = $derived(above[0]?.pT ?? null);
  // What a proton of the measured momentum would look like, for the ionisation comparison.
  const protonRatio = $derived.by(() => {
    const p = pBelow ?? pAbove;
    if (!p) return null;
    const mat = MATERIALS.air;
    const mip = mipLoss(mat, true);
    return ionisationLoss({ mass: 938.272, charge: 1 }, p * 1000, mat, mat.deltaCut) / mip;
  });
  const ptText = (x: number | null) => (x === null ? '—' : x >= 1 ? x.toFixed(2) + ' GeV/c' : (x * 1000).toFixed(0) + ' MeV/c');

  const truthSide = $derived<Side | ''>(truth?.direction ? (truth.direction === 'up' ? 'above' : 'below') : '');
  const truthCharge = $derived(truth ? (truth.truth === 'e+' || truth.truth === 'mu+' || truth.truth === 'p' ? 'positive' : 'negative') : '');
  const truthMass = $derived(truth ? (truth.truth === 'p' ? 'heavy' : 'light') : '');
  const ready = $derived(!!(side && dir && charge && mass && who));
  const tick = (ok: boolean) => (ok ? '✓' : '✗');
</script>

<section class="panel ui" aria-label="Work out what the particle was">
  <h5>Work out what the particle was</h5>
  {#if !info}
    <p class="lead">Select the track in the picture (click it), then answer the five questions. Nothing is labelled for you.</p>
  {:else}
    <p class="lead">
      Measured for you: below the plate the curve has R = {below[0]?.R ? below[0].R.toFixed(0) : '—'} mm (p⊥ ≈ {ptText(pBelow)}); above it R = {above[0]?.R ? above[0].R.toFixed(0) : '—'} mm (p⊥ ≈ {ptText(pAbove)}).
      Ionisation: {fmtIonisation(info.ionisation)} minimum{#if protonRatio}; a proton of that momentum would ionise about {fmtIonisation(protonRatio)} minimum{/if}.
    </p>
  {/if}
  <div class="qs">
    <div>
      <fieldset>
        <legend>1. On which side of the plate is the track more strongly curved (smaller radius)?</legend>
        {#each [['below', 'Below the plate'], ['above', 'Above the plate'], ['same', 'Neither']] as [v, l] (v)}
          <label><input type="radio" name="side" value={v} bind:group={side} /> {l}</label>
        {/each}
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>2. A particle loses momentum crossing the plate and is bent more afterwards. Did it move…</legend>
        {#each [['up', 'upwards'], ['down', 'downwards']] as [v, l] (v)}
          <label><input type="radio" name="dir" value={v} bind:group={dir} /> {l}</label>
        {/each}
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>3. The field points {bField > 0 ? 'out of the page, towards you' : 'into the page'}. With that direction of motion, is the charge…</legend>
        {#each [['positive', 'positive'], ['negative', 'negative']] as [v, l] (v)}
          <label><input type="radio" name="charge" value={v} bind:group={charge} /> {l}</label>
        {/each}
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>4. From its ionisation at that momentum, is it…</legend>
        {#each [['light', 'light, like an electron or a muon'], ['heavy', 'heavy, like a proton']] as [v, l] (v)}
          <label><input type="radio" name="mass" value={v} bind:group={mass} /> {l}</label>
        {/each}
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>5. So the particle is…</legend>
        {#each CHOICES as c (c.id)}
          <label><input type="radio" name="who" value={c.id} bind:group={who} /> {c.label}</label>
        {/each}
      </fieldset>
    </div>
  </div>
  <div class="row">
    <button type="button" class="go" disabled={!ready || !info} onclick={() => (revealed = true)}>Check my answers</button>
    <button type="button" onclick={onnext}>{first ? 'Take another exposure' : 'Another exposure'}</button>
  </div>
  {#if revealed && truth}
    <div class="result" role="status">
      <ul>
        <li>{tick(side === truthSide)} Tighter curve {truthSide === 'above' ? 'above' : 'below'} the plate, because the particle lost momentum there.</li>
        <li>{tick(dir === truth.direction)} It moved <strong>{truth.direction === 'up' ? 'upwards' : 'downwards'}</strong>.</li>
        <li>{tick(charge === truthCharge)} The charge is <strong>{truthCharge}</strong>.</li>
        <li>{tick(mass === truthMass)} It is {truthMass === 'light' ? 'light' : 'heavy'}.</li>
        <li>{tick(who === truth.truth)} It was <strong>{NAMES[truth.truth] ?? truth.truth}</strong>.</li>
      </ul>
      {#if first}
        <p>
          This is a re-simulation of the kind of track Carl Anderson photographed at Caltech in 1932, with the field, plate and momenta as he reported them in
          <em>The positive electron</em> (Physical Review 43, 491 (1933)): about 1.5 T (15 kG), 6 mm of lead, and about {(ANDERSON.pBefore * 1000).toFixed(0)} MeV/c before the plate and
          {(ANDERSON.pAfter * 1000).toFixed(0)} MeV/c after it. A particle with the electron's mass and a positive charge: the first antiparticle seen. Dirac's relativistic equation for the electron (1928) had
          solutions of negative energy, which in 1931 he interpreted as such a particle; Chapter 9 tells the story.
        </p>
      {:else}
        <p>Each exposure here is simulated; the geometry is the same as Anderson's (1.5 T, 6 mm of lead), and any of these particles could have been in his photographs.</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.7rem 0.9rem 0.8rem;
    background: var(--pn);
    font-size: 0.86rem;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
    font-family: var(--font-mono);
    border: 0;
    padding: 0;
  }
  .lead {
    margin: 0 0 0.6rem;
    color: var(--ink-2);
  }
  .qs {
    display: grid;
    gap: 0.7rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
  }
  legend {
    padding: 0;
    margin-bottom: 0.2rem;
    font-weight: 500;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }
  .row {
    margin-top: 0.8rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    font-size: 0.84rem;
  }
  button.go {
    background: var(--track);
    color: #04161b;
    border-color: var(--track);
    font-weight: 600;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .result {
    margin-top: 0.8rem;
    border-left: 3px solid var(--track);
    padding: 0.2rem 0.8rem;
    background: var(--track-soft);
    border-radius: 0 6px 6px 0;
  }
  .result ul {
    list-style: none;
    padding: 0;
    margin: 0.3rem 0;
    display: grid;
    gap: 0.2rem;
  }
  .result p {
    margin: 0.4rem 0;
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
</style>
