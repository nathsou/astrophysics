/**
 * Generates the course's audio with OpenAI text-to-speech.
 *
 *   npm run audio -- [--env path/to/.env] [--model gpt-4o-mini-tts] [--voice coral]
 *                    [--tiers words,lessons,extras] [--format mp3] [--limit 20] [--dry-run]
 *
 * Reads OPENAI_API_KEY from the environment or from a .env file: --env, else ./.env, the
 * repository's .env, or a .env in the folder that contains the repository. Without --model, it asks the API for the available speech models and
 * picks the newest steerable one (gpt-*-tts), falling back to tts-1-hd.
 *
 * The list of texts is static/audio/texts.json, written by
 *   WRITE=1 npx vitest run tools/audio/collect.test.ts
 * Clips go to static/audio/<hash>.<ext> and are listed in static/audio/manifest.json, which the
 * player reads (src/lib/audio/speech.svelte.ts). Existing clips are kept, so the script can be
 * stopped and resumed, and rerun after adding content to generate only what is new.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const audioDir = join(root, 'static/audio');
const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name: string) => args.includes(`--${name}`);

function loadEnv(): void {
  const candidates = [opt('env'), join(process.cwd(), '.env'), join(root, '.env'), join(root, '../../.env'), join(root, '../../../.env')];
  for (const file of candidates) {
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
    }
    console.log(`Read ${file}`);
    return;
  }
}

loadEnv();
const key = process.env.OPENAI_API_KEY;
if (!key && !flag('dry-run')) {
  console.error('OPENAI_API_KEY is not set (pass --env path/to/.env, or export it).');
  process.exit(1);
}
const API = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function pickModel(): Promise<string> {
  const chosen = opt('model') ?? process.env.OPENAI_TTS_MODEL;
  if (chosen) return chosen;
  try {
    const r = await fetch(`${API}/models`, { headers });
    const { data } = (await r.json()) as { data: { id: string; created: number }[] };
    const steerable = data.filter((m) => /^gpt-.*tts/.test(m.id) && !/\d{4}-\d{2}-\d{2}$/.test(m.id)).sort((a, b) => b.created - a.created);
    if (steerable[0]) return steerable[0].id;
    if (data.some((m) => m.id === 'tts-1-hd')) return 'tts-1-hd';
  } catch {
    /* fall through */
  }
  return 'gpt-4o-mini-tts';
}

const INSTRUCTIONS = {
  short:
    'You are recording audio for a Mandarin course for beginners. Say this Chinese word or syllable on its own in clear Standard Mandarin (Putonghua) with a neutral Beijing accent. Give every syllable its full dictionary tone, as said in isolation, at a calm, slightly slow pace. Say only the text, with no added words.',
  sentence:
    'You are recording audio for a Mandarin course for beginners. Read this Chinese text in clear, natural Standard Mandarin (Putonghua) with a neutral Beijing accent, at a relaxed, slightly slow pace, with warm, friendly intonation and every tone clearly audible. Say only the text, with no added words or translations.',
};

const format = opt('format', 'mp3')!;
const voice = opt('voice', process.env.OPENAI_TTS_VOICE ?? 'coral')!;
const tiers = new Set(opt('tiers', 'words,lessons,extras')!.split(','));
const limit = Number(opt('limit', '0'));
const concurrency = Number(opt('concurrency', '4'));

const texts = (JSON.parse(readFileSync(join(audioDir, 'texts.json'), 'utf8')) as { text: string; tier: string }[]).filter((t) => tiers.has(t.tier));
const manifestPath = join(audioDir, 'manifest.json');
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const todo = texts.filter((t) => !manifest[t.text] || !existsSync(join(audioDir, manifest[t.text]!)));
const batch = limit ? todo.slice(0, limit) : todo;
console.log(`${texts.length} texts, ${texts.length - todo.length} already recorded, ${batch.length} to generate.`);
if (flag('dry-run') || !batch.length) process.exit(0);

const model = await pickModel();
console.log(`Model ${model}, voice ${voice}, format ${format}.`);
const steerable = model.startsWith('gpt-');

function save(): void {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(manifestPath, JSON.stringify(sorted, null, 0).replace(/","/g, '",\n"') + '\n');
}

async function speak(text: string): Promise<Buffer> {
  const isShort = [...text].length <= 3 && !/[，。！？]/.test(text);
  const body: Record<string, unknown> = { model, voice, input: text, response_format: format };
  if (steerable) body.instructions = isShort ? INSTRUCTIONS.short : INSTRUCTIONS.sentence;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${API}/audio/speech`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 6) {
      await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`${r.status} for “${text}”: ${msg.slice(0, 300)}`);
  }
}

let done = 0;
let failed = 0;
const queue = [...batch];
async function worker(): Promise<void> {
  for (let t = queue.shift(); t; t = queue.shift()) {
    const file = `${createHash('sha1').update(`${t.text}|${voice}`).digest('hex').slice(0, 12)}.${format}`;
    try {
      writeFileSync(join(audioDir, file), await speak(t.text));
      manifest[t.text] = file;
      done++;
      if (done % 25 === 0) {
        save();
        console.log(`${done} / ${batch.length}`);
      }
    } catch (e) {
      failed++;
      console.error((e as Error).message);
      if (failed > 20) throw new Error('Too many failures; stopping.');
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
save();
console.log(`Done: ${done} clips written${failed ? `, ${failed} failed (rerun to retry)` : ''}.`);
