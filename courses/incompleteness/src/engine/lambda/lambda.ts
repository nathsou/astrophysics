// The untyped lambda calculus (part "Lambda Calculus" of the book): terms with stable node ids,
// parsing and printing, substitution with capture avoidance, α-renaming, β-reduction and
// strategies, η-reduction, reduction graphs, and the Church encodings of chapter
// "Lambda Definability". This module re-exports the pieces:
//
//   term.ts      AST, constructors, traversal, free variables, α-equivalence, fresh names
//   parse.ts     parseLambda / tryParseLambda
//   print.ts     print / toTex / printTokens
//   subst.ts     substitute / naiveSubstitute / freeFor / alphaRename
//   reduce.ts    redexes / contract / strategies / reduce / eta / reductionGraph
//   numerals.ts  churchNumeral / numeralValue / churchBoolean / booleanValue
//   defs.ts      BOOK_DEFS (Succ, Add, Mult, Exp, Pair, Fst, Snd, Pred, true, false, IsZero, Y, …)
//   church.ts    decoders and the λ-definability constructions

export * from './term.ts';
export * from './parse.ts';
export * from './print.ts';
export * from './subst.ts';
export * from './reduce.ts';
export * from './numerals.ts';
export * from './defs.ts';
export { decodeNumeral, decodeBoolean, decodePair, pair, combinator, applyNamed, projection, composition, primitiveRecursion, minimization, applyTo, type DecodeOptions } from './church.ts';
