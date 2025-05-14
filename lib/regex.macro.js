import { re, spam as m } from '@bablr/boot';
import {
  Node,
  CoveredBy,
  InjectFrom,
  UndefinedAttributes,
  AllowEmpty,
} from '@bablr/helpers/decorators';
import objectEntries from 'iter-tools-es/methods/object-entries';
import * as Shared from '@bablr/helpers/productions';
import {
  eat,
  eatMatch,
  match,
  holdForMatch,
  guard,
  defineAttribute,
  fail,
} from '@bablr/helpers/grammar';
import { buildString, buildBoolean } from '@bablr/helpers/builders';

export const canonicalURL = 'https://bablr.org/languages/core/universe/es3-regex-pattern';

export const dependencies = {};

const escapables = new Map(
  objectEntries({
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
  }),
);

const flagCharacters = {
  global: 'g',
  ignoreCase: 'i',
  multiline: 'm',
};

const unique = (flags) => flags.length === new Set(flags).size;

const getSpecialPattern = (span) => {
  if (span === 'Pattern') {
    return re`/[*+{}[\]().^$|\n\\]/`;
  } else if (span === 'CharacterClass') {
    return re`/[\]\\]/`;
  } else {
    throw new Error('unknown span type for special pattern');
  }
};

export const grammar = class RegexGrammar {
  @Node
  *Pattern() {
    yield eat(m`openToken: <*Punctuator '/' { balanced: '/', balancedSpan: 'Pattern' } />`);
    yield eat(m`<Alternatives />`);
    yield eat(m`closeToken: <*Punctuator '/' { balancer: true } />`);
    yield eat(m`flags$: <Flags />`);
  }

  @UndefinedAttributes(Object.keys(flagCharacters))
  @AllowEmpty
  @Node
  *Flags({ ctx }) {
    const flags = yield match(re`/[gim]+/`);

    const flagsStr = ctx.sourceTextFor(flags) || '';

    if (flagsStr && !unique(flagsStr)) throw new Error('flags must be unique');

    for (const { 0: name, 1: chr } of Object.entries(flagCharacters)) {
      if (flagsStr.includes(chr)) {
        yield defineAttribute(name, true);
      } else {
        yield defineAttribute(name, false);
      }
    }

    for (const flagChr of flagsStr) {
      yield eat(m`tokens[]: <*Keyword ${buildString(flagChr)} />`);
    }
  }

  @AllowEmpty
  *Alternatives() {
    do {
      yield eat(m`alternatives[]$: <Alternative />`);
    } while (yield eatMatch(m`separatorTokens[]: <*Punctuator '|' />`));
  }

  @AllowEmpty
  @Node
  *Alternative() {
    yield eat(m`elements[]$: <Elements />`);
  }

  @AllowEmpty
  *Elements() {
    yield eat(m`.[]+: []`);
    while (yield match(re`/[^|]/`)) {
      yield eat(m`.[]+: <__Element />`);
    }
  }

  *Element() {
    yield guard(m`<*Keyword /[*+?]/ />`);

    yield eat(m`<_Any />`, [
      m`<CharacterClass '[' />`,
      m`<Group '(?:' />`,
      m`<Assertion /[$^]|\\b/i />`,
      m`<CharacterSet /\.|\\[dswp]/i />`,
      m`<Character />`,
    ]);

    if (yield match(re`/[*+?{]/`)) {
      return holdForMatch(m`<Quantifier />`);
    }
  }

  @CoveredBy('Element')
  @Node
  *Group() {
    yield eat(m`openToken: <*Punctuator '(?:' { balanced: ')' } />`);
    yield eat(m`<Alternatives />`);
    yield eat(m`closeToken: <*Punctuator ')' { balancer: true } />`);
  }

  @Node
  *CapturingGroup() {
    yield eat(m`openToken: <*Punctuator '(' { balanced: ')' } />`);
    yield eat(m`<Alternatives />`);
    yield eat(m`closeToken: <*Punctuator ')' { balancer: true } />`);
  }

  @UndefinedAttributes('negate')
  @Node
  *LookaheadGroup() {
    yield eat(m`openToken: <*Punctuator '(?' { balanced: ')' } />`);
    yield eat(m`negateToken: <*Punctuator /[!=]/ />`);
    yield eat(m`<Alternatives />`);
    yield eat(m`closeToken: <*Punctuator ')' { balancer: true } />`);
  }

  @CoveredBy('Element')
  *Assertion() {
    yield eat(m`<_Any />`, [
      m`<*StartOfInputAssertion '^' />`,
      m`<*EndOfInputAssertion '$' />`,
      m`<*WordBoundaryAssertion /\\b/i />`,
    ]);
  }

  @CoveredBy('Assertion')
  @Node
  *StartOfInputAssertion() {
    yield eat(m`sigilToken: <*Keyword '^' />`);
  }

  @CoveredBy('Assertion')
  @Node
  *EndOfInputAssertion() {
    yield eatMatch(m`sigilToken: <*Keyword '$' />`);
  }

  @UndefinedAttributes(['negate'])
  @CoveredBy('Assertion')
  @Node
  *WordBoundaryAssertion({ ctx }) {
    yield eatMatch(m`escapeToken: <*Punctuator '\\' />`);
    const m_ = yield eat(m`value: <*Keyword /b/i />`);
    yield defineAttribute('negate', buildBoolean(ctx.sourceTextFor(m_) === 'B'));
  }

  @CoveredBy('Element')
  @CoveredBy('CharacterClassElement')
  @Node
  *Character() {
    yield eat(m`value: <*Literal />`);
  }

  @Node
  *Literal() {
    if (yield match('\\')) {
      yield eat(m`@: <EscapeSequence />`);
    } else {
      yield eat(re`/[^\r\n\t]/`);
    }
  }

  @UndefinedAttributes(['negate'])
  @CoveredBy('Element')
  @Node
  *CharacterClass() {
    yield eat(m`openToken: <*Punctuator '[' { balancedSpan: 'CharacterClass', balanced: ']' } />`);

    let negate = yield eatMatch(m`negateToken: <*Keyword '^' />`);

    yield defineAttribute('negate', !!negate);

    while (yield match(re`/./s`)) {
      yield eat(m`elements[]+$: <CharacterClassElement />`);
    }

    yield eat(m`closeToken: <*Punctuator ']' { balancer: true } />`);
  }

  *CharacterClassElement() {
    yield eat(m`<_Any />`, [m`<CharacterSet /\\[dswp]/i />`, m`<Gap '\\g' />`, m`<*Character />`]);

    if (yield match('-')) {
      return holdForMatch(m`<CharacterClassRange />`);
    }
  }

  @CoveredBy('CharacterClassElement')
  @Node
  *CharacterClassRange() {
    yield eat(m`min+$: <*Character />`);
    yield eat(m`sigilToken: <*Punctuator '-' />`);
    yield eat(m`max+$: <*Character />`);
  }

  @CoveredBy('Element')
  *CharacterSet() {
    yield eat(m`<_Any />`, [
      m`<AnyCharacterSet '.' />`,
      m`<DigitCharacterSet /\\[dD]/  />`,
      m`<SpaceCharacterSet /\\[sS]/  />`,
      m`<WordCharacterSet /\\[wW]/  />`,
    ]);
  }

  @CoveredBy('CharacterSet')
  @Node
  *AnyCharacterSet() {
    yield eat(m`sigilToken: <*Keyword '.' />`);
  }

  @UndefinedAttributes(['negate'])
  @CoveredBy('CharacterSet')
  @Node
  *DigitCharacterSet({ ctx }) {
    yield eat(m`escapeToken: <*Punctuator '\\' />`);

    let code = yield eat(m`value: <*Keyword /[dD]/ />`);

    yield defineAttribute('negate', buildBoolean(ctx.sourceTextFor(code) === 'D'));
  }

  @UndefinedAttributes(['negate'])
  @CoveredBy('CharacterSet')
  @Node
  *SpaceCharacterSet({ ctx }) {
    yield eat(m`escapeToken: <*Punctuator '\\' />`);

    let code = yield eat(m`value: <*Keyword /[sS]/ />`);

    yield defineAttribute('negate', buildBoolean(ctx.sourceTextFor(code) === 'S'));
  }

  @UndefinedAttributes(['negate'])
  @CoveredBy('CharacterSet')
  @Node
  *WordCharacterSet({ ctx }) {
    yield eat(m`escapeToken: <*Punctuator '\\' />`);

    let code = yield eat(m`value: <*Keyword /[wW]/ />`);

    yield defineAttribute('negate', ctx.sourceTextFor(code) === 'W');
  }

  @UndefinedAttributes(['min', 'max'])
  @Node
  *Quantifier({ ctx }) {
    yield eat(m`element+$: <Element />`);

    let attrs, sigil;

    if ((sigil = yield eatMatch(m`sigilToken: <*Keyword /[*+?]/ />`))) {
      switch (ctx.sourceTextFor(sigil)) {
        case '*':
          attrs = { min: 0, max: Infinity };
          break;
        case '+':
          attrs = { min: 1, max: Infinity };
          break;
        case '?':
          attrs = { min: 0, max: 1 };
          break;
      }
    } else if (yield eat(m`openToken: <*Punctuator '{' { balanced: '}' } />`)) {
      let max;
      let min = yield eat(m`min$: <*UnsignedInteger />`);

      if (yield eatMatch(m`separator: <*Punctuator ',' />`)) {
        max = yield eatMatch(m`max$: <*UnsignedInteger />`);
      }

      min = min && ctx.sourceTextFor(min);
      max = max && ctx.sourceTextFor(max);

      min = min && parseInt(min, 10);
      max = max && parseInt(max, 10);

      attrs = { min, max };

      yield eat(m`closeToken: <*Punctuator '}' { balancer: true } />`);
    }

    yield defineAttribute('min', attrs.min);
    yield defineAttribute('max', attrs.max);
  }

  @Node
  *UnsignedInteger() {
    yield eat(re`/\d+/`);
  }

  @Node
  *EscapeSequence({ state, ctx }) {
    const parentSpan = state.span;

    yield eat(m`escape: <*Punctuator '\\' { openSpan: 'Escape' } />`);

    let m_;

    let cooked;

    if ((m_ = yield match(re`/[\\/fnrtv]/`))) {
      const match_ = ctx.sourceTextFor(m_);
      yield eat(m`code: <*Keyword ${buildString(match_)} { closeSpan: 'Escape' } />`);
      cooked = escapables.get(match_);
    } else if ((m_ = yield match(getSpecialPattern(parentSpan)))) {
      const match_ = ctx.sourceTextFor(m_);
      yield eat(m`code: <*Keyword ${buildString(match_)} { closeSpan: 'Escape' } />`);
      cooked = match_;
    } else if (yield match('x')) {
      let code = yield eat(m`code: <EscapeCode { closeSpan: 'Escape' } />`);

      cooked = String.fromCodePoint(parseInt(ctx.sourceTextFor(code.get('value')), 16));
    } else {
      yield fail();
    }

    yield defineAttribute('cooked', cooked);
  }

  @Node
  *EscapeCode() {
    if (yield eatMatch(m`type: <*Keyword 'x' />`)) {
      yield eat(m`openToken: null`);
      yield eat(m`value$: <*UnsignedInteger /\d{2}/ />`);
      yield eat(m`closeToken: null`);
    }
  }

  *Digits() {
    while (yield eatMatch(m`<*Digit />`));
  }

  @Node
  *Digit() {
    yield eat(re`/\d/`);
  }

  @InjectFrom(Shared)
  *Any() {}

  @Node
  @InjectFrom(Shared)
  *Keyword() {}

  @Node
  @InjectFrom(Shared)
  *Punctuator() {}
};
