import { spam } from '@bablr/boot';
import { dedent } from '@qnighy/dedent';
// eslint-disable-next-line import/no-unresolved
import * as language from '@bablr/language-en-ruby';
import { buildTag, Context } from 'bablr';
import { debugEnhancers } from '@bablr/helpers/enhancers';
import { expect } from 'expect';
import { printPrettyCSTML } from '@bablr/helpers/tree';
import { buildIdentifier, buildString } from '@bablr/helpers/builders';

let enhancers = undefined;

const ctx = Context.from(language, enhancers?.bablrProduction);

const buildRbTag = (matcher) => {
  return buildTag(ctx, matcher, undefined, { enhancers });
};

const print = (tree) => {
  return printPrettyCSTML(tree.node, { ctx });
};

describe.only('@bablr/language-en-ruby', () => {
  describe('Program', () => {
    const rb = buildRbTag(spam`<$${buildString(language.canonicalURL)}:Program />`);

    it('rb`true`', () => {
      expect(print(rb`true`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Boolean>
                sigilToken: <*Keyword 'true' />
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`1+2`', () => {
      expect(print(rb`1+2`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Number>
                wholePart$: <*UnsignedInteger '1' />
                fractionalSeparatorToken: null
                fractionalPart$: null
                exponentSeparatorToken: null
                exponentPart$: null
              </>
              ^^^
              <$BinaryExpression { power: 14 }>
                left+$: <//>
                sigilToken: <*Punctuator '+' />
                right+$:
                <$Number>
                  wholePart$: <*UnsignedInteger '2' />
                  fractionalSeparatorToken: null
                  fractionalPart$: null
                  exponentSeparatorToken: null
                  exponentPart$: null
                </>
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`1*2+3`', () => {
      expect(print(rb`1*2+3`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Number>
                wholePart$: <*UnsignedInteger '1' />
                fractionalSeparatorToken: null
                fractionalPart$: null
                exponentSeparatorToken: null
                exponentPart$: null
              </>
              ^^^
              <$BinaryExpression { power: 12 }>
                left+$: <//>
                sigilToken: <*Punctuator '*' />
                right+$:
                <$Number>
                  wholePart$: <*UnsignedInteger '2' />
                  fractionalSeparatorToken: null
                  fractionalPart$: null
                  exponentSeparatorToken: null
                  exponentPart$: null
                </>
              </>
              ^^^
              <$BinaryExpression { power: 14 }>
                left+$: <//>
                sigilToken: <*Punctuator '+' />
                right+$:
                <$Number>
                  wholePart$: <*UnsignedInteger '3' />
                  fractionalSeparatorToken: null
                  fractionalPart$: null
                  exponentSeparatorToken: null
                  exponentPart$: null
                </>
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`1+2*3`', () => {
      expect(print(rb`1+2*3`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Number>
                wholePart$: <*UnsignedInteger '1' />
                fractionalSeparatorToken: null
                fractionalPart$: null
                exponentSeparatorToken: null
                exponentPart$: null
              </>
              ^^^
              <$BinaryExpression { power: 14 }>
                left+$: <//>
                sigilToken: <*Punctuator '+' />
                right+$:
                <$Number>
                  wholePart$: <*UnsignedInteger '2' />
                  fractionalSeparatorToken: null
                  fractionalPart$: null
                  exponentSeparatorToken: null
                  exponentPart$: null
                </>
                ^^^
                <$BinaryExpression { power: 12 }>
                  left+$: <//>
                  sigilToken: <*Punctuator '*' />
                  right+$:
                  <$Number>
                    wholePart$: <*UnsignedInteger '3' />
                    fractionalSeparatorToken: null
                    fractionalPart$: null
                    exponentSeparatorToken: null
                    exponentPart$: null
                  </>
                </>
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`foo.bar`', () => {
      expect(print(rb`foo.bar`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Identifier>
                value: <*Literal 'foo' />
              </>
              ^^^
              <$MemberExpression { power: 2 }>
                object+$: <//>
                sigilToken: <*Punctuator '.' />
                property+$:
                <$Identifier>
                  value: <*Literal 'bar' />
                </>
                matchingSigilToken: null
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`a[b]`', () => {
      expect(print(rb`a[b]`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Identifier>
                value: <*Literal 'a' />
              </>
              ^^^
              <$MemberExpression { power: 2 }>
                object+$: <//>
                sigilToken: <*Punctuator '[' { balanced: ']' } />
                property+$:
                <$Identifier>
                  value: <*Literal 'b' />
                </>
                matchingSigilToken: <*Punctuator ']' { balancer: true } />
              </>
            </>
          </>
        </>\n`);
    });

    it('rb`foo.bar = false`', () => {
      expect(print(rb`foo.bar = false`)).toEqual(dedent`\
        <!0:cstml { bablrLanguage: 'https://bablr.org/languages/universe/ruby' }>
        <$_>
          .:
          <$Program>
            body[]: []
            body[]:
            <$ExpressionStatement>
              expression+:
              <$Identifier>
                value: <*Literal 'foo' />
              </>
              ^^^
              <$MemberExpression { power: 2 }>
                object+$: <//>
                sigilToken: <*Punctuator '.' />
                property+$:
                <$Identifier>
                  value: <*Literal 'bar' />
                </>
                matchingSigilToken: null
              </>
              ^^^
              <$AssignmentExpression { power: 32 }>
                left+$: <//>
                #: <*Space:Space ' ' />
                sigilToken: <*Punctuator '=' />
                #: <*Space:Space ' ' />
                right+$:
                <$Boolean>
                  sigilToken: <*Keyword 'false' />
                </>
              </>
            </>
          </>
        </>\n`);
    });
  });
});
