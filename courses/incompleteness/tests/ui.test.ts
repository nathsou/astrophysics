// The small pieces of interface logic from the design review: the sidebar (which chapters start
// open, keeping the current section in view), where the reader left off, the end-of-proof mark,
// and the fixed-point stepper's first stage.

import { describe, expect, it, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { centeredScrollTop, chapterStartsOpen, isComfortablyVisible, revealInContainer, type ScrollContainer } from '../src/ui/sidebar.ts';
import { lastVisited, recordVisit } from '../src/ui/progress.ts';
import { FormalBlocks } from '../src/formal/FormalText.tsx';
import type { Block, SourceLoc } from '../src/content/schema.ts';

describe('the sidebar', () => {
  it('opens only the chapter holding the current section', () => {
    expect(chapterStartsOpen(['inc.inp.fix', 'inc.inp.1in'], 'inc.inp.1in')).toBe(true);
    expect(chapterStartsOpen(['inc.int.bgr', 'inc.int.def'], 'inc.inp.1in')).toBe(false);
    expect(chapterStartsOpen(['inc.int.bgr'], undefined)).toBe(false);
  });

  const geo = { containerTop: 0, containerHeight: 800, scrollTop: 0, scrollHeight: 5000, itemTop: 2400, itemHeight: 30 };
  it('centres the current row, within the scrollable range', () => {
    expect(centeredScrollTop(geo)).toBe(2400 - (800 - 30) / 2);
    // near the top: no negative scroll
    expect(centeredScrollTop({ ...geo, itemTop: 100 })).toBe(0);
    // near the bottom: no scrolling past the end
    expect(centeredScrollTop({ ...geo, itemTop: 4980 })).toBe(4200);
    // already scrolled: positions are relative to the visible box
    expect(centeredScrollTop({ ...geo, scrollTop: 1000, itemTop: 1400 })).toBe(2400 - 385);
  });

  it('knows when the row is already in view', () => {
    expect(isComfortablyVisible({ ...geo, itemTop: 300 })).toBe(true);
    expect(isComfortablyVisible({ ...geo, itemTop: 2400 })).toBe(false);
    expect(isComfortablyVisible({ ...geo, itemTop: 790 })).toBe(false);
  });

  function fakeNav(scrollTop = 0) {
    const calls: { top: number; behavior: string }[] = [];
    const nav: ScrollContainer & { calls: typeof calls } = {
      scrollTop,
      scrollHeight: 5000,
      clientHeight: 800,
      getBoundingClientRect: () => ({ top: 0, height: 800 }),
      scrollTo: (o) => calls.push(o),
      calls,
    };
    return nav;
  }
  const row = (top: number) => ({ getBoundingClientRect: () => ({ top, height: 30 }) });

  it('scrolls the sidebar to a row far below, instantly under reduced motion', () => {
    const nav = fakeNav();
    expect(revealInContainer(nav, row(2400), { force: false, smooth: false })).toBe(2015);
    expect(nav.calls).toEqual([{ top: 2015, behavior: 'auto' }]);
    const nav2 = fakeNav();
    revealInContainer(nav2, row(2400), { force: false, smooth: true });
    expect(nav2.calls[0].behavior).toBe('smooth');
  });

  it('leaves a visible row alone after navigating, but centres it when forced (load, drawer)', () => {
    const nav = fakeNav();
    expect(revealInContainer(nav, row(500), { force: false, smooth: true })).toBeNull();
    expect(nav.calls).toEqual([]);
    expect(revealInContainer(nav, row(500), { force: true, smooth: false })).toBe(115);
  });
});

describe('where the reader left off', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  });
  it('remembers the last section opened, if it still exists', () => {
    const known = (id: string) => id.startsWith('inc.');
    expect(lastVisited(known)).toBeNull();
    recordVisit('inc.inp.1in');
    expect(lastVisited(known)).toBe('inc.inp.1in');
    recordVisit('gone.section');
    expect(lastVisited(known)).toBeNull();
  });
});

describe('the end-of-proof mark', () => {
  const loc: SourceLoc = { repo: 'incompleteness-computability', file: 'x.tex', line: 1, endLine: 2 };
  const p = (id: string, v: string): Block => ({ t: 'p', id, c: [{ t: 'text', v }], loc });
  const proof = (c: Block[]): Block => ({ t: 'env', id: 'pf', kind: 'proof', c, loc });
  const render = (b: Block) => renderToStaticMarkup(createElement(FormalBlocks, { blocks: [b], ctx: { sectionId: 's' } }));
  const QED = '<span class="qed" role="img" aria-label="end of proof">∎</span>';

  it('is set inside the last paragraph, once', () => {
    const html = render(proof([p('a', 'First.'), p('b', 'Last.')]));
    expect(html.split('end of proof').length).toBe(2);
    expect(html).toContain(`Last.${QED}</p>`);
    expect(html).toContain('class="ol-p has-qed"');
  });

  it('goes into the last item of a closing list, or the closing display', () => {
    const list: Block = { t: 'list', id: 'l', ordered: false, loc, items: [{ id: 'i1', c: [p('x', 'One.')] }, { id: 'i2', c: [p('y', 'Two.')] }] } as Block;
    const html = render(proof([p('a', 'Cases:'), list]));
    expect(html).toContain(`Two.${QED}</p>`);
    expect(html).not.toContain(`One.${QED}`);
    const display: Block = { t: 'display', id: 'd', env: 'equation*', rows: [{ tex: 'x = y' }], src: 'x=y', loc };
    const html2 = render(proof([p('a', 'Hence'), display]));
    expect(html2).toMatch(/class="ol-display has-qed"[^]*end of proof[^]*<\/div>/);
  });

  it('is not set outside proofs', () => {
    expect(render(p('a', 'Text.'))).not.toContain('end of proof');
  });
});

describe('the fixed-point stepper', () => {
  it('starts at the first stage, B(x), and has no second B(x) input', async () => {
    const { FixedPointLab } = await import('../src/workbench/FixedPointLab.tsx');
    const html = renderToStaticMarkup(createElement(FixedPointLab));
    expect(html).toContain('construction · 1 / 7');
    expect(html).toContain('Stage 1: the formula B(x)');
    expect(html).toContain('<button disabled="" aria-label="Previous step"');
    expect(html).toContain('<button aria-label="Next step"');
    expect(html).not.toContain('fi-field');
    // only the first stage is shown
    expect(html.match(/class="fp-stage /g)?.length).toBe(1);
  });
});
