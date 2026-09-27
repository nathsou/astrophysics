// Declarative-ish control panel for sims. Produces DOM styled by `.panel` in global.css.
//
//   const panel = new Panel(host);
//   const m = panel.slider('Mass', { min: 0.1, max: 10, value: 1, log: true, unit: 'M☉' }, (v) => ...);
//   panel.button('Reset', reset);
//   const E = panel.readout('Energy');  E.set('−1.000');

export interface SliderOpts {
  min: number;
  max: number;
  value: number;
  step?: number;
  /** Logarithmic mapping of the slider track. */
  log?: boolean;
  unit?: string;
  format?: (v: number) => string;
}

export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const [m, e] = v.toExponential(Math.max(0, digits - 1)).split('e');
    return `${m}×10${superscript(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace('-', '−');
}

const SUP: Record<string, string> = { '-': '⁻', '+': '', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const superscript = (s: string) => [...s].map((ch) => SUP[ch] ?? ch).join('');

export interface Control<T> {
  get(): T;
  set(v: T, emit?: boolean): void;
  el: HTMLElement;
}

export class Panel {
  el: HTMLDivElement;
  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel';
    host.append(this.el);
  }

  private wrap(label: string) {
    const d = document.createElement('div');
    d.className = 'ctl';
    if (label) {
      const l = document.createElement('label');
      l.textContent = label;
      d.append(l);
    }
    this.el.append(d);
    return d;
  }

  slider(label: string, o: SliderOpts, onChange: (v: number) => void): Control<number> {
    const d = this.wrap(label);
    const input = document.createElement('input');
    input.type = 'range';
    const out = document.createElement('output');
    if (o.log && !(o.min > 0)) console.warn(`Panel.slider("${label}"): log sliders need min > 0 (got ${o.min})`);
    const N = 1000;
    const toT = (v: number) => (o.log ? (Math.log(v / o.min) / Math.log(o.max / o.min)) * N : ((v - o.min) / (o.max - o.min)) * N);
    const fromT = (t: number) => {
      let v = o.log ? o.min * Math.pow(o.max / o.min, t / N) : o.min + ((o.max - o.min) * t) / N;
      if (o.step) v = Math.round(v / o.step) * o.step;
      return v;
    };
    input.min = '0';
    input.max = String(N);
    input.step = o.step && !o.log ? String((o.step / (o.max - o.min)) * N) : '1';
    let value = o.value;
    const show = () => (out.textContent = (o.format ? o.format(value) : fmt(value)) + (o.unit ? ` ${o.unit}` : ''));
    input.value = String(toT(value));
    show();
    input.addEventListener('input', () => {
      value = fromT(+input.value);
      show();
      onChange(value);
    });
    d.append(input, out);
    return {
      el: d,
      get: () => value,
      set(v, emit = false) {
        value = v;
        input.value = String(toT(v));
        show();
        if (emit) onChange(v);
      },
    };
  }

  button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = primary ? 'btn primary' : 'btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    this.el.append(b);
    return b;
  }

  /** Play/pause toggle bound to a flag. */
  playPause(get: () => boolean, set: (paused: boolean) => void): HTMLButtonElement {
    const b = this.button(get() ? '▶ Play' : '❚❚ Pause', () => {
      set(!get());
      b.textContent = get() ? '▶ Play' : '❚❚ Pause';
    });
    return b;
  }

  toggle(label: string, value: boolean, onChange: (v: boolean) => void): Control<boolean> {
    const d = this.wrap('');
    const l = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = value;
    cb.addEventListener('change', () => onChange(cb.checked));
    l.append(cb, ' ', label);
    d.append(l);
    return { el: d, get: () => cb.checked, set(v, emit = false) { cb.checked = v; if (emit) onChange(v); } };
  }

  select<T extends string>(label: string, options: { value: T; label: string }[], value: T, onChange: (v: T) => void): Control<T> {
    const d = this.wrap(label);
    const s = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      s.append(opt);
    }
    s.value = value;
    s.addEventListener('change', () => onChange(s.value as T));
    d.append(s);
    return { el: d, get: () => s.value as T, set(v, emit = false) { s.value = v; if (emit) onChange(v); } };
  }

  readout(label: string): { set(text: string): void; el: HTMLElement } {
    const d = document.createElement('div');
    d.className = 'readout';
    const l = document.createElement('span');
    l.textContent = label + ' ';
    const v = document.createElement('b');
    v.style.fontWeight = '500';
    d.append(l, v);
    this.el.append(d);
    let last = '';
    return { el: d, set(t) { if (t !== last) { v.textContent = t; last = t; } } };
  }

  spacer() {
    const s = document.createElement('div');
    s.className = 'spacer';
    this.el.append(s);
  }
}
