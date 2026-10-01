<!--
  The reaction exercise: for each reaction, is it allowed or forbidden, and (when the spec says so) by which law or by which force?

  Spec: { id, title, prompt, hints?, solution?, explain?,
          reactions: [{ text, answer: 'allowed' | 'forbidden', law?: 'charge' | 'baryon' | 'lepton-e' | 'lepton-mu' | 'lepton-tau' | 'strangeness' | 'charm' | 'bottom' | 'energy',
                       force?: 'strong' | 'electromagnetic' | 'weak' }] }

  `text` is read by hep/conservation's parser ("K- + p -> Omega- + K+ + K0"). `law` is asked for when the answer is forbidden, and `force` when it is allowed;
  leave either out to skip the second question. The truth is computed from the particle table by `checkReaction` and must agree with the spec
  (a test in hep/conservation reads the chapters to be sure); the feedback names the law and gives the totals. Keyboard: radio groups and a select.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';
  import { checkReaction, parseReaction, formatReaction, LAWS, type CheckResult } from '$lib/hep/conservation';

  interface Item { text: string; answer: 'allowed' | 'forbidden'; law?: string; force?: string }
  interface Spec extends ExerciseBase { reactions: Item[] }
  let { spec }: { spec: Spec } = $props();

  const LAW_NAME: Record<string, string> = Object.fromEntries(LAWS.map((l) => [l.id, l.name]));
  const FORCES = [
    { id: 'strong', label: 'the strong force' },
    { id: 'electromagnetic', label: 'the electromagnetic force' },
    { id: 'weak', label: 'the weak force' },
  ];
  // the judgement and the optional law or force, per reaction
  let picked = $state<string[]>(spec.reactions.map(() => ''));
  let law = $state<string[]>(spec.reactions.map(() => ''));
  let force = $state<string[]>(spec.reactions.map(() => ''));
  let checked = $state(false);

  onMount(() => {
    progress.load();
    const saved = progress.draft<{ p: string[]; l: string[]; f: string[] } | null>(spec.id, null);
    if (saved) {
      picked = spec.reactions.map((_, i) => saved.p?.[i] ?? '');
      law = spec.reactions.map((_, i) => saved.l?.[i] ?? '');
      force = spec.reactions.map((_, i) => saved.f?.[i] ?? '');
    }
  });

  const truth = $derived(
    spec.reactions.map((r): { parsed: ReturnType<typeof parseReaction>; res: CheckResult | null } => {
      const parsed = parseReaction(r.text);
      let res: CheckResult | null = null;
      try { if (!parsed.errors.length) res = checkReaction(parsed.initial, parsed.final); } catch { /* unknown particle */ }
      return { parsed, res };
    }),
  );
  // "allowed" in the spec means that some force can do it; "forbidden" that an exact law is broken (or a flavour changes by two units).
  const lawsBroken = (res: CheckResult | null) => (res ? (res.details.exactBroken.length ? res.details.exactBroken : res.details.flavourBroken) : []);

  function okItem(i: number): { judge: boolean; second: boolean | null } {
    const spec_i = spec.reactions[i]!;
    const t = truth[i]!.res;
    const judge = picked[i] === spec_i.answer;
    let second: boolean | null = null;
    if (spec_i.answer === 'forbidden' && spec_i.law) second = lawsBroken(t).includes(law[i] as never);
    if (spec_i.answer === 'allowed' && spec_i.force) second = force[i] === spec_i.force;
    return { judge, second };
  }
  const allOk = $derived(checked && spec.reactions.every((_, i) => { const o = okItem(i); return o.judge && (o.second === null || o.second); }));

  function check() {
    progress.saveDraft(spec.id, { p: picked, l: law, f: force });
    checked = true;
    if (spec.reactions.every((_, i) => { const o = okItem(i); return o.judge && (o.second === null || o.second); })) progress.markSolved(spec.id);
  }
  const ready = $derived(spec.reactions.every((r, i) => picked[i] !== '' && (picked[i] !== 'forbidden' || !r.law || law[i] !== '') && (picked[i] !== 'allowed' || !r.force || force[i] !== '')));
  const fmt = (x: number) => (Number.isInteger(x) ? (x > 0 ? '+' + x : String(x)) : x.toFixed(2));
