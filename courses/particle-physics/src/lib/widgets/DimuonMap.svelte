<!--
  The dimuon map: the invariant mass of 100,000 real muon pairs from CMS (2011 data, CC0), on log axes.
  The mass is computed with `kinematics.pairMass`, through the hook: if the reader has solved Chapter 2's exercise
  and "use my code" is on, it is the reader's function that draws the peaks.

    ::dimuon-map{reveal="rho,phi" n="2.1" caption="…"}

  `reveal` names the peaks the chapter has explained so far: rho (ρ and ω), phi, jpsi, psi2s, upsilon, z.
  Peaks not listed are not marked. Hover the plot to read the mass and count of a bin.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { loadDimuon, type DimuonEvents } from '$lib/hep/data';
  import { hook } from '$lib/hep/hooks';
  import { pairMass } from '$lib/hep/kinematics';
  import { particle } from '$lib/hep/particles';
  import { applyMine, listMine } from '$lib/code/apply';

  let { reveal = '', n, title = 'Invariant mass of muon pairs', caption }: { reveal?: string; n?: string | number; title?: string; caption?: string } = $props();

  const PEAKS: Record<string, { label: string; ids: number[] }> = {
    rho: { label: 'ρ, ω', ids: [113] },
    phi: { label: 'φ', ids: [333] },
    jpsi: { label: 'J/ψ', ids: [443] },
    psi2s: { label: 'ψ(2S)', ids: [100443] },
    upsilon: { label: 'Υ', ids: [553, 100553, 200553] },
    z: { label: 'Z', ids: [23] },
  };

  let events = $state<DimuonEvents | null>(null);
  let failed = $state<string | null>(null);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  let useMine = $state(true);
  let binsPerDecade = $state(60);

  onMount(async () => {
    mine = listMine().filter((m) => m.hook === 'kinematics.pairMass');
    try {
      events = await loadDimuon(base);
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const LO = 0.3;
  const HI = 300;
  const nb = $derived(Math.round(Math.log10(HI / LO) * binsPerDecade));
  const edges = $derived(Array.from({ length: nb + 1 }, (_, i) => LO * 10 ** ((i / nb) * Math.log10(HI / LO))));

  const result = $derived.by(() => {
    if (!events) return { counts: new Array<number>(nb).fill(0), note: '' };
    let note: string;
    if (useMine && mine.some((m) => m.enabled)) {
      const applied = applyMine();
      const used = applied.active.includes('kinematics.pairMass') ? 'your code' : 'the library';
      const err = applied.errors['kinematics.pairMass'];
      note = err ? `Your code failed to load (${err}); showing the library's.` : `Computed with ${used}.`;
    } else {
      applyMine(); // clears any overrides
      note = 'Computed with the library.';
    }
    const fn = hook('kinematics.pairMass', pairMass);
    const c = new Array<number>(nb).fill(0);
    const k = nb / Math.log10(HI / LO);
    let bad = 0;
    for (let i = 0; i < events.n; i++) {
      const m = fn(events.mu1(i), events.mu2(i));
      if (!Number.isFinite(m)) {
        bad++;
        continue;
      }
      const b = Math.floor(Math.log10(m / LO) * k);
      if (b >= 0 && b < nb) c[b]!++;
    }
    if (bad) note += ` ${bad} events gave NaN or infinity and were dropped.`;
    return { counts: c, note };
  });
  const counts = $derived(result.counts);
  const note = $derived(result.note);

  const markers = $derived(
    reveal
      .split(/[,\s]+/)
      .filter(Boolean)
      .flatMap((id, j) => {
        const pk = PEAKS[id];
        if (!pk) return [];
        return pk.ids.map((pdg, k) => ({ x: particle(pdg).mass, label: k === 0 ? pk.label : '', at: 0.95 - 0.08 * ((j + k) % 3) }));
      }),
  );
</script>

<Widget {title} {n} {caption} kind="Real data">
  {#snippet controls()}
    <label class="ui ctl">Bins per decade <input type="range" min="20" max="120" step="10" bind:value={binsPerDecade} /> <span>{binsPerDecade}</span></label>
    {#if mine.length}
      <label class="ui ctl"><input type="checkbox" bind:checked={useMine} /> use my code</label>
    {/if}
  {/snippet}
  {#if failed}
    <p class="ui">{failed}</p>
  {:else if !events}
    <p class="ui">Loading 100,000 events…</p>
  {:else}
    <HepHist
      label="Histogram of the invariant mass of 100,000 opposite-sign muon pairs, on logarithmic axes from 0.3 to 300 GeV"
      series={[{ edges, counts, label: `CMS 2011 data, ${events.n.toLocaleString('en-GB')} events`, errors: false }]}
      x={{ type: 'log', domain: [LO, HI], label: 'invariant mass of the muon pair [GeV]', tickValues: [0.3, 1, 3, 10, 30, 100, 300] }}
      y={{ type: 'log', domain: [1, 10000], label: 'events per bin' }}
      {markers}
      height={360}
    />
    <p class="ui note">{note}</p>
  {/if}
</Widget>

<style>
  .ctl {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.75rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
</style>
