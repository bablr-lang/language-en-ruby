import { spam as m } from '@bablr/boot';
import { defineAttribute, eat, eatMatch, o } from '@bablr/helpers/grammar';
import { CoveredBy, Node, UndefinedAttributes } from '@bablr/helpers/decorators';

export const mixin = (Base) =>
  class RubyFunctionGrammar extends Base {
    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @Node
    *NewExpression({ props: { power } }) {
      yield eat(m`sigilToken: <*Keyword 'new' />`);
      yield eat(m`callee+$: <_Expression />`, o({ power: 4 }));
      let p = yield power >= 4
        ? eatMatch(m`openArgumentsToken: <*Punctuator '(' { balanced: ')' } />`)
        : eat(m`openArgumentsToken: <*Punctuator '(' { balanced: ')' } />`);
      if (p) {
        yield eat(
          m`arguments[]: <__List />`,
          o({
            element: m`<Identifier />`,
            allowTrailingSeparator: false,
            separator: m`separatorTokens[]: <*Punctuator ',' />`,
          }),
        );
        yield eat(m`closeArgumentsToken: <*Punctuator ')' { balancer: true } />`);
        yield defineAttribute('power', 2);
      } else {
        yield eat(m`arguments[]: []`);
        yield eat(m`separatorTokens[]: []`);
        yield eat(m`closeArgumentsToken: null`);
        yield defineAttribute('power', 4);
      }
    }
  };