</script>

<ExerciseFrame id={spec.id} kind="Reaction" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  <form class="ui rx" onsubmit={(e) => { e.preventDefault(); check(); }}>
    <ol>
      {#each spec.reactions as r, i (i)}
        {@const t = truth[i]!}
        {@const o = checked ? okItem(i) : null}
        <li>
          <div class="re">{t.res ? formatReaction(t.parsed.initial, t.parsed.final) : r.text}</div>
          {#if t.parsed.errors.length}<div class="err">This reaction could not be read: {t.parsed.errors.join(' ')}</div>{/if}
          <fieldset>
            <legend class="p3-sr">Is {r.text} allowed?</legend>
            <label><input type="radio" name="{spec.id}-{i}" value="allowed" bind:group={picked[i]} /> allowed</label>
            <label><input type="radio" name="{spec.id}-{i}" value="forbidden" bind:group={picked[i]} /> forbidden</label>
          </fieldset>
          {#if picked[i] === 'forbidden' && r.law}
            <label class="sub">By which law?
              <select bind:value={law[i]}>
                <option value="">choose…</option>
                {#each LAWS as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
              </select>
            </label>
          {/if}
          {#if picked[i] === 'allowed' && r.force}
            <label class="sub">Which force would do it?
              <select bind:value={force[i]}>
                <option value="">choose…</option>
                {#each FORCES as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
              </select>
            </label>
          {/if}
          {#if checked && o && t.res}
            {@const res = t.res}
            <div class="fb" class:ok={o.judge && (o.second === null || o.second)}>
              <strong>{o.judge && (o.second === null || o.second) ? '✓' : '✗'}</strong>
              {#if res.details.interaction === 'forbidden'}
                Forbidden: {lawsBroken(res).map((x) => LAW_NAME[x] + ' (' + fmt(res.details.laws.find((l) => l.id === x)!.initial) + ' before, ' + fmt(res.details.laws.find((l) => l.id === x)!.final) + ' after)').join('; ')}.
              {:else}
                Allowed: every exact law holds. {res.details.interaction === 'strong' ? 'Only hadrons take part: the strong force.' : res.details.interaction === 'electromagnetic' ? 'A photon or charged lepton takes part: the electromagnetic force.' : 'The weak force: a neutrino takes part, or a flavour number changes by one unit.'}
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <button type="submit" class="go" disabled={!ready}>Check</button>
  </form>
  {#if checked}
    <Verdict ok={allOk}>{allOk ? 'Every reaction is judged correctly.' : 'Some are wrong: the marks show which.'}</Verdict>
    {#if allOk && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
  {/if}
</ExerciseFrame>

<style>
  ol { margin: 0; padding-left: 1.4rem; display: grid; gap: 0.9rem; }
  .re { font-family: var(--font-mono); font-size: 0.98rem; }
  fieldset { border: 0; padding: 0; margin: 0.25rem 0 0; display: flex; gap: 1.2rem; }
  label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-size: 0.88rem; }
  .sub { display: flex; margin-top: 0.3rem; gap: 0.5rem; }
  select { font: inherit; font-size: 0.85rem; padding: 0.15rem 0.4rem; background: var(--panel); color: var(--ink); border: 1px solid var(--line-strong); border-radius: 4px; }
  .fb { margin-top: 0.3rem; font-size: 0.84rem; color: var(--ink-2); border-left: 3px solid var(--bad); padding-left: 0.6rem; }
  .fb.ok { border-color: var(--ok); }
  .err { color: var(--bad); font-size: 0.84rem; }
  .go { margin-top: 0.9rem; border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent-ink); border-radius: var(--radius-sm); padding: 0.35rem 1rem; font-weight: 700; cursor: pointer; min-height: 2.3rem; }
  .go:disabled { opacity: 0.5; cursor: default; }
  .explain { margin-top: 0.5rem; padding: 0.5rem 0.8rem 0.1rem; border-left: 3px solid var(--ok); background: var(--surface-2); font-family: var(--font-body); font-size: 0.98rem; }
  .p3-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
