/**
 * Builds content/data/lexicon.json from the Complete HSK Vocabulary dataset (MIT,
 * github.com/drkameleon/complete-hsk-vocabulary; meanings from CC-CEDICT, CC BY-SA 4.0).
 *
 *   npm run lexicon                 # downloads complete.json
 *   npm run lexicon -- path.json    # or reads a local copy
 *
 * Keeps every word that appears in levels 1–3 of any of the three word lists, which is enough
 * to segment and gloss everything the course says. The levels are kept per list:
 *   n = the 2025 syllabus ("newest" in the dataset), s = the 2021 standard (HSK 3.0), o = HSK 2.0.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pinyin } from 'pinyin-pro';

interface Form {
  transcriptions: { pinyin: string };
  meanings: string[];
  classifiers?: string[];
}
interface Entry {
  simplified: string;
  level: string[];
  frequency?: number;
  pos?: string[];
  forms: Form[];
}

const SOURCE_URL = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json';
const source = process.argv[2];
const data: Entry[] = source ? JSON.parse(readFileSync(source, 'utf8')) : await (await fetch(SOURCE_URL)).json();

/** For words with several readings, the reading a learner meets first. */
const PREFERRED: Record<string, string> = {
  吧: 'ba', 啊: 'a', 边: 'biān', 便宜: 'pián yi', 差: 'chà', 场: 'chǎng', 打: 'dǎ', 大: 'dà', 当: 'dāng',
  得: 'de', 的: 'de', 地: 'dì', 地方: 'dì fang', 东西: 'dōng xi', 多少: 'duō shao', 分: 'fēn',
  告诉: 'gào su', 个: 'gè', 给: 'gěi', 更: 'gèng', 故事: 'gù shi', 过: 'guò', 还: 'hái', 好: 'hǎo',
  好吃: 'hǎo chī', 好处: 'hǎo chu', 号: 'hào', 喝: 'hē', 和: 'hé', 会: 'huì', 几: 'jǐ', 假: 'jià',
  间: 'jiān', 教: 'jiāo', 结果: 'jié guǒ', 看: 'kàn', 了: 'le', 累: 'lèi', 离: 'lí', 吗: 'ma',
  哪: 'nǎ', 那: 'nà', 女人: 'nǚ rén', 妻子: 'qī zi', 起来: 'qǐ lai', 少: 'shǎo', 数: 'shù',
  说: 'shuō', 听: 'tīng', 头: 'tóu', 为: 'wèi', 喂: 'wèi', 要: 'yào', 长: 'cháng', 着: 'zhe',
  只: 'zhǐ', 中: 'zhōng', 重: 'zhòng', 子: 'zǐ', 行: 'xíng', 页: 'yè', 句: 'jù', 万: 'wàn',
  骑: 'qí', 跑: 'pǎo', 提: 'tí', 鸟: 'niǎo', 女: 'nǚ', 远: 'yuǎn', 雨: 'yǔ', 片: 'piàn', 卡: 'kǎ',
  度: 'dù', 读: 'dú', 发: 'fā', 正: 'zhèng', 省: 'shěng', 脏: 'zāng', 当时: 'dāng shí', 觉得: 'jué de',
  睡觉: 'shuì jiào', 为什么: 'wèi shén me', 因为: 'yīn wèi', 没: 'méi', 空: 'kòng', 音乐: 'yīn yuè',
  银行: 'yín háng', 大夫: 'dài fu', 种: 'zhǒng', 觉: 'jué', 都: 'dōu', 少年: 'shào nián', 背: 'bèi',
  称: 'chēng', 倒: 'dào', 干: 'gàn', 角: 'jiǎo', 见: 'jiàn', 结: 'jié', 难: 'nán', 系: 'xì',
};

