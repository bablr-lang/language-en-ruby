import { spam as m } from '@bablr/boot';
import { eat, eatMatch, o, shiftMatch, fail } from '@bablr/helpers/grammar';
import { triviaEnhancer } from '@bablr/helpers/trivia';
import * as productions from '@bablr/helpers/productions';
import { mixin as functionMixin } from './mixins/function.js';
import { mixin as statementMixin } from './mixins/statement.js';
import { mixin as callMixin } from './mixins/call.js';
import { mixin as literalMixin } from './mixins/literals.js';

export const canonicalURL = 'https://bablr.org/languages/universe/ruby';

export const defaultMatcher = m`.+: <_Expression />`;

let reservedWords = new Set([
  'BEGIN',
  'class',
  'ensure',
  'nil',
  'self',
  'when',
  'END',
  'def',
  'false',
  'not',
  'super',
  'while',
  'true',
  'begin',
  'else',
  'in',
  'rescue',
  'ndef',
  'break',
  'elsif',
  'module',
  'retry',
  'unless',
  'case',
  'end',
  'next',
  'return',
  'until',
]);

export const atrivialGrammar = class RubyGrammar extends literalMixin(
  functionMixin(statementMixin(callMixin(Object))),
) {
  constructor() {
    super(),
    this.emptyables = new Set(['Program', 'Optional', 'List']);
  }

  *[Symbol.for('@bablr/fragment')]({ props: { rootMatcher } }) {
    // needed for the trivia plugin
    yield eat(rootMatcher);
  }

    *Program() {
    yield eat(m`statements[]: <__Statements />`);
  }

  *Expression({ props: { power = 34 }, s }) {
    let res;
    if (!s.holding) {
      if ((res = yield eatMatch(m`<_LiteralExpression />`))) {
      } else if (power >= 4 && (res = yield eatMatch(m`<UnaryCall /|\+|!|~|/ />`))) {
      } else if (power >= 4 && (res = yield eatMatch(m`<NewExpression 'new' />`, o({ power })))) {
      } else if ((res = yield eatMatch(m`<Identifier />`))) {
      }
    } else {
      res = yield eatMatch(m`<__Call />`, o({ power }));
    }
    if (res) {
      return shiftMatch(m`<_Expression />`, o({ power }));
    }
  }

  *Identifier({ ctx }) {
    let id = ctx.sourceTextFor((yield eat(m`value: <*Literal /[a-zA-Z_$][a-zA-Z\d_$]*/ />`)).node);
    if (reservedWords.has(id)) yield fail();
  }

  List(args) { return productions.List(args) }

  Keyword(args) { return productions.Keyword(args) }

  Literal(args) { return productions.Literal(args) }

  Punctuator(args) { return productions.Punctuator(args) }

  Any(args) { return productions.Any(args) }

  Space(args) { return productions.Space(args) }

  All(args) { return productions.All(args) }

  Optional(args) { return productions.Optional(args) }
};

export const grammar = triviaEnhancer(
  {
    triviaIsAllowed: (s) => s.span === 'Bare',
    triviaMatcher: m`#: <*_Space /[ \t]/ />`,
  },
  atrivialGrammar,
);
