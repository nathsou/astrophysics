<!--
  The sieve of Eratosthenes, animated: cross out multiples of each prime in turn; what survives is prime.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const N = 120;
  const HUES = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)', 'var(--series-7)', 'var(--series-5)'];
  // killer[k] = the prime that first crossed k out (0 = not crossed).
  let killer = $state<number[]>(Array(N + 1).fill(0));
  let primes = $state<number[]>([]);
  let current = $state(1);
  let running = $state(false);
  let done = $state(false);

  function reset() {
    killer = Array(N + 1).fill(0);
    primes = [];
    current = 1;
    running = false;
    done = false;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** Advance to the next prime and cross out its multiples (animated). */
  async function step() {
    if (done) return;
    let p = current + 1;
    while (p <= N && killer[p]) p++;
    if (p > N) {
      done = true;
      return;
    }
    current = p;
    primes = [...primes, p];
    if (p * p > N) {
      // Every composite ≤ N has a prime factor ≤ √N, so everything left is prime.
      done = true;
      return;
    }
    for (let k = p * p; k <= N; k += p) {
      if (!killer[k]) {
        killer[k] = p;
        await sleep(running ? 25 : 12);
      }
    }
  }

  async function run() {
    running = true;
    while (!done && running) {
      await step();
      await sleep(250);
    }
    running = false;
  }

  const hue = (p: number) => HUES[primes.indexOf(p) % HUES.length];
  const survivors = $derived(done ? Array.from({ length: N - 1 }, (_, i) => i + 2).filter((k) => !killer[k]) : []);
</script>

<Widget title="The sieve of Eratosthenes" subtitle="Circle the next uncrossed number — it is prime — and cross out its multiples. Once the prime passes √120 ≈ 10.95, everything left is prime." onreset={reset}>
  {#snippet controls()}
    <button onclick={step} disabled={done || running}>Next prime</button>
    <button onclick={() => (running ? (running = false) : run())} disabled={done}>{running ? 'Pause' : 'Run'}</button>
    <span class="msg">{#if done}{survivors.length} primes up to {N}.{:else if primes.length}Sieving with {current}…{:else}Press “Next prime”.{/if}</span>
  {/snippet}
  <div class="grid" role="img" aria-label="Numbers 1 to {N}, with composites crossed out">
    {#each Array.from({ length: N }, (_, i) => i + 1) as k (k)}
      <span
        class="cell num"
        class:one={k === 1}
        class:dead={(killer[k] ?? 0) > 0}
        class:prime={primes.includes(k) || (done && k > 1 && !killer[k])}
        class:cur={k === current && !done}
        style:--h={killer[k] ? hue(killer[k]) : primes.includes(k) ? hue(k) : 'var(--accent)'}
      >{k}</span>
    {/each}
  </div>
</Widget>

<style>
  button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.8rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  button:disabled {
    opacity: 0.5;
  }
  .msg {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 3px;
    max-width: 34rem;
    margin: 0 auto;
  }
  .cell {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border-radius: 5px;
    font-size: 0.78rem;
    background: var(--page);
    border: 1px solid var(--border);
    transition: background 0.25s, color 0.25s;
  }
  .one {
    color: var(--ink-3);
  }
  .dead {
    color: var(--ink-3);
    background: color-mix(in srgb, var(--h) 14%, var(--page));
  }
  .dead::after {
    content: '';
    position: absolute;
    left: 15%;
    right: 15%;
    top: 50%;
    height: 2px;
    background: var(--h);
    transform: rotate(-35deg);
    animation: strike 0.25s ease-out;
  }
  @keyframes strike {
    from {
      transform: rotate(-35deg) scaleX(0);
    }
  }
  .prime {
    font-weight: 700;
    color: var(--ink);
    border: 2px solid var(--h);
    border-radius: 50%;
  }
  .cur {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--h) 35%, transparent);
  }
</style>
