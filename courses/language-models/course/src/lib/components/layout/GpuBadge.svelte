<script lang="ts">
  import { onMount } from 'svelte';
  import { detectBackend, gpuDescription, type GpuBackend } from '$lib/gpu/device';

  let backend = $state<GpuBackend | null>(null);
  let detail = $state('');
  onMount(async () => {
    backend = await detectBackend();
    detail = gpuDescription();
  });
  const text = $derived(backend === 'webgpu' ? 'WebGPU' : backend === 'webgl2' ? 'WebGL 2 only' : backend === 'none' ? 'No GPU' : '');
  const title = $derived(
    backend === 'webgpu'
      ? `WebGPU available${detail ? ` — ${detail}` : ''}. Training and GPU labs will run on your GPU.`
      : backend === 'webgl2'
        ? 'WebGPU is not available in this browser: visualisations use WebGL 2, and GPU training labs will fall back to the CPU (slower). Try a recent Chrome, Edge or Safari.'
        : 'No GPU access: visualisations and labs will be limited.',
  );
</script>

{#if backend}
  <span class="badge ui" class:ok={backend === 'webgpu'} {title}>
    <span class="dot" aria-hidden="true"></span>{text}
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font: 400 0.7rem var(--font-mono);
    color: var(--ink-2);
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--pn);
    cursor: help;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warn);
  }
  .ok .dot {
    background: var(--good);
  }
</style>
