<!--
  Break the clock: a launching flip-flop, a chain of gates and a capturing flip-flop, run on the digital engine.
  Drag the clock period down and watch the data arrive later and later relative to the edge that has to catch
  it; the budget bar shows where the period goes; the slack numbers say by how much the path passes or fails.
  Skew moves the capture clock: it buys setup time and spends hold time.

    ::break-the-clock{n="17.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Strip, { type Band, type Mark, type Row } from './Strip.svelte';
  import { DEFAULT_PATH, FLIPFLOP, analyse, simulate, type PathParams } from './clocking';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let period = $state(DEFAULT_PATH.period);
  let gates = $state(DEFAULT_PATH.gates);
  let skew = $state(0);
  const gateDelay = DEFAULT_PATH.gateDelay;

  const p: PathParams = $derived({ ...DEFAULT_PATH, period, gates, skew, gateDelay });
  const a = $derived(analyse(p));
  const SPAN = 80;
  const from = $derived(period);
  const run = $derived(simulate(p, Math.min(60, Math.ceil((from + SPAN) / period) + 1)));

  const rows: Row[] = $derived([
    ...(skew !== 0 ? [{ name: skew < 0 ? 'CLK →FF2' : 'CLK →FF1', segs: skew < 0 ? run.clk2 : run.clk1 } satisfies Row] : []),
    { name: skew !== 0 ? (skew < 0 ? 'CLK →FF1' : 'CLK →FF2') : 'CLK', segs: skew !== 0 ? (skew < 0 ? run.clk1 : run.clk2) : run.clk1 },
    { name: 'Q1', segs: run.q1 },
    { name: 'D2', segs: run.d2 },
    { name: 'Q2', segs: run.q2 },
  ]);
  const bands: Band[] = $derived(
    run.captures.map((c) => ({ from: c.time - p.setup, to: c.time + p.hold, tone: c.verdict === 'ok' ? ('setup' as const) : ('bad' as const) })),
  );
  const marks: Mark[] = $derived(
    run.captures.map((c) => ({
      t: c.time,
      symbol: c.verdict === 'ok' ? '✓' : c.verdict === 'metastable' ? '?' : '✗',
      tone: c.verdict === 'ok' ? ('ok' as const) : ('bad' as const),
      title:
        c.verdict === 'ok'
          ? `Capture at ${c.time.toFixed(1)} ns: correct`
          : c.verdict === 'metastable'
            ? `Capture at ${c.time.toFixed(1)} ns: the data moved inside the aperture, so Q2 was unknown for a while`
            : `Capture at ${c.time.toFixed(1)} ns: Q2 holds the wrong value`,
    })),
  );

  // The budget bar: where one period goes.
  const used = $derived(p.clkToQ + a.tpath + p.setup);
  const avail = $derived(period + skew);
  const scale = $derived(Math.max(used, avail));
  const pct = (v: number) => `${(100 * v) / scale}%`;

  const verdict = $derived.by(() => {
    const bad = run.captures.filter((c) => c.verdict !== 'ok');
    if (!bad.length) return { ok: true, text: 'Every capture is correct.' };
    const meta = bad.some((c) => c.verdict === 'metastable');
    if (!a.setupOk) {
      return meta
        ? { ok: false, text: `The data arrives ${(-a.setupSlack).toFixed(1)} ns after it was needed, inside the aperture, so FF2 goes metastable: Q2 is unknown for a random time, then 0 or 1.` }
        : { ok: false, text: 'The path is longer than the clock period. The data reaches FF2 a cycle late, and Q2 quietly holds the value from an earlier cycle. Nothing warns you.' };
    }
    if (!a.holdOk) return { ok: false, text: `The next value arrives ${(-a.holdSlack).toFixed(1)} ns too soon: it changes before FF2 has finished looking at the old one. Slowing the clock would not help.` };
    return { ok: false, text: 'A capture went wrong.' };
  });
  const FLOOR = 3;

  const fmt = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
  function toLimit() {
    period = Math.min(40, Math.max(3, Math.ceil((a.tmin + 0.2) * 10) / 10));
  }
  function reset() {
    period = DEFAULT_PATH.period;
    gates = DEFAULT_PATH.gates;
    skew = 0;
  }
</script>

<Widget title="Break the clock" subtitle="One path between two flip-flops: how fast can it go?" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <div class="ctl">
      <Slider label="Clock period" bind:value={period} min={3} max={40} step={0.1} format={(v) => `${v.toFixed(1)} ns · ${(1000 / v).toFixed(0)} MHz`} />
      <Slider label="Gates in the path" bind:value={gates} min={0} max={12} step={1} format={(v) => `${v} × ${gateDelay} ns`} />
      <Slider label="Clock skew at FF2" bind:value={skew} min={-3} max={3} step={0.1} format={(v) => `${fmt(v)} ns`} />
    </div>
  {/snippet}

  <div class="w">
    <div class="chain ui" aria-hidden="true">
      <span class="box ff">FF1<small>clock to Q {p.clkToQ} ns</small></span>
      <span class="arrow">→</span>
      <span class="box path">{gates === 0 ? 'a wire' : `${gates} gate${gates === 1 ? '' : 's'}`}<small>{a.tpath.toFixed(1)} ns</small></span>
      <span class="arrow">→</span>
      <span class="box ff">FF2<small>set-up {p.setup} ns · hold {p.hold} ns</small></span>
    </div>

    <div class="budget ui" role="img" aria-label="Where the clock period goes: clock to Q {p.clkToQ} ns, gates {a.tpath.toFixed(1)} ns, set-up {p.setup} ns; {a.setupSlack >= 0 ? `${a.setupSlack.toFixed(1)} ns to spare` : `${(-a.setupSlack).toFixed(1)} ns too long`}.">
      <div class="bar" style:--avail={pct(avail)}>
        <span class="seg cq" style:width={pct(p.clkToQ)}>clk→Q</span>
        <span class="seg pd" style:width={pct(a.tpath)}>{a.tpath > 0 ? 'gates' : ''}</span>
        <span class="seg su" style:width={pct(p.setup)}>su</span>
        {#if avail > used}
          <span class="seg slack" style:width={pct(avail - used)}>slack {a.setupSlack.toFixed(1)}</span>
        {:else if used > avail}
          <span class="seg over" style:width={pct(used - avail)}>late</span>
        {/if}
        <i class="limit" aria-hidden="true"></i>
      </div>
      <div class="scalelabels"><span>0</span><span class="lim">next capture edge at {avail.toFixed(1)} ns</span></div>
    </div>

    <Strip {rows} {bands} {marks} {from} to={from + SPAN} label="Timing diagram of the launch and capture flip-flops. Shaded bands are the set-up and hold aperture around each capture edge." />

    <div class="read ui">
      <div class="nums">
        <div class="num" class:bad={!a.setupOk}><span>Set-up slack</span><b>{fmt(a.setupSlack)} ns</b></div>
        <div class="num" class:bad={!a.holdOk}><span>Hold slack</span><b>{fmt(a.holdSlack)} ns</b></div>
        <div class="num"><span>Shortest period</span><b>{a.tmin < FLOOR ? `< ${FLOOR}` : a.tmin.toFixed(1)} ns</b></div>
        <div class="num"><span>Top speed</span><b>{a.tmin < FLOOR ? `> ${(1000 / FLOOR).toFixed(0)}` : a.fmax.toFixed(0)} MHz</b></div>
      </div>
      <p class="verdict" class:ok={verdict.ok} class:bad={!verdict.ok} role="status"><b>{verdict.ok ? 'Works.' : 'Fails.'}</b> {verdict.text}</p>
      <div class="btns">
        <Button size="sm" onclick={toLimit}>Set the period to the limit</Button>
        <Button size="sm" onclick={() => { gates = 0; skew = 2; period = 20; }}>Short path, skewed clock</Button>
        <Button size="sm" onclick={() => { gates = 12; skew = 0; period = 12; }}>Twelve gates at 12 ns</Button>
      </div>
      <p class="fine">Flip-flop numbers ({FLIPFLOP.clkToQ} ns clock to Q, {FLIPFLOP.setup} ns set-up, {FLIPFLOP.hold} ns hold) and {gateDelay} ns gates are typical of a 5 V CMOS family, not of any one part.</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .w {
    display: grid;
    gap: 0.9rem;
    min-width: 0;
  }
  .chain {
    display: flex;
    align-items: stretch;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .box {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.3rem 0.7rem;
    border: 1.5px solid var(--wire);
    border-radius: 6px;
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1.25;
  }
  .box small {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--mute);
  }
  .box.path {
    border-style: dashed;
  }
  .arrow {
    align-self: center;
    color: var(--mute);
  }
  .budget {
    display: grid;
    gap: 0.25rem;
  }
  .bar {
    position: relative;
    display: flex;
    height: 1.7rem;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: var(--pn);
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .seg {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
    color: var(--fg);
    min-width: 0;
  }
  .seg.cq {
    background: var(--copper-soft);
    border-right: 1px solid var(--line-strong);
  }
  .seg.pd {
    background: light-dark(rgb(26 115 201 / 0.16), rgb(98 200 255 / 0.16));
    border-right: 1px solid var(--line-strong);
  }
  .seg.su {
    background: var(--maybe-soft);
    border-right: 1px solid var(--line-strong);
  }
  .seg.slack {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .seg.over {
    background: repeating-linear-gradient(135deg, var(--bad-soft) 0 5px, transparent 5px 9px);
    color: var(--bad);
    font-weight: 700;
  }
  .limit {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--avail);
    width: 0;
    border-left: 2px solid var(--fg);
  }
  .scalelabels {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .read {
    display: grid;
    gap: 0.6rem;
  }
  .nums {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    gap: 0.5rem;
  }
  .num {
    display: grid;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
  }
  .num span {
    font-size: 0.7rem;
    color: var(--mute);
  }
  .num b {
    font-family: var(--font-mono);
    font-size: 1rem;
    color: var(--ok);
  }
  .num.bad b {
    color: var(--bad);
  }
  .num:not(:nth-child(-n + 2)) b {
    color: var(--fg);
  }
  .verdict {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.86rem;
    line-height: 1.45;
  }
  .verdict.ok {
    background: var(--ok-soft);
    border: 1px solid var(--ok);
  }
  .verdict.bad {
    background: var(--bad-soft);
    border: 1px solid var(--bad);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .fine {
    margin: 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
</style>
