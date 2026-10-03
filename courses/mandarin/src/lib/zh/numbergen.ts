/** Random number-game questions and lenient answer checking. */
import { countToChinese, dateToChinese, numberToChinese, phoneToChinese, priceToChinese, timeToChinese } from './numbers';

export type NumberKind = 'number' | 'price' | 'time' | 'date' | 'phone' | 'age';

export interface NumberQ {
  kind: NumberKind;
  /** What the learner types (digits). */
  answer: string;
  /** How it is shown in digits ("8:30", "¥12.50"). */
  shown: string;
  /** The Chinese. */
  zh: string;
  /** For clock questions. */
  h?: number;
  m?: number;
}

export function makeQuestion(kind: NumberKind, r: () => number, max = 99): NumberQ {
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  switch (kind) {
    case 'number': {
      const n = r() < 0.7 ? int(0, Math.min(max, 99)) : int(0, max);
      return { kind, answer: String(n), shown: String(n), zh: numberToChinese(n) };
    }
    case 'age': {
      const n = int(2, 89);
      return { kind, answer: String(n), shown: `${n} years old`, zh: `${countToChinese(n)}岁` };
    }
    case 'price': {
      const yuan = r() < 0.5 ? int(1, 30) : int(10, 300);
      const jiao = r() < 0.5 ? 0 : int(1, 9);
      const v = yuan + jiao / 10;
      return { kind, answer: v.toFixed(jiao ? 1 : 0), shown: `¥${v.toFixed(2)}`, zh: priceToChinese(v) };
    }
    case 'time': {
      const h = int(1, 12);
      const m = [0, 0, 30, 30, 15, 45, 5, 10, 20, 40, 50][int(0, 10)]!;
      return { kind, answer: `${h}:${String(m).padStart(2, '0')}`, shown: `${h}:${String(m).padStart(2, '0')}`, zh: timeToChinese(h, m), h, m };
    }
    case 'date': {
      const mo = int(1, 12);
      const d = int(1, 28);
      return { kind, answer: `${mo}/${d}`, shown: `${mo}/${d}`, zh: dateToChinese(mo, d) };
    }
    case 'phone': {
      const digits = '1' + Array.from({ length: 10 }, () => int(0, 9)).join('');
      return { kind, answer: digits, shown: digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3'), zh: phoneToChinese(digits) };
    }
  }
}

/** Normalise a typed answer for comparison. */
export function normalise(kind: NumberKind, s: string): string {
  const t = s.trim().replace(/[¥元\s]/g, '').replace(/[：.]/g, kind === 'time' ? ':' : '.');
  if (kind === 'time') {
    const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t);
    return m ? `${Number(m[1])}:${m[2] ?? '00'}` : t;
  }
  if (kind === 'price') {
    const n = Number(t);
    return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : t;
  }
  if (kind === 'date') {
    const m = /^(\d{1,2})[/\-.](\d{1,2})$/.exec(t);
    return m ? `${Number(m[1])}/${Number(m[2])}` : t;
  }
  return t.replace(/^0+(?=\d)/, kind === 'phone' ? '' : '').replace(/\D/g, '') || t;
}

export function isRight(q: NumberQ, typed: string): boolean {
  return normalise(q.kind, typed) === normalise(q.kind, q.answer);
}
