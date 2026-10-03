# Mandarin course audit — 3 October 2026

The audit covers all 23 lessons, home, settings, the word list, placement, active review and
mock-exam screens, and all 11 practice tools. Browser checks use a 1440px desktop, 375px mobile,
375px mobile in dark mode, and a 320px narrow screen. Short 300px-high screens are also checked
for word-card access. The production static build is used for browser tests.

## Fixed issues

| Finding | Change |
| --- | --- |
| Normal and slow playback looked like duplicate speaker buttons; both lit up for one word. | Slow playback has a visible **Slow** label; active state also checks playback speed. |
| Prose list margins shifted vocabulary-grid rows and leaked into component lists. | Native Markdown lists are marked separately; component styles take precedence. Word rows have zero margins and consistent minimum heights. |
| Word cards could extend below a short screen, had no visible dismissal control, and ran pinyin syllables together. | Clamp cards inside the viewport, allow internal scrolling, add a close button with focus return, and separate syllables. |
| A queued scroll event could dismiss a just-opened word card on touch layouts. | Close on scroll only when the originating word has moved; check both queued and real scrolls. |
| The toolbar overflowed every page at 320px. Icon-only tool links lacked clear accessible names. | Compact narrow-screen spacing and add explicit link names. |
| Matching and sorting answers contained nested word-card controls. | Answer text is non-interactive inside the enclosing button. |
| Cancelling browser speech could leave an awaited playback promise unresolved; failed clips did not fall back to speech. | Settle playback on cancellation and fall back to a Chinese voice after clip errors. |
| Quickly stopping and restarting word lists/dialogues could resume an older playback loop. | Guard sequences with generation IDs and cancel them on destruction. |
| Off-screen lesson exercises queued audio on page load and could interrupt a word card; delayed prompts could outlive newer playback. | Start lesson exercises silently, replay after advancing, and cancel delayed prompts on newer playback or navigation. |
| Lesson navigation could preserve local exercise state and a stale word card. | Key lesson content by slug; close word cards and stop speech on navigation. |
| Typing numbered pinyin in the teacher chat could answer a running practice game. | Game shortcuts ignore text input, composition events, dialogs and already-handled keys. |
| A pending microphone permission could outlive the tone mirror. | Stop late-granted tracks and ignore results from discarded recordings. |
| Sentence feedback stayed visible after editing; a restarted roleplay could receive an old review. | Invalidate sentence feedback on edit and bind asynchronous roleplay results to the current run. |
| Provider controls had ambiguous accessible labels. | Give provider and key fields explicit names. |

## Added AI support

Anthropic, OpenAI and OpenRouter keep separate keys and model IDs. Existing Anthropic-only
settings migrate automatically. Exports omit all credentials; restoration preserves this
device's keys. Requests use standard text endpoints with cancellation, a one-minute timeout,
and useful authentication, credit, rate-limit and invalid-reply errors.

The global teacher has separate course-question and Mandarin-conversation histories. Its
context includes the current lesson source and section, course outline, learner level,
self-reviewed lessons and studied words. Mandarin replies show the course's normal pinyin,
translations and a short coaching suggestion. The keyboard inserts tone marks and looks up
dictionary words from plain, marked or numbered pinyin. Device IMEs continue to work.

## Verification and limits

- `npm test`: library, content, HSK coverage, provider migration/requests, teacher context,
  keyboard, word-card positioning and cancelled microphone access.
- `npm run check`: no Svelte or TypeScript errors or warnings.
- `npm run build`: the complete static course builds successfully.
- `npm run test:browser`: every lesson and tool page, all practice tools, active review and
  mock exams, word-card geometry/focus, normal/slow playback, teacher context/navigation,
  pinyin/character insertion, IME handling, cancellation/retry, game shortcuts, provider
  switching, credential-free backups and stale-feedback/restart cases across four layouts.
- Browser checks run in the Mandarin GitHub Actions workflow, with traces retained locally
  on failure.

AI network requests are mocked in regression tests; no paid live-provider calls were made.
Audio cancellation is checked with a browser speech stub. Actual pronunciation quality and
microphone hardware vary by device; this audit does not replace linguistic review of every
recorded clip or a real-device microphone trial. Teacher chat stays in memory until reload,
and its answers can be mistaken. Other lessons are represented by their outline summaries
unless they are currently open.
