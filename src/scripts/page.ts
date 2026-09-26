// Page-wide behaviours: theme toggle, sidebar, equation-term highlighting,
// draggable <Var> numbers and <Predict> boxes.

import { vars } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

// ---------- Theme ----------
document.querySelectorAll('[data-action="theme"]').forEach((b) =>
  b.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  }),
);

// ---------- Mobile sidebar ----------
document.querySelector('.menu-toggle')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));

// ---------- Equation term highlighting ----------
// In LaTeX: \htmlData{term=mass}{M}. In prose/HTML: <span data-term="mass">.
// Hovering any element with a term highlights all of them and emits `term:hover` on window.
let activeTerm: string | null = null;
function setTerm(t: string | null) {
  if (t === activeTerm) return;
  document.querySelectorAll('.term-hl').forEach((el) => el.classList.remove('term-hl'));
  activeTerm = t;
  if (t) document.querySelectorAll(`[data-term="${CSS.escape(t)}"]`).forEach((el) => el.classList.add('term-hl'));
  window.dispatchEvent(new CustomEvent('term:hover', { detail: t }));
}
document.addEventListener('pointerover', (ev) => {
  const el = (ev.target as Element).closest?.('[data-term]') as HTMLElement | null;
  setTerm(el?.dataset.term ?? null);
});

// ---------- Draggable variables ----------
for (const el of document.querySelectorAll<HTMLElement>('.var[data-var]')) {
  const name = el.dataset.var!;
  const min = +el.dataset.min!, max = +el.dataset.max!;
  const log = el.dataset.log === 'true';
  const step = el.dataset.step ? +el.dataset.step : 0;
  const digits = el.dataset.digits ? +el.dataset.digits : 3;
  const clampQ = (v: number) => {
    v = Math.min(max, Math.max(min, v));
    if (step) v = Math.round(v / step) * step;
    return +v.toPrecision(12);
  };
  if (!vars.has(name)) vars.set(name, clampQ(+el.dataset.value!));
  vars.subscribe(name, (v) => (el.textContent = fmt(v, digits)));

  let startX = 0, startV = 0;
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    startX = e.clientX;
    startV = vars.get(name);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const d = (e.clientX - startX) / 200; // 200px drag = full range (linear) or one range-fraction in log
    const v = log ? startV * Math.pow(max / min, d) : startV + d * (max - min);
    vars.set(name, clampQ(v));
  });
  const end = (e: PointerEvent) => { el.releasePointerCapture(e.pointerId); el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // Keyboard accessibility
  el.tabIndex = 0;
  el.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    const v = vars.get(name);
    vars.set(name, clampQ(log ? v * Math.pow(max / min, k / 50) : v + k * (step || (max - min) / 100)));
  });
}

// ---------- Predict boxes ----------
for (const box of document.querySelectorAll<HTMLElement>('.box.predict')) {
  const answer = box.dataset.answer;
  box.querySelectorAll<HTMLButtonElement>('.choices button').forEach((b) =>
    b.addEventListener('click', () => {
      box.querySelectorAll<HTMLButtonElement>('.choices button').forEach((o) => {
        o.classList.toggle('correct', o.dataset.choice === answer);
        o.classList.toggle('wrong', o === b && o.dataset.choice !== answer);
      });
      box.classList.add('answered');
    }),
  );
}

// ---------- Per-chapter script (src/chapters/<slug>.ts), for <Var>/<Out> wiring ----------
const chapterScripts = import.meta.glob('../chapters/*.ts');
const slug = document.body.dataset.chapter;
if (slug) chapterScripts[`../chapters/${slug}.ts`]?.();

// ---------- Depth of explanation ----------
// Global reader preference (1 Intuitive · 2 High school · 3 Engineering), stored on <html data-depth>.
// Sims can read it via document.documentElement.dataset.depth and listen for `depth:change`.
const DEPTH_HINTS: Record<string, string> = {
  '1': 'Ideas and pictures first — equations only where they tell a story.',
  '2': 'Algebra and simple formulas; calculus-based derivations are folded away.',
  '3': 'Everything: calculus, vectors and full derivations.',
};
function applyDepth(d: string, persist: boolean) {
  const root = document.documentElement;
  root.dataset.depth = d;
  document.querySelectorAll<HTMLButtonElement>('.depth-seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.depth === d)));
  document.querySelectorAll<HTMLElement>('.depth-hint').forEach((el) => (el.textContent = DEPTH_HINTS[d]));
  // blocks opened manually stay open only if still above the new depth
  document.querySelectorAll<HTMLElement>('.lvl.open').forEach((el) => { if (+el.dataset.min! <= +d) el.classList.remove('open'); });
  if (persist) {
    try { localStorage.setItem('depth', d); } catch {}
    window.dispatchEvent(new CustomEvent('depth:change', { detail: +d }));
  }
}
applyDepth(document.documentElement.dataset.depth || '2', false);
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const seg = t.closest<HTMLButtonElement>('.depth-seg button');
  if (seg) {
    // keep the reader's place: anchor on the first heading/paragraph currently in view
    const anchor = [...document.querySelectorAll<HTMLElement>('.article > h2, .article > h3, .article > p')].find((el) => el.getBoundingClientRect().top > 0);
    const before = anchor?.getBoundingClientRect().top ?? 0;
    applyDepth(seg.dataset.depth!, true);
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
    return;
  }
  const pill = t.closest('.lvl-pill');
  if (pill) { pill.parentElement!.classList.add('open'); return; }
  const hide = t.closest('.lvl-hide');
  if (hide) hide.closest('.lvl')!.classList.remove('open');
});

