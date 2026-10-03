<!--
  The result badge (PLAN §2, "Honest results"): every result in the course is reported this way. A verified result
  is an embossed seal, a violation a red-pencil stamp, testing and bounded checks plain ink stamps. Expanding it
  says what was checked, how, and what was assumed.
-->
<script lang="ts">
  import { badgeText, type Verdict } from '$lib/fv/engines';

  let { verdict, compact = false, open = false }: { verdict: Verdict; compact?: boolean; open?: boolean } = $props();

  const b = $derived(verdict.badge);
  const tone = $derived(verdict.status === 'violated' ? 'bad' : verdict.status === 'verified' ? 'ok' : b.kind === 'tested' || b.kind === 'bounded' ? 'ink' : 'maybe');
  const glyph = $derived(tone === 'bad' ? '✗' : tone === 'ok' ? '✓' : b.kind === 'tested' ? '◌' : b.kind === 'bounded' ? '⋯' : '?');
  const title = $derived(
    verdict.status === 'violated' ? 'Violated'
    : b.kind === 'verified' ? 'Verified'
    : b.kind === 'exhaustive' ? 'Checked exhaustively'
    : b.kind === 'tested' ? 'Tested'
    : b.kind === 'bounded' ? 'Bounded check'
    : b.kind === 'error' ? 'Error'
    : 'Unknown',
  );
  const stats = $derived(Object.entries(verdict.stats ?? {}).filter(([, v]) => typeof v === 'number'));
</script>

<details class="badge {tone}" class:compact {open}>
  <summary>
    <span class="stamp" aria-hidden="true">{glyph}</span>
    <span class="what">
      <span class="title">{title}</span>
      <span class="subject">{verdict.subject}</span>
    </span>
    <span class="how">{badgeText(b)}</span>
  </summary>
  <div class="body">
    {#if verdict.message}<p class="msg">{verdict.message}</p>{/if}
    <dl>
      <dt>Engine</dt>
      <dd>{verdict.engine}</dd>
      <dt>Certificate</dt>
      <dd>
        {#if verdict.certificate.kind === 'none'}none{:else}{verdict.certificate.kind}
          {#if verdict.certificate.checked}<span class="vchip ok">✓ checked</span> by {verdict.certificate.checker}{:else}<span class="vchip maybe">not independently checked</span>{#if verdict.certificate.checker} ({verdict.certificate.checker}){/if}{/if}{/if}
      </dd>
      {#if verdict.assumptions.length}
        <dt>Assumes</dt>
        <dd>
          <ul>{#each verdict.assumptions as a (a)}<li>{a}</li>{/each}</ul>
        </dd>
      {/if}
      {#if stats.length}
        <dt>Statistics</dt>
        <dd class="stats">{#each stats as [k, v] (k)}<span>{k} <b>{v.toLocaleString('en-GB')}</b></span>{/each}</dd>
      {/if}
    </dl>
  </div>
</details>

<style>
  .badge {
    --c: var(--ink-blue);
    border: 1px solid color-mix(in srgb, var(--c) 45%, var(--line));
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--c) 5%, var(--panel));
    font-family: var(--font-ui);
    font-size: 0.86rem;
  }
  .badge.ok {
    --c: var(--seal);
    outline: 1px solid color-mix(in srgb, var(--seal) 25%, transparent);
    outline-offset: 2px;
  }
  .badge.bad {
    --c: var(--pencil);
  }
  .badge.maybe {
    --c: var(--maybe);
  }
  summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .stamp {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    border: 2px solid var(--c);
    color: var(--c);
    font-weight: 800;
    transform: rotate(-8deg);
  }
  .ok .stamp {
    border-style: double;
    border-width: 4px;
    background: var(--seal-soft);
  }
  .bad .stamp {
    border-radius: 3px;
  }
  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--c);
  }
  .subject {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .how {
    font-size: 0.8rem;
    color: var(--ink-2);
    text-align: right;
  }
  .compact .how {
    display: none;
  }
  .body {
    padding: 0 0.8rem 0.7rem 3.2rem;
  }
  .msg {
    margin: 0 0 0.5rem;
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.2rem 0.8rem;
    margin: 0;
  }
  dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    padding-top: 0.1rem;
  }
  dd {
    margin: 0;
  }
  dd ul {
    margin: 0;
    padding-left: 1rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    color: var(--ink-2);
  }
  @media (max-width: 520px) {
    summary {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .how {
      grid-column: 2;
      text-align: left;
    }
    .body {
      padding-left: 0.8rem;
    }
  }
</style>
