<!--
  `rewrite` exercises: a docket of peephole rewrites. For each one, decide whether it is correct at every width;
  for each wrong one, add a precondition that makes it correct without making it vacuous. The court checks each
  decision at every listed width.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import { courtVerdicts } from '$lib/components/rewrite/court';
  import { showValue } from '$lib/fv/rewrite/peephole';
  import { progress } from '$lib/state/progress.svelte';

  interface Spec {
    id: string;
    title?: string;
    prompt?: string;
    rewrites: string[];
    widths?: number[];
    hints?: string[];
    success?: string;
    /** A bug-museum exhibit this exercise catches. */
    exhibit?: string;
  }
  let { spec }: { spec: Spec } = $props();
  // svelte-ignore state_referenced_locally
  const widths = spec.widths ?? [8, 16, 32];

  type Choice = { verdict: '' | 'correct' | 'wrong'; pre: string };
  type Outcome = { ok: boolean; text: string };
  // svelte-ignore state_referenced_locally
  let choices = $state<Choice[]>(spec.rewrites.map(() => ({ verdict: '', pre: '' })));
  let outcomes = $state<(Outcome | undefined)[]>([]);
  let running = $state(false);
  let solved = $state(false);

  onMount(() => {
    const d = progress.draft<Choice[] | undefined>(spec.id, undefined);
    if (d && d.length === choices.length) choices = d;
  });

  const withPre = (rule: string, pre: string) => (/\bif\b/.test(rule) ? `${rule} && (${pre})` : `${rule} if ${pre}`);

  function describe(v: Awaited<ReturnType<typeof courtVerdicts>>['verdicts'][number]): string {
    const c = v.counterexample!;
    const inputs = c.inputs.map(([n, x]) => `${n} = ${showValue(x, v.width).hex}`).join(', ');
    const side = (s: typeof c.lhs) => (!s.defined ? 'undefined' : typeof s.v === 'boolean' ? String(s.v) : showValue(s.v, v.width).hex);
    return `At ${v.width} bits, ${inputs}: the left side is ${side(c.lhs)}, the right side ${side(c.rhs)}.`;
  }

  async function check() {
    running = true;
    solved = false;
    progress.saveDraft(spec.id, $state.snapshot(choices));
    const out: (Outcome | undefined)[] = [];
    try {
      for (let i = 0; i < spec.rewrites.length; i++) {
        const rule = spec.rewrites[i]!;
        const ch = choices[i]!;
        if (!ch.verdict) {
          out.push({ ok: false, text: 'No decision yet.' });
          continue;
        }
        const truth = await courtVerdicts(rule, widths);
        const refuted = truth.verdicts.find((v) => v.status === 'refuted');
        const allProved = truth.verdicts.every((v) => v.status === 'proved');
        if (ch.verdict === 'correct') {
          out.push(allProved ? { ok: true, text: `Correct: proved at ${widths.join(', ')} bits.` } : refuted ? { ok: false, text: `Not correct. ${describe(refuted)}` } : { ok: false, text: 'The court could not decide this rule in time.' });
          continue;
        }
        if (allProved) {
          out.push({ ok: false, text: `It is correct: the court proves it at ${widths.join(', ')} bits.` });
          continue;
        }
        if (!ch.pre.trim()) {
          out.push({ ok: false, text: `Right, it is wrong. ${refuted ? describe(refuted) : ''} Now add a precondition that makes it correct.` });
          continue;
        }
        const fixed = await courtVerdicts(withPre(rule, ch.pre), widths);
        if (fixed.error) out.push({ ok: false, text: fixed.error });
        else if (fixed.verdicts.every((v) => v.status === 'proved')) out.push({ ok: true, text: `Right, and with your precondition it is proved at ${widths.join(', ')} bits.` });
        else {
          const r = fixed.verdicts.find((v) => v.status === 'refuted');
          const vac = fixed.verdicts.find((v) => v.status === 'vacuous');
          out.push({ ok: false, text: r ? `Still wrong with that precondition. ${describe(r)}` : vac ? `That precondition never holds at ${vac.width} bits, so it proves nothing. Find a weaker one.` : 'The court could not decide the repaired rule in time; try a simpler precondition.' });
        }
      }
      outcomes = out;
      if (out.every((o) => o?.ok)) {
        solved = true;
        progress.markSolved(spec.id);
        if (spec.exhibit) progress.markCaught(spec.exhibit);
      }
    } finally {
      running = false;
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="rewrite" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <ol class="docket">
    {#each spec.rewrites as rule, i (i)}
      {@const o = outcomes[i]}
      <li class:ok={o?.ok} class:bad={o && !o.ok}>
        <code class="rule">{rule}</code>
        <div class="row ui">
          <label><input type="radio" name="{spec.id}-{i}" value="correct" bind:group={choices[i]!.verdict} /> correct</label>
          <label><input type="radio" name="{spec.id}-{i}" value="wrong" bind:group={choices[i]!.verdict} /> wrong</label>
          {#if choices[i]!.verdict === 'wrong'}
            <label class="pre">repair: <span class="if">if</span> <input class="code" bind:value={choices[i]!.pre} placeholder="precondition" spellcheck="false" autocomplete="off" /></label>
          {/if}
        </div>
        {#if o}<p class="out ui">{o.ok ? '✓' : '✗'} {o.text}</p>{/if}
      </li>
    {/each}
  </ol>
  <div class="bar ui">
    <button type="button" class="go" onclick={check} disabled={running}>{running ? 'The court is sitting…' : 'Submit to the court'}</button>
    <span class="target">Checked at {widths.join(', ')} bits</span>
  </div>
  {#if solved}<div class="success" role="status"><strong class="ui">All rulings upheld.</strong> {#if spec.success}{@html spec.success}{/if}</div>{/if}
</ExerciseFrame>

<style>
  .docket {
    margin: 0.4rem 0;
    padding-left: 1.4rem;
    display: grid;
    gap: 0.6rem;
  }
  .docket li {
    padding: 0.3rem 0.5rem;
    border-left: 3px solid var(--line);
  }
  .docket li.ok {
    border-left-color: var(--seal);
  }
  .docket li.bad {
    border-left-color: var(--pencil);
  }
  .rule {
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    align-items: center;
    margin-top: 0.25rem;
    font-size: 0.85rem;
  }
  .pre {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    min-width: 12rem;
  }
  .if {
    font-family: var(--font-mono);
    color: var(--ink-2);
  }
  input.code {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .out {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
  }
  li.ok .out {
    color: var(--seal);
  }
  li.bad .out {
    color: var(--pencil);
  }
  .bar {
    display: flex;
    gap: 0.5rem;
    margin: 0.5rem 0;
    flex-wrap: wrap;
    align-items: center;
  }
  button {
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .target {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-left: auto;
  }
  .success {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--seal) 45%, var(--line));
    background: var(--seal-soft);
    border-radius: var(--radius-sm);
  }
</style>
