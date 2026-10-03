/**
 * The optional AI tutor: a conversation partner and a sentence checker, powered by Claude with
 * the learner's own Anthropic API key (kept in this browser, sent only to api.anthropic.com).
 * Everything else in the course works without it.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { settings } from '$lib/state/settings.svelte';

export class TutorError extends Error {}

export interface TutorCall {
  system: string;
  messages: Anthropic.MessageParam[];
  effort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
}

/** One reply from Claude, as plain text. */
export async function askClaude({ system, messages, effort = 'low', signal }: TutorCall): Promise<string> {
  settings.load();
  const apiKey = settings.data.apiKey.trim();
  if (!apiKey) throw new TutorError('Add your Anthropic API key in Settings first.');
  const { default: AnthropicClient } = await import('@anthropic-ai/sdk');
  const client = new AnthropicClient({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const stream = client.beta.messages.stream(
      {
        model: settings.data.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort },
        system,
        messages,
      },
      { signal },
    );
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new TutorError('The tutor declined to answer this one.');
    return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if (e instanceof AnthropicClient.AuthenticationError) throw new TutorError('The API key was rejected. Check it in Settings.');
    if (e instanceof AnthropicClient.RateLimitError) throw new TutorError('Rate limited: wait a moment and try again.');
    if (e instanceof AnthropicClient.APIUserAbortError) throw new TutorError('Stopped.');
    if (e instanceof AnthropicClient.APIConnectionError) throw new TutorError('Could not reach the API. Check your connection.');
    if (e instanceof AnthropicClient.APIError) throw new TutorError(`The API returned an error${e.status ? ` (${e.status})` : ''}: ${e.message}`);
    throw new TutorError(e instanceof Error ? e.message : String(e));
  }
}

/** Pull <tag>…</tag> sections out of a reply. */
export function tag(text: string, name: string): string {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text);
  return m ? m[1]!.trim() : '';
}
