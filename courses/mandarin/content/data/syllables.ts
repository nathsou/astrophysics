/**
 * Syllables with a common character for each tone, for tone training. Every character is said
 * on its own, so the recordings carry the citation tone. A null means no common character.
 */
export interface ToneSet {
  base: string;
  chars: [string | null, string | null, string | null, string | null];
  meanings: [string | null, string | null, string | null, string | null];
}

export const TONE_SETS: ToneSet[] = [
  { base: 'ma', chars: ['妈', '麻', '马', '骂'], meanings: ['mum', 'hemp; numbing', 'horse', 'to scold'] },
  { base: 'ba', chars: ['八', '拔', '把', '爸'], meanings: ['eight', 'to pull out', 'to hold', 'dad'] },
  { base: 'shi', chars: ['诗', '十', '使', '是'], meanings: ['poem', 'ten', 'to make (someone do)', 'to be'] },
  { base: 'tang', chars: ['汤', '糖', '躺', '烫'], meanings: ['soup', 'sugar', 'to lie down', 'scalding hot'] },
  { base: 'wen', chars: ['温', '文', '稳', '问'], meanings: ['warm', 'writing', 'steady', 'to ask'] },
  { base: 'tong', chars: ['通', '同', '桶', '痛'], meanings: ['to go through', 'same', 'bucket', 'pain'] },
  { base: 'fang', chars: ['方', '房', '访', '放'], meanings: ['square', 'house', 'to visit', 'to put'] },
  { base: 'guo', chars: ['锅', '国', '果', '过'], meanings: ['wok', 'country', 'fruit', 'to pass'] },
  { base: 'xiang', chars: ['香', '详', '想', '向'], meanings: ['fragrant', 'detailed', 'to think; to want', 'towards'] },
  { base: 'qi', chars: ['七', '骑', '起', '气'], meanings: ['seven', 'to ride', 'to rise', 'air; anger'] },
  { base: 'wu', chars: ['屋', '无', '五', '雾'], meanings: ['room', 'without', 'five', 'fog'] },
  { base: 'jie', chars: ['接', '节', '姐', '借'], meanings: ['to receive', 'festival', 'older sister', 'to borrow'] },
  { base: 'tian', chars: ['天', '甜', '舔', null], meanings: ['sky; day', 'sweet', 'to lick', null] },
  { base: 'mai', chars: [null, '埋', '买', '卖'], meanings: [null, 'to bury', 'to buy', 'to sell'] },
  { base: 'hua', chars: ['花', '华', null, '话'], meanings: ['flower', 'splendid; China', null, 'speech'] },
  { base: 'yu', chars: [null, '鱼', '雨', '玉'], meanings: [null, 'fish', 'rain', 'jade'] },
  { base: 'tu', chars: ['秃', '图', '土', '兔'], meanings: ['bald', 'picture', 'earth', 'rabbit'] },
  { base: 'lao', chars: ['捞', '劳', '老', null], meanings: ['to scoop', 'labour', 'old', null] },
  { base: 'ji', chars: ['鸡', '急', '几', '记'], meanings: ['chicken', 'urgent', 'how many', 'to remember'] },
  { base: 'shu', chars: ['书', '熟', '鼠', '树'], meanings: ['book', 'ripe; familiar', 'mouse', 'tree'] },
];

/** All (character, tone) pairs, flattened. */
export const TONE_ITEMS = TONE_SETS.flatMap((s) =>
  s.chars.flatMap((ch, i) => (ch ? [{ ch, tone: (i + 1) as 1 | 2 | 3 | 4, base: s.base, meaning: s.meanings[i] ?? '' }] : [])),
);
