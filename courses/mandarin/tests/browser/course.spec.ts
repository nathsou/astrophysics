import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';

const lessons = readdirSync('content/lessons').filter(file => file.endsWith('.md')).map(file => `/learn/${file.slice(0, -3)}/`);
const routes = ['/', ...lessons, '/practice/', '/review/', '/words/', '/placement/', '/exam/', '/settings/'];
const games = ['blitz', 'tones', 'pairs', 'mirror', 'numbers', 'measure', 'write', 'map', 'family', 'builder', 'chart'];

for (const route of routes) {
  test(`${route} fits the viewport and has no nested answer controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-pinyin', 'always');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('button [role="button"], button button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('every practice tool fits the viewport and loads without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const game of games) {
    await page.goto(`/practice/#${game}`);
    await expect(page.locator('.stage')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), game).toBeLessThanOrEqual(1);
    await expect(page.locator('button [role="button"], button button')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('active review and mock exam controls fit the viewport', async ({ page }) => {
  await page.goto('/learn/07-numbers/');
  await page.locator('.words').first().locator('.word').first().click();
  await page.getByRole('button', { name: 'Add to review' }).click();
  await page.getByRole('button', { name: 'Close word card' }).click();
  await page.goto('/review/');
  await page.getByRole('button', { name: 'Start reviewing' }).click();
  await page.getByRole('button', { name: 'Show answer' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.goto('/exam/');
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await expect(page.locator('button [role="button"], button button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('word-list rows align and a short viewport keeps every word-card control reachable', async ({ page }) => {
  await page.goto('/learn/07-numbers/');
  const list = page.locator('.words').first();
  expect(await list.locator('li').evaluateAll(rows => rows.every(row => getComputedStyle(row).marginTop === '0px'))).toBe(true);
  await page.setViewportSize({ width: 375, height: 300 });
  const word = list.locator('.word').filter({ hasText: '五' }).first();
  await word.click();
  const card = page.getByRole('dialog', { name: 'Word: 五' });
  await expect(card).toBeVisible();
  // A queued scroll event after opening must not dismiss an unmoved anchor.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect(card).toBeVisible();
  const rect = await card.boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(8);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(293);
  await expect(card.getByRole('button', { name: 'Listen slowly' })).toHaveText('Slow');
  await card.getByRole('button', { name: 'Close word card' }).click();
  await expect(card).toHaveCount(0);
  await expect(word).toBeFocused();
  await word.click();
  await expect(card).toBeVisible();
  await page.evaluate(() => window.scrollBy(0, 50));
  await expect(card).toHaveCount(0);
});

test('normal and slow audio have distinct active states and stop does not hang the word list', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ lang: 'zh-CN', name: 'Chinese', localService: true }],
      speak: () => {}, cancel: () => {}, addEventListener: () => {},
    } });
  });
  await page.goto('/learn/07-numbers/');
  const list = page.locator('.words').first();
  await list.locator('.word').filter({ hasText: '五' }).first().click();
  const card = page.getByRole('dialog', { name: 'Word: 五' });
  await expect(card.getByRole('button', { name: 'Stop audio' })).toHaveCount(1);
  await card.getByRole('button', { name: 'Listen slowly' }).click();
  await expect(card.getByRole('button', { name: 'Stop audio' })).toHaveCount(1);
  await card.getByRole('button', { name: 'Stop audio' }).click();
  await expect(card.getByRole('button', { name: 'Stop audio' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Close word card' }).click();
  await list.getByRole('button', { name: 'Hear them all' }).click();
  await list.getByRole('button', { name: 'Stop', exact: true }).click();
  await list.getByRole('button', { name: 'Hear them all' }).click();
  await expect(list.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
});
