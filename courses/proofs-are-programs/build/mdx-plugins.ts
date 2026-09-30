// Build-time MDX plugins.
//
//  * rehypeRawKatex: KaTeX output is serialised back to an HTML string and
//    rendered with innerHTML by a single <RawHtml> component, instead of
//    thousands of tiny JSX elements.
//  * remarkCodeBlocks: fenced code blocks become <CodeBlock> components;
//    a `playground` meta turns them into live <Playground> widgets; widgets
//    marked `chapter` receive the chapter's earlier code as `setup`.

import { toHtml } from 'hast-util-to-html';
import { visit, SKIP } from 'unist-util-visit';

type Node = { type: string; [k: string]: any };

function attr(name: string, value: string | number | boolean): any {
  if (typeof value === 'string') return { type: 'mdxJsxAttribute', name, value };
  return {
    type: 'mdxJsxAttribute',
    name,
    value: {
      type: 'mdxJsxAttributeValueExpression',
      value: JSON.stringify(value),
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [{ type: 'ExpressionStatement', expression: { type: 'Literal', value, raw: JSON.stringify(value) } }],
        },
      },
    },
  };
}

export function rehypeRawKatex() {
  return (tree: Node) => {
    visit(tree as any, 'element', (node: any, index: number | undefined, parent: any) => {
      const cls: string[] = node.properties?.className ?? [];
      if (!parent || index === undefined) return;
      if (cls.includes('katex-display') || cls.includes('katex')) {
        const html = toHtml(node);
        const display = cls.includes('katex-display');
        parent.children[index] = {
          type: display ? 'mdxJsxFlowElement' : 'mdxJsxTextElement',
          name: 'RawHtml',
          attributes: [attr('html', html), attr('display', display)],
          children: [],
        };
        return SKIP;
      }
      return undefined;
    });
  };
}

export function remarkCodeBlocks() {
  return (tree: Node) => {
    // the lean code blocks of a chapter form one file: each block may use the definitions of the
    // blocks before it (except those marked `nocheck`, `errors` or `alone`), which travel with it
    // to the playground as `context`
    let context = '';
    const isTarget = (n: any) => n.type === 'code' || (n.type === 'mdxJsxFlowElement' && n.attributes?.some((a: any) => a.name === 'chapter'));
    visit(tree as any, isTarget, (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined) return;
      if (node.type === 'mdxJsxFlowElement') {
        // a widget marked `chapter` gets the chapter's code so far as hidden setup (before its own)
        const own = node.attributes.find((a: any) => a.name === 'setup');
        const ownSetup = typeof own?.value === 'string' ? own.value : '';
        node.attributes = node.attributes.filter((a: any) => a.name !== 'chapter' && a.name !== 'setup');
        node.attributes.push(attr('setup', context + ownSetup));
        return SKIP;
      }
      const meta: string = node.meta ?? '';
      const opts: Record<string, string | boolean> = {};
      for (const m of meta.matchAll(/([\w-]+)(?:=("[^"]*"|\S+))?/g)) {
        opts[m[1]] = m[2] === undefined ? true : m[2].replace(/^"|"$/g, '');
      }
      const isPlayground = opts.playground === true;
      const attributes = [attr('code', node.value), attr('lang', node.lang ?? '')];
      for (const [k, v] of Object.entries(opts)) if (k !== 'playground') attributes.push(attr(k, v));
      if (node.lang === 'lean' && !opts.nocheck && !opts.alone) {
        // a live block gets the earlier blocks as hidden setup; a static one carries them for "try it"
        if (context) attributes.push(attr(isPlayground ? 'setup' : 'context', context));
        if (!opts.errors) context += node.value + '\n\n';
      }
      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: isPlayground ? 'Playground' : 'CodeBlock',
        attributes,
        children: [],
      };
      return SKIP;
    });
  };
}