// ---------- <Tiers> ----------
const TIER_NAMES: Record<number, string> = { 1: 'Intuitive', 2: 'High-school math', 3: 'Engineering math' };
function layoutTiers(box: HTMLElement, depth: number, reveal = 0) {
  const tiers = [...box.querySelectorAll<HTMLElement>(':scope > .tier')];
  const levels = tiers.map((t) => +t.dataset.tier!);
  // base = deepest tier ≤ depth, else the shallowest available
  let base = levels.filter((l) => l <= depth).pop() ?? levels[0];
  const upto = Math.max(base, reveal);
  tiers.forEach((t, i) => {
    const l = levels[i];
    const shown = l === base || (l > base && l <= upto);
    t.classList.toggle('shown', shown);
    t.classList.toggle('extra', shown && l !== base);
  });
  const next = levels.find((l) => l > upto);
  box.classList.toggle('has-more', next !== undefined);
  box.dataset.reveal = String(upto);
  const txt = box.querySelector<HTMLElement>(':scope > .tier-more .lvl-pill-text');
  if (txt && next) txt.textContent = `${TIER_NAMES[next]} version of this explanation`;
}
function layoutAllTiers() {
  const d = +(document.documentElement.dataset.depth || '2');
  document.querySelectorAll<HTMLElement>('.tiers').forEach((b) => layoutTiers(b, d));
}
layoutAllTiers();
window.addEventListener('depth:change', layoutAllTiers);
document.addEventListener('click', (e) => {
  const more = (e.target as HTMLElement).closest('.tier-more');
  if (!more) return;
  const box = more.parentElement as HTMLElement;
  const levels = [...box.querySelectorAll<HTMLElement>(':scope > .tier')].map((t) => +t.dataset.tier!);
  const cur = +(box.dataset.reveal || '0');
  const next = levels.find((l) => l > cur);
  if (next) layoutTiers(box, +(document.documentElement.dataset.depth || '2'), next);
});

// ---------- Equation-term tooltips ----------
// Any [data-term] element (KaTeX \term{id}{…} or prose spans) gets a tooltip explaining the term.
import { GLOBAL_TERMS, type TermDef } from '../lib/terms';
const TERMS: Record<string, TermDef> = { ...GLOBAL_TERMS };
document.querySelectorAll<HTMLScriptElement>('script[data-terms]').forEach((s) => {
  try { Object.assign(TERMS, JSON.parse(s.textContent || '{}')); } catch (err) { console.warn('Bad <Terms> JSON', err); }
});
document.querySelectorAll<HTMLElement>('[data-term]').forEach((el) => {
  if (TERMS[el.dataset.term!]) el.classList.add('has-tip');
  else if (import.meta.env.DEV) console.warn(`No <Terms> definition for equation term "${el.dataset.term}"`);
});
const tip = document.createElement('div');
tip.className = 'term-tip';
tip.setAttribute('role', 'tooltip');
document.body.append(tip);
let tipFor: HTMLElement | null = null;
function showTip(el: HTMLElement) {
  const def = TERMS[el.dataset.term!];
  if (!def) return hideTip();
  tipFor = el;
  tip.replaceChildren();
  const b = document.createElement('b');
  b.textContent = def.name;
  tip.append(b);
  if (def.value) { const v = document.createElement('code'); v.textContent = def.value; tip.append(v); }
  if (def.text) { const t = document.createElement('span'); t.textContent = def.text; tip.append(t); }
  tip.classList.add('on');
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  x = Math.max(8, Math.min(innerWidth - tw - 8, x));
  let y = r.top - th - 10;
  if (y < 8) y = r.bottom + 10;
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function hideTip() { tipFor = null; tip.classList.remove('on'); }
document.addEventListener('pointerover', (e) => {
  const el = (e.target as Element).closest?.('[data-term]') as HTMLElement | null;
  if (el && el !== tipFor) showTip(el);
  else if (!el && tipFor) hideTip();
});
document.addEventListener('click', (e) => { // touch: tap a term to toggle its tip
  const el = (e.target as Element).closest?.('[data-term]') as HTMLElement | null;
  if (el) { if (el === tipFor) hideTip(); else showTip(el); } else hideTip();
});
window.addEventListener('scroll', hideTip, { passive: true });
