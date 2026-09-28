<!--
  Cantor's diagonal argument (1891). Any list of real numbers in (0, 1) misses one: change the
  n-th digit of the n-th number (to 5, or to 4 if it was 5). The result differs from every row.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const ROWS = 10;
  const DIGITS = 14;
  const PRESETS: Record<string, string[]> = {
    'Famous numbers': ['14159265358979', '71828182845904', '41421356237309', '33333333333333', '14285714285714', '61803398874989', '50000000000000', '73205080756887', '69314718055994', '57721566490153'],
    'A cunning list': ['10000000000000', '01000000000000', '00100000000000', '00010000000000', '00001000000000', '00000100000000', '00000010000000', '00000001000000', '00000000100000', '00000000010000'],
    'Random': [],
  };
  const NAMES: Record<string, string[]> = {
    'Famous numbers': ['π − 3', 'e − 2', '√2 − 1', '1/3', '1/7', 'φ − 1', '1/2', '√3 − 1', 'ln 2', 'γ (Euler)'],
  };

  let preset = $state('Famous numbers');
  let rows = $state<string[]>([...PRESETS['Famous numbers']!]);
  let built = $state(0);
  let hover = $state<number | null>(null);

  function load(name: string) {
    preset = name;
    rows = name === 'Random' ? Array.from({ length: ROWS }, () => Array.from({ length: DIGITS }, () => Math.floor(Math.random() * 10)).join('')) : [...PRESETS[name]!];
    built = 0;
  }
  const newDigit = (d: string) => (d === '5' ? '4' : '5');
  const diag = $derived(rows.map((r, i) => newDigit(r[i] ?? '0')));

  $effect(() => {
    if (built <= 0 || built >= ROWS) return;
    const id = setTimeout(() => built++, 380);
    return () => clearTimeout(id);
  });

  function edit(i: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(0, DIGITS).padEnd(DIGITS, '0');
    rows[i] = clean;
    preset = 'Your own';
  }
</script>

<Widget title="The diagonal argument" subtitle="A list of numbers between 0 and 1, digit by digit. Build a new number that differs from the n-th number in its n-th digit. Edit any row — the new number escapes whatever list you make." onreset={() => load('Famous numbers')}>
  {#snippet controls()}
    {#each Object.keys(PRESETS) as k (k)}<button class:on={preset === k} onclick={() => load(k)}>{k}</button>{/each}
    <button class="go" onclick={() => (built = 1)}>Build the diagonal number</button>
  {/snippet}
  <div class="list num">
    {#each rows as r, i (i)}
      <div class="row" class:hl={hover === i}>
        <span class="idx">{i + 1}</span>
        <span class="zero">0.</span>
        <span class="digits">
          {#each r.split('') as d, j (j)}<span class="d" class:diag={i === j} class:done={i === j && built > i}>{d}</span>{/each}
        </span>
        <input value={r} oninput={(e) => edit(i, (e.target as HTMLInputElement).value)} aria-label="Digits of number {i + 1}" />
        {#if NAMES[preset]}<span class="name">{NAMES[preset]![i]}</span>{/if}
      </div>
    {/each}
    <div class="row result">
      <span class="idx">new</span>
      <span class="zero">0.</span>
      <span class="digits">
        {#each diag as d, j (j)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="d nd" class:shown={built > j} onmouseenter={() => (hover = j)} onmouseleave={() => (hover = null)}>{built > j ? d : '·'}</span>
        {/each}
        <span class="d">…</span>
      </span>
    </div>
  </div>
  <p class="read">
    {#if hover !== null && built > hover}
      The new number has <strong>{diag[hover]}</strong> in position {hover + 1}; number {hover + 1} has <strong>{rows[hover]![hover]}</strong> there. So they differ.
    {:else if built >= ROWS}
      The new number differs from every number in the list — in the first digit from the first number, in the second from the second, and so on. However the list continues, the same recipe works.
    {:else}
      Press “Build” and hover over the new digits.
    {/if}
  </p>
</Widget>

<style>
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .go {
    border-color: var(--byrne-red);
  }
  .list {
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    overflow-x: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
  }
  .row.hl {
    background: var(--accent-soft);
  }
  .idx {
    width: 2.2rem;
    text-align: right;
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .zero {
    color: var(--ink-2);
  }
  .digits {
    display: flex;
  }
  .d {
    width: 1.15rem;
    text-align: center;
  }
  .d.diag {
    background: color-mix(in srgb, var(--byrne-yellow) 30%, transparent);
    border-radius: 3px;
  }
  .d.done {
    background: var(--byrne-yellow);
    color: #111;
    font-weight: 700;
  }
  input {
    width: 8.5rem;
    font: inherit;
    font-size: 0.72rem;
    padding: 0 0.3rem;
    margin-left: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--page);
    color: var(--ink-2);
  }
  .name {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .result {
    margin-top: 0.3rem;
    border-top: 2px solid var(--byrne-red);
    padding-top: 0.3rem;
  }
  .nd {
    color: var(--byrne-red);
    font-weight: 700;
  }
  .nd.shown {
    animation: pop 0.3s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(1.8);
    }
  }
  .read {
    font-size: 0.85rem;
    margin: 0.5rem 0 0;
    color: var(--ink-2);
  }
</style>
