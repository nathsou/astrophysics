<!--
  Gaussian elimination on a 3 × 3 system, one row operation at a time: the same algorithm as the simulator's
  LU solver. Edit the numbers or pick a preset, step forward, and watch the multipliers pile up into L.

    ::gauss-stepper{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { PRESETS, fmt, gaussSteps, matmul, permute, solveWithLU, unknownName, type Preset } from './gauss';

  let { n: fig }: { n?: string | number } = $props();

  const N = 3;
  let presetId = $state('ladder');
  let cells = $state<string[][]>(PRESETS[0]!.A.map((r, i) => [...r.map(String), String(PRESETS[0]!.b[i])]));
  let largest = $state(false);
  let pos = $state(0);
  let extra = $state(['0', '1', '0']);

  const preset = $derived(PRESETS.find((p) => p.id === presetId)!);
  const parsed = $derived.by(() => {
    const nums = cells.map((r) => r.map((c) => Number(c.replace('−', '-').trim() === '' ? NaN : c.replace('−', '-'))));
    return nums.flat().every(Number.isFinite) ? nums : null;
  });
  const sol = $derived(parsed ? gaussSteps(parsed.map((r) => r.slice(0, N)), parsed.map((r) => r[N]!), largest ? 'largest' : 'first-nonzero') : null);
  const last = $derived(sol ? sol.steps.length - 1 : 0);
  const step = $derived(sol ? sol.steps[Math.min(pos, last)]! : null);

  function choose(p: Preset) {
    presetId = p.id;
    cells = p.A.map((r, i) => [...r.map(String), String(p.b[i])]);
    pos = 0;
  }
  function edit(i: number, j: number, v: string) {
    cells[i]![j] = v;
    presetId = 'custom';
    pos = 0;
  }

  const LU_READY = $derived(!!sol && !sol.singular && !!step && step.kind !== 'start' && sol.steps.slice(0, pos + 1).some((s) => s.kind === 'triangular'));
  const check = $derived.by(() => {
    if (!sol || sol.singular || !parsed) return null;
    const PA = permute(parsed.map((r) => r.slice(0, N)), sol.perm);
    const LU = matmul(sol.L, sol.U);
    return { PA, LU };
  });
  const again = $derived.by(() => {
    if (!sol || sol.singular) return null;
    const b = extra.map((c) => Number(c.replace('−', '-')));
    if (!b.every(Number.isFinite)) return null;
    return { b, x: solveWithLU(sol.L, sol.U, sol.perm, b) };
  });

  const cellClass = (i: number, j: number) => ({
    pivot: !!step?.pivot && step.pivot[0] === i && step.pivot[1] === j && step.kind !== 'back',
    zero: !!step && j < N && j < i && step.m[i]![j] === 0 && step.kind !== 'start',
  });
  const varLabel = (j: number) => (j === N ? '=' : unknownName(j, N));
</script>

<Widget title="Gaussian elimination stepper" n={fig} kind="Stepper" live={false} onreset={() => choose(PRESETS[0]!)} caption="Press Next to do one row operation at a time. Choose ‘A zero where the pivot should be’ to see a row swap, and ‘A floating node’ to see what a singular circuit looks like to the solver.">
  {#snippet controls()}
    <label class="ap-label sel">
      <span>System</span>
      <select class="ap-input" value={presetId} onchange={(e) => { const p = PRESETS.find((q) => q.id === e.currentTarget.value); if (p) choose(p); }}>
        {#each PRESETS as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
        {#if presetId === 'custom'}<option value="custom">Your own numbers</option>{/if}
      </select>
    </label>
    <Toggle bind:checked={largest} label="Largest pivot, as the simulator does" onchange={() => (pos = 0)} />
  {/snippet}

  <div class="gs">
    <p class="ap-note blurb">{preset?.blurb ?? 'Edit any number: the steps below follow.'}</p>

    <div class="grid2">
      <div class="panel">
        <h5>The equations</h5>
        <div class="editor" role="group" aria-label="Coefficients">
          {#each cells as row, i (i)}
            <div class="erow">
              {#each row as c, j (j)}
                {#if j === N}<span class="eqs" aria-hidden="true">=</span>{/if}
                <input class="ap-input cell" value={c} oninput={(e) => edit(i, j, e.currentTarget.value)} aria-label="Row {i + 1}, {j === N ? 'right-hand side' : 'coefficient of ' + unknownName(j, N)}" inputmode="decimal" aria-invalid={!Number.isFinite(Number(c.replace('−', '-')))} />
                {#if j < N}<span class="var">{unknownName(j, N)}{j < N - 1 ? ' +' : ''}</span>{/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>

      <div class="panel">
        <h5>The matrix {step ? `· step ${Math.min(pos, last) + 1} of ${last + 1}` : ''}</h5>
        {#if step}
          <table class="mat" aria-label="Augmented matrix after this step">
            <thead>
              <tr>{#each Array(N + 1) as _, j (j)}<th class:sep={j === N}>{varLabel(j)}</th>{/each}</tr>
            </thead>
            <tbody>
              {#each step.m as row, i (i)}
                <tr class:hl={step.rows.includes(i)} class:pivotrow={step.pivot?.[0] === i && step.kind !== 'back'}>
                  {#each row as v, j (j)}
                    <td class:sep={j === N} class={cellClass(i, j).pivot ? 'pivot' : cellClass(i, j).zero ? 'zero' : ''}>{fmt(v)}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="ap-bad">Every box needs a number.</p>
        {/if}
      </div>
    </div>

    {#if step}
      <p class="say" class:ap-bad={step.kind === 'singular'} aria-live="polite">{step.text}</p>
      <div class="btns">
        <Button size="sm" onclick={() => (pos = Math.max(0, pos - 1))} disabled={pos === 0}>← Back</Button>
        <Button size="sm" variant="primary" onclick={() => (pos = Math.min(last, pos + 1))} disabled={pos >= last}>Next →</Button>
        <Button size="sm" onclick={() => (pos = last)} disabled={pos >= last}>Run to the end</Button>
        <Button size="sm" variant="ghost" onclick={() => (pos = 0)} disabled={pos === 0}>Start again</Button>
      </div>
    {/if}

    {#if LU_READY && sol && check}
      <div class="lu">
        <h5>What the multipliers made: L and U</h5>
        <p class="ap-note">The multipliers (below the diagonal of L) are what elimination subtracted; U is the triangular matrix it left behind. Multiplying them gives back the original rows (in the order used): the LU factorisation.</p>
        <div class="trio">
          <div><b>L</b><table class="mat small"><tbody>{#each sol.L as row, i (i)}<tr>{#each row as v, j (j)}<td class:zero={j > i}>{fmt(v)}</td>{/each}</tr>{/each}</tbody></table></div>
          <span class="op">×</span>
          <div><b>U</b><table class="mat small"><tbody>{#each sol.U as row, i (i)}<tr>{#each row as v, j (j)}<td class:zero={j < i}>{fmt(v)}</td>{/each}</tr>{/each}</tbody></table></div>
          <span class="op">=</span>
          <div><b>{sol.perm.some((p, i) => p !== i) ? 'P · A' : 'A'}</b><table class="mat small"><tbody>{#each check.LU as row, i (i)}<tr>{#each row as v, j (j)}<td>{fmt(v)}</td>{/each}</tr>{/each}</tbody></table></div>
        </div>
        <h5>A new right-hand side costs almost nothing</h5>
        <p class="ap-note">Change only the right-hand side (the sources of the circuit) and the expensive elimination is not repeated: two quick sweeps with L and U give the answer.</p>
        <div class="again">
          {#each extra as c, i (i)}
            <label class="ap-label"><span>b{i + 1}</span><input class="ap-input cell" bind:value={extra[i]} inputmode="decimal" /></label>
          {/each}
          <span class="arrow" aria-hidden="true">→</span>
          <output class="res">{#if again}{again.x.map((v, i) => `${unknownName(i, N)} = ${fmt(v)}`).join(',  ')}{:else}enter three numbers{/if}</output>
        </div>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .gs {
    display: grid;
    gap: 0.9rem;
    padding: 0.8rem 1.1rem 1.2rem;
  }
  .sel {
    min-width: 12rem;
  }
  .blurb {
    min-height: 2.6em;
  }
  .grid2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.9rem;
  }
  @media (max-width: 42rem) {
    .grid2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .panel {
    padding: 0.7rem 0.8rem 0.8rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    min-width: 0;
    overflow-x: auto;
  }
  h5 {
    margin: 0 0 0.5rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-ui) !important;
    font-size: 0.72rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--mute);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .editor {
    display: grid;
    gap: 0.35rem;
  }
  .erow {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .cell {
    width: 3.7rem;
    padding: 0.3rem 0.35rem;
    text-align: right;
    min-height: 1.9rem;
  }
  .eqs {
    padding: 0 0.15rem;
  }
  .var {
    white-space: nowrap;
  }
  @media (max-width: 30rem) {
    .erow .cell {
      width: 2.75rem;
      padding: 0.3rem 0.25rem;
    }
    .erow {
      gap: 0.1rem;
      font-size: 0.75rem;
    }
    .var {
      min-width: 1.1rem;
    }
  }
  .var {
    min-width: 1.5rem;
  }
  .mat {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.92rem;
    margin: 0 auto;
  }
  .mat th {
    text-align: right;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--mute);
    padding: 0 0.6rem 0.25rem;
  }
  .mat td {
    text-align: right;
    padding: 0.28rem 0.6rem;
    min-width: 3.2rem;
    color: var(--fg);
  }
  .mat .sep {
    border-left: 2px solid var(--line-strong);
  }
  .mat tr.hl td {
    background: color-mix(in srgb, var(--sig-high) 13%, transparent);
  }
  .mat tr.pivotrow td {
    background: color-mix(in srgb, var(--series-3) 16%, transparent);
  }
  .mat td.pivot {
    font-weight: 700;
    outline: 2px solid var(--series-3);
    outline-offset: -2px;
  }
  .mat td.zero {
    color: var(--mute);
  }
  .mat.small td {
    padding: 0.2rem 0.45rem;
    min-width: 2.6rem;
    font-size: 0.85rem;
  }
  .say {
    margin: 0 !important;
    padding: 0.6rem 0.85rem;
    background: var(--panel);
    border-left: 3px solid var(--copper);
    border-radius: 0 6px 6px 0;
    font-family: var(--font-ui);
    font-size: 0.9rem;
    line-height: 1.5;
    min-height: 3.6em;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .lu {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem;
    border: 1px dashed var(--line-strong);
    border-radius: 8px;
  }
  .trio {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    justify-content: center;
  }
  .trio b {
    display: block;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--copper-ink);
  }
  .op {
    font-size: 1.3rem;
    color: var(--mute);
  }
  .again {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: end;
  }
  .again .cell {
    width: 4.2rem;
  }
  .arrow {
    font-size: 1.3rem;
    color: var(--mute);
    padding-bottom: 0.2rem;
  }
  .res {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 600;
    padding-bottom: 0.4rem;
  }
</style>
