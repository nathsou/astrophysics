<!--
  Measure a simulated chamber picture on the scanning table, then enter what you found.

  Spec: { id, title, prompt, hints?, solution?, explain?,
          config: { preset, seed, field?, plate? },      the picture: a name for hep/chamber's makePicture (cloud-mixed, cloud-alpha,
                                                          cloud:alpha,mu-,e+, anderson, omega, v0, pair) and its random seed
          answers: { momentum?: {…}, radius?: {…}, length?: {…}, angle?: {…}, charge?: {…} },
          tolerance? }                                     default relative tolerance (0.1 = 10 %)

  Each answer is { track: "A" | between: ["B","C"], value?, tolerance?, toleranceAbs?, label? }: `track` is the letter drawn on the
  picture; `value` fixes the expected number (otherwise it is taken from the simulated track); `tolerance` is a fraction of the
  true value, `toleranceAbs` an absolute half-width in the unit of the quantity. Units: momentum GeV/c, radius and length mm,
  angle degrees, charge ±1 (entered as + or −).

  Mouse: the ruler, circle and angle tools of the scanning table. Keyboard: the crosshair of the table (arrow keys, Enter), the
  track list, and, below, a table of sampled coordinates and a three-point circle calculator that take typed numbers.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';
  import ScanTable from '$lib/sims/chambers/ScanTable.svelte';
  import { makePicture, circleThrough, momentumFromRadiusMm, type Picture } from '$lib/hep/chamber';
  import { rng as makeRng, normal } from '$lib/hep/random';
  import { ANSWER_TITLES, ANSWER_UNITS, coordinateTable, gradeAnswers, labelOf, trackOf, type AnswerKey, type AnswerSpec, type Verdict as V } from '$lib/sims/chambers/grading';
  import type { Measurement } from '$lib/sims/chambers/tools';

  interface Spec extends ExerciseBase {
    config?: { preset?: string; seed?: number; field?: number; plate?: boolean };
    answers: Partial<Record<AnswerKey, AnswerSpec>>;
    tolerance?: number;
    /** Reserved for a historic photograph (not used by the simulated pictures). */
    image?: string;
  }
  let { spec }: { spec: Spec } = $props();

  let pic = $state.raw<Picture | null>(null);
  let measurements = $state<Measurement[]>([]);
  let typed = $state<Record<string, string>>({});
  let verdicts = $state<V[] | null>(null);
  let failed = $state('');

  const keys = $derived(Object.keys(spec.answers) as AnswerKey[]);

  onMount(() => {
    progress.load();
    typed = progress.draft<Record<string, string>>(spec.id, {});
    const id = setTimeout(() => {
      try {
        const c = spec.config ?? {};
        pic = makePicture(c.preset ?? 'cloud:alpha,mu-,e+', c.seed ?? 1, { bField: c.field, plate: c.plate });
      } catch (e) {
        failed = e instanceof Error ? e.message : String(e);
      }
    }, 10);
    return () => clearTimeout(id);
  });

  function num(s: string | undefined): number | null {
    if (s === undefined) return null;
    const t = s.trim().replace(',', '.');
    if (t === '+' ) return 1;
    if (t === '−' || t === '-') return -1;
    const v = Number(t);
    return t === '' || !Number.isFinite(v) ? null : v;
  }

  function check() {
    if (!pic) return;
    progress.saveDraft(spec.id, typed);
    const entered: Partial<Record<AnswerKey, number | null>> = {};
    for (const k of keys) entered[k] = k === 'charge' ? (typed[k] === '+' ? 1 : typed[k] === '-' ? -1 : null) : num(typed[k]);
    verdicts = gradeAnswers(spec.answers, pic, entered, spec.tolerance ?? 0.1);
    if (verdicts.every((v) => v.ok)) progress.markSolved(spec.id);
  }

  // Fill an answer from the latest measurement of the matching kind.
  function fromMeasurement(k: AnswerKey) {
    const last = (tool: Measurement['tool']) => [...measurements].reverse().find((m) => m.tool === tool);
    let v: number | undefined;
    if (k === 'momentum') v = last('circle')?.pT;
    else if (k === 'radius') v = last('circle')?.value;
    else if (k === 'length') v = last('ruler')?.value;
    else if (k === 'angle') v = last('angle')?.value;
    if (v !== undefined && Number.isFinite(v)) typed[k] = String(Number(v.toPrecision(4)));
  }
  const hasMeasurement = (k: AnswerKey) => (k === 'momentum' || k === 'radius' ? measurements.some((m) => m.tool === 'circle') : k === 'length' ? measurements.some((m) => m.tool === 'ruler') : k === 'angle' ? measurements.some((m) => m.tool === 'angle') : false);

  // Keyboard alternative: a table of coordinates and a three-point circle calculator
  const refTracks = $derived.by(() => {
    if (!pic) return [];
    const refs = new Set<string>();
    for (const k of keys) {
      const a = spec.answers[k]!;
      if (a.track !== undefined) refs.add(String(a.track));
      a.between?.forEach((b) => refs.add(String(b)));
    }
    return [...refs].map((r) => ({ ref: r, track: trackOf(pic!, r), label: labelOf(pic!, r) })).filter((x) => x.track);
  });
  function table(ref: { track: NonNullable<ReturnType<typeof trackOf>> }) {
    const r = makeRng(1000 + ref.track.id);
    const noise = ref.track.points.map(() => [normal(r, 0, 0.18), normal(r, 0, 0.18)] as [number, number]);
    return coordinateTable(ref.track, Math.max(5, Math.round(ref.track.length / 14 / 5) * 5), (i) => noise[i]!);
  }
  let cpts = $state([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }]);
  const circle = $derived.by(() => {
    const raw = cpts.flatMap((p) => [p.x, p.y]);
    const v = raw.map((s) => Number(s.replace(',', '.')));
    if (raw.some((s) => s.trim() === '') || v.some((x) => !Number.isFinite(x))) return null;
    const r = circleThrough({ x: v[0]!, y: v[1]! }, { x: v[2]!, y: v[3]! }, { x: v[4]!, y: v[5]! });
    return r ? { R: r.R, p: pic ? momentumFromRadiusMm(r.R, pic.bField) : NaN } : 'straight';
  });
  function useCircle() {
    if (circle && circle !== 'straight') {
      if (keys.includes('radius')) typed['radius'] = String(Number(circle.R.toPrecision(4)));
      if (keys.includes('momentum')) typed['momentum'] = String(Number(circle.p.toPrecision(4)));
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="Scan" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  {#if failed}
    <p class="ui">The picture could not be simulated: {failed}</p>
  {:else if !pic}
    <p class="ui">Simulating the picture…</p>
  {:else}
    <ScanTable embedded exercise picture={pic} bind:measurements />
    <form class="ui answers" onsubmit={(e) => { e.preventDefault(); check(); }}>
      <h5>Your answers</h5>
      {#each keys as k (k)}
        {@const a = spec.answers[k]!}
        <div class="row">
          {#if k === 'charge'}
            <label for="{spec.id}-{k}">{a.label ?? `Sign of the charge of track ${a.track ?? ''}`}</label>
            <select id="{spec.id}-{k}" bind:value={typed[k]}>
              <option value="">choose…</option>
              <option value="+">positive (+)</option>
              <option value="-">negative (−)</option>
            </select>
          {:else}
            <label for="{spec.id}-{k}">{a.label ?? (k === 'angle' ? `Angle between tracks ${a.between?.join(' and ') ?? ''}` : `${ANSWER_TITLES[k]} of track ${a.track ?? ''}`)}</label>
            <input id="{spec.id}-{k}" inputmode="decimal" autocomplete="off" placeholder="number" bind:value={typed[k]} />
            <span class="unit">{ANSWER_UNITS[k]}</span>
            {#if hasMeasurement(k)}<button type="button" class="link" onclick={() => fromMeasurement(k)}>use my last measurement</button>{/if}
          {/if}
        </div>
      {/each}
      <button type="submit" class="go">Check</button>
    </form>
    {#if verdicts}
      {#each verdicts as v (v.key)}<Verdict ok={v.ok}>{v.title}: {v.message}</Verdict>{/each}
      {#if verdicts.every((v) => v.ok) && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
    {/if}

    <details class="alt ui">
      <summary>Keyboard and screen-reader alternative: typed coordinates instead of the mouse tools</summary>
      <p>
        The tables list positions along the tracks (x to the right, y up, in millimetres, with the scatter of a real scan), and the field is
        {Math.abs(pic.bField).toFixed(2)} T {pic.bField >= 0 ? 'out of the page' : 'into the page'}. Pick three points on a track, well apart, and the calculator finds the circle through them;
        p⊥ = 0.29979 · B · R with R in metres gives the momentum in GeV/c.
      </p>
      {#each refTracks as r (r.ref)}
        <table>
          <caption>Track {r.ref}</caption>
          <thead><tr><th scope="col">path s [mm]</th><th scope="col">x [mm]</th><th scope="col">y [mm]</th></tr></thead>
          <tbody>
            {#each table({ track: r.track! }) as row (row.s)}
              <tr><td>{row.s.toFixed(0)}</td><td>{row.x.toFixed(1)}</td><td>{row.y.toFixed(1)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/each}
      <fieldset class="calc">
        <legend>Circle through three points</legend>
        {#each cpts as p, i (i)}
          <label>point {i + 1}: x <input inputmode="decimal" bind:value={p.x} /> y <input inputmode="decimal" bind:value={p.y} /> mm</label>
        {/each}
        <p role="status">
          {#if circle === 'straight'}The points are in a straight line.
          {:else if circle}R = {circle.R.toFixed(1)} mm, p⊥ = {circle.p >= 1 ? circle.p.toFixed(3) + ' GeV/c' : (circle.p * 1000).toFixed(1) + ' MeV/c'}
            <button type="button" class="link" onclick={useCircle}>use these in my answers</button>
          {:else}Enter the six numbers.{/if}
        </p>
      </fieldset>
    </details>
  {/if}
</ExerciseFrame>

<style>
  .answers {
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
  }
  .row label {
    min-width: 15rem;
  }
  input,
  select {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
    width: 9rem;
  }
  select {
    width: auto;
  }
  .unit {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--track-ink);
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
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
    margin: 0.5rem 1rem 0.5rem 0;
    display: inline-table;
    vertical-align: top;
  }
  caption {
    text-align: left;
    font-weight: 600;
    padding-bottom: 0.2rem;
  }
  th,
  td {
    text-align: right;
    padding: 0.1rem 0.6rem 0.1rem 0;
    text-transform: none;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .calc {
    border: 1px solid var(--line);
    border-radius: 6px;
    display: grid;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
  .calc input {
    width: 6rem;
  }
</style>
