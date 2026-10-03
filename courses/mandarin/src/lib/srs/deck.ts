/**
 * The review deck. Every word the learner meets becomes up to three cards:
 *
 *   read — see the characters, recall the sound and meaning
 *   hear — hear the word, recall the meaning
 *   say  — see the meaning, say the word aloud
 *
 * A word starts with a `read` card. Its `hear` and `say` cards join once the reading card has
 * graduated from learning, so a new word never arrives as three cards on the same day.
 * Scheduling is FSRS (ts-fsrs); this module is pure so it can be tested with fixed dates.
 */
import { createEmptyCard, fsrs, Rating, State, TypeConvert, type Card, type Grade } from 'ts-fsrs';

export type CardKind = 'read' | 'hear' | 'say';
export const KINDS: CardKind[] = ['read', 'hear', 'say'];

export interface DeckCard {
  word: string;
  kind: CardKind;
  card: Card;
  /** Where the word was met (lesson slug), for the "from lesson…" label. */
  source?: string;
}

export interface DeckData {
  cards: Record<string, DeckCard>;
  /** How many new cards were started on each date, for the daily limit. */
  started: Record<string, number>;
}

export const cardId = (word: string, kind: CardKind) => `${kind}:${word}`;

const scheduler = fsrs({ enable_fuzz: false, request_retention: 0.9 });

export function emptyDeck(): DeckData {
  return { cards: {}, started: {} };
}

/** Add words that are not in the deck yet (as reading cards). Returns how many were added. */
export function addWords(deck: DeckData, words: string[], now: Date, source?: string): number {
  let n = 0;
  for (const word of words) {
    const id = cardId(word, 'read');
    if (deck.cards[id]) continue;
    deck.cards[id] = { word, kind: 'read', card: createEmptyCard(now), source };
    n++;
  }
  return n;
}

export function isNew(c: DeckCard): boolean {
  return c.card.state === State.New;
}

/** Cards due now, oldest first, then up to the day's remaining allowance of new cards. */
export function dueQueue(deck: DeckData, now: Date, newPerDay: number, dayKey: string): DeckCard[] {
  const all = Object.values(deck.cards);
  const due = all.filter((c) => !isNew(c) && new Date(c.card.due) <= now).sort((a, b) => +new Date(a.card.due) - +new Date(b.card.due));
  const allowance = Math.max(0, newPerDay - (deck.started[dayKey] ?? 0));
  // New cards in the order they were added, which follows the lessons.
  const fresh = all.filter(isNew).slice(0, allowance);
  return [...due, ...fresh];
}

export function counts(deck: DeckData, now: Date, newPerDay: number, dayKey: string) {
  const all = Object.values(deck.cards);
  return {
    due: all.filter((c) => !isNew(c) && new Date(c.card.due) <= now).length,
    fresh: Math.min(all.filter(isNew).length, Math.max(0, newPerDay - (deck.started[dayKey] ?? 0))),
    waiting: all.filter(isNew).length,
    total: all.length,
    words: new Set(all.map((c) => c.word)).size,
    /** Words whose reading card is out of the learning phase. */
    known: all.filter((c) => c.kind === 'read' && c.card.state === State.Review).length,
  };
}

/** Preview the next interval for each grade, as short labels ("10m", "3d"). */
export function preview(c: DeckCard, now: Date): Record<Grade, string> {
  const r = scheduler.repeat(c.card, now);
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) out[g] = interval(new Date(r[g].card.due).getTime() - now.getTime());
  return out;
}

export function interval(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${(d / 365).toFixed(1)}y`;
}

/** Grade a card. Unlocks the word's listening and speaking cards when reading graduates. */
export function grade(deck: DeckData, c: DeckCard, rating: Grade, now: Date, dayKey: string): void {
  const id = cardId(c.word, c.kind);
  if (isNew(c)) deck.started[dayKey] = (deck.started[dayKey] ?? 0) + 1;
  const next = scheduler.next(c.card, now, rating).card;
  deck.cards[id] = { ...c, card: next };
  if (c.kind === 'read' && next.state === State.Review) {
    for (const kind of ['hear', 'say'] as CardKind[]) {
      const k = cardId(c.word, kind);
      if (!deck.cards[k]) deck.cards[k] = { word: c.word, kind, card: createEmptyCard(now), source: c.source };
    }
  }
}

/** Restore Date fields after JSON round-trips. */
export function revive(deck: DeckData): DeckData {
  const cards: Record<string, DeckCard> = {};
  for (const [id, c] of Object.entries(deck.cards ?? {})) cards[id] = { ...c, card: TypeConvert.card(c.card) };
  return { cards, started: deck.started ?? {} };
}

export { Rating, State };
