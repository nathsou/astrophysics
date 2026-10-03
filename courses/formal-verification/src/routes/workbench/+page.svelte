<script lang="ts">
  import { onMount } from 'svelte';
  import { COURSE_TITLE } from '$content/outline';
  import Playground from '$lib/components/verify/Playground.svelte';

  const files = import.meta.glob('/src/lib/fv/vouch/examples/*.vouch', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const examples = Object.entries(files)
    .map(([path, code]) => ({ id: path.split('/').at(-1)!.replace('.vouch', ''), code }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const TITLES: Record<string, string> = {
    'binary-search': 'Binary search (fixed)',
    'binary-search-overflow': 'Binary search (Java’s overflow bug)',
    'die-hard': 'The Die Hard jugs',
    peterson: 'Peterson’s mutual exclusion',
    hyman: 'Hyman’s mutual exclusion (1966)',
    'two-phase-commit': 'Two-phase commit',
    'needham-schroeder': 'Needham–Schroeder and Lowe’s attack',
    'insertion-sort': 'Insertion sort',
    'ledger-transfer': 'The Ledger’s transfer',
    'list-reverse': 'List reversal (separation logic)',
    'ring-buffer': 'A ring buffer and its abstraction',
    'file-system': 'A file system (small worlds)',
    sudoku: 'A 4×4 Sudoku',
  };
  let chosen = $state('peterson');
  let custom = $state<string | undefined>();
  const code = $derived(custom ?? examples.find((e) => e.id === chosen)?.code ?? '');

  onMount(() => {
    const q = new URLSearchParams(location.search).get('code');
    if (q) custom = q;
  });
</script>

<svelte:head>
  <title>The Workbench — {COURSE_TITLE}</title>
  <meta name="description" content="Write Vouch, the course's verification language, and check it as you type: diagnostics, hover, completion, rename, and verdicts with certificates." />
</svelte:head>

<div class="page">
  <header class="guilloche">
    <p class="eyebrow ui">The Workbench</p>
    <h1>Write it, then let the machine check it</h1>
    <p class="lede">
      The editor talks to the Vouch language server, which runs in your browser. It reports problems as you type,
      explains any name you hover, completes, renames, and, when you pause, runs the course's engines on every
      invariant, property and contract. Each result comes as a badge that says exactly what was established.
    </p>
    <label class="ui pick">
      Start from
      <select bind:value={chosen} onchange={() => (custom = undefined)}>
        {#each examples as e (e.id)}<option value={e.id}>{TITLES[e.id] ?? e.id}</option>{/each}
      </select>
    </label>
  </header>
  {#key code}
    <Playground {code} name="workbench" minLines={22} />
  {/key}
</div>

<style>
  .page {
    max-width: 90rem;
    margin: 0 auto;
    padding: 0 max(1rem, 2vw) 4rem;
  }
  header {
    padding: 2.4rem 1rem 1.2rem;
    margin: 0 -1rem;
    border-bottom: 1px solid var(--line);
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--gold);
    margin: 0 0 0.4rem;
  }
  h1 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    margin: 0 0 0.6rem;
  }
  .lede {
    max-width: 52rem;
    margin: 0 0 1rem;
  }
  .pick {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.9rem;
  }
  select {
    font: inherit;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--fg);
  }
</style>
