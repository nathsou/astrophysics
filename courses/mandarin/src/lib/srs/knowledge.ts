/** How much of each HSK level the learner has in their deck, and how much is learned. */
import { State } from 'ts-fsrs';
import { hskWords, type ListId } from '$lib/zh/lexicon';
import type { DeckData } from './deck';

export interface LevelStat {
  level: number;
  total: number;
  inDeck: number;
  known: number;
}

export function levelStats(deck: DeckData, list: ListId, levels = [1, 2]): LevelStat[] {
  const status = new Map<string, 'deck' | 'known'>();
  for (const c of Object.values(deck.cards)) {
    if (c.kind !== 'read') continue;
    status.set(c.word, c.card.state === State.Review ? 'known' : 'deck');
  }
  return levels.map((level) => {
    const ws = hskWords(list, level);
    return {
      level,
      total: ws.length,
      inDeck: ws.filter((w) => status.has(w.w)).length,
      known: ws.filter((w) => status.get(w.w) === 'known').length,
    };
  });
}
