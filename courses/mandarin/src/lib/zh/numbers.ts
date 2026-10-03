/**
 * Numbers, prices, clock times and dates as a Chinese speaker says them. Used by the number
 * games, which generate endless fresh questions, so the rules are spelt out and tested.
 */

const DIGIT = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Below 10 000. `liang` uses 两 for a leading 2 before 百 and 千. `bare` drops the 一 in 一十. */
function below10k(n: number, liang: boolean, bare: boolean): string {
  const units = ['千', '百', '十', ''];
  const digits = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  let out = '';
  let zero = false;
  let started = false;
  digits.forEach((d, i) => {
    if (d === 0) {
      if (started) zero = true;
      return;
    }
    if (zero) out += '零';
    zero = false;
    const unit = units[i]!;
    let digit = DIGIT[d]!;
    if (d === 2 && liang && !started && (unit === '千' || unit === '百')) digit = '两';
    if (d === 1 && unit === '十' && !started && bare) digit = '';
    out += digit + unit;
    started = true;
  });
  return out;
}

export interface NumberStyle {
  /** Say 两 for a leading 2 before 百, 千 and 万 (natural when counting things or money). */
  liang?: boolean;
}

/** 0 ≤ n < 100 000 000, as said aloud: 15 → 十五, 110 → 一百一十, 20 000 → 两万. */
export function numberToChinese(n: number, style: NumberStyle = {}): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e8) throw new RangeError(`unsupported number ${n}`);
  if (n === 0) return '零';
  const liang = style.liang ?? false;
  const wan = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!wan) return below10k(rest, liang, true);
  let out = wan === 2 && liang ? '两万' : below10k(wan, liang, true) + '万';
  if (rest) out += (rest < 1000 ? '零' : '') + below10k(rest, liang, false);
  return out;
}

/** "two of something": 2 → 两, otherwise the ordinary number. */
export function countToChinese(n: number): string {
  return n === 2 ? '两' : numberToChinese(n, { liang: true });
}

/**
 * A price in yuan, as said in a shop: 12.5 → 十二块五, 3 → 三块, 0.8 → 八毛, 2.05 → 两块零五分.
 * The last unit is usually dropped after 块 (十二块五 rather than 十二块五毛).
 */
export function priceToChinese(yuan: number): string {
  const fen = Math.round(yuan * 100);
  const kuai = Math.floor(fen / 100);
  const mao = Math.floor(fen / 10) % 10;
  const f = fen % 10;
  let out = '';
  if (kuai) out += countToChinese(kuai) + '块';
  if (mao) out += (kuai || mao !== 2 ? DIGIT[mao] : '两') + (kuai && !f ? '' : '毛');
  if (f) out += (kuai && !mao ? '零' : '') + DIGIT[f] + '分';
  if (!out) out = '零块';
  return out;
}

/** A clock time: 8:30 → 八点半, 2:00 → 两点, 9:15 → 九点十五分, 7:05 → 七点零五分. */
export function timeToChinese(h: number, m: number): string {
  const hour = h === 2 ? '两点' : numberToChinese(h) + '点';
  if (m === 0) return hour;
  if (m === 30) return hour + '半';
  return hour + (m < 10 ? '零' : '') + numberToChinese(m) + '分';
}

export const WEEKDAYS = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** A date: (3, 12) → 三月十二号; with a weekday (0 = Sunday) appended. */
export function dateToChinese(month: number, day: number, weekday?: number): string {
  const out = numberToChinese(month) + '月' + numberToChinese(day) + '号';
  return weekday === undefined ? out : out + WEEKDAYS[weekday];
}

/** A year, read digit by digit: 2026 → 二零二六年. */
export function yearToChinese(y: number): string {
  return [...String(y)].map((d) => DIGIT[Number(d)]).join('') + '年';
}

/** A phone number, digit by digit, with 1 said as 幺 (yāo) so it is not confused with 七. */
export function phoneToChinese(digits: string): string {
  return [...digits].map((d) => (d === '1' ? '幺' : DIGIT[Number(d)] ?? '')).join('');
}
