import { describe, expect, it } from 'vitest';
import { addWords, cardId, counts, dueQueue, emptyDeck, grade, Rating, revive } from './deck';

const t0 = new Date('2026-01-01T09:00:00Z');
const later = (min: number) => new Date(t0.getTime() + min * 60000);

describe('deck', () => {
  it('adds each word once as a reading card', () => {
    const d = emptyDeck();
    expect(addWords(d, ['你好', '谢谢'], t0)).toBe(2);
    expect(addWords(d, ['你好'], t0)).toBe(0);
    expect(Object.keys(d.cards)).toEqual([cardId('你好', 'read'), cardId('谢谢', 'read')]);
  });
  it('limits new cards per day', () => {
    const d = emptyDeck();
    addWords(d, ['一', '二', '三', '四'], t0);
    expect(dueQueue(d, t0, 3, 'day1')).toHaveLength(3);
    grade(d, d.cards[cardId('一', 'read')]!, Rating.Good, t0, 'day1');
    expect(counts(d, t0, 3, 'day1').fresh).toBe(2);
  });
  it('unlocks listening and speaking cards once reading graduates', () => {
    const d = emptyDeck();
    addWords(d, ['好'], t0);
    let now = t0;
    for (let i = 0; i < 6 && !d.cards[cardId('好', 'hear')]; i++) {
      grade(d, d.cards[cardId('好', 'read')]!, Rating.Good, now, 'day');
      now = new Date(d.cards[cardId('好', 'read')]!.card.due);
    }
    expect(d.cards[cardId('好', 'hear')]).toBeDefined();
    expect(d.cards[cardId('好', 'say')]).toBeDefined();
  });
  it('survives a JSON round trip', () => {
    const d = emptyDeck();
    addWords(d, ['好'], t0);
    grade(d, d.cards[cardId('好', 'read')]!, Rating.Again, t0, 'day');
    const back = revive(JSON.parse(JSON.stringify(d)));
    expect(back.cards[cardId('好', 'read')]!.card.due).toBeInstanceOf(Date);
    expect(dueQueue(back, later(30), 0, 'day')).toHaveLength(1);
  });
});
