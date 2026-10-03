# Project notes for Claude

"Mandarin, Out Loud", an interactive Mandarin course (beginner to HSK 2), in `courses/mandarin/`
of the Interactive Courses monorepo. Read README.md and docs/AUTHORING.md first.

- SvelteKit 2 + Svelte 5 (runes) static site, TypeScript. Output in `dist/`. Base path: BASE_PATH,
  or COURSES_BASE_PATH + /mandarin from the monorepo build.
- British English. Learners are English speakers; Chinese is simplified, pinyin with tone marks.
- Lessons: `content/lessons/*.md`, outline in `content/outline.ts`. Dictionary: `content/data/`
  (generated JSON plus hand-written `extra.ts`). Exams: `content/exams/`.
- Core libraries in `src/lib`: `zh/` (pinyin, annotate, lexicon, numbers), `audio/` (YIN pitch,
  tone classifier, speech playback, recorder), `srs/` (FSRS deck), `state/`, `tutor/` (Claude).
- Every module with logic has vitest tests. Before finishing: `npm test`, `npm run check`, and
  `npm run build` if pages or components changed.
- After content changes: `npm run audio:texts`; if new characters, `sh scripts/refresh.sh`.
