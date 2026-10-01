<!--
  The quark builder (Chapter 13). Assemble quarks and antiquarks, give each a colour, and read off the charge, baryon number, strangeness, isospin and
  hypercharge; see whether the colours cancel; and see which hadrons of the particle table have that content. Arithmetic from hep/su3 (quark.ts)
  and hep/particles. Colour neutrality is checked as in the theory: the colour weights of the three colours add to zero.

    ::quark-builder{n="13.2" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { contentNumbers, hadronsWithContent, hasColourSinglet, flavourMultiplets, isColourNeutral, netColour, quarkSpec, type Colour, type QuarkLetter, type Constituent } from '$lib/hep/su3';
  import { particle } from '$lib/hep/particles';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  interface Q { letter: QuarkLetter; anti: boolean; colour: Colour }
  const LETTERS: QuarkLetter[] = ['u', 'd', 's', 'c', 'b'];
  const COLOURS: Colour[] = ['r', 'g', 'b'];
  const COL_NAME: Record<Colour, string> = { r: 'red', g: 'green', b: 'blue' };
  const COL_VAR: Record<Colour, string> = { r: 'var(--series-7)', g: 'var(--series-3)', b: 'var(--series-1)' };
  const BAR = '̄';
  const sym = (l: QuarkLetter, anti: boolean) => (anti ? l + BAR : l);
  const colLabel = (c: Colour, anti: boolean) => (anti ? `anti-${COL_NAME[c]}` : COL_NAME[c]);

  let list = $state<Q[]>([
    { letter: 'u', anti: false, colour: 'r' },
    { letter: 'u', anti: false, colour: 'g' },
    { letter: 'd', anti: false, colour: 'b' },
  ]);
  const MAX = 5;

  function add(letter: QuarkLetter, anti: boolean) {
    if (list.length >= MAX) return;
    // default colour: for a quark, the colour not yet used; for an antiquark, the anticolour of a colour that is unmatched
    const used = list.filter((q) => q.anti === anti).map((q) => q.colour);
    const colour = COLOURS.find((c) => !used.includes(c)) ?? 'r';
    list = [...list, { letter, anti, colour }];
  }
  const remove = (i: number) => (list = list.filter((_, k) => k !== i));
  const preset = (s: string) => {
    const make = (t: string): Q[] => {
      const out: Q[] = [];
      for (let i = 0; i < t.length; i++) {
        const l = t[i] as QuarkLetter;
        const anti = t[i + 1] === '~';
        if (anti) i++;
        out.push({ letter: l, anti, colour: 'r' });
      }
      // give colours: quarks r g b in turn, antiquarks the anticolours in turn
      let a = 0, b = 0;
      for (const q of out) q.colour = COLOURS[(q.anti ? b++ : a++) % 3]!;
      return out;
    };
    list = make(s);
  };
  const PRESETS: [string, string][] = [['proton uud', 'uud'], ['neutron udd', 'udd'], ['π⁺ ud̄', 'ud~'], ['K⁻ sū', 's~u'.replace('s~u', 'su~')], ['Δ⁺⁺ uuu', 'uuu'], ['Ω⁻ sss', 'sss'], ['J/ψ cc̄', 'cc~'], ['Υ bb̄', 'bb~'], ['two quarks uu', 'uu'], ['one quark u', 'u'], ['uud ū', 'uud~']];

  const cons = $derived<Constituent[]>(list.map((q) => ({ letter: q.letter, anti: q.anti })));
  const num = $derived(contentNumbers(cons));
  const neutral = $derived(list.length > 0 && isColourNeutral(list));
  const singlet = $derived(list.length > 0 && hasColourSinglet(cons));
  const net = $derived(netColour(list));
  const hadrons = $derived(list.length ? hadronsWithContent(cons) : []);
  const multiplets = $derived(list.length ? flavourMultiplets(cons) : []);
  const fq = (q3: number) => (q3 % 3 === 0 ? String(q3 / 3) : `${q3 < 0 ? '−' : ''}${Math.abs(q3)}/3`);
  const same = $derived(list.length === 3 && list.every((q) => q.letter === list[0]!.letter && q.anti === list[0]!.anti));
  const shapeName = $derived.by(() => {
    const nq = list.filter((q) => !q.anti).length, na = list.length - nq;
    if (list.length === 0) return 'nothing yet';
    if (nq === 1 && na === 1) return 'a meson (q q̄)';
    if (nq === 3 && na === 0) return 'a baryon (qqq)';
    if (nq === 0 && na === 3) return 'an antibaryon (q̄q̄q̄)';
    if (nq === 2 && na === 2) return 'four quarks (a tetraquark, if colourless)';
    if (nq === 4 && na === 1) return 'five quarks (a pentaquark, if colourless)';
    return `${nq} quark${nq === 1 ? '' : 's'} and ${na} antiquark${na === 1 ? '' : 's'}`;
  });
  const hadronNote = (p: ReturnType<typeof particle>) => `${p.symbol}  ${(p.mass * 1000).toFixed(0)} MeV, spin ${p.spin2 % 2 ? p.spin2 + '/2' : p.spin2 / 2}`;
</script>

<Widget title="Build a hadron from quarks" {n} {caption} kind="Explore" live={false}>
  {#snippet controls()}
    <div class="p3-chips ui" role="group" aria-label="Presets">
      {#each PRESETS as [label, content]}<button type="button" onclick={() => preset(content)}>{label}</button>{/each}
    </div>
  {/snippet}
  <div class="ui add" role="group" aria-label="Add a quark or antiquark">
    <span class="p3-h">Add</span>
    {#each LETTERS as l}<button type="button" class="p3-btn" disabled={list.length >= MAX} onclick={() => add(l, false)} aria-label="Add a {l} quark">{l}</button>{/each}
    <span class="sep"></span>
    {#each LETTERS as l}<button type="button" class="p3-btn" disabled={list.length >= MAX} onclick={() => add(l, true)} aria-label="Add a {l} antiquark">{l}{BAR}</button>{/each}
    <Button size="sm" variant="ghost" onclick={() => (list = [])}>Clear</Button>
  </div>
  <ul class="qs ui" aria-label="The quarks in the hadron">
    {#each list as q, i}
      <li>
        <span class="dot" style="background:{COL_VAR[q.colour]}" class:anti={q.anti}></span>
        <strong class="qs-sym">{sym(q.letter, q.anti)}</strong>
        <span class="qs-q">Q = {fq((q.anti ? -1 : 1) * quarkSpec(q.letter).charge3)}</span>
        <label>colour
          <select value={q.colour} onchange={(e) => (list[i]!.colour = (e.currentTarget as HTMLSelectElement).value as Colour)}>
            {#each COLOURS as c}<option value={c}>{colLabel(c, q.anti)}</option>{/each}
          </select>
        </label>
        <button type="button" class="p3-btn" onclick={() => remove(i)} aria-label="Remove {sym(q.letter, q.anti)}">✕</button>
      </li>
    {/each}
    {#if !list.length}<li class="p3-note">Add quarks above, or pick a preset.</li>{/if}
  </ul>

  <dl class="p3-out ui" aria-live="polite">
    <div><dt>what this is</dt><dd>{shapeName}</dd></div>
    <div><dt>charge Q</dt><dd>{fq(num.charge3)}</dd></div>
    <div><dt>baryon number B</dt><dd>{fq(num.baryon3)}</dd></div>
    <div><dt>strangeness S · charm · bottom</dt><dd>{num.strangeness} · {num.charm} · {num.bottom}</dd></div>
    <div><dt>I₃ · hypercharge Y</dt><dd>{num.i3x2 / 2} · {fq(num.y3)}</dd></div>
    <div><dt>colour, as you coloured them</dt><dd>{neutral ? '✓ neutral: the three colours cancel (or a colour meets its anticolour)' : list.length ? `✗ net colour (${net[0]}, ${net[1]}/3 in units of ½): a coloured object` : '—'}</dd></div>
    <div><dt>can the colours cancel at all?</dt><dd>{list.length ? (singlet ? '✓ yes, a colour singlet exists for this content' : '✗ never: no assignment gives a colour singlet') : '—'}</dd></div>
    {#if multiplets.length}<div><dt>SU(3) flavour multiplets that hold this weight</dt><dd>{multiplets.join(', ')}</dd></div>{/if}
  </dl>

  {#if list.length}
    <div class="res" role="status">
      {#if !singlet}
        <p><strong>Not seen, and never will be.</strong> Quarks carry colour and only colour-neutral combinations are found as free particles (Chapter 18 explains why: confinement). No choice of colours makes this content neutral.</p>
      {:else if !neutral}
        <p><strong>The colours you chose do not cancel.</strong> A neutral combination exists for this content: change the colours until the totals cancel, for example red, green and blue for a baryon, or a colour with its anticolour for a meson.</p>
      {:else if hadrons.length}
        <p><strong>Seen:</strong> {hadrons.map(hadronNote).join(' · ')}.</p>
        {#if same}<p>Three identical quarks with their spins aligned: in the ground state their flavour, spin and spatial parts are all symmetric under exchange, so without colour the exclusion principle would forbid this state. Colour is antisymmetric (red-green-blue), which makes the whole wave function antisymmetric. That was the argument for colour (Chapter 13).</p>{/if}
      {:else}
        <p>A colour-neutral combination, and the particle table lists no hadron with exactly this content. (Hadrons of this kind may exist, such as the tetraquarks and pentaquarks that experiments have reported, but the course's table does not include them.)</p>
      {/if}
    </div>
  {/if}
</Widget>

<style>
  .add { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.4rem; }
  .sep { width: 0.8rem; }
  .qs { list-style: none; padding: 0; margin: 0.4rem 0; display: grid; gap: 0.3rem; }
  .qs li { display: flex; align-items: center; gap: 0.7rem; padding: 0.2rem 0.5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); font-size: 0.86rem; flex-wrap: wrap; }
  .dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; border: 2px solid var(--ink); }
  .dot.anti { border-style: dashed; background-clip: content-box; padding: 2px; }
  .qs-sym { font-size: 1.2rem; min-width: 1.6rem; }
  .qs-q { color: var(--ink-2); min-width: 4rem; font-variant-numeric: tabular-nums; }
  select { font: inherit; font-size: 0.82rem; padding: 0.1rem 0.3rem; background: var(--surface); color: var(--ink); border: 1px solid var(--line-strong); border-radius: 4px; }
  .res { border-left: 3px solid var(--c-key); padding: 0.1rem 0.8rem; background: var(--surface-2); font-size: 0.93rem; margin-top: 0.5rem; }
  .p3-btn:disabled { opacity: 0.4; cursor: default; }
</style>
