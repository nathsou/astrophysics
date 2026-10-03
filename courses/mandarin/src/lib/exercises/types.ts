/**
 * The YAML shape of each exercise kind. Chinese in any field gets pinyin and word cards
 * automatically. Most kinds take a list of `items`, played one after another.
 */

export interface ChooseItem {
  /** The question, in English (Chinese inside it is annotated). */
  prompt?: string;
  /** Chinese shown large above the options. */
  zh?: string;
  /** Chinese to play aloud; `true` plays `zh`. With `listen: true` the text stays hidden. */
  audio?: string | boolean;
  listen?: boolean;
  /** Hide the pinyin of `zh` and of the options (when pinyin would give the answer away). */
  noPinyin?: boolean;
  options: string[];
  /** Index of the right option. */
  answer: number;
  /** Shown after answering. */
  explain?: string;
}

export interface Choose {
  title?: string;
  items: ChooseItem[];
}

/** Pick the tone of each syllable. Answers come from the dictionary. */
export interface Tones {
  title?: string;
  /** Hide the characters and only play the sound. */
  listen?: boolean;
  items: (string | { zh: string; en?: string })[];
}

/** Type the pinyin (tone numbers or marks). With `listen`, a dictation: hear it, type it. */
export interface PinyinEx {
  title?: string;
  listen?: boolean;
  items: { zh: string; en?: string; answer?: string }[];
}

/** Put the tiles in order to translate the English. */
export interface Order {
  title?: string;
  items: {
    en: string;
    /** The answer, tiles separated by spaces: "我 很 喜欢 茶". */
    zh: string;
    /** Wrong tiles mixed in. */
    extra?: string[];
    /** Other accepted orders (same tile syntax). */
    also?: string[];
    explain?: string;
  }[];
}

/** Match left to right. */
export interface Match {
  title?: string;
  pairs: [string, string][];
  /** Left items are played instead of shown (match sounds to meanings). */
  listen?: boolean;
}

/** Choose the word that fills the gap (___). */
export interface Fill {
  title?: string;
  items: { zh: string; options: string[]; answer: number; en?: string; explain?: string }[];
}

/** Sort items into buckets. */
export interface Sort {
  title?: string;
  prompt?: string;
  buckets: string[];
  /** [item, bucket index] */
  items: [string, number][];
  explain?: string;
}

/** A conversation where you choose what to say. Wrong choices get an in-character reaction. */
export interface Scene {
  title: string;
  setting?: string;
  /** Who you are talking to. */
  partner: string;
  turns: {
    they?: string;
    theyEn?: string;
    options: { zh: string; en?: string; ok?: boolean; reply?: string; replyEn?: string }[];
  }[];
  end?: string;
}

/** A graded reader: short paragraphs, tap any word, then comprehension questions. */
export interface Story {
  title: string;
  zh?: string;
  paragraphs: { zh: string; en?: string }[];
  questions?: ChooseItem[];
}

/** Write characters stroke by stroke. */
export interface Write {
  title?: string;
  chars: string;
}

/** Say it and see your pitch against the target tone. */
export interface Speak {
  title?: string;
  items: string[];
}

/** Optional AI conversation partner (needs the learner's API key). */
export interface Roleplay {
  title: string;
  setting: string;
  /** What you must achieve, in English. */
  goal: string;
  /** Who the AI plays. */
  partner: string;
  opener: string;
  openerEn?: string;
  /** Words to try to use. */
  words?: string[];
  /** What counts as success, for the AI's verdict. */
  checks?: string[];
}

/** Optional AI feedback on a sentence you write. */
export interface Compose {
  task: string;
  /** The grammar point being practised, for the AI's feedback. */
  target?: string;
  hints?: string[];
  examples?: string[];
}

export type ExerciseData = Choose | Tones | PinyinEx | Order | Match | Fill | Sort | Scene | Story | Write | Speak | Roleplay | Compose;
