/**
 * The optional Socratic tutor: sends the learner's attempt (and the course's model proof, which
 * the tutor must not reveal) to Claude and streams back feedback.
 */
import { tutorSettings } from './settings.svelte';

export interface TutorRequest {
  mode: 'feedback' | 'hint';
  statement: string;
  attempt: string;
  /** The course's model proof (plain text/Markdown) — for the tutor's eyes only. */
  solution?: string;
  rubric?: string[];
  context?: string;
}

const SYSTEM = `You are the tutor in "Proofcraft", an interactive course that teaches people to find and write mathematical proofs by rebuilding great theorems.

Your job is to help the learner improve *their own* proof, never to replace it.
- Read their attempt carefully. Name what is right before what is wrong.
- Find the first genuine gap or error, if any: a step that does not follow, a hidden assumption, a case not covered, a quantifier in the wrong order, a circular argument. Quote or point to it precisely.
- Ask one guiding question or give one concrete nudge that lets them fix it themselves. Do not write the corrected proof, even partially, unless they explicitly ask for it.
- If the proof is correct and complete, say so plainly, then suggest at most one improvement in clarity or style.
- You may be given the course's model proof. Use it only to judge the attempt; there are often other valid proofs, so accept any correct argument. Never reveal or paraphrase the model proof.
- Be brief: at most about 150 words. Use British English. Write maths in LaTeX between single dollar signs, e.g. $\\sqrt{2}$.`;

function userMessage(r: TutorRequest): string {
  const parts = [`Theorem to prove:\n${r.statement}`];
  if (r.context) parts.push(`Context from the course:\n${r.context}`);
  if (r.solution) parts.push(`Model proof (confidential, for judging only):\n${r.solution}`);
  if (r.rubric?.length) parts.push(`What a complete proof needs:\n${r.rubric.map((x) => `- ${x}`).join('\n')}`);
  parts.push(r.attempt.trim() ? `The learner's attempt:\n${r.attempt}` : `The learner has not written anything yet.`);
  parts.push(
    r.mode === 'hint'
      ? 'The learner asks for a hint for the next step. Give the smallest useful nudge, based on where their attempt currently stands.'
      : 'The learner asks for feedback on their attempt.',
  );
  return parts.join('\n\n');
}

export class TutorError extends Error {}

/** Stream a reply; calls onText with each new chunk and resolves with the full text. */
export async function askTutor(req: TutorRequest, onText: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
  tutorSettings.load();
  if (!tutorSettings.apiKey) throw new TutorError('Add your Anthropic API key in the tutor settings first.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: tutorSettings.apiKey, dangerouslyAllowBrowser: true });
  try {
    const stream = client.beta.messages.stream(
      {
        model: tutorSettings.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        messages: [{ role: 'user', content: userMessage(req) }],
      },
      { signal },
    );
    stream.on('text', (t) => onText(t));
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new TutorError('The tutor declined to answer this request.');
    return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new TutorError('The API key was rejected. Check it in the tutor settings.');
    if (e instanceof Anthropic.RateLimitError) throw new TutorError('Rate limited — wait a moment and try again.');
    if (e instanceof Anthropic.APIUserAbortError) throw new TutorError('Stopped.');
    if (e instanceof Anthropic.APIError) throw new TutorError(`The API returned an error${e.status ? ` (${e.status})` : ''}: ${e.message}`);
    throw new TutorError(e instanceof Error ? e.message : String(e));
  }
}
