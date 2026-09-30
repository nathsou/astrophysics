<!--
  The critical-path highlighter: a combinational network drawn as a graph, each gate labelled with its delay. The
  longest path from an input to an output lights up and its length is the network's propagation delay. Click a gate
  (or focus it and press Enter) to change its delay; switch networks to restructure. "Check on the simulator" floods
  the same network, gate for gate, through the digital engine and reports the last output change it can provoke.

    ::critical-path{n="15.2"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { NODE_H, NODE_W, PRESETS, analyse, layout, measure, type Measured, type Network } from './timing';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let preset = $state('chain');
  let net: Network = $state(PRESETS[0]!.make());
  let selected = $state<string | undefined>();
  let showShort = $state(false);
  let measured: Measured | undefined = $state();
  let busy = $state(false);

  const analysis = $derived(analyse(net));
  const geo = $derived(layout(net));
  const crit = $derived(new Set(analysis.critical));
  const critEdges = $derived(new Set(analysis.critical.slice(1).map((id, i) => `${analysis.critical[i]}>${id}`)));
  const shortEdges = $derived(new Set(analysis.shortest.slice(1).map((id, i) => `${analysis.shortest[i]}>${id}`)));
  const shortSet = $derived(new Set(analysis.shortest));
  const edges = $derived(net.nodes.flatMap((t) => t.inputs.map((s) => ({ from: s, to: t.id, key: `${s}>${t.id}` }))));
  const sel = $derived(net.nodes.find((x) => x.id === selected && x.type !== 'in'));
  const PAD = 6;

  function choose(id: string) {
    preset = id;
    net = PRESETS.find((p) => p.id === id)!.make();
    selected = undefined;
    measured = undefined;
  }
  function reset() {
    choose(preset);
    showShort = false;
  }
  function setDelay(v: number) {
    if (!sel) return;
    sel.delay = v;
    measured = undefined;
  }
  function pick(id: string) {
    selected = selected === id ? undefined : id;
  }
  async function check() {
    busy = true;
    // Let the button repaint before the simulator hogs the thread.
    await new Promise((r) => setTimeout(r, 20));
    measured = measure(net);
    busy = false;
  }

  const path = (a: string, b: string): string => {
    const p = geo.pos[a]!;
    const q = geo.pos[b]!;
    const x1 = p.x + NODE_W + PAD;
    const y1 = p.y + NODE_H / 2 + PAD;
    const x2 = q.x + PAD;
    const y2 = q.y + NODE_H / 2 + PAD;
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  };
  const ns = (v: number) => `${+v.toFixed(2)} ns`;
  const MHz = (t: number) => (t > 0 ? `${+(1000 / t).toFixed(t > 20 ? 0 : 1)} MHz` : '—');
  const kind = (t: string) => (t === 'in' ? '' : t.toUpperCase());
  const label = (id: string) => {
    const x = net.nodes.find((q) => q.id === id)!;
    const on = crit.has(id) ? 'on the critical path' : `slack ${ns(analysis.slack[id]!)}`;
    return x.type === 'in' ? `Input ${id}` : `${kind(x.type)} gate ${id}, delay ${ns(x.delay)}, output ready at ${ns(analysis.late[id]!)}, ${on}`;
  };
</script>

<Widget {n} title="Critical path" subtitle="The slowest way through the circuit sets how fast it can be used" kind="Analysis" {caption} onreset={reset} live={false}>
  {#snippet controls()}
    <Segmented label="Circuit" size="sm" value={preset} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} onchange={choose} />
    <Toggle label="Show the shortest path" bind:checked={showShort} />
  {/snippet}

  <div class="cp">
    <div class="scroll">
      <svg viewBox="0 0 {geo.width + 2 * PAD} {geo.height + 2 * PAD}" style:min-width="{Math.min(640, geo.width + 2 * PAD)}px" role="group" aria-label="{net.name}: gates with their delays; the critical path is highlighted">
        <g class="edges">
          {#each edges as e (e.key)}
            {#if !critEdges.has(e.key) && !(showShort && shortEdges.has(e.key))}
              <path class="e" d={path(e.from, e.to)} />
            {/if}
          {/each}
          {#if showShort}
            {#each edges.filter((e) => shortEdges.has(e.key) && !critEdges.has(e.key)) as e (e.key)}
              <path class="e short" d={path(e.from, e.to)} />
            {/each}
          {/if}
          {#each edges.filter((e) => critEdges.has(e.key)) as e (e.key)}
            <path class="e crit" d={path(e.from, e.to)} />
          {/each}
        </g>
        {#each net.nodes as t (t.id)}
          {@const p = geo.pos[t.id]!}
          {@const isIn = t.type === 'in'}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <g
            class="node"
            class:in={isIn}
            class:crit={crit.has(t.id)}
            class:short={showShort && shortSet.has(t.id)}
            class:sel={selected === t.id}
            transform="translate({p.x + PAD} {p.y + PAD})"
            role={isIn ? 'img' : 'button'}
            tabindex={isIn ? undefined : 0}
            aria-label={label(t.id)}
            aria-pressed={isIn ? undefined : selected === t.id}
            onclick={() => !isIn && pick(t.id)}
            onkeydown={(ev) => {
              if (!isIn && (ev.key === 'Enter' || ev.key === ' ')) {
                ev.preventDefault();
                pick(t.id);
              }
            }}
          >
            <rect width={NODE_W} height={NODE_H} rx={isIn ? NODE_H / 2 : 5} />
            {#if isIn}
              <text x={NODE_W / 2} y={NODE_H / 2 + 4} text-anchor="middle" class="id">{t.id}</text>
            {:else}
              <text x={NODE_W / 2} y="12" text-anchor="middle" class="ty">{kind(t.type)} {t.id}</text>
              <text x={NODE_W / 2} y="24" text-anchor="middle" class="dl">{+t.delay.toFixed(2)} ns</text>
            {/if}
            {#if !isIn}<text x={NODE_W / 2} y={NODE_H + 10} text-anchor="middle" class="at">{+analysis.late[t.id]!.toFixed(2)}</text>{/if}
          </g>
        {/each}
      </svg>
    </div>

    <div class="side">
      <dl class="stats ui">
        <div><dt>Propagation delay t<sub>pd</sub></dt><dd class="hi">{ns(analysis.tpd)}</dd><small>the critical path, {analysis.critical.length - 1} gates: {analysis.critical.join(' → ')}</small></div>
        <div><dt>Contamination delay t<sub>cd</sub></dt><dd>{ns(analysis.tcd)}</dd><small>the shortest path, {analysis.shortest.length - 1} gate{analysis.shortest.length === 2 ? '' : 's'}</small></div>
        <div><dt>Fastest use</dt><dd>{MHz(analysis.tpd)}</dd><small>one new input every t<sub>pd</sub>; {analysis.paths} paths in all</small></div>
      </dl>

      <div class="edit ui">
        {#if sel}
          <Slider label="Delay of {kind(sel.type)} {sel.id}" value={sel.delay} min={0.5} max={8} step={0.5} compact format={(v) => ns(v)} oninput={setDelay} />
          <p class="slack">Slack {ns(analysis.slack[sel.id]!)}: {analysis.slack[sel.id] === 0 ? 'on the critical path, so any change here changes t_pd.' : 'this gate can get that much slower before it matters.'}</p>
        {:else}
          <p class="slack">Click a gate to change its delay.</p>
        {/if}
      </div>

      <div class="check ui">
        <Button size="sm" onclick={check} disabled={busy}>{busy ? 'Simulating…' : 'Check on the simulator'}</Button>
        {#if measured}
          <p>
            Flipping each input from each of {measured.runs.toLocaleString('en-GB')} starting points, the last output change came <strong>{ns(measured.worst)}</strong> after the flip (input <code>{measured.input}</code>){#if Math.abs(measured.worst - analysis.tpd) < 1e-6}, exactly the critical path.{:else if measured.worst < analysis.tpd}: shorter than the critical path, so no input pattern can light it up all the way. Such a path is a <em>false path</em>.{/if}
          </p>
        {/if}
      </div>
    </div>
  </div>
</Widget>

<style>
  .cp {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .scroll {
    overflow-x: auto;
    min-width: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    max-width: 44rem;
    font-family: var(--font-mono);
    overflow: visible;
  }
  .e {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.3;
    opacity: 0.45;
  }
  .e.short {
    stroke: var(--sig-current);
    stroke-width: 2.4;
    stroke-dasharray: 5 4;
    opacity: 1;
  }
  .e.crit {
    stroke: var(--sig-high);
    stroke-width: 3.6;
    opacity: 1;
    filter: drop-shadow(0 0 3px var(--sig-high-glow, transparent));
  }
  .node rect {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .node.in rect {
    fill: var(--surface-2, var(--panel));
  }
  .node.crit rect {
    stroke: var(--sig-high);
    stroke-width: 2.4;
    fill: color-mix(in srgb, var(--sig-high) 13%, var(--panel));
  }
  .node.short:not(.crit) rect {
    stroke: var(--sig-current);
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }
  .node.sel rect {
    stroke: var(--copper);
    stroke-width: 3;
  }
  .node:not(.in) {
    cursor: pointer;
  }
  .node:focus-visible {
    outline: none;
  }
  .node:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 3;
  }
  .node text {
    fill: var(--fg);
    font-size: 9.5px;
    pointer-events: none;
  }
  .node .id {
    font-weight: 600;
    font-size: 10.5px;
  }
  .node .dl {
    fill: var(--ink-2);
    font-weight: 600;
  }
  .node .at {
    fill: var(--mute);
    font-size: 8.5px;
  }
  .node.crit .at {
    fill: var(--copper-ink, var(--copper));
    font-weight: 700;
  }
  .side {
    display: grid;
    gap: 0.8rem;
    align-content: start;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.6rem 1.2rem;
    margin: 0;
  }
  .stats dt {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .stats dd {
    margin: 0.1rem 0 0;
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg);
  }
  .stats dd.hi {
    color: var(--copper-ink, var(--copper));
  }
  .stats small {
    display: block;
    font-size: 0.72rem;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .slack {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .check p {
    margin: 0.5rem 0 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .check code {
    font-family: var(--font-mono);
  }
  @media (min-width: 60rem) {
    .cp {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
