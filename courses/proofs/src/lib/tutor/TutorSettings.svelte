<!-- Dialog for the tutor's API key and model. -->
<script lang="ts">
  import { tutorSettings, DEFAULT_MODEL } from './settings.svelte';

  let dialog: HTMLDialogElement;
  let key = $state('');
  let model = $state(DEFAULT_MODEL);

  $effect(() => {
    if (tutorSettings.open) {
      tutorSettings.load();
      key = tutorSettings.apiKey;
      model = tutorSettings.model;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  });

  function save() {
    tutorSettings.save(key, model);
    tutorSettings.open = false;
  }
</script>

<dialog bind:this={dialog} class="ui" onclose={() => (tutorSettings.open = false)} aria-labelledby="tutor-title">
  <h2 id="tutor-title">The proof tutor</h2>
  <p>
    Exercises that ask you to write a proof can send your attempt to Claude for Socratic feedback: it points at the first gap and asks a
    question, without writing the proof for you. This is optional — every exercise also has hand-written hints and a model proof.
  </p>
  <p>
    It uses <strong>your own Anthropic API key</strong>, stored only in this browser and sent only to <code>api.anthropic.com</code>. Anyone
    with access to this browser profile can read it, so use a key with a spending limit, and remove it on shared computers. Requests are billed to your account.
  </p>
  <label>
    API key
    <input type="password" bind:value={key} placeholder="sk-ant-…" autocomplete="off" spellcheck="false" />
  </label>
  <label>
    Model
    <select bind:value={model}>
      <option value="claude-opus-5">Claude Opus 5 (recommended)</option>
      <option value="claude-sonnet-5">Claude Sonnet 5 (cheaper)</option>
    </select>
  </label>
  <div class="buttons">
    {#if tutorSettings.apiKey}<button class="danger" onclick={() => { key = ''; save(); }}>Remove key</button>{/if}
    <span class="spacer"></span>
    <button onclick={() => (tutorSettings.open = false)}>Cancel</button>
    <button class="primary" onclick={save}>Save</button>
  </div>
</dialog>

<style>
  dialog {
    max-width: 32rem;
    width: calc(100vw - 2rem);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    padding: 1.25rem 1.4rem;
    box-shadow: var(--shadow-lg);
    font-size: 0.88rem;
    line-height: 1.5;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.35);
  }
  h2 {
    margin: 0 0 0.6rem;
    font-size: 1.1rem;
  }
  p {
    color: var(--ink-2);
    margin: 0 0 0.7rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    margin: 0.7rem 0;
    font-weight: 600;
    font-size: 0.8rem;
  }
  input,
  select {
    font: inherit;
    font-weight: 400;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--page);
    color: var(--ink);
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .spacer {
    flex: 1;
  }
  button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.35rem 0.9rem;
    cursor: pointer;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .danger {
    color: var(--bad);
  }
</style>
