<!--
  Identify the particles in a cloud-chamber picture or an event display from the clues: how thick each track is (ionisation),
  how it curves (radius → momentum, sign of charge), how long it is (range) and whether it has a kink.

  Spec: { id, title, prompt, hints?, solution?, explain?,
          event: { preset?: "cloud" | "anderson" | "omega" | "v0" | "pair" | "cloud-mixed" …, seed?, plate? },
                  "cloud" (the default) draws exactly the particles named in `answers`, one per label A, B, C…; the other presets
                  are hep/chamber's makePicture and their labelled tracks are the ones named in `answers` (or the preset's truth)
          answers: ["alpha", "mu-", "e+"],   one particle per labelled track. Ids: alpha, e-, e+, mu-, mu+, pi-, pi+, K-, K+, p, pbar.
                  An id without a sign ("mu", "pi", "e") accepts either charge.
          config: { field?: tesla, choices?: [ids shown in the lists] } }

  Pass when every track is right. The feedback says which clue each track gave. Keyboard: a select per track, the measurement
  crosshair of the scanning table, and a table of the numbers a scan of each track gives.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';
  import ScanTable from '$lib/sims/chambers/ScanTable.svelte';
  import { PARTICLE_CHOICES, composeCloudPicture, explainTrack, makePicture, sameParticle, type Picture } from '$lib/hep/chamber';
  import { selectionInfo, fmtIonisation, fmtMomentum } from '$lib/sims/chambers/info';
  import type { Measurement } from '$lib/sims/chambers/tools';

  interface Spec extends ExerciseBase {
    event?: { preset?: string; seed?: number; plate?: boolean };
    answers: string[];
    config?: { field?: number; choices?: string[] };
  }
  let { spec }: { spec: Spec } = $props();

  let pic = $state.raw<Picture | null>(null);
  let failed = $state('');
  let measurements = $state<Measurement[]>([]);
  let chosen = $state<string[]>([]);
  let checked = $state(false);

  const choices = $derived(
    (spec.config?.choices ?? PARTICLE_CHOICES.map((c) => c.id)).map((id) => PARTICLE_CHOICES.find((c) => c.id === id) ?? { id, pdg: 0, label: id, plain: id }),
  );

  onMount(() => {
    progress.load();
    const saved = progress.draft<string[]>(spec.id, []);
    const id = setTimeout(() => {
      try {
        const ev = spec.event ?? {};
        const seed = ev.seed ?? 1;
        const field = spec.config?.field ?? 1;
        pic = !ev.preset || ev.preset === 'cloud' || ev.preset === 'compose' ? composeCloudPicture(spec.answers, seed, { bField: field, plate: ev.plate }) : makePicture(ev.preset, seed, { bField: spec.config?.field, plate: ev.plate });
        chosen = pic.labels.map((_, i) => saved[i] ?? '');
      } catch (e) {
        failed = e instanceof Error ? e.message : String(e);
      }
    }, 10);
    return () => clearTimeout(id);
  });

  const expected = $derived(pic ? pic.labels.map((l, i) => spec.answers[i] ?? l.truth) : []);
  const results = $derived(pic ? pic.labels.map((l, i) => ({ l, ok: sameParticle(expected[i]!, chosen[i] ?? '') || (chosen[i] === expected[i]) })) : []);
  const nameOf = (id: string) => choices.find((c) => c.id === id)?.label ?? PARTICLE_CHOICES.find((c) => c.id === id)?.label ?? id;
  const plainOf = (id: string) => PARTICLE_CHOICES.find((c) => c.id === id)?.plain ?? id;

  function check() {
    if (!pic) return;
    progress.saveDraft(spec.id, chosen);
    checked = true;
    if (results.every((r) => r.ok)) progress.markSolved(spec.id);
  }

  const scan = $derived(
    pic
      ? pic.labels.map((l) => {
          const t = pic!.set.tracks[l.trackId]!;
          return { letter: l.letter, info: selectionInfo(t, pic!.bField, pic!.medium, pic!.kind) };
        })
      : [],
  );
  const ptText = (x: number | null) => (x === null ? 'straight' : fmtMomentum(x));
</script>

