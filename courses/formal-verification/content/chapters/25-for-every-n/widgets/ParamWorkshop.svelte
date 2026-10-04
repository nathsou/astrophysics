<!--
  The parameterised workshop: edit a system whose node type has no size, and prove its invariants inductive for
  every number of nodes. The checker reports how many nodes a counterexample could need, checks every instance up
  to that size (with a running count of the ground instances of the universal formulas), and either proves the
  invariants or draws the counterexample to induction as nodes, before and after the step.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { runParam } from '$lib/components/induction/client';
  import type { ParamEvent } from '$lib/fv/param/worker';
  import type { ParamSize } from '$lib/fv/param/param';
  import { picture, type Picture } from './diagram';

  let { code, title, caption, goal, ring, order }: { code: string; title?: string; caption?: string; goal?: string; ring?: string; order?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  let running = $state(false);
  let error = $state('');
  let sizes = $state<ParamSize[]>([]);
  let bound = $state<Record<string, number>>({});
  let result = $state.raw<Extract<ParamEvent, { kind: 'result' }> | undefined>();
  let cancel: (() => void) | undefined;

  function run() {
    cancel?.();
    running = true;
    error = '';
    sizes = [];
    bound = {};
    result = undefined;
    cancel = runParam({ source, timeout: 60000, certifyBudget: 20000 }, (e) => {
      if (e.kind === 'error') error = e.message;
      else if (e.kind === 'size') {
        sizes = [...sizes, e.size];
        bound = e.bound;
      } else if (e.kind === 'result') {
        result = e;
        bound = e.bound;
      } else if (e.kind === 'done') running = false;
    });
  }
  onMount(() => {
    run();
    return () => cancel?.();
  });

  const ground = $derived(sizes.reduce((n, s) => n + s.groundInstances, 0));
  const sizeText = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${v} ${k}${v === 1 ? '' : 's'}`).join(', ');
  const pics = $derived.by((): { before: Picture; after?: Picture } | undefined => {
    const c = result?.cti;
    if (!c) return undefined;
    const sort = Object.keys(c.sizes)[0]!;
    const n = c.sizes[sort]!;
    const before = picture(c.slots.map((s) => ({ name: s.name, ty: s.ty, value: s.before })), sort, n, { ring, order });
    const after = c.kind === 'consecution' ? picture(c.slots.map((s) => ({ name: s.name, ty: s.ty, value: s.after ?? null })), sort, n, { ring, order }) : undefined;
    return { before, after };
  });

  const panels = $derived(pics ? (pics.after ? [{ lab: 'before the step', p: pics.before, other: pics.after }, { lab: 'after', p: pics.after, other: pics.before }] : [{ lab: 'initial state', p: pics.before, other: undefined }]) : []);
  const W = 300;
  const H = 280;
  const pos = (i: number, n: number) => {
    if (n === 1) return { x: W / 2, y: H / 2 };
    const r = n === 2 ? 70 : 95;
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a) };
  };
  /** When every arrow is the same relation, name it once under the picture instead of on each arrow. */
  const oneLabel = (p: Picture) => (p.edges.length && p.edges.every((e) => e.label === p.edges[0]!.label) ? p.edges[0]!.label : '');
  const changed = (other: Picture | undefined, id: number, line: string) => !!other && !other.nodes.find((x) => x.id === id)?.lines.includes(line);
</script>

<figure class="pw">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <textarea bind:value={source} rows={Math.min(34, source.split('\n').length + 1)} spellcheck="false" wrap="off" aria-label="The system"></textarea>
  <div class="bar ui">
    <button type="button" class="go" onclick={run} disabled={running}>{running ? 'Checking…' : 'Prove for every N'}</button>
    {#if Object.keys(bound).length}<span class="bound">A counterexample needs at most {sizeText(bound)}.</span>{/if}
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if sizes.length || result}
    <div class="sizes ui">
      {#each sizes as s, i (i)}<span class="sz ok" title="{s.checks} checks, {s.ms} ms">{sizeText(s.sizes)} ✓</span>{/each}
      {#if result?.status === 'cti' && result.cti}<span class="sz bad">{sizeText(result.cti.sizes)} ✗</span>{/if}
      <span class="ground">{ground.toLocaleString('en-GB')} ground instances of the universal formulas</span>
    </div>
  {/if}
  {#if result}
    {#if result.status === 'proved'}
      <p class="verdict ok ui">✓ Inductive for every number of {Object.keys(bound).join(' and ')} values: every instance up to {sizeText(bound)} was checked, and no larger one can hold a counterexample.
        <span class="cert">{result.certified === true ? 'The SAT proofs at every size were re-checked by the DRAT checker.' : result.certified === false ? 'The DRAT re-check did not finish in time.' : ''}</span></p>
      {#if goal}<p class="goal ui">{goal}</p>{/if}
    {:else if result.status === 'outside'}
      <p class="verdict warn ui">Outside the decidable fragment: {result.message}</p>
    {:else if result.status === 'unknown'}
      <p class="verdict warn ui">Not decided: {result.message}</p>
    {:else if result.cti && pics}
      <div class="cti">
        <p class="ui ctih"><b>Counterexample to {result.cti.kind === 'initiation' ? 'initiation' : 'induction'}</b> with {sizeText(result.cti.sizes)}.
          {#if result.cti.kind === 'initiation'}An initial state where {result.cti.failing.join(', ')} fail{result.cti.failing.length === 1 ? 's' : ''}.{:else}Every invariant holds before the step <code>{result.cti.step}</code>; after it, {result.cti.failing.join(', ')} fail{result.cti.failing.length === 1 ? 's' : ''}. Is the state before reachable? If not, add an invariant that rules it out.{/if}</p>
        <div class="pics">
          {#each panels as { lab, p, other } (lab)}
            <div class="pic">
              <p class="sub ui">{lab}</p>
              {#if p.globals.length}<p class="globals"><code>{p.globals.join(', ')}</code></p>{/if}
              <svg viewBox="0 0 {W} {H}" role="img" aria-label="{lab}: {p.nodes.length} nodes">
                <defs><marker id="pw-arrow-{lab.replace(/\W/g, '')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="ah" /></marker></defs>
                {#each p.edges as e, k (k)}
                  {@const ia = p.nodes.findIndex((x) => x.id === e.from)}
                  {@const ib = p.nodes.findIndex((x) => x.id === e.to)}
                  {@const a = pos(ia, p.nodes.length)}
                  {@const b = pos(ib, p.nodes.length)}
                  {#if ia === ib}
                    <path d="M{a.x - 8} {a.y - 22} C {a.x - 30} {a.y - 60}, {a.x + 30} {a.y - 60}, {a.x + 8} {a.y - 22}" class="edge" marker-end="url(#pw-arrow-{lab.replace(/\W/g, '')})" />
                    {#if !oneLabel(p)}<text x={a.x} y={a.y - 52} class="elabel" text-anchor="middle">{e.label}</text>{/if}
                  {:else}
                    {@const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18}
                    {@const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18}
                    {@const t = 30 / Math.max(1, Math.hypot(b.x - mx, b.y - my))}
                    <path d="M{a.x} {a.y} Q {mx} {my}, {b.x + (mx - b.x) * t} {b.y + (my - b.y) * t}" class="edge" marker-end="url(#pw-arrow-{lab.replace(/\W/g, '')})" />
                    {#if !oneLabel(p)}<text x={mx} y={my} class="elabel" text-anchor="middle">{e.label}</text>{/if}
                  {/if}
                {/each}
                {#each p.nodes as nd, i (nd.id)}
                  {@const c = pos(i, p.nodes.length)}
                  {@const up = c.y < H / 2 - 10}
                  <g>
                    <circle cx={c.x} cy={c.y} r="22" class="node" />
                    <text x={c.x} y={c.y + 4} class="nlabel" text-anchor="middle">{nd.label}</text>
                    {#each nd.lines as l, k (k)}
                      <text x={c.x} y={up ? c.y - 30 - (nd.lines.length - 1 - k) * 12 : c.y + 36 + k * 12} class="nline" class:changed={changed(other, nd.id, l)} text-anchor="middle">{l}</text>
                    {/each}
                  </g>
                {/each}
              </svg>
              {#if oneLabel(p)}<p class="arrows ui">Arrows: {oneLabel(p)}</p>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .pw {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.6rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    line-height: 1.45;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    white-space: pre;
    overflow-x: auto;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.84rem;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.25rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .bound {
    color: var(--ink-2);
  }
  .err {
    color: var(--pencil);
    font-size: 0.84rem;
  }
  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    margin: 0.6rem 0 0;
    font-size: 0.76rem;
  }
  .sz {
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--seal);
    color: var(--seal);
  }
  .sz.bad {
    border-color: var(--pencil);
    color: var(--pencil);
    font-weight: 700;
  }
  .ground {
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .verdict {
    margin: 0.7rem 0 0;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    font-size: 0.86rem;
    font-weight: 600;
  }
  .verdict.ok {
    border: 1px solid var(--seal);
    color: var(--seal);
  }
  .verdict.warn {
    border: 1px solid var(--gold);
    color: var(--fg);
    font-weight: 400;
  }
  .cert {
    display: block;
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.2rem;
  }
  .goal {
    font-size: 0.84rem;
    margin: 0.5rem 0 0;
  }
  .cti {
    margin-top: 0.7rem;
    padding: 0.5rem 0.6rem;
    border-left: 3px solid var(--pencil);
    background: color-mix(in srgb, var(--pencil) 5%, transparent);
  }
  .ctih {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
  }
  .pw code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    overflow-wrap: anywhere;
  }
  .pics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.6rem;
  }
  .pic svg {
    display: block;
    width: 100%;
    max-width: 380px;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    overflow: visible;
  }
  .sub {
    margin: 0 0 0.2rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .globals {
    margin: 0 0 0.3rem;
  }
  .node {
    fill: var(--pn);
    stroke: var(--ink-blue);
    stroke-width: 1.6;
  }
  .nlabel {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg);
  }
  .nline {
    font-family: var(--font-ui);
    font-size: 9.5px;
    fill: var(--ink-2);
  }
  .nline.changed {
    fill: var(--pencil);
    font-weight: 700;
  }
  .edge {
    fill: none;
    stroke: var(--gold);
    stroke-width: 1.4;
  }
  .ah {
    fill: var(--gold);
  }
  .arrows {
    margin: 0.2rem 0 0;
    font-size: 0.74rem;
    color: var(--gold);
  }
  .elabel {
    font-family: var(--font-ui);
    font-size: 9px;
    fill: var(--gold);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
