<!--
  The policy lab: an access policy as allow and deny statements, and a question about it ("is there a request the
  policy allows such that …?"), or a second policy to compare it with. The answer is an example request, re-checked
  by the reference semantics, or a proof that there is none.
-->
<script lang="ts">
  import { ask, compare, decide, parseCond, parsePolicy, showIp, PolicyError, OTHER_NAME, type Answer, type Statement } from '$lib/fv/policy/policy';

  let { policy: p0, question: q0 = '', other: o0 = [], caption }: { policy: string[]; question?: string; other?: string[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let policy = $state(p0.join('\n'));
  // svelte-ignore state_referenced_locally
  let question = $state(q0);
  // svelte-ignore state_referenced_locally
  let other = $state(o0.join('\n'));
  // svelte-ignore state_referenced_locally
  let mode = $state<'ask' | 'compare'>(q0 || !o0.length ? 'ask' : 'compare');
  let result = $state<{ answer: Answer; a: Statement[]; b?: Statement[] } | undefined>();
  let error = $state('');

  function run() {
    error = '';
    result = undefined;
    try {
      const a = parsePolicy(policy);
      if (mode === 'ask') result = { answer: ask(a, parseCond(question)), a };
      else {
        const b = parsePolicy(other);
        result = { answer: compare(b, a), a, b };
      }
    } catch (e) {
      if (e instanceof PolicyError) error = e.message;
      else throw e;
    }
  }
  run();

  const name = (s: string) => (s === OTHER_NAME ? 'any other name' : s);
  const because = $derived(result?.answer.request ? decide(result.a, result.answer.request) : undefined);
  const becauseB = $derived(result?.answer.request && result.b ? decide(result.b, result.answer.request) : undefined);
</script>

<figure class="plab">
  <div class="cols">
    <div>
      <label class="ui lab" for="plab-policy">Policy</label>
      <textarea id="plab-policy" bind:value={policy} rows={Math.max(4, policy.split('\n').length + 1)} spellcheck="false"></textarea>
    </div>
    <div>
      <div class="tabs ui" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'ask'} class:on={mode === 'ask'} onclick={() => ((mode = 'ask'), run())}>Ask a question</button>
        <button type="button" role="tab" aria-selected={mode === 'compare'} class:on={mode === 'compare'} onclick={() => ((mode = 'compare'), run())}>Compare with a new version</button>
      </div>
      {#if mode === 'ask'}
        <label class="ui lab" for="plab-q">Is there a request the policy allows such that…</label>
        <input id="plab-q" class="code" bind:value={question} spellcheck="false" autocomplete="off" onkeydown={(e) => e.key === 'Enter' && run()} />
      {:else}
        <label class="ui lab" for="plab-b">New version: does it allow anything the policy does not?</label>
        <textarea id="plab-b" bind:value={other} rows={Math.max(4, other.split('\n').length + 1)} spellcheck="false"></textarea>
      {/if}
      <div class="bar ui"><button type="button" class="go" onclick={run}>Ask the solver</button></div>
    </div>
  </div>

  {#if error}<p class="err ui">{error}</p>{/if}
  {#if result}
    {@const a = result.answer}
    <div class="answer ui" class:yes={a.found} class:no={a.status === 'unsat'}>
      {#if a.found && a.request}
        <p class="head">{mode === 'ask' ? 'Yes. For example:' : 'Yes: the new version allows a request the policy denies. For example:'}</p>
        <dl>
          <dt>user</dt><dd><code>{name(a.request.user)}</code></dd>
          <dt>action</dt><dd><code>{name(a.request.action)}</code></dd>
          <dt>resource</dt><dd><code>{a.request.resource.map(name).join('/')}</code></dd>
          <dt>source IP</dt><dd><code>{showIp(a.request.ip)}</code></dd>
          <dt>MFA</dt><dd><code>{a.request.mfa ? 'yes' : 'no'}</code></dd>
        </dl>
        {#if mode === 'ask' && because}<p class="why">Allowed by line {because.because.map((s) => s.line).join(', ')}: <code>{because.because[0]?.text}</code>. No deny statement matches.</p>{/if}
        {#if mode === 'compare' && becauseB && because}<p class="why">The new version allows it (line {becauseB.because.map((s) => s.line).join(', ')}); the policy {because.because.length ? `denies it explicitly (line ${because.because.map((s) => s.line).join(', ')})` : 'has no statement that allows it'}.</p>{/if}
        <p class="cert">Checked: the example was replayed against the policy semantics.</p>
      {:else if a.status === 'unsat'}
        <p class="head">{mode === 'ask' ? 'No. No request at all satisfies the question and is allowed.' : 'No. The new version allows nothing the policy denies.'}</p>
        <p class="cert">{a.certified ? 'Proved for every request: the certificate was checked.' : 'Proved, but the certificate did not check.'}</p>
      {:else}
        <p class="head">Unknown: {a.reason}</p>
      {/if}
    </div>
  {/if}

  <details class="syntax ui">
    <summary>Syntax</summary>
    <p>One statement per line: <code>allow ACTIONS on RESOURCE if CONDITION</code> or <code>deny …</code>. ACTIONS is <code>*</code> or a list such as <code>read,write</code>; RESOURCE is a path such as <code>logs/*</code> or <code>*</code>. Conditions: <code>ip in 10.0.0.0/8</code>, <code>mfa</code>, <code>user == alice</code>, <code>action == write</code>, <code>resource in logs/*</code>, combined with <code>! && || ( )</code>. A request is allowed when some allow statement matches and no deny statement does.</p>
    <p>Simplified from real access policies: names range over those that appear plus “any other name”, and paths are compared on their first two segments.</p>
  </details>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .plab {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 0.9rem;
  }
  @media (max-width: 720px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .lab {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
    margin: 0.2rem 0 0.3rem;
  }
  textarea,
  input.code {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  textarea {
    resize: vertical;
  }
  .tabs {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
    flex-wrap: wrap;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .tabs button.on {
    border-color: var(--ink-blue);
    color: var(--ink-blue);
    font-weight: 600;
  }
  .bar {
    margin-top: 0.5rem;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .answer {
    margin-top: 0.8rem;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    font-size: 0.86rem;
  }
  .answer.yes {
    border-color: var(--pencil);
  }
  .answer.no {
    border-color: var(--seal);
  }
  .head {
    margin: 0 0 0.4rem;
    font-weight: 700;
  }
  .yes .head {
    color: var(--pencil);
  }
  .no .head {
    color: var(--seal);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.15rem 0.8rem;
    margin: 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .why,
  .cert {
    margin: 0.4rem 0 0;
    color: var(--ink-2);
    font-size: 0.82rem;
  }
  .syntax {
    margin-top: 0.8rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .syntax summary {
    cursor: pointer;
    font-weight: 600;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
