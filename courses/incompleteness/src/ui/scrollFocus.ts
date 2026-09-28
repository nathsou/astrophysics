// Keyboard access to horizontally scrollable regions (a wide formula, table or trace): any
// element in the main column that actually overflows sideways gets tabindex=0, so it can be
// focused and scrolled with the arrow keys (WCAG 2.1.1). Elements that stop overflowing lose the
// tab stop again. Runs after DOM changes and resizes, debounced.

const MARK = 'data-scroll-focus';

function scan(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>(`[${MARK}]`)) {
    if (el.scrollWidth <= el.clientWidth + 1) {
      el.removeAttribute('tabindex');
      el.removeAttribute(MARK);
    }
  }
  for (const el of root.querySelectorAll<HTMLElement>('div, pre, ol, ul, section, figure, td')) {
    if (el.scrollWidth <= el.clientWidth + 1 || el.hasAttribute('tabindex')) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox !== 'auto' && ox !== 'scroll') continue;
    if (el.querySelector('a, button, input, select, textarea, [tabindex]')) continue;
    el.setAttribute('tabindex', '0');
    el.setAttribute(MARK, '');
  }
}

export function installScrollFocus(root: HTMLElement): () => void {
  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => scan(root), 300);
  };
  const mo = new MutationObserver(schedule);
  mo.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    mo.disconnect();
    window.removeEventListener('resize', schedule);
    window.clearTimeout(timer);
  };
}
