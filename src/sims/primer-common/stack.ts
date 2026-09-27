// Helper shared by the appendix primers: a row of stages that stacks vertically on narrow hosts
// (phones), where two side-by-side panels would each be too small to read.

import type { Stage } from '../../lib/runtime/sim';

/**
 * `wide` is the grid-template-columns used when there is room; each stage gets its own aspect
 * ratio (width / height) for the side-by-side and the stacked layouts.
 */
export function stackWhenNarrow(
  host: HTMLElement,
  wrap: HTMLElement,
  wide: string,
  stages: [stage: Stage, sideBySide: number, stacked: number][],
  onDestroy: (fn: () => void) => void,
  breakpoint = 560,
) {
  let narrow: boolean | null = null;
  const apply = () => {
    const n = host.clientWidth < breakpoint;
    if (n === narrow) return;
    narrow = n;
    wrap.style.gridTemplateColumns = n ? 'minmax(0,1fr)' : wide;
    for (const [s, a, b] of stages) s.el.style.aspectRatio = String(n ? b : a);
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(host);
  onDestroy(() => ro.disconnect());
}

/** Switch a stage to a taller aspect ratio (width / height) on narrow hosts. */
export function narrowAspect(stage: Stage, wide: number, narrow: number, breakpoint = 520) {
  stage.onResize((w) => {
    const a = String(w < breakpoint ? narrow : wide);
    if (stage.el.style.aspectRatio !== a) stage.el.style.aspectRatio = a;
  });
}
