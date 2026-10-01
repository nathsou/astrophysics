<!--
  The reaction judge (Chapter 11's flagship): type a reaction, and every law of the ledger is checked against the quantum numbers in hep/particles.
  The verdict names the law that forbids it, or the force that can do it, and says each time that "allowed" is not "observed".
  If the reader has solved the Chapter 11 exercise and ticks "use my code", the headline verdict is computed by the reader's checker
  (hook conservation.checkReaction); the table of totals always comes from the library.

    ::reaction-judge{n="11.2" caption="…" start="K- + p -> Omega- + K+ + K0"}
-->
<script lang="ts">
  import './part3.css';
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { checkReaction, parseReaction, formatReaction, LAWS } from '$lib/hep/conservation';
  import { hook } from '$lib/hep/hooks';
  import { applyMine, listMine } from '$lib/code/apply';

  let { n, caption, start = 'K- + p -> Omega- + K+ + K0' }: { n?: string | number; caption?: string; start?: string } = $props();

  interface Preset { text: string; note: string }
  const PRESETS: Preset[] = [
    { text: 'K- + p -> Omega- + K+ + K0', note: 'The reaction that made the first Ω⁻ (Chapter 12). Strangeness −1 before and after: three strange quarks appear, two strange antiquarks keep the books.' },
    { text: 'pi- + p -> K0 + Lambda', note: 'Associated production: the kaon (S = +1) and the Λ (S = −1) are made together.' },
    { text: 'pi- + p -> K0 + n', note: 'The same pions and protons, but one strange particle alone: strangeness 0 before, +1 after.' },
    { text: 'Lambda -> p + pi-', note: 'Λ has S = −1, and its decay products have none. Observed, slowly (2.6 × 10⁻¹⁰ s): the weak force changes strangeness.' },
    { text: 'p -> e+ + gamma', note: 'Baryon number and electron-lepton number both fail. No proton decay has ever been seen (Chapter 32).' },
    { text: 'mu- -> e- + gamma', note: 'Charge and baryon number are fine; the lepton flavours are not. Searched for at the level of parts in 10¹³ and never seen.' },
    { text: 'n -> p + e- + anti-nu_e', note: 'Neutron decay, a weak process.' },
    { text: 'pi0 -> gamma + gamma + gamma', note: 'Every law here holds, and the decay is never seen: charge conjugation forbids it, a law that is not in this ledger. Allowed is not observed.' },
    { text: 'p + p -> p + p + p + anti-p', note: 'The antiproton experiment of Chapter 9.' },
    { text: 'Xi- -> n + pi-', note: 'Strangeness would change by two units at once: a single weak vertex changes it by at most one.' },
  ];

  let text = $state(start);
  let useMine = $state(true);
  let mine = $state<{ hook: string; exercise: string; enabled: boolean }[]>([]);
  onMount(() => { mine = listMine().filter((m) => m.hook === 'conservation.checkReaction'); });

  const parsed = $derived(parseReaction(text));
  const result = $derived(parsed.errors.length || !parsed.initial.length ? null : safe(() => checkReaction(parsed.initial, parsed.final)));
  function safe<T>(f: () => T): T | null { try { return f(); } catch { return null; } }

  const readerVerdict = $derived.by(() => {
    if (!result || !useMine || !mine.some((m) => m.enabled)) return null;
    const applied = applyMine();
    if (applied.errors['conservation.checkReaction']) return { error: applied.errors['conservation.checkReaction'] };
    const fn = hook('conservation.checkReaction', checkReaction);
    try {
      const r = fn(parsed.initial, parsed.final) as { allowed: boolean; violated: string[] };
      return { allowed: r.allowed, violated: r.violated };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });

  const fmtNum = (law: { id: string; initial: number; final: number }, x: number) => (law.id === 'energy' ? x.toFixed(3) : Number.isInteger(x) ? (x > 0 ? '+' + x : String(x)) : x.toFixed(2));
  const preset = $derived(PRESETS.find((p) => p.text.replace(/\s+/g, '') === text.replace(/\s+/g, '')));
  const VERDICT: Record<string, { mark: string; head: string }> = {
    strong: { mark: '✓', head: 'Allowed: the strong force can do it' },
    electromagnetic: { mark: '✓', head: 'Allowed: an electromagnetic process' },
    weak: { mark: '~', head: 'Allowed, but only by the weak force' },
    forbidden: { mark: '✗', head: 'Forbidden' },
  };
  const LAW_NAME: Record<string, string> = Object.fromEntries(LAWS.map((l) => [l.id, l.name]));
</script>

<Widget title="The reaction judge" {n} {caption} kind="Explore" live={false}>
  {#snippet controls()}
    <label class="ui entry">
      <span class="p3-h">Type a reaction (particle names from the table, separated by “ + ”)</span>
      <input type="text" bind:value={text} spellcheck="false" autocomplete="off" aria-describedby="judge-help" />
    </label>
    {#if mine.some((m) => m.enabled)}<Toggle bind:checked={useMine} label="Use my checker for the verdict" />{/if}
  {/snippet}
  <div class="p3-chips ui" role="group" aria-label="Example reactions">
    {#each PRESETS as p}
      <button type="button" class:on={preset === p} onclick={() => (text = p.text)}>{p.text.replace('->', '→')}</button>
    {/each}
  </div>
  <p id="judge-help" class="p3-note ui">Names: <code>p n e- e+ mu- nu_mu gamma pi+ pi0 K- K0 Lambda Sigma+ Xi0 Omega- Delta++</code>; antiparticles <code>anti-p</code>, <code>anti-nu_e</code>. Write <code>-&gt;</code> or <code>→</code>.</p>

  {#if parsed.errors.length}
    <p class="bad ui" role="alert">{parsed.errors.join(' ')}</p>
  {:else if result}
    {@const d = result.details}
    {@const v = VERDICT[d.interaction]!}
    <div class="verdict ui {d.interaction}" role="status" aria-live="polite">
      <span class="mark" aria-hidden="true">{v.mark}</span>
      <div>
        <strong>{v.head}.</strong>
        <div class="re">{formatReaction(parsed.initial, parsed.final)}</div>
        {#if d.firstLaw && d.interaction === 'forbidden'}
          <div>Forbidden by: <strong>{d.exactBroken.length ? d.exactBroken.map((i) => LAW_NAME[i]).join(', ') : LAW_NAME[d.firstLaw]}</strong>{#if !d.exactBroken.length} (a single weak interaction changes it by one unit at most){/if}.</div>
        {:else if d.flavourBroken.length}
          <div>Changes: <strong>{d.flavourBroken.map((i) => LAW_NAME[i]).join(', ')}</strong>.</div>
        {/if}
      </div>
    </div>
    <div class="tw">
      <table class="ui laws">
        <caption class="p3-sr">Each law, the total before the arrow and after it</caption>
        <thead><tr><th scope="col">Law</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Holds?</th></tr></thead>
        <tbody>
          {#each d.laws.filter((l) => l.applies) as l}
            <tr class:bad={!l.conserved}>
              <th scope="row">{l.name}{#if !l.exact}<span class="approx" title="Conserved by the strong and electromagnetic forces, not by the weak force"> (approximate)</span>{/if}</th>
              <td>{fmtNum(l, l.initial)}</td>
              <td>{fmtNum(l, l.final)}</td>
              <td aria-label={l.conserved ? 'yes' : 'no'}>{l.conserved ? '✓' : '✗'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <ul class="why ui">
      {#each d.explanation as line}<li>{line}</li>{/each}
      {#if d.q !== null}<li>Energy released in the decay: Q = {(d.q * 1000).toFixed(d.q < 0 ? 1 : 2)} MeV{d.q < 0 ? ' (negative: the decay is closed)' : ''}.</li>{:else}<li>The final state needs √s ≥ {d.thresholdSqrtS.toFixed(3)} GeV; the initial particles must bring at least that much energy in their centre-of-mass frame.</li>{/if}
    </ul>
    {#if readerVerdict}
      <p class="mine ui" role="status">
        {#if 'error' in readerVerdict}Your checker failed: {readerVerdict.error}{:else}Your checker says: <strong>{readerVerdict.allowed ? 'allowed' : 'violated: ' + readerVerdict.violated.join(', ')}</strong>.{/if}
      </p>
    {/if}
    {#if preset}<p class="p3-note ui"><strong>About this example.</strong> {preset.note}</p>{/if}
    <p class="p3-note ui"><strong>Allowed is not observed.</strong> The ledger holds necessary conditions. A reaction that passes them can still be absent: too little energy, a rate too small to measure, or a law that is not in the ledger (charge conjugation, parity, angular momentum in detail). A reaction that fails them is never seen.</p>
  {/if}
</Widget>

<style>
  .entry { display: block; margin-bottom: 0.4rem; }
  input[type='text'] { width: 100%; padding: 0.5rem 0.7rem; font-family: var(--font-mono); font-size: 0.95rem; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--panel); color: var(--ink); box-sizing: border-box; }
  input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  .bad { color: var(--bad); font-size: 0.88rem; }
  .verdict { display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.6rem 0.9rem; border-radius: 6px; border-left: 4px solid var(--line-strong); background: var(--panel); margin: 0.4rem 0 0.7rem; }
  .verdict.strong, .verdict.electromagnetic { border-color: var(--ok); background: var(--ok-soft); }
  .verdict.weak { border-color: var(--maybe); background: var(--maybe-soft); }
  .verdict.forbidden { border-color: var(--bad); background: var(--bad-soft); }
  .mark { font-size: 1.6rem; font-weight: 800; line-height: 1; min-width: 1.4rem; text-align: center; }
  .re { font-family: var(--font-mono); font-size: 0.95rem; margin: 0.15rem 0; }
  .tw { overflow-x: auto; }
  .laws { border-collapse: collapse; font-size: 0.84rem; width: 100%; font-variant-numeric: tabular-nums; }
  .laws th, .laws td { padding: 0.25rem 0.6rem; text-align: right; border-bottom: 1px solid var(--line); text-transform: none; letter-spacing: 0; }
  .laws th:first-child { text-align: left; font-weight: 500; }
  .laws thead th { font-size: 0.72rem; color: var(--mute); font-weight: 600; }
  .laws tr.bad td, .laws tr.bad th { background: var(--bad-soft); font-weight: 700; }
  .approx { color: var(--mute); font-size: 0.75rem; font-weight: 400; }
  .why { margin: 0.6rem 0 0; padding-left: 1.2rem; font-size: 0.86rem; color: var(--ink-2); }
  .mine { font-size: 0.86rem; border-left: 3px solid var(--c-programmer); padding-left: 0.6rem; }
</style>
