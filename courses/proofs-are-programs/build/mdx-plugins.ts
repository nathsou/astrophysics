// Build-time MDX plugins.
//
//  * rehypeRawKatex: KaTeX output is serialised back to an HTML string and
//    rendered with innerHTML by a single <RawHtml> component, instead of
//    thousands of tiny JSX elements.
//  * remarkCodeBlocks: fenced code blocks become <CodeBlock> components;
//    a `playground` meta turns them into live <Playground> widgets.

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
    visit(tree as any, 'code', (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined) return;
      const meta: string = node.meta ?? '';
      const opts: Record<string, string | boolean> = {};
      for (const m of meta.matchAll(/([\w-]+)(?:=("[^"]*"|\S+))?/g)) {
        opts[m[1]] = m[2] === undefined ? true : m[2].replace(/^"|"$/g, '');
      }
      const isPlayground = opts.playground === true;
      const attributes = [attr('code', node.value), attr('lang', node.lang ?? '')];
      for (const [k, v] of Object.entries(opts)) if (k !== 'playground') attributes.push(attr(k, v));
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
