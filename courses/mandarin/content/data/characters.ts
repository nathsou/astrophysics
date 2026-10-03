/** Data for the character lessons: pictographs, building recipes, radical families. */

/** Early forms sketched as simple strokes on a 100×100 grid (after oracle-bone shapes). */
export const PICTOGRAPHS: { ch: string; sketch: string; story: string }[] = [
  { ch: '人', sketch: 'M52 14 L30 86 M47 34 L72 86', story: 'A person walking, seen from the side.' },
  { ch: '口', sketch: 'M24 34 Q50 22 76 34 L72 72 Q50 82 28 72 Z', story: 'An open mouth.' },
  { ch: '日', sketch: 'M50 20 A30 30 0 1 0 50.1 20 M40 50 L60 50', story: 'The sun, with a dot in the middle.' },
  { ch: '月', sketch: 'M60 14 Q14 50 60 86 Q36 50 60 14 M38 46 L50 46', story: 'A crescent moon.' },
  { ch: '山', sketch: 'M14 82 L86 82 M18 82 L18 52 M50 82 L50 22 M82 82 L82 52', story: 'Three peaks on a range.' },
  { ch: '水', sketch: 'M50 12 Q40 32 50 50 Q60 68 50 88 M26 28 L32 40 M28 60 L34 72 M74 28 L68 40 M72 60 L66 72', story: 'A stream with drops of water beside it.' },
  { ch: '木', sketch: 'M50 10 L50 90 M50 32 L26 14 M50 32 L74 14 M50 68 L28 88 M50 68 L72 88', story: 'A tree: branches above, roots below.' },
  { ch: '火', sketch: 'M50 86 Q28 62 38 22 Q48 52 56 18 Q74 58 50 86 M22 46 L28 58 M78 46 L72 58', story: 'Flames rising.' },
  { ch: '门', sketch: 'M24 18 L24 86 M76 18 L76 86 M24 18 L44 18 L44 48 L24 48 M56 18 L76 18 L76 48 L56 48', story: 'A pair of swinging doors.' },
  { ch: '田', sketch: 'M18 18 L82 18 L82 82 L18 82 Z M50 18 L50 82 M18 50 L82 50', story: 'A field divided into plots.' },
  { ch: '目', sketch: 'M12 50 Q50 18 88 50 Q50 82 12 50 Z M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', story: 'An eye, later turned upright.' },
  { ch: '雨', sketch: 'M14 20 L86 20 M50 20 L50 34 M24 34 L24 80 M24 34 L76 34 L76 80 M38 46 L40 54 M60 46 L62 54 M38 64 L40 72 M60 64 L62 72', story: 'Rain falling from the sky.' },
  { ch: '女', sketch: 'M44 16 Q30 50 58 86 M62 22 Q74 52 32 70 M24 46 L78 46', story: 'A woman kneeling, arms crossed.' },
  { ch: '子', sketch: 'M50 26 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M50 38 L50 86 Q50 92 42 88 M22 54 Q50 42 78 54', story: 'A baby with a big head and open arms.' },
  { ch: '大', sketch: 'M50 14 L50 46 M18 40 L82 40 M50 46 L26 86 M50 46 L74 86', story: 'A person standing with arms spread wide: big.' },
  { ch: '马', sketch: 'M30 20 L30 70 M30 20 L58 14 M30 36 L66 32 M30 52 L70 50 L70 82 Q70 88 62 84 M22 76 L78 76', story: 'A horse with a flowing mane, stood on end.' },
];

/** Characters built from two parts. `kind`: both parts give meaning, or one gives the sound. */
export const RECIPES: { parts: [string, string]; result: string; kind: 'meaning' | 'sound'; note: string }[] = [
  { parts: ['亻', '木'], result: '休', kind: 'meaning', note: 'A person leaning against a tree: to rest.' },
  { parts: ['木', '木'], result: '林', kind: 'meaning', note: 'Two trees: a grove, woods.' },
  { parts: ['日', '月'], result: '明', kind: 'meaning', note: 'Sun and moon together: bright.' },
  { parts: ['女', '子'], result: '好', kind: 'meaning', note: 'A woman with a child: good.' },
  { parts: ['田', '力'], result: '男', kind: 'meaning', note: 'Strength in the field: man.' },
  { parts: ['人', '人'], result: '从', kind: 'meaning', note: 'One person following another: from, to follow.' },
  { parts: ['宀', '女'], result: '安', kind: 'meaning', note: 'A woman under a roof: peaceful, safe.' },
  { parts: ['女', '马'], result: '妈', kind: 'sound', note: 'Woman (meaning) + 马 mǎ (sound): mā, mum.' },
  { parts: ['口', '马'], result: '吗', kind: 'sound', note: 'Mouth (a spoken word) + 马 mǎ (sound): ma, the question particle.' },
  { parts: ['氵', '青'], result: '清', kind: 'sound', note: 'Water + 青 qīng (sound): qīng, clear water.' },
  { parts: ['讠', '青'], result: '请', kind: 'sound', note: 'Speech + 青 qīng (sound): qǐng, please.' },
  { parts: ['日', '青'], result: '晴', kind: 'sound', note: 'Sun + 青 qīng (sound): qíng, sunny.' },
  { parts: ['忄', '青'], result: '情', kind: 'sound', note: 'Heart + 青 qīng (sound): qíng, feeling.' },
  { parts: ['目', '青'], result: '睛', kind: 'sound', note: 'Eye + 青 qīng (sound): jīng, eyeball.' },
  { parts: ['氵', '可'], result: '河', kind: 'sound', note: 'Water + 可 kě (sound, roughly): hé, river.' },
  { parts: ['亻', '尔'], result: '你', kind: 'sound', note: 'Person + 尔 ěr (an old word for "you"): nǐ, you.' },
];

export const PARTS = ['亻', '人', '木', '日', '月', '女', '子', '田', '力', '宀', '口', '马', '氵', '讠', '忄', '目', '青', '可', '尔'];

/** Radicals: the meaning parts that dictionaries sort characters by. */
export const RADICALS: { r: string; name: string; means: string; chars: string }[] = [
  { r: '氵', name: 'three drops', means: 'water, liquid', chars: '水河海洗汤酒没游' },
  { r: '口', name: 'mouth', means: 'mouth, speaking, eating', chars: '吃喝叫吗呢吧唱哪' },
  { r: '亻', name: 'standing person', means: 'people', chars: '你他们住作休做件' },
  { r: '女', name: 'woman', means: 'women, family', chars: '妈姐妹好她奶始' },
  { r: '讠', name: 'speech', means: 'words, speaking', chars: '说话语请让谢课认' },
  { r: '扌', name: 'hand', means: 'actions done by hand', chars: '打找拿把手拉接' },
  { r: '木', name: 'tree', means: 'trees, wooden things', chars: '林树桌椅机楼杯' },
  { r: '日', name: 'sun', means: 'sun, time, light', chars: '明早晚时昨春晴' },
  { r: '忄', name: 'standing heart', means: 'feelings, the mind', chars: '忙快怕情慢懂' },
  { r: '艹', name: 'grass', means: 'plants', chars: '花茶菜草苹药' },
  { r: '宀', name: 'roof', means: 'buildings, shelter', chars: '家字安室客' },
  { r: '辶', name: 'walking', means: 'movement, distance', chars: '这还近远进道送' },
  { r: '饣', name: 'food', means: 'eating, food', chars: '饭饺饿馆' },
  { r: '钅', name: 'metal', means: 'metal, money', chars: '钱钟铅银错' },
  { r: '纟', name: 'silk', means: 'thread, textiles', chars: '红给绿经级' },
];
