import { test, expect, type Page } from '@playwright/test';

async function configure(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mandarin:settings', JSON.stringify({ provider: 'openai', tutors: { openai: { apiKey: 'browser-test-key', model: 'test-model' } } })));
}

test('teacher is available without a key and sends users to provider settings', async ({ page }) => {
  await page.goto('/practice/');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Mandarin teacher' });
  await expect(chat.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings/#tutor');
  await page.keyboard.press('Escape');
  await expect(chat).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Teacher', exact: true })).toBeFocused();
});

test('teacher gets lesson context, renders advice and keeps the chat across navigation', async ({ page }) => {
  await configure(page);
  let request: any;
  await page.route('https://api.openai.com/**', async route => {
    request = route.request().postDataJSON();
    await route.fulfill({ json: { choices: [{ message: { content: '<reply>Use 二 for the number and 两 when counting objects.</reply><translation></translation><advice>Try 两个人。</advice>' } }] } });
  });
  await page.goto('/learn/07-numbers/');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Mandarin teacher' });
  await chat.getByRole('textbox', { name: 'Message to your Mandarin teacher' }).fill('When should I use liang?');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(chat.getByRole('log')).toContainText('Use 二');
  await expect(chat.locator('.advice')).toContainText('Try this');
  expect(request.model).toBe('test-model');
  expect(request.messages[0].content).toContain('Numbers you can say');
  expect(request.messages[0].content).toContain('Zero to ten');
  await chat.getByRole('button', { name: 'Close teacher chat' }).click();
  await page.locator('.pager a.next').click();
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await expect(chat.getByRole('log')).toContainText('Use 二');
  await expect(chat.locator('.context')).toContainText('Family and having');
});

test('pinyin tones and character candidates insert into the draft; IME Enter does not submit', async ({ page }) => {
  await configure(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Mandarin teacher' });
  const input = chat.getByRole('textbox', { name: 'Message to your Mandarin teacher' });
  await input.fill('ni hao');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 2));
  await chat.getByRole('button', { name: '拼 · Keyboard' }).click();
  await chat.getByRole('button', { name: 'Insert ǐ', exact: true }).click();
  await expect(input).toHaveValue('nǐ hao');
  await chat.getByRole('button', { name: 'Characters', exact: true }).click();
  await chat.getByRole('searchbox').fill('ni3 hao3');
  await chat.getByRole('button', { name: /^Insert 你好,/ }).click();
  await expect(input).toHaveValue('nǐ你好 hao');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(chat.getByRole('log').locator('article')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('cancellation restores the draft and a retry can succeed', async ({ page }) => {
  await configure(page);
  let requests = 0;
  await page.route('https://api.openai.com/**', async route => {
    requests++;
    if (requests === 1) return;
    await route.fulfill({ json: { choices: [{ message: { content: '<reply>你好！</reply><translation>Hello!</translation><advice></advice>' } }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Mandarin teacher' });
  await chat.getByRole('button', { name: 'Converse in Mandarin' }).click();
  const input = chat.getByRole('textbox', { name: 'Message to your Mandarin teacher' });
  await input.fill('ni hao');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(chat.getByRole('status')).toBeVisible();
  await chat.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(input).toHaveValue('ni hao');
  await expect(chat.getByRole('alert')).toHaveText('Stopped.');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(chat.locator('.translation')).toHaveText('Hello!');
  await expect(chat.getByRole('button', { name: 'Listen to the teacher' })).toHaveCount(1);
});

test('typing numbered pinyin in chat does not answer a running tone game', async ({ page }) => {
  await configure(page);
  await page.goto('/practice/#tones');
  await page.locator('.trainer').getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Mandarin teacher' });
  await chat.getByRole('textbox', { name: 'Message to your Mandarin teacher' }).pressSequentially('ni3 hao3 r');
  await expect(page.locator('.trainer').getByRole('button', { name: /^Tone \d/ }).first()).toBeEnabled();
  await expect(page.locator('.trainer').getByRole('button', { name: 'Next', exact: false })).toHaveCount(0);
});

test('provider changes keep keys separate and backups contain no credentials', async ({ page }) => {
  await configure(page);
  await page.goto('/settings/');
  await page.getByLabel('Provider', { exact: true }).selectOption('openrouter');
  await expect(page.getByLabel('OpenRouter API key')).toHaveValue('');
  await page.getByLabel('OpenRouter API key').fill('router-browser-test-key');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Provider', { exact: true }).selectOption('openai');
  await expect(page.getByLabel('OpenAI API key')).toHaveValue('browser-test-key');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download a backup' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks).toString('utf8');
  expect(backup).not.toContain('browser-test-key');
  expect(Object.values(JSON.parse(backup).settings.tutors).every((profile: any) => profile.apiKey === '')).toBe(true);
});

test('editing a sentence clears feedback and restarting a roleplay cancels pending review', async ({ page }) => {
  await configure(page);
  await page.route('https://api.openai.com/**', async route => {
    const system = route.request().postDataJSON().messages[0].content;
    if (system.includes('reviewing a short practice conversation')) return;
    const content = system.includes('check single sentences')
      ? '<verdict>correct</verdict><better>我有一个妹妹。</better><explain>Good use of 有.</explain>'
      : '<reply>很好！</reply><en>Very good!</en><fix></fix><done>yes</done>';
    await route.fulfill({ json: { choices: [{ message: { content } }] } });
  });
  await page.goto('/learn/08-family/');
  const sentence = page.getByRole('textbox', { name: 'Your sentence' });
  await sentence.fill('我有一个妹妹。');
  await page.getByRole('button', { name: 'Check my sentence' }).click();
  await expect(page.locator('.result.correct')).toBeVisible();
  await sentence.fill('我有妹妹');
  await expect(page.locator('.result.correct')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Your reply' }).fill('你好');
  await page.locator('.rp').getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.rp .review')).toContainText('Reading your conversation');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByRole('textbox', { name: 'Your reply' })).toBeEnabled();
  await expect(page.locator('.rp .review')).toHaveCount(0);
  await expect(page.locator('.rp .log .msg')).toHaveCount(1);
});