const UNHELPFUL = /^(\(?(old |erhua |unofficial )?variant|used in|see |surname|abbr\.|\(archaic\)|\(literary\)|\(onom\.\)|\(Tw\)|\(coll\.\))/i;

/** Lower is better: proper nouns and cross-references lose to ordinary words. */
function score(f: Form): number {
  const m = f.meanings[0] ?? '';
  return (/^[A-Z]/.test(f.transcriptions.pinyin) ? 2 : 0) + (UNHELPFUL.test(m) ? 1 : 0);
}

const LISTS: [string, string][] = [
  ['newest', 'n'],
  ['new', 's'],
  ['old', 'o'],
];

function levels(raw: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of raw) {
    const m = /^(newest|new|old)-(\d)$/.exec(l);
    if (!m) continue;
    const key = LISTS.find(([name]) => name === m[1])![1];
    const n = Number(m[2]);
    if (!(key in out) || n < out[key]!) out[key] = n;
  }
  return out;
}

function gloss(meanings: string[]): string {
  const parts: string[] = [];
  for (const m of meanings) {
    for (const p of m.split(/;\s*/)) {
      const clean = p.replace(/\s+/g, ' ').trim();
      if (!clean || parts.includes(clean)) continue;
      if (/variant of|abbr\. for|surname|used in /i.test(clean)) continue;
      parts.push(clean);
    }
  }
  let out = '';
  for (const p of parts) {
    const next = out ? `${out}; ${p}` : p;
    if (next.length > 44 && out) break;
    out = next;
  }
  return out;
}

const words: Record<string, { p: string; g: string; l: Record<string, number>; c?: string[]; f?: number }> = {};
for (const e of data) {
  const l = levels(e.level);
  if (!Object.values(l).some((n) => n <= 3)) continue;
  const forms = e.forms.filter((f) => f.transcriptions?.pinyin);
  if (!forms.length) continue;
  const want = PREFERRED[e.simplified];
  const form = (want && forms.find((f) => f.transcriptions.pinyin === want)) || [...forms].sort((a, b) => score(a) - score(b))[0]!;
  const prev = words[e.simplified];
  const entry = {
    p: form.transcriptions.pinyin.replace(/\s+/g, ' ').trim(),
    g: gloss(form.meanings),
    l: { ...prev?.l, ...l },
    ...(form.classifiers?.length ? { c: form.classifiers.slice(0, 3) } : {}),
    ...(e.frequency ? { f: e.frequency } : {}),
  };
  words[e.simplified] = prev ? { ...prev, l: entry.l } : entry;
}

const sorted = Object.fromEntries(Object.entries(words).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(new URL('../content/data/lexicon.json', import.meta.url), JSON.stringify(sorted) + '\n');
const count = (k: string, n: number) => Object.values(sorted).filter((w) => w.l[k] === n).length;
console.log(`${Object.keys(sorted).length} words`, LISTS.map(([name, k]) => `${name}: ${[1, 2, 3].map((n) => count(k, n)).join('/')}`).join(', '));

/**
 * A default reading for every character in the lexicon, for text the segmenter cannot match to a
 * word (names, characters met on their own in the character lessons). Course content can override
 * any reading in place with 字[pinyin].
 */
const chars: Record<string, string> = {};
// Characters in the lessons and course data too, so text outside the HSK lists still gets a reading.
const extraText: string[] = [];
const scan = (dir: URL) => {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir, { recursive: true }) as string[]) {
    if (/\.(md|ts)$/.test(f) && !f.endsWith('.test.ts')) extraText.push(readFileSync(new URL(f, dir), 'utf8'));
  }
};
scan(new URL('../content/', import.meta.url));
for (const w of [...Object.keys(sorted), ...extraText]) {
  for (const ch of w) {
    if (!/\p{Script=Han}/u.test(ch) || ch in chars) continue;
    chars[ch] = sorted[ch]?.p ?? pinyin(ch, { toneSandhi: false });
  }
}
writeFileSync(new URL('../content/data/chars.json', import.meta.url), JSON.stringify(chars) + '\n');
console.log(`${Object.keys(chars).length} characters`);
