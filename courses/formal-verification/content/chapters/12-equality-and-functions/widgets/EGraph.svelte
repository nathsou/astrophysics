<!--
  The e-graph sandbox: congruence closure by hand. The disequalities hold from the start; click the equalities to
  assert them, in any order. Each assertion merges two classes, and congruence may merge more: if a = b then
  f(a) = f(b). When the two sides of a disequality land in one class, the theory reports a conflict and explains it
  with the assertions it used.
-->
<script lang="ts">
  import { Euf } from '$lib/fv/smt/euf';
  import { parseEufClauses, showTerm } from '$lib/fv/smt/dpllt-stepper';
  import type { Term } from '$lib/fv/logic/term';

  let { equalities, disequalities = [], caption }: { equalities: string[]; disequalities?: string[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  const parsed = parseEufClauses([...equalities, ...disequalities.map((d) => d.replace('!=', '='))]);
  // svelte-ignore state_referenced_locally
  const eqs = equalities.map((_, i) => parsed.atoms[Math.abs(parsed.clauses[i]![0]!) - 1]!);
  // svelte-ignore state_referenced_locally
  const dqs = disequalities.map((_, i) => parsed.atoms[Math.abs(parsed.clauses[equalities.length + i]![0]!) - 1]!);
  const allTerms = (() => {
    const out: Term[] = [];
    const add = (t: Term) => {
      if (out.includes(t)) return;
      t.args.forEach(add);
      out.push(t);
    };
    for (const a of [...eqs, ...dqs]) {
      add(a.a);
      add(a.b);
    }
    return out;
  })();

  let order = $state<number[]>([]);
  const snap = $derived.by(() => {
    const events: { text: string; kind: 'assert' | 'cong' | 'conflict' }[] = [];
    const euf = new Euf();
    allTerms.forEach((t) => euf.add(t));
    dqs.forEach((d, j) => euf.assertDiseq(d.a, d.b, -(j + 1)));
    const groupsOf = () => {
      const g = new Map<Term, Term[]>();
      for (const t of allTerms) g.set(euf.find(t), [...(g.get(euf.find(t)) ?? []), t]);
      return g;
    };
    let conflict: number[] | null = null;
    for (const i of order) {
      const before = new Map(allTerms.map((t) => [t, euf.find(t)]));
      const e = eqs[i]!;
      euf.assertEq(e.a, e.b, i + 1);
      events.push({ text: `You assert ${showTerm(e.a)} = ${showTerm(e.b)}.`, kind: 'assert' });
      // Applications that became equal through their arguments: congruence. One per pair of classes merged, and
      // not the pair the assertion itself merged.
      const merged = new Set<string>([[before.get(e.a)!.id, before.get(e.b)!.id].sort().join(',')]);
      for (let x = 0; x < allTerms.length; x++) {
        for (let y = x + 1; y < allTerms.length; y++) {
          const s = allTerms[x]!;
          const t = allTerms[y]!;
          if (!s.args.length || s.name !== t.name || s.args.length !== t.args.length) continue;
          if (before.get(s) === before.get(t) || euf.find(s) !== euf.find(t)) continue;
          const pair = [before.get(s)!.id, before.get(t)!.id].sort().join(',');
          if (merged.has(pair)) continue;
          if (s.args.every((a, k) => euf.find(a) === euf.find(t.args[k]!))) {
            merged.add(pair);
            events.push({ text: `Congruence: ${showTerm(s)} = ${showTerm(t)}, because their arguments are now equal.`, kind: 'cong' });
          }
        }
      }
      conflict = euf.conflict();
      if (conflict) {
        const used = conflict.filter((l) => l > 0).map((l) => `${showTerm(eqs[l - 1]!.a)} = ${showTerm(eqs[l - 1]!.b)}`);
        const broken = conflict.filter((l) => l < 0).map((l) => `${showTerm(dqs[-l - 1]!.a)} ≠ ${showTerm(dqs[-l - 1]!.b)}`);
        events.push({ text: `Conflict: ${broken.join(', ')} cannot hold. The explanation uses only ${used.join(' and ')}.`, kind: 'conflict' });
        break;
      }
    }
    return { events, groups: [...groupsOf().values()], conflict };
  });
</script>

<figure class="eg">
  <div class="cols">
    <section>
      <h4 class="ui">Equalities (click to assert)</h4>
      <div class="eqs">
        {#each eqs as e, i (i)}
          <button type="button" class="ui" class:used={order.includes(i)} disabled={order.includes(i) || !!snap.conflict} onclick={() => (order = [...order, i])}>
            {#if order.includes(i)}<span class="n">{order.indexOf(i) + 1}</span>{/if}{showTerm(e.a)} = {showTerm(e.b)}
          </button>
        {/each}
      </div>
      {#if dqs.length}
        <h4 class="ui">Disequalities (always asserted)</h4>
        <div class="eqs">{#each dqs as d, i (i)}<span class="dq ui">{showTerm(d.a)} ≠ {showTerm(d.b)}</span>{/each}</div>
      {/if}
      <button type="button" class="reset ui" onclick={() => (order = [])}>Reset</button>
    </section>
    <section>
      <h4 class="ui">Classes</h4>
      <div class="classes">
        {#each snap.groups as g, i (i)}<div class="cls" class:multi={g.length > 1}>{#each g as t (t.id)}<code>{showTerm(t)}</code>{/each}</div>{/each}
      </div>
      <ol class="events">
        {#each snap.events as e, i (i)}<li class={e.kind}>{e.text}</li>{/each}
      </ol>
    </section>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .eg {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    gap: 0.9rem;
  }
  @media (max-width: 640px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .eg h4 {
    margin: 0 0 0.4rem;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .eqs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.7rem;
  }
  .eqs button,
  .dq {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.22rem 0.55rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .eqs button {
    cursor: pointer;
  }
  .eqs button.used {
    border-color: var(--ink-blue);
    color: var(--ink-blue);
  }
  .eqs button:disabled {
    cursor: default;
  }
  .n {
    display: inline-block;
    min-width: 1.1rem;
    margin-right: 0.3rem;
    font-weight: 700;
  }
  .dq {
    border-style: dashed;
    color: var(--pencil);
  }
  .reset {
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .classes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .cls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    padding: 0.25rem 0.4rem;
    border: 1px dashed var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
  }
  .cls.multi {
    border-style: solid;
    border-color: var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 8%, var(--panel));
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .events {
    margin: 0.6rem 0 0;
    padding-left: 1.3rem;
    font-size: 0.82rem;
  }
  .events li.cong {
    color: var(--ink-blue);
  }
  .events li.conflict {
    color: var(--pencil);
    font-weight: 600;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
