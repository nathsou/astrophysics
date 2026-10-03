/** The learner's review deck, persisted in this browser. */
import { browser } from '$app/environment';
import type { Grade } from 'ts-fsrs';
import { settings } from '$lib/state/settings.svelte';
import { today, writeJSON } from '$lib/state/storage';
import { addWords, counts, dueQueue, emptyDeck, grade, revive, type DeckCard, type DeckData } from './deck';

const KEY = 'mandarin:deck';

class Deck {
  data: DeckData = $state(emptyDeck());
  /** Bumped on every change so derived counts refresh (dates are not deeply reactive). */
  version = $state(0);
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    this.read();
    addEventListener('storage', (e) => {
      if (e.key === KEY) this.read();
    });
  }

  private read(): void {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? revive(JSON.parse(raw)) : emptyDeck();
    } catch {
      this.data = emptyDeck();
    }
    this.version++;
  }

  private save(): void {
    writeJSON(KEY, this.data);
    this.version++;
  }

  add(words: string[], source?: string): number {
    const n = addWords(this.data, words, new Date(), source);
    if (n) this.save();
    return n;
  }

  has(word: string): boolean {
    void this.version;
    return Object.values(this.data.cards).some((c) => c.word === word);
  }

  queue(): DeckCard[] {
    void this.version;
    return dueQueue(this.data, new Date(), settings.data.newPerDay, today());
  }

  counts() {
    void this.version;
    return counts(this.data, new Date(), settings.data.newPerDay, today());
  }

  grade(card: DeckCard, rating: Grade): void {
    grade(this.data, card, rating, new Date(), today());
    this.save();
  }

  replace(data: DeckData): void {
    this.data = revive(data);
    this.save();
  }
}

export const deck = new Deck();
