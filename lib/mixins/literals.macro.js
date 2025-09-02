import { re, spam as m } from '@bablr/boot';
import { eat, match, eatMatch, fail, o, defineAttribute } from '@bablr/helpers/grammar';
import { Node, CoveredBy, AllowEmpty } from '@bablr/helpers/decorators';
import { buildString } from '@bablr/helpers/builders';

export const escapables = new Map(
  Object.entries({
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    0: '\0',
    '\\': '\\',
    '/': '/',
  }),
);

export const mixin = (Base) =>
  class RubyLiteralsGrammar extends Base {
    *LiteralExpression() {
      yield eat(m`<_Any />`, [
        m`<True 'true' />`,
        m`<False 'false' />`,
        m`<Nil 'nil' />`,
        m`<Array '[' />`,
        m`<Object '{' />`,
        m`<String /['"]/ />`,
        m`<Integer /\d/ />`,
        m`<Float /[\d]+\.[\d]+/ />`,
      ]);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *True() {
      yield eat(m`sigilToken: <*Keyword 'true' />`);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *False() {
      yield eat(m`sigilToken: <*Keyword 'false' />`);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Nil() {
      yield eat(m`sigilToken: <*Keyword 'nil' />`);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Array() {
      yield eat(m`open: <*Punctuator '[' { balanced: ']' } />`);
      yield eat(
        m`elements[]+$: <__List />`,
        o({
          element: m`<_Expression />`,
          separator: m`separatorTokens[]: <*Punctuator ',' />`,
          allowTrailingSeparator: false,
        }),
      );
      yield eat(m`close: <*Punctuator ']' { balancer: true } />`);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Object() {
      yield eat(m`open: <*Punctuator '{' { balanced: '}' } />`);
      yield eat(
        m`properties[]$: <__List />`,
        o({
          element: m`<Property />`,
          separator: m`separatorTokens[]: <*Punctuator ',' />`,
          allowTrailingSeparator: false,
        }),
      );
      yield eat(m`close: <*Punctuator '}' { balancer: true } />`);
    }

    @Node
    *Property() {
      yield eat(m`key$: <Identifier />`);
      yield eat(m`mapOperator: <*Punctuator ':' />`);
      yield eat(m`value+$: <_Expression />`, o({ power: 16 }));
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *String({ ctx }) {
      let q = yield match(re`/['"]/`);

      if (!q) yield fail();

      const q_ = ctx.sourceTextFor(q);

      yield q_ === "'"
        ? eat(m`open: <*Punctuator "'" { balanced: "'", balancedSpan: 'String:Single' } />`)
        : eat(m`open: <*Punctuator '"' { balanced: '"', balancedSpan: 'String:Double' } />`);

      yield eat(m`content: <*StringContent />`);

      yield q_ === "'"
        ? eat(m`close: <*Punctuator "'" { balancer: true } />`)
        : eat(m`close: <*Punctuator '"' { balancer: true } />`);
    }

    @AllowEmpty
    @Node
    *StringContent({ state: { span } }) {
      let esc, lit;
      do {
        esc = (yield match('\\')) && (yield eat(m`@: <EscapeSequence />`));
        lit =
          span === 'String:Single'
            ? yield eatMatch(re`/[^\r\n\\']+/`)
            : yield eatMatch(re`/[^\r\n\\"]+/`);
      } while (esc || lit);
    }

    @Node
    *EscapeSequence({ state: { span }, ctx }) {
      if (!span.startsWith('String')) {
        yield fail();
      }

      yield eat(m`escape: <*Punctuator '\\' { openSpan: 'Escape' } />`);

      let match;
      let cooked;

      if (
        (match =
          span === 'String:Single' ? yield match(re`/[\\/nrt0']/`) : yield match(re`/[\\/nrt0"]/`))
      ) {
        const match_ = ctx.sourceTextFor(match);
        yield eat(m`code: <*Keyword ${buildString(match_)} { closeSpan: 'Escape' } />`);
        cooked = escapables.get(match_) || match_;
      } else {
        let code = yield eat(m`code: <EscapeCode { closeSpan: 'Escape' } />`);

        cooked = String.fromCodePoint(parseInt(ctx.sourceTextFor(code.get('value')), 16));
      }

      yield defineAttribute('cooked', cooked);
    }

    @Node
    *EscapeCode() {
      if (yield match('x')) {
        yield eatMatch(m`typeToken: <*Keyword 'x' />`);
        yield eat(m`digits[]: <Digits /\d{2}/ />`);
        yield eat(m`close: null`);
      } else if (yield match('u')) {
        yield eatMatch(m`typeToken: <*Keyword 'u' />`);
        yield eat(m`digits[]: <Digits /\d{4}/ />`);
        yield eat(m`close: null`);
      } else {
        yield fail();
      }
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Infinity() {
      yield eat(m`sigilToken: <*Keyword 'Infinity' />`);
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Integer({ props: { noDoubleZero = false }, ctx }) {
      let firstDigit = ctx.sourceTextFor(yield eat(re`/\d/`));

      if (!noDoubleZero || firstDigit.value !== '0') {
        yield eatMatch(re`/\d+/`);
      }
    }

    @CoveredBy('LiteralExpression')
    @CoveredBy('Expression')
    @Node
    *Float() {
      yield eat(m`wholePart$: <*Integer />`, o({ noDoubleZero: true }));

      let fs = yield eatMatch(
        m`fractionalSeparatorToken: <*Punctuator '.' />`,
        null,
        o({ bind: true }),
      );

      if (fs) {
        yield eat(m`fractionalPart$: <*Integer />`);
      } else {
        yield eat(m`fractionalPart$: null`);
      }
    }
  };
