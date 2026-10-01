<!--
  The diagram sketchpad (Chapter 15): draw the Feynman diagrams of a process and let the vertex rules judge them.

    ::diagram-sketchpad{process="e+ e- > mu+ mu-" forces="qed,weak" n="15.2" caption="…"}

  `process` is the starting process; the reader can switch to a preset or type any process ("e+ e- > mu+ mu- gamma"). `forces` are the
  interactions of the answer key (comma-separated from qed, qcd, weak, higgs, fermi). `lock` hides the process chooser.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import SketchpadCore from './SketchpadCore.svelte';
  import { PRESETS } from './sketch';
  import { formatProcess, parseProcess, processSymbols, tryParseProcess, type Force, type Process } from '$lib/hep/diagrams';

  let {
    process = 'e+ e- > mu+ mu-',
    forces,
    n,
    caption,
    title = 'Diagram sketchpad',
    lock = false,
  }: {
    process?: string;
    forces?: string;
    n?: string | number;
    caption?: string;
    title?: string;
    lock?: boolean;
  } = $props();

  const parseForces = (f: string | undefined): Force[] | undefined => {
    const list = (f ?? '').split(/[,\s]+/).filter(Boolean) as Force[];
    return list.length ? list : undefined;
  };

  let text = $state(process);
  let applied = $state(process);
  let selForces = $state<Force[] | undefined>(parseForces(forces));
  let error = $state('');
  const ALL: { id: Force; label: string }[] = [
    { id: 'qed', label: 'QED (γ)' },
    { id: 'qcd', label: 'QCD (g)' },
    { id: 'weak', label: 'Weak (W, Z)' },
    { id: 'higgs', label: 'Higgs' },
  ];
  const proc = $derived<Process>(tryParseProcess(applied).ok ? parseProcess(applied) : parseProcess('e+ e- > mu+ mu-'));
  const effectiveForces = $derived(selForces ?? (['qed', 'qcd', 'weak'] as Force[]));

  function apply(t: string) {
    const r = tryParseProcess(t);
    if (!r.ok) {
      error = r.error;
      return;
    }
    error = '';
    applied = t;
    text = formatProcess(r.process);
  }
  function preset(i: number) {
    const p = PRESETS[i];
    if (!p) return;
    selForces = p.forces ? [...p.forces] : undefined;
    apply(p.process);
  }
  function toggle(f: Force) {
    const cur = new Set(effectiveForces);
    if (cur.has(f)) cur.delete(f);
    else cur.add(f);
    selForces = [...cur];
  }
  const keyId = $derived(`${applied}|${effectiveForces.join(',')}`);
</script>

<Widget {title} {n} {caption} kind="Sketchpad" live={false}>
  {#snippet controls()}
    {#if !lock}
      <div class="ctl ui">
        <label>Preset
          <select onchange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; if (v !== '') preset(Number(v)); (e.currentTarget as HTMLSelectElement).value = ''; }}>
            <option value="">choose a process…</option>
            {#each PRESETS as p, i (i)}<option value={i}>{p.label}</option>{/each}
          </select>
        </label>
        <form onsubmit={(e) => { e.preventDefault(); apply(text); }}>
          <label>Process
            <input type="text" bind:value={text} spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="proc-help" aria-invalid={!!error} />
          </label>
          <button type="submit">Set</button>
        </form>
        <fieldset class="forces">
          <legend>Interactions in the answer key</legend>
          {#each ALL as f (f.id)}
            <label class="chk"><input type="checkbox" checked={effectiveForces.includes(f.id)} onchange={() => toggle(f.id)} /> {f.label}</label>
          {/each}
        </fieldset>
      </div>
      <p id="proc-help" class="ui small" class:err={!!error} role={error ? 'alert' : undefined}>
        {error || 'Write particles as e- e+ mu- mu+ tau- nu_e nu_e~ u u~ d g gamma Z W+ W- H, then > between the initial and final state.'}
      </p>
    {:else}
      <p class="ui small">Process: <strong>{processSymbols(proc)}</strong></p>
    {/if}
  {/snippet}
  {#key keyId}
    <SketchpadCore process={proc} options={{ forces: effectiveForces }} />
  {/key}
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: end;
    font-size: 0.82rem;
  }
  .ctl label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    color: var(--mute);
    font-size: 0.72rem;
  }
  form {
    display: flex;
    gap: 0.4rem;
    align-items: end;
  }
  input[type='text'] {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    min-width: 15rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: var(--panel);
    color: var(--ink);
    min-height: 2.1rem;
  }
  select,
  button {
    font: inherit;
    font-size: 0.82rem;
    min-height: 2.1rem;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .forces {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.8rem;
    align-items: center;
  }
  .forces legend {
    font-size: 0.72rem;
    color: var(--mute);
    padding: 0;
    float: left;
    margin-right: 0.6rem;
  }
  .chk {
    flex-direction: row !important;
    align-items: center;
    gap: 0.3rem !important;
    color: var(--ink) !important;
    font-size: 0.82rem !important;
  }
  .small {
    font-size: 0.78rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
  .small.err {
    color: var(--bad);
  }
</style>
