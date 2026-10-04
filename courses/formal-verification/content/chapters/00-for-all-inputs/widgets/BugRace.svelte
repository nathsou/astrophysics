<!--
  The bug race (chapter 0's flagship): a random tester and the verifier race on the same binary search. The tester
  runs the reference interpreter on random sorted arrays, with every contract and every overflow checked; the
  verifier proves the function for all inputs or finds an input that breaks it, and replays that input.
-->
<script lang="ts">
  import buggy from '$lib/fv/vouch/examples/binary-search-overflow.vouch?raw';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { verifyText } from '$lib/components/verify/lsp';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { Runner } from '$lib/fv/vouch/interp/exec';
  import { seq } from '$lib/fv/vouch/interp/values';
  import { rng } from '$lib/fv/util/random';
  import type { Verdict } from '$lib/fv/engines';
  import { progress } from '$lib/state/progress.svelte';

  let { caption }: { caption?: string } = $props();

  const start = buggy.split('\n').filter((l) => !l.startsWith('//')).join('\n').trim();
  let editor: VouchEditor | undefined = $state();
  let maxLen = $state(16);
  let budget = $state(20000);

  // Tester state.
  let tests = $state(0);
  let lengths = $state<number[]>(Array(8).fill(0));
  let failure = $state<{ input: string; message: string; len: number } | undefined>();
  let testing = $state(false);
  // Verifier state.
  let verdicts = $state<Verdict[] | undefined>();
  let errors = $state<string[]>([]);
  let verifying = $state(false);
  let verifyMs = $state(0);
  let stopped = false;

  const BUCKETS = 8;
  const bucketOf = (n: number) => Math.min(BUCKETS - 1, Math.floor((n / 128) * BUCKETS));

  function race() {
    const code = editor?.getValue() ?? start;
    runTester(code);
    void runVerifier(code);
  }

  function runTester(code: string) {
    stopped = false;
    tests = 0;
    lengths = Array(BUCKETS).fill(0);
    failure = undefined;
    const parsed = parse(code);
    const checked = check(parsed.program);
    if (checked.diagnostics.some((d) => d.severity === 'error') || !checked.fns.get('search')) return;
    testing = true;
    const r = rng(2006);
    const hist = Array(BUCKETS).fill(0);
    const step = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 10 && tests < budget && !failure && !stopped) {
        const n = r.int(0, maxLen + 1);
        const items = Array.from({ length: n }, () => BigInt(r.int(-50, 51))).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const key = BigInt(r.int(-60, 61));
        const res = new Runner(checked, { fuel: 50_000 }).run('search', [seq(items), key]);
        tests++;
        hist[bucketOf(n)]++;
        if (res.failure && res.failure.kind !== 'fuel') {
          failure = { input: `a = [${items.join(', ')}], key = ${key}`, message: res.failure.message, len: n };
        }
      }
      lengths = [...hist];
      if (tests < budget && !failure && !stopped) requestAnimationFrame(step);
      else testing = false;
    };
    requestAnimationFrame(step);
  }

  async function runVerifier(code: string) {
    verifying = true;
    verdicts = undefined;
    errors = [];
    const t0 = performance.now();
    try {
      const r = await verifyText(code);
      errors = r.errors.map((e) => `line ${e.line}: ${e.message}`);
      verdicts = r.verdicts.find((d) => d.decl === 'search')?.verdicts ?? [];
      if (verdicts.some((v) => v.status === 'violated' && v.badge.kind === 'violated' && v.badge.replayed)) progress.markCaught('binary-search-2006');
    } finally {
      verifyMs = performance.now() - t0;
      verifying = false;
    }
  }

  const cex = $derived.by(() => {
    const v = verdicts?.find((x) => x.status === 'violated');
    const m = v?.message?.match(/Input: a = \[([^\]]*)\], key = (-?\d+)/);
    if (!m) return undefined;
    const items = m[1]!.split(', ').filter(Boolean);
    return { n: items.length, first: items.slice(0, 4).join(', '), last: items.slice(-2).join(', '), key: m[2], why: v!.message!.split(' Input:')[0] };
  });
  const peak = $derived(Math.max(1, ...lengths));
</script>

<figure class="race">
  <div class="code">
    <VouchEditor bind:this={editor} value={start} name="bug-race" minLines={12} maxHeight="26rem" />
  </div>
  <div class="controls ui">
    <button type="button" class="go" onclick={race} disabled={testing || verifying}>{testing || verifying ? 'Racing…' : 'Start the race'}</button>
    <label>Largest array the tester tries <input type="range" min="4" max="127" bind:value={maxLen} /> <b>{maxLen}</b></label>
    <label>Tests <select bind:value={budget}><option value={2000}>2,000</option><option value={20000}>20,000</option><option value={100000}>100,000</option></select></label>
  </div>
  <div class="lanes">
    <section class="lane" aria-live="polite">
      <h4 class="ui">The random tester</h4>
      <p class="big ui">{tests.toLocaleString('en-GB')} <span>input{tests === 1 ? '' : 's'} run</span></p>
      <div class="hist" role="img" aria-label="Lengths of the arrays tried">
        {#each lengths as c, i (i)}
          <span class="bar" style:height="{(c / peak) * 100}%" title="{i * 16}–{i * 16 + 15}: {c}"></span>
        {/each}
      </div>
      <p class="axis ui"><span>0</span><span>array length</span><span>127</span></p>
      {#if failure}
        <p class="found"><b class="ui">Found a failing input</b> (an array of {failure.len}): {failure.message}</p>
      {:else if tests && !testing}
        <p class="none">No failure. Every test passed.</p>
      {/if}
    </section>
    <section class="lane" aria-live="polite">
      <h4 class="ui">The verifier</h4>
      {#if verifying}
        <p class="big ui">thinking…</p>
      {:else if errors.length}
        <ul class="err ui">{#each errors as e, i (i)}<li>{e}</li>{/each}</ul>
      {:else if verdicts}
        <p class="big ui">{verifyMs < 1000 ? Math.round(verifyMs) : (verifyMs / 1000).toFixed(1)} <span>{verifyMs < 1000 ? 'milliseconds' : 'seconds'}</span></p>
        {#if cex}
          <p class="found"><b class="ui">Counterexample:</b> a sorted array of {cex.n} elements ([{cex.first}, …, {cex.last}]) and key = {cex.key}. {cex.why}</p>
        {/if}
        {#each verdicts as v, i (i)}<Badge verdict={v} />{/each}
      {:else}
        <p class="none">Waiting for the start.</p>
      {/if}
    </section>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .race {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.2rem;
    margin: 0.7rem 0;
    font-size: 0.85rem;
  }
  .controls label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .controls input {
    accent-color: var(--ink-blue);
  }
  .go {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0.35rem 0.9rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  .go:disabled {
    opacity: 0.6;
  }
  select {
    font: inherit;
  }
  .lanes {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem;
  }
  @media (max-width: 760px) {
    .lanes {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .lane {
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    min-width: 0;
  }
  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .big {
    margin: 0 0 0.4rem;
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .big span {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--ink-2);
  }
  .hist {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 3.2rem;
    border-bottom: 1px solid var(--line-strong);
  }
  .bar {
    flex: 1;
    background: var(--ink-blue);
    opacity: 0.75;
    min-height: 1px;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    margin: 0.15rem 0 0.4rem;
    font-size: 0.7rem;
    color: var(--mute);
  }
  .found {
    margin: 0.4rem 0;
    color: var(--pencil);
    font-size: 0.95rem;
    overflow-wrap: anywhere;
  }
  .none {
    margin: 0.4rem 0;
    color: var(--ink-2);
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
