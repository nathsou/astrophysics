/** Structural checks for exercise YAML, run over every lesson by the content tests. */
import type { ChooseItem } from './types';

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
const str = (x: unknown) => typeof x === 'string' && x.trim().length > 0;

function chooseItem(it: unknown, where: string, errors: string[]): void {
  if (!isObj(it)) return void errors.push(`${where}: item must be an object`);
  const c = it as unknown as ChooseItem;
  if (!Array.isArray(c.options) || c.options.length < 2) errors.push(`${where}: needs at least two options`);
  else if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length) errors.push(`${where}: answer ${c.answer} out of range`);
  else if (new Set(c.options.map(String)).size !== c.options.length) errors.push(`${where}: duplicate options`);
  if (!c.prompt && !c.zh && !c.audio) errors.push(`${where}: needs a prompt, zh or audio`);
  if (c.listen && !c.audio && !c.zh) errors.push(`${where}: listen needs audio or zh`);
}

function items(d: Obj, where: string, errors: string[]): unknown[] {
  if (!Array.isArray(d.items) || !d.items.length) {
    errors.push(`${where}: needs items`);
    return [];
  }
  return d.items;
}

export function validateExercise(kind: string, d: unknown, where: string): string[] {
  const errors: string[] = [];
  if (!isObj(d)) return [`${where}: exercise must be a YAML mapping`];
  switch (kind) {
    case 'choose':
      items(d, where, errors).forEach((it, i) => chooseItem(it, `${where} item ${i + 1}`, errors));
      break;
    case 'tones':
      items(d, where, errors).forEach((it, i) => {
        const zh = typeof it === 'string' ? it : isObj(it) ? it.zh : undefined;
        if (!str(zh)) errors.push(`${where} item ${i + 1}: needs Chinese`);
      });
      break;
    case 'pinyin':
      items(d, where, errors).forEach((it, i) => {
        if (!isObj(it) || !str(it.zh)) errors.push(`${where} item ${i + 1}: needs zh`);
      });
      break;
    case 'order':
      items(d, where, errors).forEach((it, i) => {
        if (!isObj(it) || !str(it.en) || !str(it.zh)) return void errors.push(`${where} item ${i + 1}: needs en and zh`);
        const tiles = String(it.zh).split(/\s+/);
        if (tiles.length < 2) errors.push(`${where} item ${i + 1}: needs at least two tiles`);
        for (const alt of (it.also as string[] | undefined) ?? []) {
          if ([...alt.split(/\s+/)].sort().join() !== [...tiles].sort().join()) errors.push(`${where} item ${i + 1}: "also" order uses different tiles`);
        }
      });
      break;
    case 'match':
      if (!Array.isArray(d.pairs) || d.pairs.length < 2) errors.push(`${where}: needs at least two pairs`);
      else if (d.pairs.some((p) => !Array.isArray(p) || p.length !== 2)) errors.push(`${where}: each pair needs two entries`);
      else if (d.pairs.length > 8) errors.push(`${where}: at most 8 pairs`);
      break;
    case 'fill':
      items(d, where, errors).forEach((it, i) => {
        if (!isObj(it) || !String(it.zh ?? '').includes('___')) return void errors.push(`${where} item ${i + 1}: zh needs a ___ gap`);
        chooseItem({ ...it, prompt: 'x' }, `${where} item ${i + 1}`, errors);
      });
      break;
    case 'sort':
      if (!Array.isArray(d.buckets) || d.buckets.length < 2) errors.push(`${where}: needs at least two buckets`);
      if (!Array.isArray(d.items) || !d.items.length) errors.push(`${where}: needs items`);
      else
        (d.items as unknown[]).forEach((it, i) => {
          if (!Array.isArray(it) || !str(it[0]) || !Number.isInteger(it[1]) || it[1] < 0 || it[1] >= (d.buckets as unknown[]).length)
            errors.push(`${where} item ${i + 1}: should be [text, bucket index]`);
        });
      break;
    case 'scene':
      if (!str(d.title) || !str(d.partner)) errors.push(`${where}: needs title and partner`);
      if (!Array.isArray(d.turns) || !d.turns.length) errors.push(`${where}: needs turns`);
      else
        (d.turns as unknown[]).forEach((t, i) => {
          if (!isObj(t) || !Array.isArray(t.options) || !t.options.length) return void errors.push(`${where} turn ${i + 1}: needs options`);
          const ok = (t.options as Obj[]).filter((o) => o.ok);
          if (ok.length < 1) errors.push(`${where} turn ${i + 1}: needs at least one ok option`);
          if ((t.options as Obj[]).some((o) => !o.ok && !o.reply)) errors.push(`${where} turn ${i + 1}: wrong options need a reply`);
        });
      break;
    case 'story':
      if (!str(d.title)) errors.push(`${where}: needs a title`);
      if (!Array.isArray(d.paragraphs) || !d.paragraphs.length) errors.push(`${where}: needs paragraphs`);
      ((d.questions as unknown[]) ?? []).forEach((q, i) => chooseItem(q, `${where} question ${i + 1}`, errors));
      break;
    case 'write':
      if (!str(d.chars)) errors.push(`${where}: needs chars`);
      break;
    case 'speak':
      items(d, where, errors);
      break;
    case 'roleplay':
      for (const k of ['title', 'setting', 'goal', 'partner', 'opener']) if (!str(d[k])) errors.push(`${where}: needs ${k}`);
      break;
    case 'compose':
      if (!str(d.task)) errors.push(`${where}: needs a task`);
      break;
    default:
      errors.push(`${where}: unknown exercise kind ${kind}`);
  }
  return errors;
}
