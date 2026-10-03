import { afterEach, describe, it, expect, vi } from 'vitest';
import { requestReply } from './client';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create }; } }));
const call = { system: 'Teach Mandarin', messages: [{ role: 'user' as const, content: '你好' }] };
const config = { apiKey: 'example-key', model: 'custom-model' };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('tutor requests', () => {
  it.each(['openai', 'openrouter'] as const)('uses the %s endpoint, key, model and complete history', async provider => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '  你好！  ' } }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await requestReply(provider, config, call)).toBe('你好！');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer example-key');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'custom-model', messages: [{ role: 'system', content: call.system }, ...call.messages] });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('keeps Anthropic on its SDK and collects text blocks', async () => {
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '你好' }, { type: 'text', text: '！' }] });
    expect(await requestReply('anthropic', config, call)).toBe('你好！');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: config.model, system: call.system, messages: call.messages }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it.each([[401, 'key was rejected'], [402, 'needs credit'], [429, 'Rate limited'], [500, '(500)']] as const)('reports HTTP %s without exposing provider payloads', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private payload', { status })));
    await expect(requestReply('openai', config, call)).rejects.toThrow(message);
  });
  it.each([{ choices: [] }, { choices: [{ message: { content: '' } }] }, { error: { message: 'failure' } }])('rejects empty/invalid successful responses', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(requestReply('openrouter', config, call)).rejects.toThrow('empty or unsupported');
  });
  it('rejects a truncated reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'half a reply' } }] }))));
    await expect(requestReply('openai', config, call)).rejects.toThrow('cut short');
  });
  it('reports cancellation separately from connection errors', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(requestReply('openai', config, { ...call, signal: controller.signal })).rejects.toThrow('Stopped.');
    await expect(requestReply('openai', config, call)).rejects.toThrow('Could not reach');
  });
  it('requires a key for the selected provider', async () => {
    await expect(requestReply('openrouter', { ...config, apiKey: '' }, call)).rejects.toThrow('OpenRouter API key');
  });
});
