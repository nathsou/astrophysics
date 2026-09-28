<!--
  Fill in the blanks of a proof. The text contains [[id]] placeholders; each blank is an
  expression (checked by the CAS for equality with the answer), a word, or a choice.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Checker, parseExpr, toTex } from '$lib/cas';
  import katex from 'katex';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import { casOptions, type CasSpec, type ExerciseBase } from './types';

  interface Blank extends CasSpec {
    answer: string | number;
    /** Other accepted answers (text blanks). */
    accept?: string[];
    kind?: 'expr' | 'text' | 'choice';
    options?: string[];
    width?: number;
  }
  interface Spec extends ExerciseBase, CasSpec {
    text: string;
    blanks: Record<string, Blank>;
  }

  let { spec }: { spec: Spec } = $props();

  type State = 'empty' | 'ok' | 'bad' | 'error';
  let values = $state<Record<string, string>>({});
  let states = $state<Record<string, State>>({});
  let checked = $state(false);
  let root: HTMLDivElement;

  const html = $derived(spec.text.replace(/\[\[([\w-]+)\]\]/g, (_, id: string) => `<span class="blank-slot" data-blank="${id}"></span>`));

  function kindOf(b: Blank): 'expr' | 'text' | 'choice' {
    return b.kind ?? (b.options ? 'choice' : 'expr');
  }

  function checkOne(id: string): State {
    const b = spec.blanks[id];
    const v = (values[id] ?? '').trim();
    if (!b || !v) return 'empty';
    const kind = kindOf(b);
    if (kind === 'choice') return Number(v) === Number(b.answer) ? 'ok' : 'bad';
    if (kind === 'text') {
      const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return [String(b.answer), ...(b.accept ?? [])].some((a) => norm(a) === norm(v)) ? 'ok' : 'bad';
    }
    try {
      const c = new Checker(casOptions({ ...spec, ...b, domains: { ...spec.domains, ...b.domains } }));
      const verdict = c.relation(c.parse(v), '=', c.parse(String(b.answer)));
      return verdict.ok ? 'ok' : verdict.how === 'error' ? 'error' : 'bad';
    } catch {
      return 'error';
    }
  }

  function checkAll() {
    checked = true;
    const next: Record<string, State> = {};
    for (const id of Object.keys(spec.blanks)) next[id] = checkOne(id);
    states = next;
    progress.saveDraft(spec.id, values);
    if (Object.values(next).every((s) => s === 'ok')) progress.markSolved(spec.id);
    paint();
  }

  function preview(id: string): string {
    const b = spec.blanks[id];
    const v = values[id] ?? '';
    if (!b || kindOf(b) !== 'expr' || !v.trim()) return '';
    try {
      return katex.renderToString(toTex(parseExpr(v, casOptions(spec).parse)), { throwOnError: false });
    } catch {
      return '';
    }
  }

  /** Mount the inputs into the placeholders of the rendered Markdown. */
  function paint() {
    for (const slot of root.querySelectorAll<HTMLElement>('[data-blank]')) {
      const id = slot.dataset.blank!;
      const b = spec.blanks[id];
      if (!b) continue;
      let input = slot.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
      if (!input) {
        if (kindOf(b) === 'choice') {
          const sel = document.createElement('select');
          sel.innerHTML = `<option value="">…</option>` + (b.options ?? []).map((o, i) => `<option value="${i}">${o.replace(/<[^>]+>/g, '')}</option>`).join('');
          input = sel;
        } else {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.spellcheck = false;
          inp.autocomplete = 'off';
          inp.style.width = `${b.width ?? (kindOf(b) === 'text' ? 9 : 7)}ch`;
          input = inp;
        }
        input.setAttribute('aria-label', `Blank ${id}`);
        input.value = values[id] ?? '';
        input.addEventListener('input', () => {
          values[id] = input!.value;
          states[id] = 'empty';
          paint();
        });
        input.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') checkAll();
        });
        const pv = document.createElement('span');
        pv.className = 'blank-preview';
        slot.append(input, pv);
      }
      slot.dataset.state = states[id] ?? 'empty';
      const pv = slot.querySelector<HTMLSpanElement>('.blank-preview');
      if (pv) pv.innerHTML = preview(id);
    }
  }

  onMount(() => {
    values = progress.draft(spec.id, {} as Record<string, string>);
    paint();
    if (Object.keys(values).length) checkAll();
  });

  const allOk = $derived(checked && Object.keys(spec.blanks).every((id) => states[id] === 'ok'));
  const wrong = $derived(Object.values(states).filter((s) => s === 'bad').length);
</script>

<ExerciseFrame id={spec.id} kind="Fill in the proof" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  <div class="text" bind:this={root}>{@html html}</div>
  <div class="row ui">
    <button class="check" onclick={checkAll}>Check</button>
    {#if allOk}
      <span class="ok">✓ All blanks are right.</span>
    {:else if checked && wrong}
      <span class="bad">{wrong} blank{wrong > 1 ? 's are' : ' is'} not right yet.</span>
    {/if}
  </div>
  {#if allOk && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
</ExerciseFrame>

<style>
  .text :global(p) {
    margin: 0 0 0.8rem;
  }
  .text :global(.blank-slot) {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    margin: 0 0.15rem;
  }
  .text :global(.blank-slot input),
  .text :global(.blank-slot select) {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.1rem 0.35rem;
    border: 1px solid var(--rule-strong);
    border-radius: 5px;
    background: var(--page);
    color: var(--ink);
    min-width: 3ch;
  }
  .text :global(.blank-slot[data-state='ok'] input),
  .text :global(.blank-slot[data-state='ok'] select) {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .text :global(.blank-slot[data-state='bad'] input),
  .text :global(.blank-slot[data-state='bad'] select) {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .text :global(.blank-slot[data-state='error'] input) {
    border-color: var(--maybe);
  }
  .text :global(.blank-preview) {
    font-size: 0.9em;
    color: var(--ink-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }
  .check {
    border: 1px solid var(--lab);
    background: var(--lab);
    color: white;
    border-radius: 6px;
    padding: 0.3rem 0.9rem;
    cursor: pointer;
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
  }
  .explain {
    margin-top: 0.75rem;
    padding: 0.6rem 0.9rem 0.1rem;
    border-radius: var(--radius-sm);
    background: var(--ok-soft);
  }
  .explain :global(p) {
    margin: 0 0 0.6rem;
  }
</style>
