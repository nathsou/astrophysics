/**
 * The course audio lives in a GitHub release asset, not in git.
 *
 *   npm run audio:pack -- --tag mandarin-audio-v2
 *       zips static/audio (clips, manifest, QA report) into build/mandarin-audio.zip and records
 *       the tag and checksum in audio-release.json. Then upload it:
 *       gh release create mandarin-audio-v2 build/mandarin-audio.zip --title "Mandarin course audio"
 *       and commit audio-release.json.
 *
 *   npm run audio:fetch [-- --optional]
 *       downloads the release named in audio-release.json, checks its checksum and unpacks it
 *       into static/audio. The deploy workflow runs this before building. With --optional, a
 *       missing release only warns, and the course falls back to the browser's voice.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const audioDir = join(root, 'static/audio');
const infoPath = join(root, 'audio-release.json');
const args = process.argv.slice(3);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface ReleaseInfo {
  repo: string;
  tag: string;
  asset: string;
  sha256: string;
  clips: number;
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const readInfo = (): ReleaseInfo => JSON.parse(readFileSync(infoPath, 'utf8'));

function pack(): void {
  const tag = opt('tag');
  if (!tag) throw new Error('Pass --tag, e.g. --tag mandarin-audio-v1');
  const clips = readdirSync(audioDir).filter((f) => f.endsWith('.mp3'));
  if (!clips.length || !existsSync(join(audioDir, 'manifest.json'))) throw new Error('No clips: run npm run audio first.');
  const out = join(root, 'build');
  mkdirSync(out, { recursive: true });
  const zip = join(out, 'mandarin-audio.zip');
  rmSync(zip, { force: true });
  const files = ['manifest.json', ...(existsSync(join(audioDir, 'qa.json')) ? ['qa.json'] : []), ...clips.sort()];
  // -X: no extra file attributes, so the same clips always give the same archive.
  execFileSync('zip', ['-q', '-X', '-0', zip, ...files], { cwd: audioDir });
  const info: ReleaseInfo = { ...(existsSync(infoPath) ? readInfo() : { repo: 'nathsou/courses', asset: 'mandarin-audio.zip' }), tag, sha256: sha256(readFileSync(zip)), clips: clips.length };
  writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');
  console.log(`Packed ${clips.length} clips into build/mandarin-audio.zip (sha256 ${info.sha256.slice(0, 12)}…).`);
  console.log(`Upload it:  gh release create ${tag} build/mandarin-audio.zip --repo ${info.repo} --title "Mandarin course audio" --notes "Audio for courses/mandarin (${clips.length} clips)."`);
  console.log('Then commit audio-release.json.');
}

async function fetchAudio(): Promise<void> {
  const optional = args.includes('--optional');
  const fail = (msg: string) => {
    if (!optional) throw new Error(msg);
    console.warn(`${msg} The course will use the browser's voice.`);
  };
  if (!existsSync(infoPath)) return fail('No audio-release.json.');
  const info = readInfo();
  if (!info.tag || !info.sha256) return fail('audio-release.json names no release yet.');
  const marker = join(audioDir, '.release');
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === info.sha256) {
    console.log(`Audio ${info.tag} already in place.`);
    return;
  }
  const url = process.env.MANDARIN_AUDIO_URL ?? `https://github.com/${info.repo}/releases/download/${info.tag}/${info.asset}`;
  const r = await fetch(url);
  if (!r.ok) return fail(`Could not download ${url} (${r.status}).`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (sha256(buf) !== info.sha256) return fail(`Checksum mismatch for ${url}.`);
  for (const f of readdirSync(audioDir)) if (f.endsWith('.mp3')) rmSync(join(audioDir, f));
  const tmp = join(root, 'build', info.asset);
  mkdirSync(join(root, 'build'), { recursive: true });
  writeFileSync(tmp, buf);
  execFileSync('unzip', ['-q', '-o', tmp, '-d', audioDir]);
  writeFileSync(marker, info.sha256 + '\n');
  console.log(`Unpacked ${info.clips} clips from ${info.tag}.`);
}

const command = process.argv[2];
if (command === 'pack') pack();
else if (command === 'fetch') await fetchAudio();
else throw new Error('Usage: audio-release.ts pack --tag <tag> | fetch [--optional]');
