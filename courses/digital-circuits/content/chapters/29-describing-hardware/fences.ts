/** Fenced code blocks of a Markdown text, for the chapter's tests. */
export interface Block {
  meta: string;
  code: string;
  line: number;
}

export function fencedBlocks(text: string, lang: string): Block[] {
  const blocks: Block[] = [];
  const re = /^```(\w+)([^\n]*)\n([\s\S]*?)\n```$/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1] === lang) blocks.push({ meta: m[2]!.trim(), code: m[3]! + '\n', line: text.slice(0, m.index).split('\n').length });
  }
  return blocks;
}

