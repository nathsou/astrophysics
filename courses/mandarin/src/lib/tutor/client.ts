import { PROVIDERS, type Provider, type TutorConfig } from './providers';
export class TutorError extends Error {}
export interface TutorMessage { role: 'user' | 'assistant'; content: string }
export interface TutorCall {
  system: string;
  messages: TutorMessage[];
  effort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
}

function statusError(status: number): TutorError {
  if (status === 401 || status === 403) return new TutorError('The API key was rejected or lacks access to this model. Check it in Settings.');
  if (status === 402) return new TutorError('Your provider account needs credit before the tutor can reply.');
  if (status === 429) return new TutorError('Rate limited: wait a moment and try again.');
  return new TutorError(`The API returned an error (${status}). Check the model in Settings and try again.`);
}

/** Text-only tutor requests go directly to the selected provider using its own key. */
export async function requestReply(provider: Provider, config: TutorConfig, call: TutorCall): Promise<string> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new TutorError(`Add your ${PROVIDERS[provider].name} API key in Settings first.`);
  const timeout = AbortSignal.timeout(60_000);
  const signal = call.signal ? AbortSignal.any([call.signal, timeout]) : timeout;
  try {
    if (provider === 'anthropic') {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
      const message = await client.messages.create({ model: config.model, max_tokens: 4096, system: call.system, messages: call.messages }, { signal });
      if (message.stop_reason === 'refusal') throw new TutorError('The tutor declined to answer this one.');
      if (message.stop_reason === 'max_tokens') throw new TutorError('The tutor reply was cut short. Try again with a shorter sentence or conversation.');
      const reply = message.content.map(b => b.type === 'text' ? b.text : '').join('').trim();
      if (!reply) throw new TutorError('The tutor returned an empty reply. Try again.');
      return reply;
    }
    const response = await fetch(provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: call.system }, ...call.messages], ...(provider === 'openai' ? { max_completion_tokens: 4096 } : { max_tokens: 4096 }) }),
      signal,
    });
    if (!response.ok) throw statusError(response.status);
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (choice?.message?.refusal) throw new TutorError('The tutor declined to answer this one.');
    if (choice?.finish_reason === 'length') throw new TutorError('The tutor reply was cut short. Try again with a shorter sentence or conversation.');
    const content = choice?.message?.content;
    const reply = typeof content === 'string' ? content.trim() : '';
    if (!reply) throw new TutorError('The tutor returned an empty or unsupported reply. Check the model in Settings.');
    return reply;
  } catch (error) {
    if (call.signal?.aborted) throw new TutorError('Stopped.');
    if (timeout.aborted) throw new TutorError('The tutor took too long to reply. Try again.');
    if (error instanceof TutorError) throw error;
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') throw statusError(error.status);
    throw new TutorError('Could not reach the API or read its reply. Check your connection and model in Settings.');
  }
}
