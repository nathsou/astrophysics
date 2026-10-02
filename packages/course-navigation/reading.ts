/** Section bookmarks shared by all course shells; no framework or automatic scrolling. */
export function mountReadingGuide(course: string): () => void {
  let panel: HTMLElement | null = null;
  let headings: HTMLElement[] = [];
  let key = '';
  let route = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let lastSaved = '';
  const main = document.querySelector<HTMLElement>('main, .main');
  if (!main) return () => {};
  const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
  const button = (label: string, action: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); return b;
  };
  const jump = (heading: HTMLElement) => {
    heading.scrollIntoView({ block: 'start' });
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  };
  const install = () => {
    timer = undefined;
    if (panel?.isConnected) return;
    headings = [...main.querySelectorAll<HTMLElement>('h2')].filter(h => !h.closest('nav, aside, .exercise, .widget, details:not([open])'));
    if (headings.length < 3) return;
    observer.disconnect();
    const saved = read(key);
    panel = document.createElement('nav');
    panel.className = 'course-reading-guide'; panel.setAttribute('aria-label', 'Reading checkpoints');
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `Read in sections · ${headings.length} stopping points`;
    details.append(summary);
    const note = document.createElement('p'); note.textContent = 'Choose one section for this session. Your last section is remembered in this browser when storage is available; visiting a section does not mark it learned.';
    details.append(note);
    const list = document.createElement('ol');
    headings.forEach(h => { const li = document.createElement('li'); li.append(button(h.textContent?.trim() ?? 'Section', () => jump(h))); list.append(li); });
    details.append(list); panel.append(details);
    const resume = headings.find(h => h.textContent?.trim() === saved);
    if (resume) panel.prepend(button(`Resume: ${saved}`, () => jump(resume)));
    const h1 = main.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', panel);
    else headings[0]!.insertAdjacentElement('beforebegin', panel);
  };
  const schedule = () => { if (!timer) timer = setTimeout(install, 100); };
  const observer = new MutationObserver(schedule);
  const navigate = () => {
    const next = location.pathname + (location.hash.startsWith('#/') ? location.hash : '');
    if (next === route && panel?.isConnected) return;
    route = next;
    panel?.remove(); panel = null; headings = []; lastSaved = '';
    observer.disconnect(); clearTimeout(timer); timer = undefined;
    const lesson = /\/(?:ch|chapters|appendices)\//.test(location.pathname) || /^#\/(?:ch\/|s\/|\d+\.)/.test(location.hash);
    if (!lesson) return;
    key = `${course}:reading:${next.split('?')[0]}`;
    observer.observe(main, { childList: true, subtree: true });
    schedule();
  };
  const scroll = () => {
    if (frame || !headings.length || !panel?.isConnected) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const current = headings.filter(h => h.getBoundingClientRect().top <= innerHeight * 0.35).at(-1);
      const text = current?.textContent?.trim();
      if (text && text !== lastSaved) { lastSaved = text; try { localStorage.setItem(key, text); } catch { /* reading works without storage */ } }
    });
  };
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('hashchange', navigate);
  window.addEventListener('popstate', navigate);
  window.addEventListener('course-sidebar-close', navigate);
  navigate();
  return () => {
    panel?.remove(); observer.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame);
    window.removeEventListener('scroll', scroll); window.removeEventListener('hashchange', navigate);
    window.removeEventListener('popstate', navigate); window.removeEventListener('course-sidebar-close', navigate);
  };
}
