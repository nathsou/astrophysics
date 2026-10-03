/** The course outline. Lesson slugs are URLs and progress keys: do not rename them. */
export const COURSE_TITLE = 'Mandarin, Out Loud';
export const COURSE_SUBTITLE = 'From your first tone to HSK 2';

export interface LessonRef {
  slug: string;
  title: string;
  zh: string;
  /** Rough time to work through the lesson, in minutes. */
  minutes: number;
  /** One-line promise shown on the course map. */
  blurb: string;
}

export interface Part {
  id: string;
  title: string;
  zh: string;
  /** Who this part is for, shown on the map. */
  tagline: string;
  /** HSK level this part prepares for (0 = foundations). */
  level: 0 | 1 | 2;
  lessons: LessonRef[];
}

export const PARTS: Part[] = [
  {
    id: 'sounds',
    title: 'Sounds',
    zh: '发音',
    tagline: 'Hear and say every sound of Mandarin. No characters yet.',
    level: 0,
    lessons: [
      { slug: '01-four-tones', title: 'Four tones and a melody', zh: '四声', minutes: 25, blurb: 'Why mā, má, mǎ and mà are four different words, and how to hear the difference.' },
      { slug: '02-pinyin', title: 'Pinyin: letters that lie', zh: '拼音', minutes: 30, blurb: 'The spelling system, and the dozen letters that do not sound like English.' },
      { slug: '03-tones-in-company', title: 'Tones in company', zh: '变调', minutes: 25, blurb: 'Tone pairs, the light neutral tone, and the three tones that change.' },
    ],
  },
  {
    id: 'characters',
    title: 'Characters',
    zh: '汉字',
    tagline: 'How Chinese writing works, and how to write it by hand.',
    level: 0,
    lessons: [
      { slug: '04-how-characters-work', title: 'How characters work', zh: '汉字', minutes: 25, blurb: 'Pictures, ideas, and the sound-plus-meaning trick behind most characters.' },
      { slug: '05-strokes', title: 'Strokes, order and radicals', zh: '笔画', minutes: 25, blurb: 'The eight strokes, the rules of order, and the radicals that group meanings.' },
    ],
  },
  {
    id: 'hsk1',
    title: 'Everyday Mandarin',
    zh: '一级',
    tagline: 'The core of HSK 1: introduce yourself, count, shop, eat, get around.',
    level: 1,
    lessons: [
      { slug: '06-hello', title: 'Hello, who are you?', zh: '你好', minutes: 30, blurb: 'Greetings, names, nationalities, and questions with 吗.' },
      { slug: '07-numbers', title: 'Numbers you can say', zh: '数字', minutes: 30, blurb: 'Counting to 99 999, ages, phone numbers, and the two words for two.' },
      { slug: '08-family', title: 'Family and having', zh: '家人', minutes: 30, blurb: 'Who is in your family, 有 and 没有, measure words, and the possessive 的.' },
      { slug: '09-time', title: 'Days, dates and the clock', zh: '时间', minutes: 30, blurb: 'Telling the time, saying dates, and the big-to-small rule.' },
      { slug: '10-food', title: 'Eating and drinking', zh: '吃饭', minutes: 30, blurb: 'Ordering food, 想 and 要, and the measure words of the table.' },
      { slug: '11-shopping', title: 'Shopping and money', zh: '买东西', minutes: 30, blurb: 'Prices, 这 and 那, 太…了, and bargaining at a market stall.' },
      { slug: '12-places', title: 'Where is it?', zh: '在哪儿', minutes: 30, blurb: 'Places, directions, 在, 去 and how to get there.' },
      { slug: '13-daily-life', title: 'A day in your life', zh: '生活', minutes: 30, blurb: 'Daily routines, likes and skills: 喜欢, 会, 能 and 可以.' },
      { slug: '14-weather-feelings', title: 'Weather and feelings', zh: '天气', minutes: 25, blurb: 'Describing things with 很, asking 怎么样, and talking about the weather.' },
      { slug: '15-hsk1-review', title: 'HSK 1: putting it together', zh: '复习', minutes: 35, blurb: 'A story, a scene and a full review of everything in this part.' },
    ],
  },
  {
    id: 'hsk2',
    title: 'Going further',
    zh: '二级',
    tagline: 'HSK 2: the past, comparisons, plans, reasons, and how well things go.',
    level: 2,
    lessons: [
      { slug: '16-what-happened', title: 'What happened: 了 and 过', zh: '了', minutes: 35, blurb: 'Talking about the past, things done, and things you have ever done.' },
      { slug: '17-comparing', title: 'Comparing things', zh: '比', minutes: 30, blurb: '比, 一样, 更 and 最: bigger, cheaper, the best.' },
      { slug: '18-getting-around', title: 'Getting around', zh: '出行', minutes: 30, blurb: 'Transport, distance, 从…到, 离, and how long things take.' },
      { slug: '19-right-now', title: 'Right now and soon', zh: '正在', minutes: 30, blurb: 'Actions in progress with 在 and 正在, and things about to happen.' },
      { slug: '20-reasons', title: 'Health, reasons and results', zh: '因为', minutes: 30, blurb: 'Seeing the doctor, 因为…所以, 但是, and giving reasons.' },
      { slug: '21-plans', title: 'Plans and invitations', zh: '计划', minutes: 30, blurb: 'Making plans, suggesting with 吧, and asking why and how.' },
      { slug: '22-how-well', title: 'How well, how much', zh: '得', minutes: 30, blurb: 'Describing actions with 得, and the difference between 有点儿 and 一点儿.' },
      { slug: '23-hsk2-review', title: 'HSK 2: putting it together', zh: '复习', minutes: 40, blurb: 'A longer story, a free conversation, and a review of the whole course.' },
    ],
  },
];

export const LESSONS: (LessonRef & { part: Part; number: number })[] = PARTS.flatMap((part) => part.lessons).map((l, i) => ({
  ...l,
  part: PARTS.find((p) => p.lessons.includes(l))!,
  number: i + 1,
}));

export function lessonBySlug(slug: string) {
  return LESSONS.find((l) => l.slug === slug);
}
