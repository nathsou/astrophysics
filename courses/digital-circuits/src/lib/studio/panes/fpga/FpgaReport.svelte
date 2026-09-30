<!--
  The FPGA report: utilisation, fmax and the critical path (a list you can click through), the time each stage took,
  the flow's log, and the placement and routing charts.
-->
<script lang="ts">
  import { NK } from '../../../pld/devices/vfpga';
  import { placeSeries, routeSeries } from '../../fpga/replay';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import LineChart from './LineChart.svelte';

  let { session, charts = true }: { session: FpgaSession; charts?: boolean } = $props();

  const r = $derived(session.result);
  const rep = $derived(r?.report);
  const series = $derived(r ? placeSeries(r.place) : null);
  const route = $derived(r ? routeSeries(r.route) : null);
  const crit = $derived(r?.critical);

  const meters = $derived(
    rep
      ? [
          { label: 'Logic cells', ...rep.utilisation.cells },
          { label: 'Logic tiles', ...rep.utilisation.tiles },
          { label: 'Block RAMs', ...rep.utilisation.blockRams },
          { label: 'Pads', ...rep.utilisation.pads },
          { label: 'Global clocks', ...rep.utilisation.globalClocks },
          { label: 'Routing nodes', ...rep.utilisation.routingNodes },
        ].filter((m) => m.total > 0)
      : [],
  );
  const stageMax = $derived(Math.max(1, ...(rep?.stages.map((s) => s.ms) ?? [1])));

  /** Select what a step of the critical path is: a net (its wires) or a cell. */
  function pick(i: number) {
    const ix = session.index;
    const step = crit?.steps[i];
    if (!ix || !step || !r) return;
    if (step.kind === 'net' && step.nodes.length) {
      const net = ix.nodeNet[step.nodes[0]!];
      if (net !== undefined && net >= 0) session.select({ kind: 'net', net });
    } else {
      const label = step.name.replace(/\.(lut|q|I\d|ce|sr|cout)$/, '').replace(/ (LUT|carry.*)$/, '');
      const c = r.cells.find((x) => x.label === label);
      if (c) session.select({ kind: 'cell', x: c.x, y: c.y, k: c.k });
    }
  }
  const nodeKindOf = (n: number) => session.device?.nodeKind[n] === NK.WIRE;
  const pct = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)} %`;
</script>

<div class="rep ui">
  {#if !r || !rep}
    <p class="empty">{session.status === 'running' ? 'Fitting the design…' : 'Fit a design to see its report.'}</p>
  {:else}
    <section class="head">
      <div class="big"><span>fmax</span><strong>{rep.timing.fmaxMHz.toFixed(1)}</strong><em>MHz</em></div>
      <div class="big"><span>critical path</span><strong>{rep.timing.periodNs.toFixed(2)}</strong><em>ns</em></div>
      <div class="big"><span>device</span><strong>{rep.device.replace('vFPGA-', '')}</strong><em>{rep.utilisation.cells.used}/{rep.utilisation.cells.total} cells</em></div>
      <div class="big"><span>fitted in</span><strong>{rep.totalMs < 1000 ? rep.totalMs.toFixed(0) : (rep.totalMs / 1000).toFixed(1)}</strong><em>{rep.totalMs < 1000 ? 'ms' : 's'}</em></div>
    </section>

    <section>
      <h5>Utilisation</h5>
      <div class="meters">
        {#each meters as m (m.label)}
          <div class="meter" title="{m.label}: {m.used} of {m.total}">
            <span class="name">{m.label}</span>
            <span class="bar" role="meter" aria-label={m.label} aria-valuemin="0" aria-valuemax={m.total} aria-valuenow={m.used}><span class="fill" class:full={m.used >= m.total} style:width="{Math.min(100, m.percent)}%"></span></span>
            <span class="num">{m.used}/{m.total} · {pct(m.percent)}</span>
          </div>
        {/each}
      </div>
      <p class="sub">{rep.utilisation.luts} LUTs · {rep.utilisation.flipFlops} flip-flops · {rep.utilisation.carryCells} carry cells · {rep.utilisation.wires} wires · {rep.sizes.nets} nets</p>
    </section>

    <section>
      <h5>Critical path <span class="hint">ends at {rep.timing.endpoint}</span></h5>
      <ol class="path">
        {#each crit?.steps ?? [] as s, i (i)}
          <li>
            <button type="button" class={s.kind} onclick={() => pick(i)} title={s.route ? `${s.route.length} routing nodes: ${s.route.slice(0, 4).join(' → ')}${s.route.length > 4 ? ' …' : ''}` : s.name}>
              <span class="t">{s.arrival.toFixed(2)}</span>
              <span class="d">+{s.delay.toFixed(2)}</span>
              <span class="k">{s.kind}</span>
              <span class="n">{s.name}{s.nodes.length ? ` · ${s.nodes.filter(nodeKindOf).length} wires` : ''}</span>
            </button>
          </li>
        {/each}
      </ol>
    </section>

    <section>
      <h5>Time per stage</h5>
      <div class="stages">
        {#each rep.stages as s (s.name)}
          <div class="st"><span class="name">{s.name}</span><span class="sb"><span style:width="{(100 * s.ms) / stageMax}%"></span></span><span class="num">{s.ms.toFixed(1)} ms</span></div>
        {/each}
      </div>
    </section>

    {#if charts && series && route}
      <section>
        <h5>Placement <span class="hint">simulated annealing, {r.place.steps.length} temperatures</span></h5>
        <div class="charts">
          <LineChart values={series.temperature.values} label="Temperature" log marker={session.replay.mode === 'place' ? session.replay.pos : undefined} onscrub={(p) => (session.replay.pos = p)} />
          <LineChart values={series.cost.values} label="Cost" colour="var(--phosphor)" />
          <LineChart values={series.wirelength.values} label="Wirelength" unit="tiles" />
          <LineChart values={series.acceptance.values} label="Acceptance" unit="%" colour="var(--sig-current)" />
        </div>
        <h5>Routing <span class="hint">PathFinder, {r.route.iterations.length} iteration{r.route.iterations.length === 1 ? '' : 's'}</span></h5>
        <LineChart values={route.values} label="Overused nodes" bars colour="var(--sig-x)" />
      </section>
    {/if}

    <section>
      <h5>Log</h5>
      <pre>{r.log.join('\n')}</pre>
      <p class="sub">The flow ran {session.inWorker ? 'in a Web Worker, off the main thread' : 'in the page (this browser has no worker)'}.</p>
    </section>
  {/if}
</div>

<style>
  .rep {
    padding: 0.5rem 0.8rem 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    overflow: auto;
    height: 100%;
    background: var(--panel);
  }
  .empty {
    margin: 0.8rem 0;
    color: var(--mute);
  }
  section {
    margin-bottom: 0.9rem;
  }
  h5 {
    margin: 0.2rem 0 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  .hint {
    text-transform: none;
    letter-spacing: 0;
    color: var(--mute);
    font-weight: 400;
  }
  .head {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: 0.5rem;
  }
  .big {
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.6rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .big span {
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .big strong {
    font-family: var(--font-mono);
    font-size: 1.35rem;
    color: var(--fg);
    line-height: 1.2;
  }
  .big em {
    font-style: normal;
    font-size: 0.7rem;
    color: var(--mute);
  }
  .meters,
  .stages {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .meter,
  .st {
    display: grid;
    grid-template-columns: 6.5rem 1fr 7.5rem;
    align-items: center;
    gap: 0.5rem;
  }
  .st {
    grid-template-columns: 6.5rem 1fr 4.5rem;
  }
  .bar,
  .sb {
    height: 0.55rem;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
    display: block;
  }
  .fill,
  .sb span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--copper), var(--phosphor));
  }
  .fill.full {
    background: var(--bad);
  }
  .sb span {
    background: var(--copper);
  }
  .num {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
    text-align: right;
  }
  .sub {
    margin: 0.3rem 0 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .path {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 15rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .path button {
    display: grid;
    grid-template-columns: 3rem 3rem 3.8rem 1fr;
    gap: 0.4rem;
    width: 100%;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-align: left;
    padding: 0.18rem 0.5rem;
    cursor: pointer;
  }
  .path button:hover {
    background: var(--term-hl);
  }
  .path .t {
    color: var(--mute);
  }
  .path .d {
    color: var(--copper-ink);
  }
  .path .net .k {
    color: var(--sig-current);
  }
  .path .cell .k,
  .path .launch .k,
  .path .capture .k {
    color: var(--phosphor-ink);
  }
  .path .n {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  pre {
    margin: 0;
    padding: 0.4rem 0.6rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 0.68rem;
    white-space: pre-wrap;
    color: var(--ink-2);
  }
</style>
