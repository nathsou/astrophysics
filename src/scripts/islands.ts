// Lazy sim loader: imports src/sims/<name>.ts when its figure nears the viewport,
// mounts it, and pauses it whenever it is offscreen or the tab is hidden.

import type { SimDefinition, SimInstance } from '../lib/runtime/sim';
import { hasWebGPU } from '../lib/runtime/gpu';

const modules = import.meta.glob<{ default: SimDefinition }>('../sims/*.ts');

interface Entry {
  host: HTMLElement;
  inst?: SimInstance;
  loading?: boolean;
  onscreen: boolean;
}

const entries = new Map<Element, Entry>();

function status(host: HTMLElement, cls: string, text: string) {
  host.querySelector('.sim-loading, .sim-error')?.remove();
  if (!cls) return;
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  host.append(d);
}

async function mount(e: Entry) {
  e.loading = true;
  const name = e.host.dataset.sim!;
  const loader = modules[`../sims/${name}.ts`];
  if (!loader) return status(e.host, 'sim-error', `Unknown simulation “${name}”`);
  try {
    const def = (await loader()).default;
    if (def.gpu && !hasWebGPU()) {
      return status(e.host, 'sim-error', 'This simulation needs WebGPU — try a recent Chrome, Edge or Safari 26+.');
    }
    const cleanups: (() => void)[] = [];
    const params = JSON.parse(e.host.dataset.params || '{}') as Record<string, string>;
    const inst = await def.mount({ host: e.host, params, onDestroy: (fn) => cleanups.push(fn) });
    const destroy = inst.destroy;
    inst.destroy = () => { destroy?.call(inst); cleanups.forEach((f) => f()); };
    e.inst = inst;
    status(e.host, '', '');
    inst.setVisible?.(e.onscreen && !document.hidden);
  } catch (err) {
    console.error(err);
    status(e.host, 'sim-error', (err as Error).message);
  }
}

const io = new IntersectionObserver(
  (items) => {
    for (const it of items) {
      const e = entries.get(it.target);
      if (!e) continue;
      e.onscreen = it.isIntersecting;
      if (e.onscreen && !e.inst && !e.loading) mount(e);
      e.inst?.setVisible?.(e.onscreen && !document.hidden);
    }
  },
  { rootMargin: '300px 0px' },
);

document.addEventListener('visibilitychange', () => {
  for (const e of entries.values()) e.inst?.setVisible?.(e.onscreen && !document.hidden);
});

for (const host of document.querySelectorAll<HTMLElement>('[data-sim]')) {
  const e: Entry = { host, onscreen: false };
  entries.set(host, e);
  io.observe(host);
}
