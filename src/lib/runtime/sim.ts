// The contract between chapter pages and simulation modules.
//
// A sim module lives in src/sims/<name>.ts and default-exports `defineSim(...)`.
// The island loader (scripts/islands.ts) lazily imports it when the figure scrolls near the
// viewport, calls `mount`, and toggles `setVisible` as it enters/leaves the screen so
// offscreen sims cost nothing.

import { onThemeChange } from '../ui/theme';

export interface SimContext {
  /** The figure's host element. Sims own everything inside it. */
  host: HTMLElement;
  /** String params passed from MDX: <Sim name="x" params={{ mode: 'rk4' }} /> */
  params: Record<string, string>;
  /** Register cleanup to run on destroy (listeners, GPU buffers…). */
  onDestroy(fn: () => void): void;
}

export interface SimInstance {
  /** Called when the figure enters/leaves the viewport (and on tab visibility change). */
  setVisible?(visible: boolean): void;
  destroy?(): void;
}

export interface SimDefinition {
  /** Whether this sim needs WebGPU (loader shows a fallback message if unavailable). */
  gpu?: boolean;
  mount(ctx: SimContext): SimInstance | Promise<SimInstance>;
}

export const defineSim = (def: SimDefinition) => def;

/**
 * Fixed-timestep simulation loop decoupled from rendering.
 * `step(dt)` runs at a fixed rate × timeScale; `render(alpha)` runs once per animation frame.
 * Automatically stops when not visible.
 */
export class Loop {
  timeScale = 1;
  paused = false;
  /** Max physics steps per frame, to avoid the spiral of death. */
  maxSteps = 240;
  simTime = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private visible = false;

  constructor(
    private step: ((dt: number) => void) | null,
    private render: (alpha: number, frameDt: number) => void,
    public dt = 1 / 120,
  ) {}

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    if (v) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } else cancelAnimationFrame(this.raf);
  }

  /** Request one render even while paused (e.g. after a parameter change). */
  invalidate() {
    if (!this.visible) return;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const frameDt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (this.step && !this.paused) {
      this.acc += frameDt * this.timeScale;
      let n = 0;
      while (this.acc >= this.dt && n < this.maxSteps) {
        this.step(this.dt);
        this.simTime += this.dt;
        this.acc -= this.dt;
        n++;
      }
      if (n === this.maxSteps) this.acc = 0;
    }
    this.render(this.step ? this.acc / this.dt : 1, this.paused ? 0 : frameDt);
    if (this.visible) this.raf = requestAnimationFrame(this.tick);
  };

  destroy() {
    this.setVisible(false);
  }
}

export interface Stage {
  /** Wrapper that holds the canvas and overlays. */
  el: HTMLDivElement;
  canvas: HTMLCanvasElement;
  /** Absolutely-positioned overlay for HTML labels (pointer-events: none). */
  overlay: HTMLDivElement;
  /** CSS pixel size. */
  width: number;
  height: number;
  dpr: number;
  onResize(fn: (w: number, h: number, dpr: number) => void): void;
}

/**
 * Create a responsive canvas inside `host`. Height follows `aspect` (w/h) unless `height` (CSS px) is given.
 * The canvas backing store tracks devicePixelRatio (capped by `maxDpr`).
 */
export function createStage(
  host: HTMLElement,
  opts: { aspect?: number; height?: number; maxDpr?: number; before?: Element | null } = {},
): Stage {
  const el = document.createElement('div');
  el.className = 'sim-stage';
  const canvas = document.createElement('canvas');
  const overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  el.append(canvas, overlay);
  host.insertBefore(el, opts.before ?? null);
  if (opts.height) el.style.height = `${opts.height}px`;
  else el.style.aspectRatio = String(opts.aspect ?? 16 / 9);

  const listeners: ((w: number, h: number, dpr: number) => void)[] = [];
  const stage: Stage = {
    el, canvas, overlay, width: 1, height: 1, dpr: 1,
    onResize(fn) { listeners.push(fn); fn(stage.width, stage.height, stage.dpr); },
  };
  const apply = () => {
    const r = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 2);
    stage.width = Math.max(1, r.width);
    stage.height = Math.max(1, r.height);
    stage.dpr = dpr;
    canvas.width = Math.round(stage.width * dpr);
    canvas.height = Math.round(stage.height * dpr);
    for (const l of listeners) l(stage.width, stage.height, dpr);
  };
  apply();
  new ResizeObserver(apply).observe(el);
  return stage;
}

export { onThemeChange };
