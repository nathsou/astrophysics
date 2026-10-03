/**
 * Learner settings, including the "scaffolding dial": how much help the course shows with
 * Chinese text. Stored in this browser only.
 */
import { browser } from '$app/environment';
import type { ListId } from '$lib/zh/lexicon';
import { readJSON, writeJSON } from './storage';

export type PinyinMode = 'always' | 'tap' | 'off';
export type StartPoint = 'new' | 'pinyin' | 'hsk1' | 'hsk2';

export interface SettingsData {
  pinyin: PinyinMode;
  /** Show English translations of example sentences straight away. */
  translations: boolean;
  toneColours: boolean;
  /** Speed for spoken audio (1 = natural). */
  rate: number;
  list: ListId;
  start: StartPoint | null;
  newPerDay: number;
  /** Type the pinyin when reviewing reading cards. */
  typeAnswers: boolean;
  /** Little chimes for right and wrong answers. */
  sounds: boolean;
  apiKey: string;
  model: string;
}

export const DEFAULT_MODEL = 'claude-opus-5-5';

const KEY = 'mandarin:settings';
const DEFAULTS: SettingsData = {
  pinyin: 'always',
  translations: true,
  toneColours: true,
  rate: 1,
  list: 'n',
  start: null,
  newPerDay: 10,
  typeAnswers: false,
  sounds: true,
  apiKey: '',
  model: DEFAULT_MODEL,
};

/** Help levels for each starting point: beginners see everything, HSK 2 learners less. */
export const START_DEFAULTS: Record<StartPoint, Partial<SettingsData>> = {
  new: { pinyin: 'always', translations: true },
  pinyin: { pinyin: 'always', translations: true },
  hsk1: { pinyin: 'tap', translations: true },
  hsk2: { pinyin: 'tap', translations: false },
};

class Settings {
  data: SettingsData = $state({ ...DEFAULTS });
  panelOpen = $state(false);
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    this.data = readJSON(KEY, { ...DEFAULTS });
    this.apply();
    addEventListener('storage', (e) => {
      if (e.key === KEY) {
        this.data = readJSON(KEY, { ...DEFAULTS });
        this.apply();
      }
    });
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.save();
  }

  update(patch: Partial<SettingsData>): void {
    Object.assign(this.data, patch);
    this.save();
  }

  private save(): void {
    writeJSON(KEY, this.data);
    this.apply();
  }

  private apply(): void {
    if (!browser) return;
    const root = document.documentElement;
    root.dataset.pinyin = this.data.pinyin;
    if (this.data.toneColours) delete root.dataset.tones;
    else root.dataset.tones = 'off';
  }

  get tutorEnabled(): boolean {
    return this.data.apiKey.trim().length > 0;
  }
}

export const settings = new Settings();
