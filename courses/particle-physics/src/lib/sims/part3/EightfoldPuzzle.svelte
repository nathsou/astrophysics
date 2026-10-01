<!--
  The Eightfold Way puzzle (Chapter 12's flagship). Place the baryons on the weight diagram of the octet and of the decuplet by their strangeness
  and charge; the decuplet has one empty corner. Predict its mass from the equal spacing of the rows, then see what the particle must be.
  The diagrams come from hep/su3 (Gelfand–Tsetlin patterns); the masses of the Δ and Ω⁻ from hep/particles. The Σ*(1385) and Ξ*(1530) are
  not in the particle table: their masses (of the neutral members) are kept in hep/su3's DECUPLET_MASSES.

    ::eightfold-puzzle{n="12.4" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { baryonMultiplet, DECUPLET_MASSES, decupletSpacing, omegaStrongDecayThreshold, type Slot } from '$lib/hep/su3';
  import { particle } from '$lib/hep/particles';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  type Kind = 'octet' | 'decuplet';
  interface Chip { id: string; symbol: string; charge: number; strangeness: number; mass: number; note?: string }
  const sup = (q: number) => (q === 0 ? '⁰' : q === 1 ? '⁺' : q === 2 ? '⁺⁺' : q === -1 ? '⁻' : '⁻⁻');

  const fromTable = (id: number): Chip => {
    const p = particle(id);
    return { id: String(id), symbol: p.symbol, charge: p.charge3 / 3, strangeness: p.strangeness, mass: p.mass };
  };
  const OCTET: Chip[] = [2212, 2112, 3222, 3212, 3112, 3122, 3322, 3312].map(fromTable);
  const star = (letter: string, S: number, q: number, m: number): Chip => ({ id: `${letter}*${q}`, symbol: `${letter}*${sup(q)}`, charge: q, strangeness: S, mass: m, note: 'mass of the neutral member' });
  const DECUPLET: Chip[] = [
    ...[2224, 2214, 2114, 1114].map(fromTable),
    star('Σ', -1, 1, DECUPLET_MASSES[-1].mass), star('Σ', -1, 0, DECUPLET_MASSES[-1].mass), star('Σ', -1, -1, DECUPLET_MASSES[-1].mass),
    star('Ξ', -2, 0, DECUPLET_MASSES[-2].mass), star('Ξ', -2, -1, DECUPLET_MASSES[-2].mass),
  ];

  let kind = $state<Kind>('octet');
  const slots = $derived(baryonMultiplet(kind));
  const chips = $derived(kind === 'octet' ? OCTET : DECUPLET);
  // which chip sits in which slot: slot key → chip ids
  let placed = $state<Record<string, string[]>>({});
  let held = $state<string | null>(null);
  let checked = $state(false);
  let guess = $state(1560);
  let guessed = $state(false);

  const key = (s: Slot) => `${kind}:${s.i3x2},${s.y3}`;
  const capacity = (s: Slot) => Math.max(1, s.all.length || 1);
  const chipById = (id: string) => [...OCTET, ...DECUPLET].find((c) => c.id === id)!;
  const isPlaced = (id: string) => Object.values(placed).some((l) => l.includes(id));
  const free = $derived(chips.filter((c) => !isPlaced(c.id)));

  function clickSlot(s: Slot) {
    const k = key(s);
    const here = placed[k] ?? [];
    if (held) {
      if (s.pdg === null && kind === 'decuplet') return; // the empty corner has no known chip
      if (here.length < capacity(s)) placed[k] = [...here, held];
      held = null;
      checked = false;
    } else if (here.length) {
      // pick the last one back up
      placed[k] = here.slice(0, -1);
      checked = false;
    }
  }
  function isRight(s: Slot, id: string) {
    const c = chipById(id);
    return c.charge === s.charge && c.strangeness === s.strangeness;
  }
  const knownSlots = $derived(slots.filter((s) => !(kind === 'decuplet' && s.strangeness === -3)));
  const allPlaced = $derived(knownSlots.every((s) => (placed[key(s)]?.length ?? 0) === capacity(s)));
  const allRight = $derived(allPlaced && knownSlots.every((s) => (placed[key(s)] ?? []).every((id) => isRight(s, id))));
  const corner = $derived(slots.find((s) => s.strangeness === -3));
  const spacing = decupletSpacing();
  const omega = particle(3334);
  const thr = omegaStrongDecayThreshold();
  const fmtMeV = (g: number) => Math.round(g * 1000).toString();

  // layout in percent
  const X = (s: Slot) => 50 + (s.i3x2 / 2) * (kind === 'decuplet' ? 24 : 38);
  const Y = (s: Slot) => (kind === 'decuplet' ? 12 + ((3 - s.y3) / 3) * 25.3 * 1 : 18 + ((3 - s.y3) / 3) * 32);
  const rowS = $derived(kind === 'decuplet' ? [0, -1, -2, -3] : [0, -1, -2]);
  const rowY = (S: number) => (kind === 'decuplet' ? 12 + (-S) * 25.3 : 18 + (-S) * 32);
  const reset = () => { placed = {}; held = null; checked = false; guessed = false; };
  $effect(() => { void kind; reset(); });
</script>

<Widget title="The Eightfold Way puzzle" {n} {caption} kind="Explore" live={false}>
  {#snippet controls()}
    <Segmented label="Multiplet" size="sm" bind:value={kind} options={[{ value: 'octet', label: 'Octet: spin ½ baryons' }, { value: 'decuplet', label: 'Decuplet: spin 3/2 baryons' }]} />
  {/snippet}
  <p class="p3-note ui" style="margin-top:0">Rows are strangeness S. Along a row the charge Q rises from left to right (the isospin component I₃ rises with it). Pick a particle below, then click the place where it belongs; click a placed particle to pick it up again.</p>
  <div class="diagram" role="group" aria-label="Weight diagram of the {kind}">
    {#each rowS as S}
      <div class="rowlab" style="top:{rowY(S)}%">S = {S}</div>
      <div class="rowline" style="top:{rowY(S)}%"></div>
    {/each}
    {#each slots as s}
      {@const k = key(s)}
      {@const here = placed[k] ?? []}
      {@const isCorner = kind === 'decuplet' && s.strangeness === -3}
      <div class="slot" class:corner={isCorner} style="left:{X(s)}%; top:{Y(s)}%">
        <button
          type="button"
          class="cell"
          class:empty={!here.length}
          class:right={checked && here.length > 0 && here.every((id) => isRight(s, id))}
          class:wrong={checked && here.some((id) => !isRight(s, id))}
          class:target={!!held && here.length < capacity(s) && !isCorner}
          onclick={() => clickSlot(s)}
          aria-label={isCorner ? 'The empty corner: strangeness −3, charge −1' : `Place for charge ${s.charge}, strangeness ${s.strangeness}${here.length ? ', holding ' + here.map((id) => chipById(id).symbol).join(' and ') : ', empty'}`}
        >
          {#if isCorner}
            {#if guessed}<span class="sym">Ω⁻</span><span class="sub">{guess} MeV?</span>{:else}<span class="sym">?</span>{/if}
          {:else if here.length}
            {#each here as id}<span class="sym">{chipById(id).symbol}</span>{/each}
          {:else}<span class="sub">Q = {s.charge}</span>{/if}
          {#if checked && here.length && here.every((id) => isRight(s, id))}<span class="tick" aria-hidden="true">✓</span>{/if}
          {#if checked && here.some((id) => !isRight(s, id))}<span class="tick bad" aria-hidden="true">✗</span>{/if}
        </button>
      </div>
    {/each}
  </div>
  <div class="pal ui" role="group" aria-label="Particles to place">
    {#each chips as c (c.id)}
      {#if !isPlaced(c.id)}
        <button type="button" class="chip" class:on={held === c.id} aria-pressed={held === c.id} onclick={() => (held = held === c.id ? null : c.id)}>
          <strong>{c.symbol}</strong> <span>Q = {c.charge}, S = {c.strangeness}, {fmtMeV(c.mass)} MeV</span>
        </button>
      {/if}
    {/each}
    {#if !free.length}<span class="p3-note">All placed.</span>{/if}
  </div>
  <div class="row ui">
    <Button size="sm" onclick={() => (checked = true)} disabled={!allPlaced}>Check the placement</Button>
    <Button size="sm" variant="ghost" onclick={reset}>Start again</Button>
    {#if checked}<span role="status" class="res">{allRight ? '✓ Every particle is in its place.' : '✗ Some are not: a mark shows which. Compare the charge and strangeness of the chip with the row and the direction of rising charge.'}</span>{/if}
  </div>

  {#if kind === 'octet' && checked && allRight}
    <p class="p3-note ui">Eight particles, eight places, and the centre holds two: Σ⁰ and Λ share the weight (I₃ = 0, Y = 0), which the pattern predicts (multiplicity 2). Their masses are 1192.6 and 1115.7 MeV: the pattern says which place a particle has, not what it weighs.</p>
  {/if}

  {#if kind === 'decuplet'}
    <div class="predict">
      <h5 class="p3-h">The empty corner</h5>
      {#if !(allRight && checked)}
        <p class="p3-note ui" style="margin-top:0">Place all nine known particles and check them. The tenth place is at S = −3, charge −1.</p>
      {:else}
        <p class="p3-note ui" style="margin-top:0">
          The rows are {fmtMeV(DECUPLET_MASSES[0].mass)}, {fmtMeV(DECUPLET_MASSES[-1].mass)} and {fmtMeV(DECUPLET_MASSES[-2].mass)} MeV: the steps are {fmtMeV(spacing.step1)} and {fmtMeV(spacing.step2)} MeV. Predict the mass of the particle in the empty corner.
        </p>
        <Slider bind:value={guess} min={1500} max={1900} step={1} label="Your prediction for the mass of the S = −3 particle" format={(v) => `${v.toFixed(0)} MeV`} />
        <div class="row ui"><Button size="sm" onclick={() => (guessed = true)}>Lock in the prediction</Button></div>
        {#if guessed}
          <div class="reveal" role="status">
            <p>
              <strong>Equal spacing</strong> puts it {fmtMeV(spacing.step2)} MeV above the last row: {fmtMeV(spacing.omegaFromLastSpacing)} MeV (a straight line through all three rows gives {fmtMeV(spacing.omegaFromMeanSpacing)}).
              You said {guess} MeV: {Math.abs(guess - 1000 * spacing.omegaFromLastSpacing) < 25 ? 'well within the range that a straight-line argument gives.' : 'a little away from a straight line through the rows.'}
            </p>
            <p>
              It has S = −3, charge −1 and spin 3/2: three strange quarks. The strong force could only turn it into a Ξ and an anti-kaon, which conserve strangeness, and
              those weigh at least {fmtMeV(thr.threshold)} MeV together, more than the particle itself. Every decay that is open changes strangeness, so it is a weak decay: slow, and long enough to leave a visible track.
              The Ω⁻ as it is known today has a mass of {fmtMeV(omega.mass)} MeV and a mean life of {(omega.lifetime * 1e12).toFixed(0)} ps. The next figure shows how it was found.
            </p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</Widget>

<style>
  .diagram { position: relative; width: 100%; max-width: 640px; margin: 0.6rem auto; aspect-ratio: 1.25; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .rowline { position: absolute; left: 12%; right: 2%; border-top: 1px dashed var(--line-strong); opacity: 0.6; }
  .rowlab { position: absolute; left: 6px; transform: translateY(-50%); font-size: 0.72rem; font-family: var(--font-mono); color: var(--mute); }
  .slot { position: absolute; transform: translate(-50%, -50%); width: 22%; min-width: 64px; }
  .cell { width: 100%; min-height: 56px; border: 2px dashed var(--line-strong); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 0.15rem; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-family: var(--font-ui); }
  .cell.empty .sub { color: var(--mute); font-size: 0.7rem; }
  .cell:not(.empty) { border-style: solid; border-color: var(--accent); }
  .cell.target { border-color: var(--accent); background: var(--accent-soft); }
  .cell.right { border-color: var(--ok); background: var(--ok-soft); }
  .cell.wrong { border-color: var(--bad); background: var(--bad-soft); }
  .cell:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .corner .cell { border-color: var(--c-key); }
  .sym { font-size: 1.1rem; font-weight: 700; }
  .sub { font-size: 0.72rem; }
  .tick { position: absolute; top: 2px; right: 6px; font-weight: 800; color: var(--ok); }
  .tick.bad { color: var(--bad); }
  .pal { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; }
  .chip { border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.78rem; text-align: left; }
  .chip strong { font-size: 0.95rem; }
  .chip span { color: var(--ink-2); }
  .chip.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .chip.on span { color: var(--on-accent); }
  .chip:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-top: 0.4rem; }
  .res { font-size: 0.86rem; }
  .predict { margin-top: 0.8rem; border-top: 1px solid var(--line); padding-top: 0.6rem; }
  .reveal { margin-top: 0.6rem; border-left: 3px solid var(--c-key); padding: 0.1rem 0.8rem; background: var(--surface-2); font-size: 0.93rem; }
</style>
