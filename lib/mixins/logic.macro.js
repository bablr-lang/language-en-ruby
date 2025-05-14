import { getRoot } from '@bablr/agast-helpers/tree';
import {
  buildPattern,
  buildAlternative,
  buildAlternatives,
  buildElements,
} from '@bablr/helpers/builders';
import { spam as m, buildTag, re } from '@bablr/boot';
import * as regexLang from '@bablr/boot/languages/regex';
import { defineAttribute, eat, eatMatch, fail, match, o } from '@bablr/helpers/grammar';
import { UndefinedAttributes, Node, CoveredBy } from '@bablr/helpers/decorators';
import { buildEmbeddedRegex } from '@bablr/agast-vm-helpers/builders';

export const reTok_ = buildTag(regexLang, 'Pattern');

export const reTok = new Proxy(reTok_, {
  apply(tag, _, args) {
    return buildEmbeddedRegex(tag(...args));
  },
});

// 17 comma
// 16 assignment
// 15 logical OR
// 14 logical AND
// 13 bitwise OR
// 12 bitwise XOR
// 11 bitwise AND
// 10 equality
// 9 relational
// 8 bitwise shift
// 7 add/sub
// 6 mul/div
// 5 unary prefix
// 4 unary postfix
// 3 call
// 2 new
// 1 access

// problem: the concrete syntax is only right in some contexts (spans)
const escaped = {
  '\\': reTok.Character`\\`,
  '/': reTok.Character`\/`,
  '(': reTok.Character`\(`,
  ')': reTok.Character`\)`,
  '{': reTok.Character`\{`,
  '}': reTok.Character`\}`,
  '+': reTok.Character`\+`,
  '*': reTok.Character`\*`,
  '<': reTok.Character`\<`,
  '>': reTok.Character`\>`,
  '^': reTok.Character`\^`,
  '|': reTok.Character`\|`,
};

const buildOperatorPattern = (categories) =>
  buildPattern(
    buildAlternatives(
      categories.flatMap((operators) =>
        operators.map((op) =>
          buildAlternative(
            buildElements(
              [...op].map((chr) => {
                if ('\\/(){}+*^$?|<>'.includes(chr)) {
                  return getRoot(escaped[chr]);
                } else {
                  return getRoot(
                    reTok.Character({
                      raw: [chr],
                    }),
                  );
                }
              }),
            ),
          ),
        ),
      ),
    ),
  );

const assignmentOperators = [
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '<<=',
  '>>=',
  '>>>=',
  '&=',
  '^=',
  '|=',
];
const assignmentOperatorPattern = buildOperatorPattern([assignmentOperators]);

const unaryPrefixOperators = ['typeof', 'void', 'delete', '++', '--', '+', '-', '!', '~'];
const unaryPrefixOperatorPattern = buildOperatorPattern([unaryPrefixOperators]);

const unaryPostfixOperators = ['++', '--'];
const unaryPostfixOperatorPattern = buildOperatorPattern([unaryPostfixOperators]);

const binaryExpressionPowerRank = [
  ['||'],
  ['&&'],
  ['|'],
  ['^'],
  ['&'],
  ['===', '==', '!==', '!='],
  ['<=', '<', '>=', '>', 'instanceof', 'in'],
  ['>>>', '<<', '>>'],
  ['+', '-'],
  ['%', '*', '/'],
];

export const getBinaryOperatorPattern = (power) => {
  return buildOperatorPattern(binaryExpressionPowerRank.slice(Math.max(0, (30 - power) / 2 - 1)));
};

const getBinaryOperatorPower = (str) => {
  let idx = binaryExpressionPowerRank.findIndex((arr) => arr.includes(str));
  return idx >= 0 ? (15 - idx) * 2 : null;
};

