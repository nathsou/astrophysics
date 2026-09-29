// Syntax-highlighting themes for the "Almanac" design (see global.css).
// Every token colour is at least 4.5:1 on the code-block panel (--pn) of its theme.
// Light panel #ebe2cd, dark panel #221f16.

const scopes = (palette) => [
  { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: palette.comment, fontStyle: 'italic' } },
  { scope: ['keyword', 'storage', 'storage.type', 'keyword.control', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical.python'], settings: { foreground: palette.keyword } },
  { scope: ['string', 'string.quoted', 'punctuation.definition.string'], settings: { foreground: palette.string } },
  { scope: ['constant.numeric', 'constant.language', 'constant.character', 'support.constant', 'variable.other.constant'], settings: { foreground: palette.number } },
  { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'variable.function'], settings: { foreground: palette.func } },
  { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'storage.type.wgsl', 'entity.name.type.wgsl', 'meta.type'], settings: { foreground: palette.type } },
  { scope: ['entity.name.tag', 'meta.attribute', 'entity.other.attribute-name', 'meta.decorator', 'storage.modifier.attribute', 'variable.annotation'], settings: { foreground: palette.attr } },
  { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: palette.punct } },
  { scope: ['variable', 'variable.parameter', 'variable.other', 'meta.definition.variable'], settings: { foreground: palette.fg } },
  { scope: ['variable.language', 'support.variable', 'variable.other.property', 'meta.object-literal.key'], settings: { foreground: palette.prop } },
];

export const almanacLight = {
  name: 'almanac-light',
  type: 'light',
  colors: { 'editor.background': '#ebe2cd', 'editor.foreground': '#2a2418' },
  tokenColors: scopes({
    fg: '#2a2418', comment: '#6a5f4b', keyword: '#a3491f', string: '#4d6a1c', number: '#7b3f96',
    func: '#1f5f82', type: '#8a5200', attr: '#8e3b63', punct: '#5a4f3c', prop: '#1f5f82',
  }),
};

export const almanacDark = {
  name: 'almanac-dark',
  type: 'dark',
  colors: { 'editor.background': '#221f16', 'editor.foreground': '#efe6d0' },
  tokenColors: scopes({
    fg: '#efe6d0', comment: '#9a8f76', keyword: '#e0a15c', string: '#a9c774', number: '#d9a0e6',
    func: '#7fb4d6', type: '#e6c87a', attr: '#d98aa8', punct: '#b5aa90', prop: '#7fb4d6',
  }),
};