<ExerciseFrame id={spec.id} kind="Identify" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  {#if failed}
    <p class="ui">The picture could not be simulated: {failed}</p>
  {:else if !pic}
    <p class="ui">Simulating the picture…</p>
  {:else}
    <ScanTable embedded exercise picture={pic} bind:measurements />
    <form class="ui ident" onsubmit={(e) => { e.preventDefault(); check(); }}>
      <h5>What made each track?</h5>
      {#each pic.labels as l, i (l.letter)}
        <div class="row">
          <label for="{spec.id}-{l.letter}">Track {l.letter}</label>
          <select id="{spec.id}-{l.letter}" bind:value={chosen[i]}>
            <option value="">choose…</option>
            {#each choices as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
          </select>
          {#if checked}<span class="mark" aria-hidden="true">{results[i]?.ok ? '✓' : '✗'}</span>{/if}
        </div>
      {/each}
      <button type="submit" class="go" disabled={chosen.some((c) => !c)}>Check</button>
    </form>
    {#if checked}
      <Verdict ok={results.every((r) => r.ok)}>{results.every((r) => r.ok) ? 'All the tracks are identified.' : `${results.filter((r) => r.ok).length} of ${results.length} right.`}</Verdict>
      <ul class="fb ui">
        {#each results as r, i (r.l.letter)}
          <li class:ok={r.ok}>
            <strong>Track {r.l.letter}</strong>:
            {#if r.ok}✓ {nameOf(expected[i]!)}.{:else}✗ you chose {nameOf(chosen[i] ?? '')}; it was {plainOf(expected[i]!)}.{/if}
            The clues: {explainTrack(pic, r.l)}
          </li>
        {/each}
      </ul>
      {#if results.every((r) => r.ok) && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
    {/if}

    <details class="alt ui">
      <summary>Keyboard and screen-reader alternative: the numbers a scan of each track gives</summary>
      <table>
        <caption>Measured properties (no identities)</caption>
        <thead>
          <tr><th scope="col">Track</th><th scope="col">Length [mm]</th><th scope="col">Ionisation</th><th scope="col">Radius [mm]</th><th scope="col">p⊥ (charge ±e)</th><th scope="col">Sense ① → ②</th><th scope="col">Kink</th><th scope="col">Stops?</th></tr>
        </thead>
        <tbody>
          {#each scan as s (s.letter)}
            {@const seg = s.info.segments[0]}
            <tr>
              <th scope="row">{s.letter}</th>
              <td>{s.info.length.toFixed(0)}</td>
              <td>{fmtIonisation(s.info.ionisation)} minimum</td>
              <td>{seg?.R ? seg.R.toFixed(0) : 'straight'}</td>
              <td>{ptText(seg?.pT ?? null)}</td>
              <td>{seg?.sense === 1 ? 'anticlockwise' : seg?.sense === -1 ? 'clockwise' : '–'}</td>
              <td>{s.info.kinks.length ? s.info.kinks.map((k) => `${k.angleDeg.toFixed(0)}°`).join(', ') : 'none'}</td>
              <td>{s.info.stops ? 'yes (range)' : 'no'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p>The field is {Math.abs(pic.bField).toFixed(2)} T {pic.bField >= 0 ? 'out of the page' : 'into the page'}. “Sense” is the sense of rotation if the particle moved from end ① (the left or upper end) to end ②; the charge sign follows once you decide which way it moved (these particles all enter from the top).</p>
    </details>
  {/if}
</ExerciseFrame>

<style>
  .ident {
    margin-top: 0.9rem;
    display: grid;
    gap: 0.5rem;
  }
  h5 {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
    font-family: var(--font-mono);
    border: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
  }
  .row label {
    min-width: 5.5rem;
    font-weight: 600;
  }
  select {
    font-size: 0.9rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
    max-width: 100%;
  }
  .mark {
    font-weight: 700;
  }
  .go {
    justify-self: start;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 6px;
    padding: 0.35rem 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .fb {
    margin: 0.6rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.4rem;
    font-size: 0.86rem;
  }
  .fb li {
    border-left: 3px solid var(--bad);
    padding: 0.2rem 0.6rem;
  }
  .fb li.ok {
    border-color: var(--ok);
  }
  .explain {
    margin-top: 0.5rem;
    font-size: 0.92rem;
  }
  .alt {
    margin-top: 0.9rem;
  }
  .alt summary {
    cursor: pointer;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .alt table {
    border-collapse: collapse;
    font-size: 0.78rem;
    margin: 0.5rem 0;
    display: block;
    overflow-x: auto;
  }
  caption {
    text-align: left;
    font-weight: 600;
    padding-bottom: 0.2rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.15rem 0.8rem 0.15rem 0;
    text-transform: none;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
