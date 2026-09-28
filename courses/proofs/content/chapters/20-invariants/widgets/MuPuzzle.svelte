<!--
  Hofstadter's MU puzzle: start from MI and use four rules to reach MU. The number of I's, modulo 3,
  starts at 1 and can only double or drop by 3 — so it is never 0, and MU (with no I's) is unreachable.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let word = $state('MI');
  let history = $state<string[]>(['MI']);
  let pick = $state<'III' | 'UU' | null>(null);
  const MAX = 48;
  const iCount = $derived([...word].filter((c) => c === 'I').length);

  function push(w: string) {
    if (w.length > MAX) return;
    word = w;
    history = [...history, w];
    pick = null;
  }
  const occurrences = (pat: string) => {
    const out: number[] = [];
    for (let i = word.indexOf(pat); i >= 0; i = word.indexOf(pat, i + 1)) out.push(i);
    return out;
  };
  const r1 = $derived(word.endsWith('I'));
  const r2 = $derived(word.length * 2 - 1 <= MAX);
  const r3 = $derived(occurrences('III').length > 0);
  const r4 = $derived(occurrences('UU').length > 0);
  function undo() {
    if (history.length < 2) return;
    history = history.slice(0, -1);
    word = history.at(-1)!;
    pick = null;
  }
</script>

<Widget title="The MU puzzle" subtitle="Start with MI. Rules: (1) xI → xIU; (2) Mx → Mxx; (3) replace any III by U; (4) delete any UU. Can you make MU?" onreset={() => ((word = 'MI'), (history = ['MI']), (pick = null))}>
  {#snippet controls()}
    <button disabled={!r1} onclick={() => push(word + 'U')}>1: add U</button>
    <button disabled={!r2} onclick={() => push('M' + word.slice(1) + word.slice(1))}>2: double</button>
    <button disabled={!r3} class:on={pick === 'III'} onclick={() => (pick = pick === 'III' ? null : 'III')}>3: III → U</button>
    <button disabled={!r4} class:on={pick === 'UU'} onclick={() => (pick = pick === 'UU' ? null : 'UU')}>4: drop UU</button>
    <button onclick={undo} disabled={history.length < 2}>Undo</button>
  {/snippet}
  <p class="word">
    {#each [...word] as ch, i (i)}
      {@const hot = pick && occurrences(pick).some((o) => i >= o && i < o + pick!.length)}
      {@const start = pick && occurrences(pick).includes(i)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span class="ch" class:hot class:start onclick={() => start && push(word.slice(0, i) + (pick === 'III' ? 'U' : '') + word.slice(i + pick!.length))}>{ch}</span>
    {/each}
  </p>
  {#if pick}<p class="hint">Click the first letter of the {pick} you want to replace.</p>{/if}
  <p class="inv num">number of I’s: <strong>{iCount}</strong> &nbsp; ≡ <strong class="mod">{iCount % 3}</strong> (mod 3) {iCount % 3 === 0 ? '' : '— never 0, as the invariant predicts'}</p>
  <p class="hist">{history.slice(-8).join(' → ')}</p>
</Widget>

<style>
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
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .word {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    letter-spacing: 0.08em;
    text-align: center;
    overflow-wrap: anywhere;
    margin: 0.3rem 0;
  }
  .ch {
    border-radius: 3px;
  }
  .ch.hot {
    background: color-mix(in srgb, var(--byrne-yellow) 45%, transparent);
  }
  .ch.start {
    cursor: pointer;
    outline: 2px solid var(--byrne-red);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--ink-2);
    text-align: center;
    margin: 0;
  }
  .inv {
    font-size: 0.88rem;
    text-align: center;
    margin: 0.3rem 0;
  }
  .mod {
    color: var(--byrne-red);
    font-size: 1.1rem;
  }
  .hist {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-3);
    overflow-wrap: anywhere;
    margin: 0;
  }
</style>
