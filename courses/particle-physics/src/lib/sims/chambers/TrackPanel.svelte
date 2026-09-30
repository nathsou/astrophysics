<!--
  What the scanner can tell about the selected track: length, ionisation, the radius of curvature and momentum on each
  side of a plate, the sense of the curve and (once the reader says which way the particle moved) the sign of the charge.
  It is a measurement tool, not a label: the identity is only shown when the reader asks.
-->
<script lang="ts">
  import type { Track } from '$lib/hep/chamber';
  import { fmtIonisation, fmtMomentum, inferredCharge, type SelectionInfo } from './info';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  let {
    info,
    track,
    bField,
    plates = [],
    allowReveal = true,
  }: { info: SelectionInfo | null; track: Track | null; bField: number; plates?: { y0: number; y1: number }[]; allowReveal?: boolean } = $props();

  let way = $state<'fwd' | 'back'>('fwd');
  let revealed = $state(false);
  $effect(() => {
    void info?.id;
    way = 'fwd';
    revealed = false;
  });

  function where(yMid: number): string {
    if (!plates.length) return '';
    const p = plates[0]!;
    if (yMid > p.y1) return ' above the plate';
    if (yMid < p.y0) return ' below the plate';
    return '';
  }
  const curved = $derived(info?.segments.filter((s) => s.sense !== 0) ?? []);
  const charge = $derived(curved.length ? inferredCharge(curved[0]!.sense, bField, way === 'fwd') : null);
  const senseWord = (s: 1 | -1 | 0) => (s === 0 ? 'straight' : s > 0 ? 'anticlockwise' : 'clockwise');
  const ptText = (x: number) => (x >= 1 ? x.toFixed(2) + ' GeV/c' : (x * 1000).toFixed(x < 0.1 ? 1 : 0) + ' MeV/c');
  const chargeName = (q: number) => (q === 0 ? 'neutral' : q > 0 ? `+${Math.abs(q) === 1 ? '' : q}e` : `−${Math.abs(q) === 1 ? '' : Math.abs(q)}e`);
</script>

<section class="panel ui" aria-live="polite" aria-label="Track measurement">
  <h5>Track measurement</h5>
  {#if !info || !track}
    <p class="empty">No track selected. Click a track in the picture, or choose one from the list below it.</p>
  {:else}
    <dl>
      <dt>Length</dt>
      <dd>{info.length.toFixed(0)} mm of visible track{info.stops ? ', and it stops inside the chamber' : ', and it leaves the picture'}</dd>
      <dt>Ionisation</dt>
      <dd>{fmtIonisation(info.ionisation)} that of a minimum-ionising particle</dd>
      {#each info.segments as s, i (i)}
        <dt>{info.segments.length > 1 ? `Curvature${where(s.yMid)}` : 'Curvature'}</dt>
        <dd>
          {#if s.R === null}
            straight to within the measurement: R too large to tell{bField === 0 ? ' (and there is no field)' : ''}
          {:else}
            radius R = {s.R.toFixed(0)} mm{#if s.pT !== null}, so p⊥ = 0.29979·B·R = <strong>{ptText(s.pT)}</strong> for a charge of ±e{/if}; curves <strong>{senseWord(s.sense)}</strong> going ① → ②
          {/if}
        </dd>
      {/each}
      {#if info.kinks.length}
        <dt>Kinks</dt>
        <dd>{info.kinks.map((k) => `${k.angleDeg.toFixed(0)}° change of direction`).join('; ')}</dd>
      {/if}
    </dl>
    {#if curved.length && bField !== 0}
      <div class="way">
        <span id="way-label">Which way did it move?</span>
        <Segmented
          label="Direction of motion"
          size="sm"
          bind:value={way}
          options={[
            { value: 'fwd', label: '① → ②' },
            { value: 'back', label: '② → ①' },
          ]}
        />
        <p class="infer">
          Field {bField > 0 ? 'out of the page' : 'into the page'}, curve {senseWord(curved[0]!.sense)} in that direction: F = q v × B says the charge is
          <strong>{charge === null ? 'unknown' : charge > 0 ? 'positive' : 'negative'}</strong>.
        </p>
      </div>
    {/if}
    {#if allowReveal}
      <button type="button" class="reveal" onclick={() => (revealed = !revealed)} aria-expanded={revealed}>{revealed ? 'Hide' : 'Show'} what it really was</button>
      {#if revealed}
        <p class="truth">
          In the simulation: <strong>{track.symbol}</strong> ({track.name}), charge {chargeName(track.charge)}, momentum {fmtMomentum(track.p0)} at the start{track.origin !== 'primary' ? `, made as a ${track.origin}` : ''}.
        </p>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    background: var(--pn);
    font-size: 0.84rem;
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
  .empty {
    margin: 0;
    color: var(--ink-2);
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 0.8rem;
  }
  dt {
    color: var(--mute);
  }
  dd {
    margin: 0;
    color: var(--fg);
  }
  .way {
    margin-top: 0.6rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.8rem;
  }
  .infer {
    flex-basis: 100%;
    margin: 0;
  }
  .reveal {
    margin-top: 0.6rem;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink-2);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .reveal:hover {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .truth {
    margin: 0.4rem 0 0;
  }
  @media (max-width: 520px) {
    dl {
      grid-template-columns: 1fr;
    }
    dt {
      margin-top: 0.25rem;
    }
  }
</style>
