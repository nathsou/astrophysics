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
