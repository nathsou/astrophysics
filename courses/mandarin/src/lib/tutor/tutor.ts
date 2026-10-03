/** Optional sentence feedback and conversations using the learner's selected AI provider. */
import { settings } from '$lib/state/settings.svelte';
import { requestReply, type TutorCall } from './client';
export { TutorError, type TutorMessage } from './client';

export async function askTutor(call: TutorCall): Promise<string> {
  settings.load();
  return requestReply(settings.data.provider, { ...settings.tutorConfig }, call);
}

/** Pull <tag>…</tag> sections out of a reply. */
export function tag(text: string, name: string): string {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text);
  return m ? m[1]!.trim() : '';
}
