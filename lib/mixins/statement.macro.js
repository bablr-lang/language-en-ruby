import { re, spam as m } from '@bablr/boot';
import { eat, match, eatMatch, fail, o } from '@bablr/helpers/grammar';
import { AllowEmpty, CoveredBy, InjectFrom, Node } from '@bablr/helpers/decorators';
import * as productions from '@bablr/helpers/productions';
import { ReferenceTag } from '@bablr/agast-helpers/symbols';

export const mixin = (Base) =>
  class RubyStatementGrammar extends Base {
    @AllowEmpty
    *StatementList({ ctx, s }) {
      let stmt, trivia, newline;
      while (yield match(re`/./s`)) {
        stmt = yield eat(m`<__Statement />`);
        if (
          s.resultPath?.previousSibling.tag.type === ReferenceTag &&
          s.resultPath?.previousSibling.tag.value.type === '#'
        ) {
          trivia = s.resultPath.inner;
        } else {
          trivia = yield eatMatch(m`#: <_Space /[\n\r;]/ />`);
        }
        newline = trivia && ctx.sourceTextFor(trivia).includes('\n');

        if (!(stmt.get('endToken') || newline)) break;
      }
    }

    @CoveredBy('Statement')
    @AllowEmpty
    @Node
    *ExpressionStatement() {
      yield eat(m`expression+: <__Expression />`);
    }

    @CoveredBy('Statement')
    @Node
    *FunctionStatement() {
      yield eat(m`sigilToken: <*Keyword 'function' />`);
      yield eat(m`id: <Identifier />`);
      yield eat(m`openArgumentsToken: <*Punctuator '(' { balanced: ')' } />`);
      yield eat(
        m`params[]: <_List />`,
        o({
          element: m`<Identifier />`,
          allowTrailingSeparator: false,
          separator: m`separatorTokens[]: <*Punctuator ',' />`,
        }),
      );
      yield eat(m`closeArgumentsToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`body: <BlockStatement />`);
    }

    @CoveredBy('Statement')
    @Node
    *ReturnStatement() {
      yield eat(m`sigilToken: <*Keyword 'return' />`);
      yield eat(m`expression+$: <__Expression />`);
    }

    @CoveredBy('Statement')
    @Node
    *ThrowStatement() {
      yield eat(m`sigilToken: <*Keyword 'throw' />`);
      yield eat(m`expression+$: <__Expression />`);
    }

    @CoveredBy('Statement')
    @Node
    *VariableDeclarationStatement() {
      yield eat(m`sigilToken: <*Keyword 'var' />`);
      yield eat(m`declarations[]: <VariableDeclarator />`);
      yield eat(
        m`declarations[]: <_List />`,
        o({
          element: m`<VariableDeclarator />`,
          allowTrailingSeparator: false,
          separator: m`separatorTokens[]: <*Punctuator ',' />`,
        }),
      );
    }

    @Node
    *VariableDeclarator() {
      yield eat(m`id: <Identifier />`);
      yield eat(m`sigilToken: <*Punctuator '=' />`);
      yield eat(m`init: <*Statement />`);
    }

    @AllowEmpty
    *Statement({ props: { allowEmpty = true } }) {
      yield eat(m`<_Any />`, [
        m`<BlockStatement '{' />`,
        m`<IfStatement 'if' />`,
        m`<WhileStatement 'while' />`,
        m`<DoWhileStatement 'do' />`,
        m`<SwitchStatement 'switch' />`,
        m`<_LoopStatement 'for' />`,
        m`<FunctionStatement /function [a-zA-Z$_]/ />`,
        m`<ReturnStatement 'return' />`,
        m`<ThrowStatement 'throw' />`,
        m`<ExpressionStatement />`,
      ]);
    }

    @CoveredBy('Statement')
    @Node
    *BlockStatement() {
      yield eat(m`openToken: <*Punctuator '{' { balanced: '}' } />`);
      yield eat(m`body[]: <_StatementList />`);
      yield eat(m`closeToken: <*Punctuator '}' { balancer: true } />`);
    }

    @CoveredBy('Statement')
    @Node
    *IfStatement() {
      yield eat(m`sigilToken: <*Keyword 'if' />`);
      yield eat(m`openHeaderToken: <*Punctuator '(' { balanced: ')' } />`);
      yield eat(m`test: <__Expression />`);
      yield eat(m`closeHeaderToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`consequent: <__Statement />`, o({ allowEmpty: false }));
      if (yield eatMatch(m`alternateSigilToken: <*Keyword 'else' />`)) {
        yield eat(m`consequent: <__Statement />`, o({ allowEmpty: false }));
      } else {
        yield eat(m`alternate: null`);
      }
    }

    @CoveredBy('Statement')
    @Node
    *WhileStatement() {
      yield eat(m`sigilToken: <*Keyword 'while' />`);
      yield eat(m`openHeaderToken: <*Punctuator '(' { balanced: ')' } />`);
      yield eat(m`test+$: <__Expression />`);
      yield eat(m`closeHeaderToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`body: <__Statement />`);
    }

    @CoveredBy('Statement')
    @Node
    *DoWhileStatement() {
      yield eat(m`sigilToken: <*Keyword 'do' />`);
      yield eat(m`body: <__Statement />`);
      yield eat(m`footerSigilToken: <*Keyword 'while' />`);
      yield eat(m`openFooterToken: <*Punctuator '(' { balanced: ')' } />`);
      yield eat(m`test+$: <__Expression />`);
      yield eat(m`closeFooterToken: <*Punctuator ')' { balancer: true } />`);
    }

    @CoveredBy('Statement')
    @Node
    *SwitchStatement() {
      yield eat(m`sigilToken: <*Keyword 'switch' />`);
      yield eat(m`openDiscriminantToken: <*Punctuator '(' { balanced: ')' } />`);
      yield eat(m`discriminant+$: <__Expression />`);
      yield eat(m`closeDiscriminantToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`openCasesToken: <*Punctuator '{' { balanced: '}' } />`);
      yield eatMatch(m`cases[]: <SwitchCase /(case|default)\b/ />`);
      yield eat(m`closeCasesToken: <*Punctuator '}' { balancer: true } />`);
    }

    @Node
    *SwitchCase({ intrinsicValue, ctx }) {
      switch (ctx.sourceTextFor(intrinsicValue)) {
        case 'case':
          yield eat(m`sigilToken: <*Keyword 'case' />`);
          yield eat(m`condition+$: <__Expression />`);
          break;

        case 'default':
          yield eat(m`sigilToken: <*Keyword 'default' />`);
          yield eat(m`condition: null`);
          break;

        default:
          yield fail();
          break;
      }

      yield eat(m`bodySeparatorToken: <*Punctuator ':' />`);
      while (yield match(re`/./`)) yield eat(m`statements[]: <__Statement />`);
    }

    *LoopStatement() {
      // This might have been called ForStatement, but that name was already in use
      throw new Error('not implemented');
    }

    @CoveredBy('LoopStatement')
    @CoveredBy('Statement')
    @Node
    *ForStatement() {
      yield eat(m`sigilToken: <*Keyword 'for' />`);
      yield eat(m`openHeaderToken: <*Punctuator '(' { balanced: ')' } />`);
      if (!(yield eatMatch(m`init: <VariableDeclaration />`))) {
        yield eatMatch(m`init+$: <__Expression />`);
      }
      yield eat(m`testSeparatorToken: <*Punctuator ';' />`);
      yield eatMatch(m`test+$: <__Expression />`);
      yield eat(m`updateSeparatorToken: <*Punctuator ';' />`);
      yield eatMatch(m`update+$: <__Expression />`);
      yield eat(m`closeHeaderToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`body: <__Statement />`);
    }

    @CoveredBy('LoopStatement')
    @CoveredBy('Statement')
    @Node
    *ForInStatement() {
      yield eat(m`sigilToken: <*Keyword 'for' />`);
      yield eat(m`openHeaderToken: <*Punctuator '(' { balanced: ')' } />`);
      if (!(yield eatMatch(m`left: <VariableDeclaration />`))) {
        yield eatMatch(m`left: <__Expression />`);
      }
      yield eat(m`iterationSigilToken: <*Keyword 'in' />`);
      yield eatMatch(m`right+$: <__Expression />`);
      yield eat(m`closeHeaderToken: <*Punctuator ')' { balancer: true } />`);
      yield eat(m`body: <__Statement />`);
    }

    @CoveredBy('Statement')
    @Node
    *LabeledStatement() {
      yield eat(m`label: <Identifier />`);
      yield eat(m`sigilToken: <*Puncuator ':' />`);
      yield eat(m`body: <*Statement />`);
    }

    @CoveredBy('Statement')
    @Node
    *BreakStatement() {
      yield eat(m`sigilToken: <*Keyword 'break' />`);
      yield eatMatch(m`label: <Identifier />`);
    }

    @CoveredBy('Statement')
    @Node
    *ContinueStatement() {
      yield eat(m`sigilToken: <*Keyword 'continue' />`);
      yield eatMatch(m`label: <Identifier />`);
    }

    @Node
    @InjectFrom(productions)
    *Punctuator() {}
  };
