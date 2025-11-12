import { re, spam as m } from '@bablr/boot';
import { eat, match, eatMatch, fail, o, defineAttribute } from '@bablr/helpers/grammar';
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
    constructor() {
      super();
      this.emptyables = new Set([
        ...(this.emptyables || []),
        'StringContent',
      ]);
    }

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

    *True() {
      yield eat(m`sigilToken: <*Keyword 'true' />`);
    }

    *False() {
      yield eat(m`sigilToken: <*Keyword 'false' />`);
    }

    *Nil() {
      yield eat(m`sigilToken: <*Keyword 'nil' />`);
    }

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

    *Property() {
      yield eat(m`key$: <Identifier />`);
      yield eat(m`mapOperator: <*Punctuator ':' />`);
      yield eat(m`value+$: <_Expression />`, o({ power: 16 }));
    }

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

    *EscapeSequence({ state: { span }, ctx }) {
      if (!span.startsWith('String')) {
        yield fail();
      }

      yield eat(m`escape: <*Punctuator '\\' { openSpan: 'Escape' } />`);

      let res;
      let cooked;

      if (
        (res =
          span === 'String:Single' ? yield match(re`/[\\/nrt0']/`) : yield match(re`/[\\/nrt0"]/`))
      ) {
        const res_ = ctx.sourceTextFor(res);
        yield eat(m`code: <*Keyword ${buildString(res_)} { closeSpan: 'Escape' } />`);
        cooked = escapables.get(res_) || res_;
      } else {
        let code = yield eat(m`code: <EscapeCode { closeSpan: 'Escape' } />`);

        cooked = String.fromCodePoint(parseInt(ctx.sourceTextFor(code.node.get('value')), 16));
      }

      yield defineAttribute('cooked', cooked);
    }

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

    *Infinity() {
      yield eat(m`sigilToken: <*Keyword 'Infinity' />`);
    }

    *Integer({ props: { noDoubleZero = false }, ctx }) {
      let firstDigit = ctx.sourceTextFor(yield eat(re`/\d/`));

      if (!noDoubleZero || firstDigit.value !== '0') {
        yield eatMatch(re`/\d+/`);
      }
    }

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
