<!--
  Induction as falling dominoes: the base case knocks over the first; the inductive step guarantees
  each one knocks over the next. Remove either and the chain fails.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const COUNT = 14;
  let base = $state(true);
  let brokenAt = $state<number | null>(null); // the step P(k) → P(k+1) fails for this k
  let fallen = $state(0);
  let running = $state(false);

  async function push() {
    fallen = 0;
    running = true;
    if (!base) {
      running = false;
      return;
    }
    for (let i = 1; i <= COUNT; i++) {
      fallen = i;
      if (brokenAt !== null && i === brokenAt + 1) break;
      await new Promise((r) => setTimeout(r, 140));
    }
    running = false;
  }
  function reset() {
    fallen = 0;
    running = false;
  }
  const tilt = (i: number) => (i < fallen ? 62 : 0);
  const summary = $derived(
    !base ? 'Without a base case, nothing starts: the step is never used.' : brokenAt !== null ? `The step fails from ${brokenAt} to ${brokenAt + 1}: everything after domino ${brokenAt} stays standing.` : 'Base case and every step hold: all the dominoes fall — for any number of dominoes.',
  );
</script>

<Widget title="Falling dominoes" subtitle="P(0) knocks over the first domino. “If P(k) then P(k + 1)” means each domino, if it falls, knocks over the next." onreset={reset}>
  {#snippet controls()}
    <label class="ctl"><input type="checkbox" bind:checked={base} onchange={reset} /> base case P(0) holds</label>
    <label class="ctl">step fails at k =
      <select value={brokenAt ?? ''} onchange={(e) => ((brokenAt = (e.target as HTMLSelectElement).value === '' ? null : Number((e.target as HTMLSelectElement).value)), reset())}>
        <option value="">never</option>
        {#each [2, 5, 9] as k (k)}<option value={k}>{k}</option>{/each}
      </select>
    </label>
    <button onclick={push} disabled={running}>Push the first domino</button>
  {/snippet}
  <svg viewBox="0 0 700 150" width="100%" role="img" aria-label="A row of {COUNT} dominoes; {fallen} have fallen">
    <line x1="10" x2="690" y1="130" y2="130" class="floor" />
    {#each Array.from({ length: COUNT }, (_, i) => i) as i (i)}
      {@const x = 40 + i * 46}
      <g style:transform="translate({x}px, 130px) rotate({tilt(i)}deg)" class="dom" class:gap={brokenAt !== null && i === brokenAt + 1}>
        <rect x="-7" y="-78" width="14" height="78" rx="2" class:down={i < fallen} />
        <text x="0" y="-86">{i}</text>
      </g>
      {#if brokenAt !== null && i === brokenAt}
        <text x={x + 23} y="146" class="warn">✗</text>
      {/if}
    {/each}
  </svg>
  <p class="sum" class:ok={base && brokenAt === null && fallen === COUNT}>{summary}</p>
</Widget>

<style>
  .ctl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
  }
  select,
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .floor {
    stroke: var(--ink-3);
    stroke-width: 2;
  }
  .dom {
    transition: transform 0.28s cubic-bezier(0.5, 0, 0.9, 0.6);
  }
  rect {
    fill: var(--surface-2);
    stroke: var(--byrne-ink);
    stroke-width: 1.5;
  }
  rect.down {
    fill: var(--byrne-red);
  }
  .gap rect {
    fill: var(--surface);
  }
  text {
    font-size: 12px;
    fill: var(--ink-2);
    text-anchor: middle;
    font-family: var(--font-ui);
  }
  .warn {
    fill: var(--bad);
    font-size: 14px;
    font-weight: 700;
  }
  .sum {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    text-align: center;
    color: var(--ink-2);
  }
  .sum.ok {
    color: var(--ok);
    font-weight: 600;
  }
</style>