export const mixin = (Base) =>
  class RubyLogicGrammar extends Base {
    *LogicExpression({ props: { power = 34 }, ctx }) {
      let res;
      if (power >= 2) {
        res = yield eatMatch(m`<MemberExpression />`, o({ power }));
      }
      if (!res && power >= 6) {
        res = yield eatMatch(m`<CallExpression />`, o({ power }));
      }
      if (!res && power >= 8) {
        res = yield eatMatch(m`<UnaryExpression />`, o({ power }));
      }
      if (!res && power >= 12) {
        res = yield eatMatch(m`<BinaryExpression />`, o({ power }));
      }
      if (!res && power >= 32) {
        if ((res = yield eatMatch(m`<AssignmentExpression />`, o({ power })))) {
        } else if ((res = yield eatMatch(m`<TernaryExpression />`, o({ power })))) {
        }
      }
      if (!res && power >= 34) {
        res = yield eatMatch(m`<CommaExpression />`, o({ power }));
      }

      const opPower = res && ctx.sourceTextFor(res.get('sigilToken'));
    }

    @UndefinedAttributes(['power', 'position'])
    @CoveredBy('Expression')
    @CoveredBy('LogicExpression')
    @Node
    *UnaryExpression({ props: { power }, s }) {
      let ownPower = 0;
      let op;
      if (!s.holding) {
        yield eatMatch(m`argument+$: null`);
        op = yield eatMatch(m`sigilToken: <*Punctuator ${unaryPrefixOperatorPattern} />`);
      }
      if (op) ownPower = 10;
      yield eat(m`argument+$: <__Expression />`, o({ power: ownPower - 2 }));

      if (!op) {
        yield eat(m`sigilToken: <*Punctuator ${unaryPostfixOperatorPattern} />`);
        ownPower = 12;
      }

      if (ownPower > power) yield fail();

      yield defineAttribute('power', ownPower);
      yield defineAttribute('position', op ? 'prefix' : 'suffix');
    }

    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @CoveredBy('LogicExpression')
    @Node
    *BinaryExpression({ props: { power }, ctx }) {
      yield eat(m`left+$: <__Expression />`, o({ power: power - 2 }));

      let op = yield eat(m`sigilToken: <*Punctuator ${getBinaryOperatorPattern(power)} />`);

      let ownPower = getBinaryOperatorPower(ctx.sourceTextFor(op));

      yield eat(m`right+$: <__Expression />`, o({ power: ownPower - 2 }));

      yield defineAttribute('power', ownPower);
    }

    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @CoveredBy('LogicExpression')
    @Node
    *AssignmentExpression() {
      let lhs = yield eat(m`left+$: <__Expression />`, o({ power: 2 }));
      yield defineAttribute('power', 32);
      if (!['MemberExpression', 'Identifier'].includes(lhs.type.description)) {
        yield fail();
      }
      yield eat(m`sigilToken: <*Punctuator ${assignmentOperatorPattern} />`);
      yield eat(m`right+$: <__Expression />`, o({ power: 30 }));
    }

    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @CoveredBy('LogicExpression')
    @Node
    *MemberExpression({ ctx }) {
      yield eat(m`object+$: <__Expression />`, o({ power: 2 }));
      yield defineAttribute('power', 2);
      let sigil = yield match(re`/[[.]/`);
      switch (ctx.sourceTextFor(sigil)) {
        case '.': {
          yield eat(m`sigilToken: <*Punctuator '.' />`);
          yield eat(m`property+$: <__Expression />`, o({ power: 2 }));
          yield eat(m`matchingSigilToken: null`);
          break;
        }
        case '[': {
          yield eat(m`sigilToken: <*Punctuator '[' { balanced: ']' } />`);
          yield eat(m`property+$: <__Expression />`);
          yield eat(m`matchingSigilToken: <*Punctuator ']' { balancer: true } />`);
          break;
        }
        default:
          yield fail();
      }
    }

    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @CoveredBy('LogicExpression')
    @Node
    *TernaryExpression() {
      yield eat(m`test+$: <__Expression />`, o({ power: 30 }));
      yield defineAttribute('power', 32);

      yield eat(m`consequentSigilToken: <*Punctuator '?' />`);
      yield eat(m`consequent+$: <__Expression />`, o({ power: 30 }));
      yield eat(m`alternateSigilToken: <*Punctuator ':' />`);
      yield eat(m`alternate+$: <__Expression />`, o({ power: 30 }));
    }

    @UndefinedAttributes(['power'])
    @CoveredBy('Expression')
    @Node
    *CommaExpression() {
      let count = 0;

      do {
        yield eatMatch(m`elements[]+$: <__Expression />`, o({ power: 32 }));
        count++;
        if (!count) {
          yield defineAttribute('power', 34);
        }
      } while (yield eatMatch(m`separatorTokens[]: <*Punctuator ',' />`));
      if (count === 1) yield fail();
    }
  };
