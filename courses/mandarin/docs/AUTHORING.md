# Writing lessons

Lessons are `content/lessons/<nn-slug>.md`, listed in `content/outline.ts` (slugs are URLs and
progress keys: never rename them). The compiler is `tools/markdown/compile.ts`.

## Front matter

```yaml
---
title: Hello, who are you?
goals:
  - greet people, thank them, apologise, and say goodbye
words: [马]          # optional: taught words not listed in a ```words block
---
```

## Chinese in prose

Write Chinese directly: every run of characters becomes an annotated, tappable `<Zh>` element.
Pinyin comes from the dictionary (word by word, with the 一/不 tone changes applied). Force a
reading after a character: `长[zhǎng]大`. Headings are not annotated.

## Blocks

| Block | Purpose |
| --- | --- |
| ```` ```words ```` | New words, one per line, optional `| gloss`. These become the lesson's deck cards. |
| ```` ```dialogue ```` | `Speaker: 中文 | English` per line; optional `title:` line. Play and shadow modes. |
| `:::note`, `:::tip`, `:::culture`, `:::grammar[Title]`, `:::mistake`, `:::key`, `:::fun` | Callouts. |
| `:::details[Summary]` | Collapsible aside. |
| `::widget-name{prop=…}` | A widget from `src/lib/widgets/WidgetName.svelte`. |

## Exercises

Fenced YAML blocks; shapes are in `src/lib/exercises/types.ts` and checked by
`src/lib/exercises/validate.ts` in `npm test`.

| Kind | What the learner does |
| --- | --- |
| `choose` | Multiple choice; `audio` + `listen: true` for listening items, `noPinyin` to hide pinyin. |
| `fill` | Choose the word for the `___` gap. |
| `tones` | Pick the tone of each syllable (answers come from the dictionary). |
| `pinyin` | Type the pinyin; `listen: true` makes it a dictation. |
| `order` | Build the sentence from tiles (`zh: 我 是 学生`, `extra`, `also`). |
| `match` | Pairs; `listen: true` plays the left side. |
| `sort` | Deal items into buckets: `items: [[text, bucket], …]`. |
| `scene` | A conversation with choices; wrong options need an in-character `reply`. |
| `story` | Graded reader: paragraphs (`zh`, `en`) and comprehension `questions`. |
| `write` | Stroke-order writing for `chars`. |
| `speak` | The tone mirror on each item. |
| `roleplay`, `compose` | Optional AI partner (needs the learner's API key). |

Quote YAML strings that contain `: ` or commas inside list items.

## Style

British English. Warm, direct, a little playful; explain the *why* of grammar with short,
concrete examples; put the first working example before any history. Keep each `##` section
5–10 minutes, ending in something the learner does.

## After editing

Run `npm run audio:texts` to refresh the clip list (and `npm run audio` to record new clips), and
`sh scripts/refresh.sh …` if you used new characters. `npm test` checks compilation, exercises,
readings, glyphs, stroke data and HSK coverage.
